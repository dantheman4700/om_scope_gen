# Frontend/Backend Alignment Report

## 1. Backend Surface Snapshot (Nov 22, 2025)

**Status:** ✅ Router registration + cookie sessions landed · ⚠️ Async ingestion + RBAC still pending

FastAPI now mounts every router plus the in-memory job registry/vector-store wiring. Auth flows are backed by the local session service until we finish wiring the database tables and RBAC policies. Everything talks to the local Postgres instance (no Supabase dependencies remain).

```11:68:server/api.py
from server.routes import (
    artifacts_router,
    auth_router,
    deals_router,
    deal_runs_router,
    embeddings_router,
    files_router,
    om_router,
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
    app.include_router(deals_router)
    ...
    app.include_router(om_router)
```

### API surface

| Endpoint group | Description | Status |
| --- | --- | --- |
| `/auth/*` | Cookie-based `register`, `login`, `logout`, `me` backed by `SessionService`. | **Beta** – needs RBAC + password policies. |
| `/deals/*` | Admin CRUD for deals (formerly “projects”), including team assignment and flags. | **Beta** – migrations/seed data outstanding. |
| `/deals/{id}/documents` | Uploads (txt/md/rst, pdf, doc/docx, ppt/pptx, common images), synchronous extraction + embeddings, summarize/toggle, delete. | **Beta** – async job queue still pending. |
| `/deals/{id}/runs`, `/runs/*`, `/deals/{id}/runs/{run_id}/artifacts`, `/deals/{id}/embeddings` | Run orchestration, artifact download, manual embedding creation. | **Beta** – needs auth checks + UI. |
| `/deals/{id}/oms`, `/deals/{id}/oms/{run_id}/download/{format}` | Lists successful runs and provides Markdown/DOCX downloads without artifact hunting. | **Beta** – format options `md` or `docx`. |
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

We are collapsing “projects” and “deals” into a single entity so there is one canonical record per opportunity. Documents/files, runs, and artifacts all hang off that unified table. Teams and RBAC will key off the merged entity as well so there is no duplicate ownership model to keep in sync.

```31:220:server/db/models.py
class Deal(Base):
    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    company_name = mapped_column(String(255), nullable=False)
    team_id = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    documents = relationship("Document", back_populates="deal", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="deal", cascade="all, delete-orphan")

class Document(Base):
    deal_id = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    file_path = mapped_column(Text, nullable=True)
    embeddings = relationship("Embedding", back_populates="document", cascade="all, delete-orphan")

class Run(Base):
    deal_id = mapped_column(UUID(as_uuid=True), ForeignKey("deals.id", ondelete="CASCADE"), nullable=False)
    artifacts = relationship("Artifact", back_populates="run", cascade="all, delete-orphan")
```

### Observations & gaps

1. **RBAC/authz**: `/auth` issues sessions but routers do not yet enforce role-based access or tenancy filters. With deals now canonical, each route needs to scope by `deal.team_id` or owner.
2. **Async ingestion/jobs**: `/deals/{id}/documents` currently runs extraction/chunking inline. We still need a background worker + status polling so uploads return quickly and heavy formats (PDF, PPTX, images) don’t block the request.
3. **OM outputs**: Runs expose artifacts by run ID, but there’s no `/deals/{id}/oms` endpoint to list/download Markdown/DOCX per deal.

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

We are replacing the legacy n8n flow with a native ingestion pipeline that accepts a curated list of formats and always emits embeddings tied back to the source deal/file.

| Requirement | FastAPI (target) | Notes |
| --- | --- | --- |
| Accepted formats | Text-like (`txt`, `md`, `rst`, etc.), `pdf`, `doc/docx`, `ppt/pptx`, and common image formats. | We intentionally drop XLS/XLSX/CSV for now; those can be re-added once we have parity. |
| Extraction | Always extract raw text. If a PDF yields zero text on the first pass, trigger a fallback OCR/renderer step before marking the file as failed. | This captures the “side step” mentioned in the new requirements. |
| Chunking/embedding | Chunk every successfully extracted file, store embeddings with references to the originating deal + document, and keep token counts/metadata for downstream auditing. | Embeddings should use the same OpenAI/Gemini strategy the OM generator expects. |
| Telemetry | Update `documents.processing_status`, `processed_at`, `text_chunks_count`, and store error messages in the DB so the admin UI can poll. | Replace the old inline-only summary. |

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

