# SEO Strategy & Performance

## SEO Architecture

### Public vs Private Content

| Content Type | Indexing | Approach |
|--------------|----------|----------|
| Marketplace page | ✅ Index | SSR with JSON-LD, sitemap |
| Public listings | ✅ Index | SSR with Open Graph, schema |
| Private listings | ❌ No-index | Meta `robots: noindex`, no SSR |
| Confidential files | ❌ Blocked | `robots.txt`, no HTML links |
| Admin console | ❌ No-index | Client-side only, auth-gated |

---

## Server-Side Rendering (SSR)

### Public Marketplace Page

**Edge-Rendered HTML:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Business Acquisition Opportunities | Sherwood Partners</title>
  <meta name="description" content="Explore verified M&A listings...">
  <meta property="og:title" content="Business Acquisition Opportunities">
  <meta property="og:image" content="https://cdn.sherwood.io/og-image.jpg">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "Product",
        "name": "SaaS Company - $5M ARR",
        "description": "Established SaaS business...",
        "offers": {
          "@type": "Offer",
          "price": "15000000",
          "priceCurrency": "USD"
        }
      }
    ]
  }
  </script>
  
  <!-- Preload critical assets -->
  <link rel="preload" as="script" href="https://cdn.sherwood.io/embed/v1/sherwood-market.js">
  <link rel="preconnect" href="https://api.sherwood.io">
</head>
<body>
  <!-- SSR'd HTML for crawlers -->
  <div id="sherwood-ssr">
    <h1>Business Acquisition Opportunities</h1>
    <article>
      <h2>SaaS Company - $5M ARR</h2>
      <p>Established SaaS business with 20% YoY growth...</p>
      <a href="/listing/uuid">View Details</a>
    </article>
    <!-- More listings... -->
  </div>
  
  <!-- Hydration data -->
  <script type="application/json" id="sherwood-data">
  {
    "listings": [...],
    "meta": {...}
  }
  </script>
  
  <!-- Web Component hydrates over SSR'd HTML -->
  <sherwood-market tenant="sherwood" module="marketplace"></sherwood-market>
</body>
</html>
```

**Hydration Strategy:**
1. Browser parses SSR'd HTML → FCP (First Contentful Paint)
2. Web Component loads async → Parse `#sherwood-data`
3. Component attaches to existing DOM → Interactive

**Benefits:**
- Crawlers see full content (no JS required)
- Fast FCP for users
- Progressive enhancement

---

### Individual Listing Pages

**Dynamic SSR:**
```javascript
// Edge function (Deno)
export async function GET(req) {
  const { id } = req.params;
  const listing = await db.getPublicListing(id);
  
  if (!listing || listing.visibility !== 'public') {
    return new Response('Not Found', { status: 404 });
  }
  
  const html = renderListingSSR(listing);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=300, s-maxage=3600', // 5min browser, 1h CDN
      'X-Robots-Tag': listing.is_searchable ? 'index, follow' : 'noindex, nofollow'
    }
  });
}
```

**Meta Tags (Per Listing):**
```html
<title>{{listing.meta_title || listing.title}} | Sherwood Partners</title>
<meta name="description" content="{{listing.meta_description || listing.description | truncate 160}}">
<meta name="robots" content="{{listing.is_searchable ? 'index, follow' : 'noindex, nofollow'}}">

<!-- Open Graph -->
<meta property="og:type" content="product">
<meta property="og:title" content="{{listing.title}}">
<meta property="og:url" content="https://sherwoodpartners.com/listing/{{listing.slug}}">
<meta property="og:image" content="{{listing.thumbnail_url}}">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{listing.title}}">
```

---

## Structured Data (Schema.org)

