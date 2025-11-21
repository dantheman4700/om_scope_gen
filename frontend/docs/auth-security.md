# Authentication & Security Model

## Authentication Flows

### 1. BYO-SSO (Bring Your Own Single Sign-On) - Preferred

**Use Case:** Host site already has authentication (e.g., membership site, corporate intranet).

**Flow:**
1. Host site authenticates user (OIDC, SAML, proprietary)
2. Host backend generates short-lived JWT with tenant context:
   ```json
   {
     "sub": "user-id",
     "email": "admin@sherwoodpartners.com",
     "tenant_id": "sherwood-uuid",
     "role": "admin",
     "exp": 1696350000
   }
   ```
3. Pass JWT to Web Component:
   ```html
   <sherwood-market tenant="sherwood" jwt="eyJhbGc..."></sherwood-market>
   ```
4. Component includes JWT in `Authorization: Bearer <jwt>` for API calls
5. API validates signature, checks expiry, extracts tenant context

**Security:**
- Host controls user lifecycle
- JWT expires in 5-15 minutes (refresh via host)
- API only validates signature, doesn't issue tokens

**Implementation (Host Backend):**
```javascript
// Node.js example
const jwt = require('jsonwebtoken');

const token = jwt.sign({
  sub: user.id,
  email: user.email,
  tenant_id: 'sherwood-uuid',
  role: user.role
}, process.env.SHERWOOD_JWT_SECRET, { expiresIn: '15m' });
```

---

### 2. Passwordless (Magic Link) - Fallback

**Use Case:** Buyers accessing listings without host site accounts.

**Flow:**
1. Buyer submits access request → `POST /v1/access-requests`
2. API generates magic token, sends email:
   ```
   Subject: Access Your Listing - Sherwood Partners
   
   Click to view: https://sherwoodpartners.com/listing/:id?token=:magic_token
   Expires in 1 hour.
   ```
3. Buyer clicks link → Web Component validates token via `POST /v1/auth/magic`
4. API returns session JWT (longer-lived, 24 hours)
5. Component stores JWT in memory (not localStorage for security)

**Security:**
- Magic token single-use, expires in 1 hour
- IP/user-agent fingerprinting (soft check, warn on mismatch)
- Rate limit: 5 magic links per email per hour

---

### 3. NDA-Specific Access Token

**Use Case:** Grant file access after NDA signing.

**Flow:**
1. Buyer signs NDA → `POST /v1/nda/sign`
2. API returns NDA-scoped token:
   ```json
   {
     "access_token": "eyJhbGc...",
     "scope": "listing:uuid:files",
     "expires_at": "2025-10-10T14:30:00Z"
   }
   ```
3. Component uses token for `GET /v1/listings/:id/files`
4. API verifies token scope before returning signed URLs

**Security:**
- Token only valid for specific listing's confidential files
- Shorter expiry (7 days) compared to session JWT
- Revocable via admin dashboard

---

## Role-Based Access Control (RBAC)

### Role Definitions

| Role | Permissions | Use Case |
|------|-------------|----------|
| **admin** | Full CRUD on listings, users, settings; view audit logs | Sherwood Partners staff |
| **editor** | Create/edit listings, reply to Q&A, view basic analytics | Deal team members |
| **reviewer** | View all listings (including unlisted), read-only | Compliance, legal review |
| **buyer** | View public listings, submit access requests, Q&A | External buyers |

### Permission Matrix

| Action | Admin | Editor | Reviewer | Buyer |
|--------|-------|--------|----------|-------|
| Create listing | ✅ | ✅ | ❌ | ❌ |
| Edit listing | ✅ | ✅ | ❌ | ❌ |
| Delete listing | ✅ | ❌ | ❌ | ❌ |
| View unlisted | ✅ | ✅ | ✅ | ❌ (needs share link) |
| Access confidential files (own NDA) | ✅ | ✅ | ✅ | ✅ |
| View audit logs | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |

### Implementation (Database RLS)

```sql
-- Example: Listings table
CREATE POLICY "Admins and editors can manage listings"
  ON listings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'))
  WITH CHECK (has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'editor'));

CREATE POLICY "Reviewers can view all listings"
  ON listings FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), tenant_id, 'reviewer'));

CREATE POLICY "Public listings viewable by all"
  ON listings FOR SELECT
  USING (visibility = 'public' AND status = 'active');
```

**CRITICAL:** Never store roles on `profiles` or `auth.users` table. Always use separate `user_roles` table with security definer functions to avoid privilege escalation.

---

## Security Measures

### 1. Multi-Tenant Isolation

**Database Level:**
- Every table has `tenant_id` column (non-nullable)
- RLS policies enforce `tenant_id = current_tenant_id()` check
- Foreign keys cascade deletes to prevent orphans

**API Level:**
- JWT must contain `tenant_id` claim
- All queries automatically scoped to tenant
- Cross-tenant access blocked at database level (RLS)