1. **Platform scaffolding**: Introduce authentication/session middleware, expose the dormant routers (now refocused around deals/files/runs/teams/artifacts/system), and add RBAC hooks so admin/editor dashboards can rely on the API instead of Supabase auth.
2. **Deal & listing APIs**: Build REST endpoints for listing CRUD, deal status transitions, NDA/access-request workflows, and ChipFoundry-specific automations. These should map to the Supabase tables (`listings`, `access_requests`, `listing_prospects`, `user_roles`, etc.) that the frontend currently depends on, but all key data now centers on the `deals` table.
3. **Async ingestion service**: Replace inline ingestion with the curated pipeline described above (txt/md/pdf/doc/ppt/img). Persist job status so the admin UI can poll progress per document.
4. **Artifact & run management**: Keep the “runs on deals” concept—each deal can have multiple generation attempts, artifacts, and quick-regens. Provide `/deals/{id}/runs` APIs plus download endpoints so the admin can re-run generation with different templates.
5. **Admin control surface**: Ship a first-party admin page where editors can create deals, upload documents, monitor ingestion progress, and trigger runs. This replaces the huge Supabase form and becomes the orchestration center for doc ingestion.
6. **Email automation & outreach**: Model sequences, enrollments, interactions, and DNS verification states; provide endpoints for the Listing Settings and Prospects screens, replacing Supabase functions (`scrape-website`, `search-trademarks`, `validate-dns`) with FastAPI services or background jobs.
7. **Shared types/SDK**: Publish a lightweight client (e.g., generated from FastAPI’s OpenAPI schema) so the React app can share DTOs with the backend instead of duplicating validation logic.
8. **Leverage existing Postgres**: Reuse and extend the local Postgres instance that already powers n8n and the current workflows. The `vectordb_schema.sql` dump shows the existing `deals`, `documents`, `embeddings`, `processing_logs`, `processing_stats`, and trigger infrastructure (pgvector, pgcrypto, uuid-ossp) that we should migrate in-place rather than standing up a new database.

## 5. Frontend Restructure + Feature Removals

### Migration strategy

- [x] **Thin Supabase UI (Nov 22)**: delete the legacy pages/components/hooks and reduce the bundle to a roadmap landing page.
- [x] **Introduce typed API helpers (Nov 22)**: `/frontend/src/lib/apiClient.ts` centralizes fetch wrappers + DTOs so React pages stop duplicating request logic.
- [ ] **Expand admin flows**: finish the metadata/automation/prospect screens once the backend APIs exist.
- [x] **Server-side storage + ingestion (Nov 22)**: uploads now land in FastAPI, get chunked/embedded, and sync metadata into Postgres/pgvector. An async worker is still a follow-up once we add queueing.
- [x] **Retire Supabase auth (Nov 22)**: removed the Supabase client, hooks, env vars, and UI; `/auth` now documents the FastAPI plan.
- [ ] **Edge-function parity**: replace `scrape-website`, `search-trademarks`, and `validate-dns` with FastAPI services before re-adding UI triggers.
- [x] **Admin dashboard baseline (Nov 22)**: `/admin` now lists deals, uploads docs, and triggers runs against the new endpoints.

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
- [x] **Implement document ingestion jobs (Nov 22)** – Uploads now enqueue a background worker that extracts/chunks/embeds and updates document/job telemetry for polling.
- [x] **Expose OM artifact APIs (Nov 22)** – `/deals/{id}/oms` lists successes and offers Markdown/DOCX downloads tied to each run.
- [x] **Typed API helpers (Nov 22)** – Added `frontend/src/lib/apiClient.ts` and hooked `/admin` into it so future pages can share DTOs.
- [x] **RBAC enforcement (Nov 22)** – Added role-aware dependencies + per-deal guards so only owners/teams/admins can view or mutate deals, docs, runs, artifacts, and embeddings.
- [x] **Listings/access requests (Nov 22)** – Modeled listings + access workflows in FastAPI to replace the Supabase tables.
- [ ] **Edge-function parity & Supabase retirements** – Reintroduce AdminCreate/Settings/Prospects only after the new APIs land; no urgency until the base pipeline ships.

### Async ingestion design sketch