### Product Schema for Listings

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "SaaS Company - $5M ARR",
  "description": "Established SaaS business with recurring revenue...",
  "brand": {
    "@type": "Organization",
    "name": "Sherwood Partners"
  },
  "offers": {
    "@type": "Offer",
    "price": "15000000",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://sherwoodpartners.com/listing/uuid"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "12"
  }
}
```

**Benefits:**
- Rich snippets in Google Search (price, availability)
- Better CTR from SERPs

---

## robots.txt & Sitemap

### Dynamic robots.txt

```
User-agent: *
Allow: /
Allow: /listings
Disallow: /admin
Disallow: /api/
Disallow: */files/*
Disallow: *?token=*

Sitemap: https://sherwoodpartners.com/sitemap.xml
```

### XML Sitemap (Auto-Generated)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Only public, searchable listings -->
  <url>
    <loc>https://sherwoodpartners.com/listing/saas-company-5m-arr</loc>
    <lastmod>2025-09-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- More listings... -->
</urlset>
```

**Regeneration:**
- On listing publish/unpublish
- Daily cron job (catch edge cases)
- Ping Google: `POST https://www.google.com/ping?sitemap=...`

---

## Performance Optimization

### Asset Strategy

| Asset Type | Strategy | Cache TTL | CDN |
|------------|----------|-----------|-----|
| Web Component JS | Immutable URL (content hash) | 1 year | ✅ |
| CSS (Shadow DOM) | Inline in JS | N/A | ✅ |
| Listing thumbnails | Optimized WebP + fallback | 30 days | ✅ |
| Confidential files | Signed URL, no cache | 0 | ❌ |

### Image Optimization

**Responsive Images:**
```html
<img
  src="https://cdn.sherwood.io/listings/uuid/thumb.webp"
  srcset="
    https://cdn.sherwood.io/listings/uuid/thumb-320w.webp 320w,
    https://cdn.sherwood.io/listings/uuid/thumb-640w.webp 640w,
    https://cdn.sherwood.io/listings/uuid/thumb-1280w.webp 1280w
  "
  sizes="(max-width: 640px) 100vw, 50vw"
  alt="SaaS Company Teaser"
  loading="lazy"
>
```

**On Upload:**
1. Convert to WebP (80% quality)
2. Generate 3 sizes (320px, 640px, 1280px)
3. Upload to CDN with `Cache-Control: public, max-age=2592000, immutable`

---

### Lazy Hydration

**Defer non-critical modules:**
```html
<!-- Load marketplace immediately -->
<sherwood-market tenant="sherwood" module="marketplace"></sherwood-market>

<!-- Lazy-load Q&A widget on scroll -->
<sherwood-market
  tenant="sherwood"
  module="qna"
  listing-id="uuid"
  loading="lazy"
></sherwood-market>
```

**Implementation:**
```javascript
// Inside Web Component
if (this.getAttribute('loading') === 'lazy') {
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      this.hydrate();
      observer.disconnect();
    }
  });
  observer.observe(this);
}
```

---

### Critical CSS

**Inline above-the-fold styles:**
```html
<style>
  /* Critical CSS for SSR'd content */
  sherwood-market { display: block; min-height: 100vh; }
  .sherwood-card { border: 1px solid #e5e7eb; padding: 1rem; }
</style>
```

**Load full CSS async:**
```html
<link rel="preload" as="style" href="https://cdn.sherwood.io/embed/v1/sherwood.css">
<link rel="stylesheet" href="https://cdn.sherwood.io/embed/v1/sherwood.css" media="print" onload="this.media='all'">
```

---

## Core Web Vitals Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **LCP** (Largest Contentful Paint) | < 2.5s | SSR, image optimization, CDN |
| **FID** (First Input Delay) | < 100ms | Lazy hydration, code splitting |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Reserve space for embeds, fixed heights |
| **FCP** (First Contentful Paint) | < 1.8s | SSR, preload critical assets |
| **TTFB** (Time to First Byte) | < 600ms | Edge rendering, cache headers |

---

## Monitoring & Analytics

### Performance Monitoring

**Real User Monitoring (RUM):**
```javascript
// Track Web Vitals
import { onLCP, onFID, onCLS } from 'web-vitals';

onLCP((metric) => {
  gtag('event', 'web_vitals', {
    event_category: 'Web Vitals',
    event_label: 'LCP',
    value: Math.round(metric.value)
  });
});
```

### SEO Monitoring

**Track Rankings:**
- Google Search Console API integration
- Alert on rank drops > 10 positions
- Monthly SEO report (organic traffic, top queries)

**Crawl Monitoring:**
- Daily: Check sitemap accessibility
- Weekly: Verify no confidential URLs indexed
- Monthly: Full crawl audit (Screaming Frog)

---

## CDN Configuration (Cloudflare)

### Caching Rules

```javascript
// Edge function cache control
if (pathname.startsWith('/listing/') && isPublic(listing)) {
  return new Response(html, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'CDN-Cache-Control': 'max-age=3600',
      'Vary': 'Accept-Encoding'
    }
  });
}
```

### Purge Strategy

```javascript
// On listing edit
await cloudflare.purge({
  files: [
    `https://sherwoodpartners.com/listing/${listing.slug}`,
    `https://sherwoodpartners.com/sitemap.xml`
  ]
});
```

---

## Checklist

- ✅ SSR for public pages (marketplace, listings)
- ✅ Client-side only for private/admin
- ✅ Dynamic `robots` meta based on `is_searchable`
- ✅ Structured data (Product schema) on listings
- ✅ XML sitemap auto-updated on publish
- ✅ Confidential files excluded from `robots.txt`
- ✅ Responsive images (WebP + srcset)
- ✅ Lazy hydration for below-fold modules
- ✅ Critical CSS inlined
- ✅ CDN caching (1h for public pages, no cache for private)
- ✅ Core Web Vitals monitored
- ✅ No indexing of share token URLs (`?token=*`)
