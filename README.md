# OM Generator API

FastAPI backend that ingests deal collateral, stores structured representations in a local Postgres + pgvector database, and generates Offering Memorandum (OM) Markdown using OpenAI embeddings and Gemini text generation. The API is the only surface for now (frontend will be added later).

## Architecture

- **FastAPI server (`server/`)** exposes two core endpoints:
  - `POST /api/deals` – ingest files for a deal, extract text, chunk, and embed into the `embeddings` table.
  - `POST /api/om/generate` – run section-by-section RAG over the stored chunks and render the OM Markdown template.
- **Local storage (`data/deals/<deal_id>/`)** keeps uploaded files (`inputs/`) and generated artifacts (`outputs/`).
- **Postgres 17 + pgvector** (see `vectordb_schema.sql`) hosts the canonical tables (`deals`, `documents`, `embeddings`, `processing_logs`, etc.). The project connects to the existing Docker-hosted instance on the Mac mini.

- **Vite/React app (`frontend/`)** provides the deal / OM workspace UI (imported from `venture-canvas-place-main`). It consumes the FastAPI endpoints listed below.

## Prerequisites

- Python 3.10+
- Access to the local Postgres/pgvector instance (default: `postgresql://postgres:PsQlP4sssh3rwood!@localhost:5432/vectordb`)
- OpenAI API key (embeddings) and Gemini API key (section generation)
- Optional: Docker Desktop on macOS if you want to mimic the host environment described in the notes (`docker-n8n`, `psql-db-1`, etc.)

## Setup

```bash
git clone https://github.com/dantheman4700/om_scope_gen.git
cd om_scope_gen

python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp server/env.example .env
# then edit .env (or export env vars) with:
#   DATABASE_DSN=postgresql://postgres:PsQlP4sssh3rwood!@localhost:5432/vectordb
#   OPENAI_API_KEY=<your-openai-key>
#   GEMINI_API_KEY=<your-gemini-key>
#   GEMINI_MODEL=models/gemini-2.5-pro  # optional override

uvicorn server.api:app --reload
```

### Frontend (Vite + React)

```bash
cd frontend
npm install           # or bun/pnpm if you prefer
npm run dev           # defaults to http://localhost:5173
```

Create `frontend/.env` (or `.env.local`) with at least:

```
VITE_API_BASE_URL=http://localhost:8000
```

so the UI can hit the FastAPI server. The default dev servers are:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Both can run concurrently from the repo root:

```bash
# Terminal 1
uvicorn server.api:app --reload

# Terminal 2
cd frontend && npm run dev
```

### Database schema

The repository tracks the schema dump from the Mac mini (`vectordb_schema.sql`). To provision a fresh instance:

```bash
docker exec -it psql-db-1 psql -U postgres -d vectordb -f /path/to/vectordb_schema.sql
```

Otherwise, ensure the running database already contains the required tables and the `vector`, `pgcrypto`, and `uuid-ossp` extensions.

## Configuration Highlights

Key environment variables (see `server/core/config.py` for defaults):

| Variable | Purpose |
| --- | --- |
| `DATABASE_DSN` | SQLAlchemy DSN (psycopg) pointing to the local vectordb |
| `VECTOR_STORE_DSN` | Auto-derived psycopg DSN used by the pgvector helper |
| `OPENAI_API_KEY` | Embeddings via `text-embedding-3-small` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Section generation using Gemini 2.5 |
| `SCOPE_DATA_ROOT` | Top-level data directory (defaults to `<repo>/data`) |
| `OM_TEMPLATE_PATH`, `OM_SECTIONS_PATH` | Markdown template + section metadata (`server/resources/`) |

Per-deal filesystem layout (auto-created):

```
data/deals/<deal_id>/
├── inputs/      # raw uploads
├── outputs/     # offering_memorandum_<deal_id>.md
├── assets/      # reserved for future image exports
└── config/      # reserved for extra metadata
```

## API Reference

### `POST /api/deals`

Multipart form that creates a deal record and ingests one or more files.

**Form fields**

- `company_name` (required)
- `deal_name` (optional, defaults to `company_name`)
- `deal_description` (optional)
- `status_value` (optional, defaults to `active`)
- `files` (one or many file inputs)

**Example**

```bash
curl -X POST http://localhost:8000/api/deals \
  -F "company_name=Acme Robotics" \
  -F "deal_name=Series B OM" \
  -F "status_value=active" \
  -F "files=@./docs/executive_summary.pdf" \
  -F "files=@./docs/financials.xlsx"
```

**Response**

```json
{
  "deal_id": "4f5d0f52-3f76-4a9d-8b9b-ea0e6d4bd2ed",
  "documents": [
    {
      "document_id": "…",
      "file_name": "executive_summary.pdf",
      "processing_status": "completed",
      "chunks": 42,
      "embeddings_created": true
    }
  ]
}
```

### `POST /api/om/generate`

Takes a `deal_id`, performs section-by-section retrieval (12 nearest chunks per section by default), and renders the OM Markdown template. Small documents can optionally be sent verbatim to Gemini as additional context.

**Payload**

```json
{
  "deal_id": "4f5d0f52-3f76-4a9d-8b9b-ea0e6d4bd2ed",
  "attach_full_documents": false
}
```

**Response**

```json
{
  "deal_id": "4f5d0f52-3f76-4a9d-8b9b-ea0e6d4bd2ed",
  "markdown": "## Executive Summary\n…",
  "output_path": "data/deals/4f5d…/outputs/offering_memorandum_4f5d….md"
}
```

## Resources & Templates

- `server/resources/template_om.md` – Markdown shell with filler sections plus placeholders for the five generated sections.
- `server/resources/variables_om.json` – Section metadata (name, prompt query, instruction, default top-k) used by the Gemini loop.

Feel free to adjust either file to change the tone or structure of the generated OM.

## Deployment Notes

- Recommended to run the FastAPI app under **systemd** or **supervisor**, optionally behind **Nginx** for TLS/host routing. Sample unit files are in `deploy/systemd/`.
- The Vite app can be served via `npm run build && npm run preview`, or baked into whichever static hosting tier you prefer. Configure `VITE_API_BASE_URL` accordingly.
- Ensure the service process has access to:
  - the shared filesystem mount containing `data/deals`
  - the Docker-hosted Postgres instance (localhost:5432)
  - outbound internet (OpenAI + Google Generative AI)
- No migrations run on deploy; schema evolution is handled manually via updated `vectordb_schema.sql`.

## License & Support

Specify license details once finalized. For support, open an issue or contact Sherwood directly.