**Testing:**
```sql
-- Verify tenant isolation
SELECT * FROM listings WHERE tenant_id != 'expected-uuid'; -- Should return empty
```

---

### 2. Confidential File Protection

**Storage Strategy:**
- **Public assets**: CDN-cached with long TTL (immutable URLs)
- **Confidential docs**: Never publicly accessible, signed URLs only

**Signed URL Generation:**
```javascript
// Edge function example
const signedUrl = await storage.createSignedUrl(
  'confidential-bucket',
  `${tenantId}/${listingId}/${filename}`,
  {
    expiresIn: 300, // 5 minutes
    transform: {
      watermark: {
        text: `${buyerEmail} | ${ip} | ${timestamp}`,
        opacity: 0.3,
        position: 'bottom-right'
      }
    }
  }
);
```

**Watermarking:**
- PDF: Embed text watermark on each page (via PDF manipulation library)
- Images: Overlay text (via image processing service)
- Excel/Word: Metadata injection + footer text

**Audit Trail:**
Every file access logged:
```sql
INSERT INTO file_access_logs (asset_id, access_request_id, action, ip_address, watermark_data)
VALUES ($1, $2, 'download', $3, jsonb_build_object('email', $4, 'timestamp', NOW()));
```

---

### 3. Rate Limiting

**Per-Tenant Limits (Redis):**
```javascript
const key = `rate-limit:${tenantId}:${endpoint}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60); // 1-minute window
if (count > 1000) throw new Error('RATE_LIMIT_EXCEEDED');
```

**Per-IP Limits (WAF):**
- Cloudflare Rate Limiting: 100 req/min per IP
- Challenge on 429 responses (CAPTCHA)

---

### 4. Secrets Management

**API Keys:**
- Stored in Supabase Vault (encrypted at rest)
- Accessed via edge functions with `SECURITY DEFINER`
- Rotated every 90 days (automated alerts)

**JWT Signing:**
- Asymmetric keys (RS256, not HS256)
- Public key exposed for host validation
- Private key in Vault, never exposed

---

### 5. Input Validation & Sanitization

**API Layer:**
```typescript
import { z } from 'zod';

const AccessRequestSchema = z.object({
  listing_id: z.string().uuid(),
  email: z.string().email().max(255),
  full_name: z.string().trim().max(100),
  company: z.string().trim().max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional() // E.164 format
});

// Validate before DB insert
const validated = AccessRequestSchema.parse(req.body);
```

**XSS Prevention:**
- All user input escaped in HTML contexts
- CSP headers: `script-src 'self' cdn.sherwood.io; object-src 'none';`
- No `dangerouslySetInnerHTML` in React components

---

### 6. CORS Configuration

**Dynamic Allow-List:**
```javascript
// Edge function CORS handler
const allowedOrigins = await getTenantDomains(tenantId); // ['sherwoodpartners.com', 'custom-domain.com']
const origin = req.headers.get('origin');

if (allowedOrigins.includes(origin)) {
  return new Response(body, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
```

---

### 7. Audit Logging

**Immutable Event Log:**
- All sensitive actions logged (NDA sign, file download, listing edit)
- Append-only table (no updates/deletes)
- Retention: 7 years (compliance requirement)

**Monitored Events:**
- `AUTH_FAILED`: Track brute force attempts
- `NDA_SIGNED`: Compliance audit trail
- `FILE_DOWNLOADED`: IP, user-agent, watermark details
- `LISTING_EDITED`: Before/after snapshots (JSONB diff)

**Alerting:**
```javascript
// Trigger on anomalies
if (event.type === 'FILE_DOWNLOADED' && dailyDownloads > 100) {
  await sendAlert('admin@sherwoodpartners.com', 'Unusual file download activity');
}
```

---

## Compliance & Data Privacy

### GDPR/CCPA
- **Right to Access**: API endpoint `GET /v1/data-export?email=...`
- **Right to Erasure**: `DELETE /v1/users/:id/gdpr-delete` (anonymizes audit logs)
- **Data Minimization**: Only collect required fields (no birthday, SSN, etc.)

### Data Retention
- **Active listings**: Indefinite
- **Archived listings**: 3 years
- **Audit logs**: 7 years
- **Buyer PII**: Deleted 90 days after listing closed (unless NDA active)

---

## Security Checklist

- ✅ RLS enabled on all tables
- ✅ Roles stored in separate table (not `profiles`)
- ✅ Confidential docs never in public storage
- ✅ Signed URLs expire < 5 minutes
- ✅ Watermarks on all confidential downloads
- ✅ Rate limiting (tenant + IP)
- ✅ Input validation (Zod schemas)
- ✅ CSP headers on all pages
- ✅ JWT expiry < 15 minutes (session tokens 24h max)
- ✅ Audit logging for all sensitive actions
- ✅ GDPR export/delete endpoints
- ✅ No API keys in client code
