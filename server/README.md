# M&A Platform Backend Server

Express.js API server for the M&A Platform with document generation capabilities.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- npm or pnpm

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

Create a `.env` file in the server directory:

```bash
# ===========================================
# Server Configuration
# ===========================================
PORT=3001
NODE_ENV=development

# ===========================================
# Database (PostgreSQL with pgvector extension)
# ===========================================
# Install pgvector: CREATE EXTENSION vector;
DATABASE_URL=postgres://username:password@localhost:5432/ma_platform

# ===========================================
# JWT Authentication
# ===========================================
# Generate a secure secret: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# ===========================================
# Frontend URL (for CORS)
# ===========================================
FRONTEND_URL=http://localhost:5173

# ===========================================
# File Uploads
# ===========================================
# UPLOAD_DIR=./uploads
MAX_FILE_SIZE=20971520

# ===========================================
# AI Services (required for document generation)
# ===========================================

# OpenAI API Key (for document embeddings)
# Get your key at: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...

# Google Gemini API Key (for content extraction and generation)
# Get your key at: https://aistudio.google.com/app/apikey
# Uses gemini-2.5-pro model
GEMINI_API_KEY=...
```

### 3. Create Database with pgvector

```bash
# Connect to PostgreSQL and create the database
psql -U postgres
CREATE DATABASE ma_platform;
\c ma_platform
CREATE EXTENSION vector;  -- Required for document embeddings
\q
```

### 4. Run Migrations

```bash
npm run db:migrate
```

This will create all necessary tables including:
- `users` (authentication)
- `profiles`, `tenants`, `user_roles`
- `listings`, `listing_prospects`
- `listing_documents` (uploaded source documents)
- `document_chunks` (vectorized text with embeddings)
- `document_templates`, `template_variables`
- `generated_documents`
- `access_requests`, `email_sequences`, `audit_events`

### 5. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/me` - Get current user

### Listings
- `GET /api/listings` - List all listings
- `GET /api/listings/:id` - Get single listing
- `POST /api/listings` - Create listing (admin/editor)
- `PATCH /api/listings/:id` - Update listing (admin/editor)
- `DELETE /api/listings/:id` - Delete listing (admin)

### Prospects
- `GET /api/prospects?listing_id=:id` - List prospects for listing
- `GET /api/prospects/:id` - Get single prospect
- `POST /api/prospects` - Create prospect
- `PATCH /api/prospects/:id` - Update prospect
- `DELETE /api/prospects/:id` - Delete prospect

### Users (Admin)
- `GET /api/users` - List all users
- `GET /api/users/:id/roles` - Get user roles
- `POST /api/users/:id/roles` - Add role
- `DELETE /api/users/:id/roles/:role` - Remove role

### Tenants
- `GET /api/tenants` - List tenants
- `GET /api/tenants/:slug` - Get tenant by slug

### File Upload
- `POST /api/upload/pitch-deck` - Upload pitch deck
- `POST /api/upload/patent-file` - Upload patent file
- `DELETE /api/upload/:type/:filename` - Delete file

### Document Generation
- `POST /api/listings/:id/documents` - Upload source documents
- `GET /api/listings/:id/documents` - List documents with processing status
- `DELETE /api/documents/:id` - Delete document
- `POST /api/listings/:id/generate/:templateId` - Generate document from template
- `GET /api/listings/:id/generated` - List generated documents
- `GET /api/generated/:id/download/:format` - Download PDF or DOCX

### Templates
- `GET /api/templates` - List active templates
- `GET /api/templates/:id` - Get template with variables
- `POST /api/templates` - Create template (admin)
- `PUT /api/templates/:id` - Update template (admin)
- `POST /api/templates/:id/variables` - Add variable to template

### Services
- `POST /api/scrape-website` - Process website/pitch deck
- `POST /api/search-trademarks` - Search USPTO trademarks
- `POST /api/validate-dns` - Validate DNS records
- `POST /api/webhooks/dynamics` - Dynamics 365 webhook

### Health
- `GET /api/health` - Health check

## File Structure

```
server/
├── src/
│   ├── index.ts              # Express app entry
│   ├── config/
│   │   └── env.ts            # Environment config
│   ├── db/
│   │   ├── index.ts          # PostgreSQL connection
│   │   └── migrate.ts        # Migration runner
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── documents.ts      # Document upload & generation
│   │   ├── listings.ts
│   │   ├── prospects.ts
│   │   ├── templates.ts      # Template management
│   │   ├── tenants.ts
│   │   ├── users.ts
│   │   ├── upload.ts
│   │   └── services.ts
│   ├── services/
│   │   ├── documentExtractor.ts  # PDF/DOCX/PPTX/image extraction
│   │   ├── documentGenerator.ts  # RAG + PDF/DOCX generation
│   │   ├── embeddingService.ts   # OpenAI embeddings + pgvector
│   │   └── queue.ts              # In-memory job queue
│   ├── types/
│   │   ├── express.d.ts
│   │   ├── mammoth.d.ts
│   │   └── officeparser.d.ts
│   └── utils/
│       ├── httpError.ts
│       ├── jwt.ts
│       └── password.ts
├── migrations/
│   ├── 001_initial.sql
│   ├── 002_documents.sql         # Document generation tables
│   └── 003_seed_offering_memo_template.sql
├── uploads/
│   ├── listing-documents/
│   ├── generated-documents/
│   ├── pitch-decks/
│   └── patent-files/
├── package.json
└── tsconfig.json
```

## Creating First Admin User

After running migrations, create your first admin user:

```bash
# 1. Sign up via the frontend or API
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password","fullName":"Admin User"}'

# 2. Connect to PostgreSQL and add admin role
psql -d ma_platform -c "
  INSERT INTO user_roles (user_id, tenant_id, role)
  SELECT u.id, t.id, 'admin'
  FROM users u, tenants t
  WHERE u.email = 'admin@example.com' AND t.slug = 'sherwood';
"
```

## Document Generation Flow

1. **Upload** - Source documents (PDF, DOCX, PPTX, images, text) are uploaded via the API
2. **Extract** - In-memory queue processes extraction using pdf-parse, mammoth, officeparser, or Gemini Vision
3. **Embed** - Text is chunked and embedded using OpenAI text-embedding-3-small
4. **Store** - Vectors stored in pgvector for similarity search
5. **Generate** - When generating a document:
   - Template variables are loaded
   - For each variable, relevant chunks are retrieved via vector search
   - Gemini 2.5 Pro generates content using RAG
   - PDF (via Puppeteer) and DOCX outputs are created

## Technology Stack

- **Express 5** - Web framework
- **postgres.js** - Type-safe PostgreSQL queries
- **pgvector** - Vector similarity search
- **OpenAI** - text-embedding-3-small for embeddings
- **Gemini 2.5 Pro** - Content extraction and generation
- **Puppeteer** - PDF generation
- **docx** - DOCX generation
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT auth
- **multer** - File uploads
- **zod** - Validation
- **tsx** - TypeScript execution
