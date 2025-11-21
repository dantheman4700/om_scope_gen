# API Specification

## Versioning & Base URL

```
Base: https://api.sherwood.io/v1
Auth: Bearer <JWT> or ?api_key=<tenant_key>
Versioning: URL path (/v1/, /v2/), 12-month deprecation notice
```

## REST Endpoints

### Marketplace

#### `GET /v1/marketplace`
Fetch public listings for a tenant.

**Query Parameters:**
- `tenant` (required): Tenant slug
- `industry`: Filter by industry
- `status`: Filter by status (default: 'active')
- `min_revenue`, `max_revenue`: Financial filters
- `limit`: Page size (default: 20, max: 100)
- `offset`: Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "SaaS Company - $5M ARR",
      "slug": "saas-company-5m-arr",
      "industry": "Software",
      "location": "San Francisco, CA",
      "revenue": 5000000,
      "ebitda": 1500000,
      "status": "active",
      "visibility": "public",
      "is_password_protected": false,
      "thumbnail_url": "https://cdn.sherwood.io/...",
      "published_at": "2025-09-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

---

### Listing Detail

#### `GET /v1/listings/:id`
Fetch single listing. Access level determined by auth context.

**Headers:**
- `Authorization: Bearer <JWT>` (optional, for NDA access)
- `X-Share-Token: <token>` (for private listings)
- `X-Password: <plain>` (for password-protected)

**Response:**
```json
{
  "id": "uuid",
  "title": "Manufacturing Business",
  "description": "Established...",
  "industry": "Manufacturing",
  "location": "Austin, TX",
  "revenue": 12000000,
  "ebitda": 3000000,
  "visibility": "public",
  "is_password_protected": false,
  "meta": {
    "title": "Manufacturing Business for Sale | Sherwood Partners",
    "description": "Established manufacturing..."
  },
  "public_assets": [
    {
      "id": "uuid",
      "filename": "teaser.pdf",
      "url": "https://cdn.sherwood.io/public/...",
      "size": 2048576,
      "mime_type": "application/pdf"
    }
  ],
  "access_level": "public" // or "nda_signed"
}
```

**Errors:**
- `403`: Password required or invalid share token
- `404`: Listing not found or not accessible

---

### Access Requests (NDA Flow)

#### `POST /v1/access-requests`
Initiate NDA process for a listing.

**Body:**
```json
{
  "listing_id": "uuid",
  "email": "buyer@example.com",
  "full_name": "John Doe",
  "company": "Acme Corp",
  "phone": "+1-555-0100"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "pending",
  "nda_url": "https://sherwood.io/nda/:id?token=:magic_token",
  "message": "NDA sent to buyer@example.com"
}
```

#### `POST /v1/nda/sign`
Sign NDA and receive access token.

**Body:**
```json
{
  "access_request_id": "uuid",
  "magic_token": "token-from-email",
  "signature": "John Doe",
  "agreed_at": "2025-10-03T14:30:00Z",
  "ip_address": "192.168.1.1"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "expires_at": "2025-10-10T14:30:00Z",
  "listing_id": "uuid"
}
```

---

### Files & Assets

#### `GET /v1/listings/:id/files`
List confidential files (requires NDA access token).

**Headers:**
- `Authorization: Bearer <nda_access_token>`

**Response:**
```json
{
  "files": [
    {
      "id": "uuid",
      "filename": "financial_statements_2024.xlsx",
      "size": 5242880,
      "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "asset_type": "confidential",
      "download_url": "https://cdn.sherwood.io/signed/...?watermark=email&expires=300",
      "expires_in": 300
    }
  ]
}
```

**Watermark Query Params:**
- `watermark=email`: Embed buyer email
- `expires=300`: URL valid for 5 minutes

---

### Q&A

#### `POST /v1/qna`
Submit a question.

**Body:**
```json
{
  "listing_id": "uuid",
  "question": "What is the customer retention rate?",
  "access_request_id": "uuid" // if buyer has NDA access
}
```

**Response:**
```json
{
  "thread_id": "uuid",
  "status": "submitted",
  "message": "Question sent to seller. You'll be notified via email."
}
```

#### `GET /v1/qna?listing_id=:id`
Fetch Q&A threads (public FAQ or buyer's own questions).

**Auth:** Optional (anonymous sees public, authenticated sees own threads)

**Response:**
```json
{
  "threads": [
    {
      "id": "uuid",
      "question": "What is the ARR?",
      "answer": "$5M with 20% YoY growth",
      "is_public": true,
      "answered_at": "2025-09-20T12:00:00Z"
    }
  ]
}
```

#### `POST /v1/qna/:thread_id/reply`
Admin/editor replies to question.

**Headers:**
- `Authorization: Bearer <admin_jwt>`

**Body:**
```json
{
  "answer": "The ARR is $5M...",
  "is_public": false
}
```

---

### Audit Logs

#### `GET /v1/audit?listing_id=:id`
Fetch audit trail (admin only).

**Headers:**
- `Authorization: Bearer <admin_jwt>`

**Query:**
- `listing_id`: Filter by listing
- `event_type`: Filter by type (e.g., 'file_downloaded')
- `from`, `to`: Date range (ISO8601)

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "event_type": "file_downloaded",
      "actor_email": "buyer@example.com",
      "metadata": {
        "filename": "financial_statements_2024.xlsx",
        "watermark": "buyer@example.com|192.168.1.1|2025-10-03T14:30:00Z"
      },
      "ip_address": "192.168.1.1",
      "created_at": "2025-10-03T14:30:00Z"
    }
  ],
  "meta": {
    "total": 127
  }
}
```

---

## Webhooks

### Outbound Events

Configured per tenant in settings. Retry policy: 3 attempts with exponential backoff.

#### `lead.created`
```json
{
  "event": "lead.created",
  "tenant_id": "uuid",
  "data": {
    "listing_id": "uuid",
    "listing_title": "SaaS Company",
    "buyer": {
      "email": "buyer@example.com",
      "full_name": "John Doe",
      "company": "Acme Corp"
    },
    "access_request_id": "uuid",
    "created_at": "2025-10-03T14:00:00Z"
  }
}
```

#### `nda.signed`
```json
{
  "event": "nda.signed",
  "tenant_id": "uuid",
  "data": {
    "listing_id": "uuid",
    "access_request_id": "uuid",
    "buyer_email": "buyer@example.com",
    "signed_at": "2025-10-03T14:30:00Z"
  }
}
```

#### `question.submitted`
```json
{
  "event": "question.submitted",
  "tenant_id": "uuid",
  "data": {
    "thread_id": "uuid",
    "listing_id": "uuid",
    "question": "What is the churn rate?",
    "buyer_email": "buyer@example.com"
  }
}
```

---

## Rate Limits

| Endpoint | Anonymous | Authenticated (Buyer) | Admin |
|----------|-----------|----------------------|--------|
| `GET /marketplace` | 100/min | 500/min | Unlimited |
| `POST /access-requests` | 5/hour | 20/hour | Unlimited |
| `GET /files` | N/A | 50/min | Unlimited |
| `POST /qna` | 10/hour | 50/hour | Unlimited |

**Headers:**
- `X-RateLimit-Limit`: Total allowed requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp for reset

---

## Error Format

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "The access token has expired",
    "details": {
      "expired_at": "2025-10-03T14:00:00Z"
    }
  }
}
```

**Standard Codes:**
- `AUTH_REQUIRED`, `INVALID_TOKEN`, `FORBIDDEN`
- `RESOURCE_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`
- `VALIDATION_ERROR`, `INTERNAL_ERROR`
