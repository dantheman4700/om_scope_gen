# Frontend/Backend Alignment Report

## 1. Backend Surface Snapshot (Nov 22, 2025)

**Status:** ✅ Router registration + cookie sessions landed · ⚠️ Persistent migrations/RBAC still pending

FastAPI now mounts every router plus the in-memory job registry/vector-store wiring. Auth flows are backed by the local session service until we finish wiring the database tables and RBAC policies.

```11:68:server/api.py
from server.routes import (
    artifacts_router,
    auth_router,
    embeddings_router,
    files_router,
    om_router,
    project_runs_router,
    projects_router,
    runs_router,
    system_router,
    teams_router,
)

def create_app() -> FastAPI:
    ...
    vector_store = VectorStore(VECTOR_STORE_DSN, embedding_dim=embedding_dim)
    app.state.vector_store = vector_store
    app.state.job_registry = JobRegistry(max_workers=2, vector_store=vector_store)
    app.include_router(system_router)
    app.include_router(auth_router)
    app.include_router(projects_router)
    ...
    app.include_router(om_router)
```

### API surface

| Endpoint group | Description | Status |
| --- | --- | --- |
| `/auth/*` | Cookie-based `register`, `login`, `logout`, `me` backed by `SessionService`. | **Beta** – needs RBAC + password policies. |
| `/projects/*`, `/projects/{id}/files`, `/projects/{id}/runs` | CRUD around projects, uploads, and run orchestration via the job registry. | **Beta** – models exist but migrations are outstanding. |
| `/runs/*`, `/artifacts/*`, `/projects/{id}/embeddings` | Run history, artifact listings/downloads, manual embedding creation. | **Beta** – storage adapters wired, needs auth checks. |
| `/api/deals`, `/api/om/generate` | Legacy inline ingestion + OM generation. | **Legacy** – still synchronous and blocks worker threads. |

```89:205:server/routes/om.py
@router.post("/deals", response_model=DealImportResponse, status_code=status.HTTP_201_CREATED)
async def import_deal(...):
    ...
    VECTOR_STORE.insert_embedding(...)

@router.post("/om/generate", response_model=OMGenerateResponse)
def generate_om(...):
    ...
    rendered = TEMPLATE.render(**sections_text)
    output_path.write_text(rendered, encoding="utf-8")
    return OMGenerateResponse(...)
```

### Data models

The ORM now covers the platform scaffolding we need to replace Supabase: `users`, `teams`, `team_members`, `projects`, `project_files`, `runs`, `run_steps`, `artifacts`, plus the existing `deals/documents/embeddings` tables.

```31:330:server/db/models.py
class User(Base):
    email = mapped_column(String(320), unique=True, nullable=False, index=True)
    role = mapped_column(String(50), default="member")
    owned_projects = relationship("Project", back_populates="owner")

class Project(Base):
    name = mapped_column(String(200), nullable=False)
    files = relationship("ProjectFile", back_populates="project", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="project", cascade="all, delete-orphan")

class Run(Base):
    status = mapped_column(String(50), default="pending")
    artifacts = relationship("Artifact", back_populates="run", cascade="all, delete-orphan")
```

### Observations & gaps

1. **Migrations + seed data** are not generated yet, so the new tables exist only in ORM form.
2. **RBAC/authz**: `/auth` issues sessions but routers do not yet enforce role-based access or tenancy filters.
3. **Ingestion/jobs** still run inline inside `/api/deals`; we need the background worker plus status endpoints.
4. **Artifact delivery** is wired, but OM generation still writes to disk without exposing `/deals/{id}/oms` convenience endpoints.

## 2. Frontend Status After Supabase Prune

**Status:** ✅ Supabase client + feature-heavy pages removed · 🔜 Rebuild each screen on FastAPI APIs

Every page that depended on Supabase tables/functions/storage has been deleted. The frontend now exposes only three routes:

| Route | Current experience | Notes |
| --- | --- | --- |
| `/` | A lightweight roadmap that explains the rebuild plan and points contributors to this document. | Lives in `frontend/src/pages/Index.tsx`. |
| `/auth` | Placeholder that explains Supabase auth is gone until FastAPI `/auth` is production ready. | No forms, no client SDK. |
| `*` | Simple 404 screen. | Keeps expectations clear while routes are offline. |

Supporting directories (`components`, `hooks`, `integrations/supabase`, `supabase/functions`, `utils`, `lib`) plus assets like `hero-ma-platform.jpg` were deleted to avoid stale imports. The npm dependency graph now only includes `react`, `react-dom`, and `react-router-dom`, so future feature work starts from a clean slate.

Reintroducing listings, admin flows, and automations will happen page-by-page once the corresponding FastAPI endpoints (listings, access requests, ChipFoundry hooks, email automation, etc.) are available.

## 3. Gap Analysis Against Legacy Workflows

### Document ingestion

