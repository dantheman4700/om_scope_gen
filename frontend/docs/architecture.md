# Sherwood Partners M&A Module - Architecture

## System Overview

Multi-tenant SaaS embeddable module for secure M&A deal listings with CMS-agnostic integration.

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Website Layer                        │
│  (sherwoodpartners.com, Ghost, WordPress, Webflow, etc.)    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├──► <script src="cdn.sherwood.io/embed.js">
                 │
┌────────────────▼────────────────────────────────────────────┐
│              Embed Layer (Web Components)                    │
│  <sherwood-market tenant="sherwood" theme="..."/>           │
│  • marketplace  • listing  • nda-gate  • qna  • admin       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├──► REST/GraphQL API (versioned)
                 │
┌────────────────▼────────────────────────────────────────────┐
│                 Application Layer                            │
│  • Tenant Isolation  • Auth/RBAC  • Business Logic          │
│  • Webhook Dispatcher  • Event Sourcing  • Rate Limiting    │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌─────────┐  ┌──────────┐
│   DB   │  │ Storage │  │  Cache   │
│ (RLS)  │  │ (S3/R2) │  │  (Redis) │
└────────┘  └─────────┘  └──────────┘
```

## Core Components

### 1. Embed Layer (Client-Side)
- **Web Component**: Custom elements with Shadow DOM isolation
- **Framework**: Lit or vanilla (< 15KB gzipped)
- **Hydration**: Progressive enhancement with SSR compatibility
- **Communication**: CustomEvents for host integration, postMessage for iframe fallback

### 2. API Layer (Edge Functions)
- **Runtime**: Lovable Cloud / Supabase Edge Functions (Deno)
- **Versioning**: `/v1/`, `/v2/` with deprecation policy
- **Protocols**: REST primary, GraphQL optional for admin
- **Auth**: JWT validation with tenant context injection

### 3. Data Layer
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Isolation**: Tenant ID on every table, enforced by RLS policies
- **Storage**: Public (CDN) vs Confidential (signed URLs with watermarking)
- **Audit**: Immutable event log for compliance

### 4. SSR Layer (SEO)
- **Edge Rendering**: Public pages pre-rendered at CDN edge
- **Hydration**: JSON island architecture for dynamic features
- **Robots**: Dynamic `robots.txt` based on listing visibility settings

## Data Flow Examples

### Public Marketplace Access
```
Host Page → Web Component → GET /v1/marketplace?tenant=sherwood
                          ← JSON listings (public only)
                          → Render cards with Shadow DOM theming
```

### NDA-Gated Access
```
Buyer → Request Access → POST /v1/access-requests {listingId, email}
                       ← {requestId, status: "pending"}
     → Email sent with magic link
     
Buyer clicks → GET /listing/:id?token=:nda_token
             → POST /v1/nda/sign {signature, requestId}
             ← {accessToken: "jwt...", expiresAt}
             
Buyer → GET /v1/listings/:id/files
        Headers: Authorization: Bearer <accessToken>
      ← [{url: "signed-url-with-watermark", expiresIn: 300}]
```

### Q&A Flow
```
Buyer → POST /v1/qna {listingId, question}
      ← {threadId, status: "submitted"}
      → Webhook fires to seller CRM
      
Admin → GET /v1/qna?listingId=X
      → POST /v1/qna/:threadId/reply {answer}
      ← Buyer notified via email
```

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Embed | Lit Web Components | 15KB, Shadow DOM, SSR-compatible |
| API | Lovable Cloud (Edge Functions) | Zero cold start, global distribution |
| Database | PostgreSQL (Supabase) | RLS for multi-tenancy, ACID guarantees |
| Storage | S3/R2 compatible | Presigned URLs, CDN integration |
| Auth | Supabase Auth + custom JWT | OIDC/SAML passthrough, passwordless fallback |
| Cache | Redis (Upstash) | Edge-compatible, TTL automation |
| CDN | Cloudflare | Global PoPs, WAF, DDoS protection |

## Scalability Considerations

- **Tenant Sharding**: Logical (RLS) up to 10k tenants, then schema-per-tenant
- **Read Scaling**: Replica DB + Redis cache for hot listings
- **Write Scaling**: Event queue for audit logs, async webhook dispatch
- **Asset Delivery**: CDN with 90-day cache for public assets, on-demand for confidential

## Security Boundaries

1. **Tenant Isolation**: RLS enforced at database level
2. **CORS**: Dynamic allow-list based on tenant domains
3. **CSP**: Embed declares `script-src 'self' cdn.sherwood.io`
4. **Rate Limiting**: Per-tenant (1000 req/min) + per-IP (100 req/min)
5. **Secrets**: Vault storage with rotation, never in client code
