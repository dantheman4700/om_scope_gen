# Embed API - Web Component Specification

## Installation

### CDN (Recommended)
```html
<script type="module" src="https://cdn.sherwood.io/embed/v1/sherwood-market.js"></script>
```

### NPM (React SDK)
```bash
npm install @sherwood/market-react
```

---

## Web Component Usage

### Basic Marketplace Embed
```html
<sherwood-market
  tenant="sherwood"
  module="marketplace"
  filters='{"industry": "Software"}'
  theme='{"brand": "#1a365d", "accent": "#d4af37"}'
></sherwood-market>
```

### Listing Detail Page
```html
<sherwood-market
  tenant="sherwood"
  module="listing"
  listing-id="550e8400-e29b-41d4-a716-446655440000"
  require-nda="true"
></sherwood-market>
```

### Admin Console
```html
<sherwood-market
  tenant="sherwood"
  module="admin"
  jwt="eyJhbGc..."
></sherwood-market>
```

---

## Props (Attributes)

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `tenant` | string | ✅ | - | Tenant slug (e.g., 'sherwood') |
| `module` | string | ✅ | - | Module name: `marketplace`, `listing`, `nda-gate`, `qna`, `admin` |
| `listing-id` | string | ⚠️ | - | Required for `listing`, `nda-gate`, `qna` modules |
| `filters` | JSON string | ❌ | `{}` | Pre-apply filters (marketplace only) |
| `require-nda` | boolean | ❌ | `false` | Show NDA gate before listing detail |
| `theme` | JSON string | ❌ | `null` | Override CSS tokens (see Theming section) |
| `jwt` | string | ❌ | - | Auth token for admin/buyer sessions |
| `api-base` | string | ❌ | `https://api.sherwood.io/v1` | Override API endpoint (testing) |
| `locale` | string | ❌ | `en-US` | i18n locale code |

---

## Events (CustomEvents)

Listen on the Web Component element:

```javascript
const market = document.querySelector('sherwood-market');

market.addEventListener('sherwood:lead', (event) => {
  console.log('Lead captured:', event.detail);
  // Send to your analytics, CRM, etc.
});
```

### Event Catalog

#### `sherwood:ready`
Fired when component is fully loaded and hydrated.

**Detail:**
```json
{
  "module": "marketplace",
  "version": "1.2.3"
}
```

---

#### `sherwood:lead`
Buyer submits access request.

**Detail:**
```json
{
  "listingId": "uuid",
  "listingTitle": "SaaS Company",
  "buyer": {
    "email": "buyer@example.com",
    "fullName": "John Doe",
    "company": "Acme Corp"
  },
  "accessRequestId": "uuid"
}
```

**Use Case:** Forward to your CRM or trigger custom workflow.

---

#### `sherwood:nda-signed`
NDA successfully signed.

**Detail:**
```json
{
  "listingId": "uuid",
  "accessRequestId": "uuid",
  "buyerEmail": "buyer@example.com",
  "signedAt": "2025-10-03T14:30:00Z",
  "accessToken": "eyJhbGc..."
}
```

**Use Case:** Store access token, show success message, redirect.

---

#### `sherwood:access-granted`
User gained access to confidential files (after NDA or password).

**Detail:**
```json
{
  "listingId": "uuid",
  "accessLevel": "nda_signed" // or "password_verified"
}
```

---

#### `sherwood:question-submitted`
Buyer asked a question via Q&A.

**Detail:**
```json
{
  "listingId": "uuid",
  "threadId": "uuid",
  "question": "What is the customer retention rate?"
}
```

---

#### `sherwood:file-viewed`
User opened/previewed a file.

**Detail:**
```json
{
  "listingId": "uuid",
  "assetId": "uuid",
  "filename": "teaser.pdf",
  "assetType": "public"
}
```

---

#### `sherwood:error`
Error occurred (API failure, auth issue, etc.).

**Detail:**
```json
{
  "code": "AUTH_REQUIRED",
  "message": "You must sign the NDA to access this listing",
  "severity": "error" // or "warning"
}
```

**Use Case:** Show custom error UI, log to monitoring.

---

## React SDK Example

```tsx
import { SherwoodMarket } from '@sherwood/market-react';

function App() {
  const handleLead = (detail) => {
    console.log('Lead:', detail);
    // Send to analytics
  };

  return (
    <SherwoodMarket
      tenant="sherwood"
      module="marketplace"
      filters={{ industry: 'Software' }}
      onLead={handleLead}
      onNdaSigned={(detail) => console.log('NDA signed:', detail)}
    />
  );
}
```

---

## Iframe Fallback

For strict CSP environments or legacy browsers:

```html
<iframe
  src="https://embed.sherwood.io/v1/marketplace?tenant=sherwood"
  width="100%"
  height="800"
  frameborder="0"
  allow="clipboard-write"
></iframe>
```

### postMessage Bridge

**Host → Iframe:**
```javascript
iframe.contentWindow.postMessage({
  type: 'sherwood:init',
  payload: {
    tenant: 'sherwood',
    theme: { brand: '#1a365d' }
  }
}, 'https://embed.sherwood.io');
```

**Iframe → Host:**
```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://embed.sherwood.io') return;
  
  if (event.data.type === 'sherwood:lead') {
    console.log('Lead from iframe:', event.data.payload);
  }
});
```

---

## Shadow DOM & Styling

The Web Component uses **open Shadow DOM** for style isolation. Host styles do NOT bleed in by default.

### CSS Custom Properties (Pass-Through)

These properties inherit from the host page:

```css
/* Host page styles */
:root {
  --sw-color-brand: #1a365d;
  --sw-color-accent: #d4af37;
  --sw-font-headings: 'Merriweather', serif;
}
```

The component automatically picks these up if defined.

### Programmatic Theme Override

```html
<sherwood-market
  theme='{
    "brand": "#1a365d",
    "accent": "#d4af37",
    "radius": "8px",
    "fontHeadings": "Merriweather, serif"
  }'
></sherwood-market>
```

See `docs/theming.md` for full token list.

---

## CSP Requirements

**Minimum CSP for Web Component:**

```
script-src 'self' https://cdn.sherwood.io;
style-src 'self' 'unsafe-inline'; /* Shadow DOM styles */
connect-src https://api.sherwood.io;
img-src https://cdn.sherwood.io;
```

**For iframe fallback:**

```
frame-src https://embed.sherwood.io;
```

---

## Loading States

The component shows a skeleton UI during initial load. Customize via:

```html
<sherwood-market tenant="sherwood" module="marketplace">
  <!-- Custom loading slot -->
  <div slot="loading">
    <img src="/spinner.gif" alt="Loading..." />
  </div>
</sherwood-market>
```

---

## Accessibility

- **ARIA**: All interactive elements have proper labels
- **Keyboard Nav**: Full keyboard support (Tab, Enter, Esc)
- **Screen Readers**: Semantic HTML with ARIA landmarks
- **Focus Management**: Trapped focus in modals (NDA dialog)

---

## Browser Support

| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 90+ | Full support |
| Firefox | 88+ | Full support |
| Safari | 14+ | Full support |
| Edge | 90+ | Full support |
| IE 11 | ❌ | Not supported (use iframe) |

**Polyfills Not Required** for modern browsers (Web Components native).