| Capability | FastAPI (`/api/deals`) | n8n `[DEV in DEV] Company/Deal Data Processing/Import` |
| --- | --- | --- |
| File persistence | Writes each upload to a local `inputs_dir` and records a `documents` row. | Creates the deal, writes binaries to disk, and records detailed metadata per document, including workflow IDs. |
| Format handling | Relies on `extract_text` plus Gemini fallbacks for PDFs/images. Limited insight into PPTX, XLSX, CSV. | Uses a Switch node to branch per extension, then dedicated converters (Excel, PDF, PowerPoint, DOCX, CSV) to extract text and images before chunking. |
| Chunking/embed | Inline chunking with fixed strategy and immediate pgvector insert. | Separate nodes chunk the cleaned text, then run embeddings per chunk to store with metadata and stats, updating `documents.processing_status` asynchronously. |
| Status/telemetry | Returns a summary in the HTTP response only. | Updates `documents` rows, writes processing logs/stats, and stores workflow IDs for auditing. |

```63:399:[DEV in DEV] Company_Deal Data Processing_Import.json
"Add to Deals Table/Get Deal ID" -> INSERT INTO deals (...)
"Save Files to Disk" -> writes uploaded binaries to target_dir
"Switch" -> routes XLSX/PDF/PPTX/DOCX/CSV/TXT to dedicated Code nodes
"Chunk the text" -> emits chunk_index/chunk_text for embeddings
"Update Doc Row" -> SET processing_status = 'completed', processed_at = now()
```

FastAPI lacks converters for PPTX/XLSX/CSV, has no structured logging, and cannot be polled for document states.

### OM generation

| Capability | FastAPI `/api/om/generate` | n8n `OM Generator` |
| --- | --- | --- |
| Input UX | Requires a `deal_id` and optional `attach_full_documents` flag. | Starts from a form trigger that looks up deal IDs by name/title. |
| Retrieval | Embeds templated queries (`SECTION_DEFINITIONS`) and retrieves top-12 matches per section. | Calls OpenAI embeddings per section query and uses SQL similarity search with tunable `top_k`. |
| LLM orchestration | Calls a custom `GeminiClient.generate_section` per section, renders Jinja template, saves Markdown. | Builds preview snippets, calls Gemini via LangChain, and optionally runs a secondary template-filling chain for full OM output. |
| Output delivery | Writes to filesystem only. | Returns JSON, and workflows can hand off to downstream nodes for email/slack delivery. |

```29:244:OM Generator.json
"On form submission" -> capture Deal Name
"get deal id" -> SELECT id FROM deals WHERE lower(deal_name)=...
"Get Embeddings" -> POST https://api.openai.com/v1/embeddings model=text-embedding-3-small
"Execute a SQL query1" -> pgvector similarity search per section
"Message a model" -> Gemini prompt that writes each section in Markdown
"Summarize OM" -> Recombine sections into a template with filler slots
```

N8n already encodes multi-step orchestration and templating, which the FastAPI service would need to absorb (or replace with a job runner) to serve the React client.

## 4. Backend Enhancements Required for the Frontend

1. **Platform scaffolding**: Introduce authentication/session middleware, expose the dormant routers (`projects`, `files`, `runs`, `teams`, `artifacts`, `system`), and add RBAC hooks so admin/editor dashboards can rely on the API instead of Supabase auth.
2. **Deal & listing APIs**: Build REST endpoints for listing CRUD, deal status transitions, NDA/access-request workflows, and ChipFoundry-specific automations. These should map to the Supabase tables (`listings`, `access_requests`, `listing_prospects`, `user_roles`, etc.) that the frontend currently depends on.
3. **Async ingestion service**: Move file conversion, chunking, and embedding into a background worker (Celery, Dramatiq, or FastAPI background tasks + job registry). Mirror the per-format processing n8n performs so XLSX/PPTX/CSV/TXT uploads behave identically, persist processing logs, and expose job status endpoints.
4. **Artifact & run management**: Store generated Markdown/DOCX artifacts in an object store (S3, Supabase storage, etc.) and expose download endpoints, run histories, and ability to re-run generation with different templates or section configs.
5. **Email automation & outreach**: Model sequences, enrollments, interactions, and DNS verification states; provide endpoints for the Listing Settings and Prospects screens, replacing Supabase functions (`scrape-website`, `search-trademarks`, `validate-dns`) with FastAPI services or background jobs.
6. **Shared types/SDK**: Publish a lightweight client (e.g., generated from FastAPI’s OpenAPI schema) so the React app can share DTOs with the backend instead of duplicating validation logic.
7. **Leverage existing Postgres**: Reuse and extend the local Postgres instance that already powers n8n and the current workflows. The `vectordb_schema.sql` dump shows the existing `deals`, `documents`, `embeddings`, `processing_logs`, `processing_stats`, and trigger infrastructure (pgvector, pgcrypto, uuid-ossp) that we should migrate in-place rather than standing up a new database.