| Concern | Plan |
| --- | --- |
| Job tracking | Add `document_ingestion_jobs` table with `id`, `deal_id`, `document_id`, `status` (`queued` → `processing` → `succeeded/failed`), worker notes, token counts, and timestamps. |
| API contract | Keep `POST /deals/{id}/documents` synchronous for upload/storage, but immediately enqueue each file. Expose `GET /deals/{id}/documents?status=...` plus `GET /documents/{doc_id}/jobs` so the admin UI can poll without re-uploading. |
| Worker topology | Reuse the existing `JobRegistry` pattern: a lightweight queue table + in-memory executor that pulls pending jobs, calls the ingester (text extraction, OCR fallback, chunk/embedding), and updates both `documents` and the new job record atomically. |
| Heavy formats | Split the ingestion steps into adapters (text-like, PDF, Office, images). PDFs that produce zero text go through OCR (Poppler + Tesseract) before marking the job failed. Images pipe through the existing Gemini-based captioner. |
| Telemetry | Persist `processing_status`, `processed_at`, `text_chunks_count`, token counts, and any `processing_error` on both `documents` and `document_ingestion_jobs`. The admin page reads these fields to show progress bars. |
| Cleanup/retries | Failed jobs stay in the queue with the error string. Provide `POST /documents/{doc_id}/jobs/retry` so admins can requeue after fixing source issues. |

## 7. Alignment Note & Current State

- **Current alignment**: The backend now exposes auth/deals/documents/runs/artifacts plus the new ingestion worker and listings/access APIs; remaining work is hardening RBAC (seeding, audit logging) and replacing the final Supabase automations. The frontend has been intentionally reduced to roadmap placeholders so nobody expects Supabase-era functionality to work.
- **Goal alignment**: Converge on FastAPI + local Postgres for *all* services—auth, listings, document ingestion, OM generation, automation—and expose those capabilities through a single API + generated client the React app consumes.
- **Execution focus**: Seed RBAC data, wire the listings/access flows into the frontend, and continue rebuilding the key pages (dashboard, admin automations) on top of the new API using the shared DTOs + role-aware hooks.

Delivering this plan will give the React app a single source of truth (the FastAPI service) and eliminate the mismatch between the legacy n8n pipelines and today’s thin API.


## 8. Implementation Progress (Nov 22, 2025)

- **Auth & sessions**: Added a cookie-based `/auth` surface (`register`, `login`, `logout`, `me`) using the existing password + session services so React can start migrating away from Supabase Auth. The new `SessionUser` dependency powers the `projects` and `teams` routers.
- **ORM coverage**: Extended `server/db/models.py` with `users`, `teams`, `team_members`, `projects`, `project_files`, `runs`, `run_steps`, and `artifacts`, giving parity with the data the React app expects (upload metadata, run history, team membership, etc.). These models mirror the schema we’ll migrate into Postgres next.
- **Router activation**: FastAPI now mounts the rebuilt routers (`/system`, `/deals`, `/teams`, `/deals/{id}/documents`, `/deals/{id}/runs`, `/runs`, `/deals/{id}/runs/{run_id}/artifacts`, `/deals/{id}/embeddings`) alongside the existing `/api` OM routes. The application factory also instantiates the vector store + job registry and exposes them via `app.state`, so run orchestration and embedding endpoints can execute.
- **Frontend cleanup**: Deleted all Supabase-dependent components, hooks, utilities, functions, and assets; trimmed the router to `/`, `/auth`, and `*`; and reduced npm dependencies to `react`, `react-dom`, and `react-router-dom` for a clean rebuild baseline.
- **Schema migration**: Added `server/db/migrations/202511210001_merge_deals_projects.sql` to drop the placeholder `projects/project_files` tables, extend `deals` with owner/team metadata, extend `documents` with checksum/token/summary fields, and repoint `runs` to `deal_id`.
- **Document ingestion pipeline**: `/deals/{id}/documents` now stores uploads under the FastAPI data root, extracts text (with PDF fallback), chunks/embeds every document into pgvector, and updates telemetry so the admin screen can poll status.
- **Ingestion worker queue**: Added `document_ingestion_jobs` plus a background `DocumentIngestionService` so uploads return immediately while a worker handles extraction/chunking/embeddings.
- **Admin UI baseline**: A new `/admin` page lets operators create deals, upload documents, trigger `/deals/{id}/runs`, and download DOCX/artifacts without relying on Supabase.
- **OM outputs API**: Added `/deals/{id}/oms` + `/deals/{id}/oms/{run_id}/download/{format}` so the frontend can list every successful run and download Markdown/DOCX directly.
- **Typed API helpers**: Introduced `frontend/src/lib/apiClient.ts` plus a React session provider so the admin page calls FastAPI through shared DTOs/hooks instead of ad hoc `fetch` calls.
- **RBAC + access guards**: Added `require_roles()` dependencies and per-deal enforcement helpers so every deal/document/run/artifact route respects ownership + team membership.
- **Listings + access requests**: New ORM/migrations + `/listings/*` endpoints mirror the Supabase tables so marketplace/admin flows can be rebuilt without Supabase.

**Open follow-ups**: seed initial RBAC users/teams, wire the new listings/access APIs into the frontend, and continue replacing legacy Supabase edge functions feature-by-feature.
