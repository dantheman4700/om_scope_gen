# M&A Platform

An M&A marketplace platform for investment banks and advisors with AI-powered document generation.

## Key Features

- **Role-Based Access**: Buyer/Editor/Admin roles with granular permissions
- **Anonymization**: Hide company identity until NDA signed
- **Website Scraping**: Auto-fill listing data from company websites
- **AI Document Generation**: Generate Offering Memoranda from source documents
- **Multi-Visibility**: Public marketplace, private share links, unlisted drafts

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express 5, PostgreSQL + pgvector
- **AI**: OpenAI (embeddings), Gemini 2.5 Pro (content generation)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension

### 1. Backend Setup

```bash
cd server
npm install

# Create .env file (see server/README.md for full configuration)
cp .env.example .env  # Then edit with your credentials

# Create database with pgvector
psql -U postgres -c "CREATE DATABASE ma_platform;"
psql -U postgres -d ma_platform -c "CREATE EXTENSION vector;"

# Run migrations
npm run db:migrate

# Start server
npm run dev
```

### 2. Frontend Setup

```bash
# From project root
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:3001/api" > .env

# Start frontend
npm run dev
```

### 3. Environment Variables

**Frontend (`.env`):**
```
VITE_API_URL=http://localhost:3001/api
```

**Backend (`server/.env`):**
```
PORT=3001
DATABASE_URL=postgres://user:pass@localhost:5432/ma_platform
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

See `server/README.md` for complete backend configuration.

## Documentation

See `/docs` folder for architecture, API specs, and integration guides.

## Development

```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm run dev
```

Access at http://localhost:5173