## 5. Frontend Restructure + Feature Removals

### Migration strategy

- [x] **Thin Supabase UI (Nov 22)**: delete the legacy pages/components/hooks and reduce the bundle to a roadmap landing page.
- [ ] **Introduce `useOmApi()` + shared DTOs**: once FastAPI publishes the OpenAPI spec, scaffold a typed client in `frontend/src/lib/api-types.ts`.
- [ ] **Modularize admin flows**: rebuild the former `AdminCreate` experience across `/deals`, `/documents`, `/metadata`, `/assets` endpoints.
- [ ] **Server-side storage + workers**: swap direct uploads/functions invocations for backend-managed presigned uploads and job tickets.
- [x] **Retire Supabase auth (Nov 22)**: removed the Supabase client, hooks, env vars, and UI; `/auth` now documents the FastAPI plan.
- [ ] **Edge-function parity**: replace `scrape-website`, `search-trademarks`, and `validate-dns` with FastAPI services before re-adding UI triggers.

### Features to trim or defer

| Area | Action | Status |
| --- | --- | --- |
| Legacy marketing fluff (hero stats, cards, timelines) | Removed with the Supabase UI purge. | ✅ Done |
| Supabase-only telemetry panels | Keep disabled until FastAPI ships equivalent analytics endpoints. | ⏳ Blocked on backend |
| Incomplete tabs (`ProspectsManagement` placeholders) | Remove until real data exists to avoid confusing users. | ✅ Done |
| Deprecated automations (ChipFoundry auto-update, DNS validator) | Rebuild as backend services behind feature flags. | ⏳ Planned |

Documenting explicit removals keeps the React bundle lean while we rebuild around the OM APIs.

## 6. Recommended Next Steps

- [x] **Stabilize backend surface (Nov 21)** – Routers + session middleware are live; next deliverable is an exported OpenAPI spec + SDK.
- [ ] **Implement document ingestion jobs** – Port XLSX/PPTX/CSV converters, persist job records, and expose `/deals/{id}/documents` polling endpoints.
- [ ] **Model listings/access requests** – Wire FastAPI to the listings/access tables so we can rebuild the marketplace flows.
- [ ] **Expose OM artifact APIs** – Publish `/deals/{id}/oms` for listing generated Markdown/DOCX + download URLs.
- [ ] **Front-end adapter layer** – Generate shared DTOs/hooks so new React pages talk to FastAPI instead of Supabase.
- [ ] **Retire Supabase features iteratively** – Reintroduce AdminCreate/Settings/Prospects once the equivalent backend endpoints exist (in progress via placeholder UI).

## 7. Alignment Note & Current State

- **Current alignment**: The backend now exposes auth/projects/files/runs/artifacts in addition to the legacy `/api` routes, but ingestion jobs, listings APIs, and migrations remain on the backlog. The frontend has been intentionally reduced to roadmap placeholders so nobody expects Supabase-era functionality to work.
- **Goal alignment**: Converge on FastAPI + local Postgres for *all* services—auth, listings, document ingestion, OM generation, automation—and expose those capabilities through a single API + generated client the React app consumes.
- **Execution focus**: Finish database migrations + document ingestion jobs, then rebuild the key pages (listings, dashboard, admin) on top of the new API using shared DTOs and RBAC-aware hooks.

Delivering this plan will give the React app a single source of truth (the FastAPI service) and eliminate the mismatch between the legacy n8n pipelines and today’s thin API.


## 8. Implementation Progress (Nov 22, 2025)

- **Auth & sessions**: Added a cookie-based `/auth` surface (`register`, `login`, `logout`, `me`) using the existing password + session services so React can start migrating away from Supabase Auth. The new `SessionUser` dependency powers the `projects` and `teams` routers.
- **ORM coverage**: Extended `server/db/models.py` with `users`, `teams`, `team_members`, `projects`, `project_files`, `runs`, `run_steps`, and `artifacts`, giving parity with the data the React app expects (upload metadata, run history, team membership, etc.). These models mirror the schema we’ll migrate into Postgres next.
- **Router activation**: FastAPI now mounts the previously dormant routers (`/system`, `/projects`, `/teams`, `/projects/{id}/files`, `/projects/{id}/runs`, `/runs`, `/artifacts`, `/projects/{id}/embeddings`) alongside the existing `/api` OM routes. The application factory also instantiates the vector store + job registry and exposes them via `app.state`, so run orchestration and embedding endpoints can execute.
- **Frontend cleanup**: Deleted all Supabase-dependent components, hooks, utilities, functions, and assets; trimmed the router to `/`, `/auth`, and `*`; and reduced npm dependencies to `react`, `react-dom`, and `react-router-dom` for a clean rebuild baseline.

**Open follow-ups**: generate migrations for the new tables, wire RLS/RBAC on the new models, deliver document ingestion jobs, and rebuild the frontend features on top of the FastAPI API + shared types.
