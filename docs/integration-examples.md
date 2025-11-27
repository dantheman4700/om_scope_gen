# Integration Examples

## Ghost Blog Integration

### 1. Add Script to Theme

Edit your Ghost theme's `default.hbs` (or inject via Code Injection):

```liquid
{{!-- In the <head> section --}}
<link rel="stylesheet" href="https://cdn.sherwood.io/embed/v1/sherwood-market.css">

{{!-- Before closing </body> --}}
<script type="module" src="https://cdn.sherwood.io/embed/v1/sherwood-market.js"></script>

<style>
  /* Inherit Ghost theme colors */
  :root {
    --sw-color-brand: {{@site.accent_color}};
    --sw-font-headings: {{@site.font_heading}};
    --sw-font-body: {{@site.font_body}};
  }
</style>
```

---

### 2. Create Marketplace Page

Create a new page in Ghost (`/acquisitions`) with this HTML content:

```html
<sherwood-market
  tenant="sherwood"
  module="marketplace"
  filters='{"industry": "Software"}'
></sherwood-market>

<script>
  // Track leads in Ghost analytics
  document.querySelector('sherwood-market').addEventListener('sherwood:lead', (e) => {
    gtag('event', 'lead_generated', {
      listing_id: e.detail.listingId,
      listing_title: e.detail.listingTitle
    });
  });
</script>
```

---

### 3. Dynamic Listing Pages (Optional)

For SEO, create individual Ghost posts for each listing:

```markdown
---
title: SaaS Company - $5M ARR
slug: listing-saas-company-5m-arr
custom_template: listing
---

<sherwood-market
  tenant="sherwood"
  module="listing"
  listing-id="550e8400-e29b-41d4-a716-446655440000"
  require-nda="true"
></sherwood-market>
```

**Benefits:**
- Ghost handles SEO meta tags
- Embeds just the listing detail
- Full control over page layout

---

## WordPress Integration

### 1. Add Script via Theme Functions

Edit `functions.php` in your theme:

```php
function sherwood_enqueue_scripts() {
  wp_enqueue_script(
    'sherwood-market',
    'https://cdn.sherwood.io/embed/v1/sherwood-market.js',
    [],
    '1.0',
    true
  );
  
  // Pass theme colors to embed
  $brand_color = get_theme_mod('primary_color', '#1a365d');
  wp_add_inline_style('wp-block-library', "
    :root {
      --sw-color-brand: {$brand_color};
    }
  ");
}
add_action('wp_enqueue_scripts', 'sherwood_enqueue_scripts');
```

---

### 2. Create Marketplace Page

Create a new page in WordPress, add this shortcode:

```
[sherwood_market tenant="sherwood" module="marketplace"]
```

**Shortcode Implementation** (add to `functions.php`):

```php
function sherwood_market_shortcode($atts) {
  $atts = shortcode_atts([
    'tenant' => '',
    'module' => 'marketplace',
    'listing_id' => '',
    'filters' => '{}',
    'theme' => ''
  ], $atts);
  
  $html = '<sherwood-market';
  foreach ($atts as $key => $value) {
    if (!empty($value)) {
      $key = str_replace('_', '-', $key);
      $html .= sprintf(' %s="%s"', esc_attr($key), esc_attr($value));
    }
  }
  $html .= '></sherwood-market>';
  
  return $html;
}
add_shortcode('sherwood_market', 'sherwood_market_shortcode');
```

---

### 3. Custom Post Type for Listings (Advanced)

Create a CPT to mirror Sherwood listings:

```php
function sherwood_register_cpt() {
  register_post_type('sherwood_listing', [
    'label' => 'Listings',
    'public' => true,
    'has_archive' => true,
    'rewrite' => ['slug' => 'listings'],
    'supports' => ['title', 'editor', 'thumbnail'],
    'menu_icon' => 'dashicons-money-alt'
  ]);
  
  add_meta_box('sherwood_listing_id', 'Sherwood Listing ID', function($post) {
    $listing_id = get_post_meta($post->ID, 'sherwood_listing_id', true);
    echo '<input type="text" name="sherwood_listing_id" value="' . esc_attr($listing_id) . '" />';
  }, 'sherwood_listing', 'side');
}
add_action('init', 'sherwood_register_cpt');

function sherwood_single_template($template) {
  if (is_singular('sherwood_listing')) {
    $listing_id = get_post_meta(get_the_ID(), 'sherwood_listing_id', true);
    ?>
    <sherwood-market
      tenant="sherwood"
      module="listing"
      listing-id="<?php echo esc_attr($listing_id); ?>"
      require-nda="true"
    ></sherwood-market>
    <?php
    return get_template_directory() . '/single-sherwood-listing.php';
  }
  return $template;
}
add_filter('single_template', 'sherwood_single_template');
```

---

## Webflow Integration

### 1. Embed Code (Global Head)

In **Site Settings → Custom Code → Head Code**:

```html
<link rel="stylesheet" href="https://cdn.sherwood.io/embed/v1/sherwood-market.css">
<script type="module" src="https://cdn.sherwood.io/embed/v1/sherwood-market.js"></script>

<style>
  :root {
    --sw-color-brand: #1a365d;
    --sw-font-headings: var(--font-heading); /* Use Webflow's font variable */
  }
</style>
```

---

### 2. Add to Page

1. Drag an **Embed** element to your page
2. Paste this code:

```html
<sherwood-market
  tenant="sherwood"
  module="marketplace"
  style="display: block; min-height: 800px;"
></sherwood-market>
```

**Tip:** Set min-height to avoid CLS (Cumulative Layout Shift).

---

### 3. Dynamic CMS Integration

For dynamic listing pages in Webflow CMS:

1. Create CMS collection: **Listings**
   - Fields: `Title`, `Sherwood Listing ID`, `Slug`
2. In collection template, add Embed element:

```html
<sherwood-market
  tenant="sherwood"
  module="listing"
  listing-id="{{wf {&quot;path&quot;:&quot;sherwood-listing-id&quot;,&quot;type&quot;:&quot;PlainText&quot;\} }}"
  require-nda="true"
></sherwood-market>
```

---

## Static HTML Site

Perfect for GitHub Pages, Netlify, Vercel, etc.

### Basic Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acquisition Opportunities | Sherwood Partners</title>
  
  <link rel="stylesheet" href="https://cdn.sherwood.io/embed/v1/sherwood-market.css">
  <style>
    :root {
      --sw-color-brand: #1a365d;
      --sw-color-accent: #d4af37;
      --sw-font-headings: 'Merriweather', serif;
      --sw-font-body: 'Inter', sans-serif;
    }
    
    body {
      margin: 0;
      font-family: var(--sw-font-body);
    }
    
    header {
      background: var(--sw-color-brand);
      color: white;
      padding: 2rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <h1>Acquisition Opportunities</h1>
    <p>Explore verified M&A listings from Sherwood Partners</p>
  </header>
  
  <main style="max-width: 1200px; margin: 2rem auto; padding: 0 1rem;">
    <sherwood-market
      tenant="sherwood"
      module="marketplace"
      filters='{"industry": "Software"}'
    ></sherwood-market>
  </main>
  
  <script type="module" src="https://cdn.sherwood.io/embed/v1/sherwood-market.js"></script>
  
  <script>
    // Track events
    const market = document.querySelector('sherwood-market');
    
    market.addEventListener('sherwood:lead', (e) => {
      console.log('Lead captured:', e.detail);
      // Send to your analytics
      if (window.gtag) {
        gtag('event', 'lead', {
          listing_id: e.detail.listingId,
          buyer_email: e.detail.buyer.email
        });
      }
    });
    
    market.addEventListener('sherwood:error', (e) => {
      alert('Error: ' + e.detail.message);
    });
  </script>
</body>
</html>
```

---

## React App (Next.js)

### 1. Install React SDK

```bash
npm install @sherwood/market-react
```

---

### 2. Use Component

```tsx
// app/listings/page.tsx
'use client';

import { SherwoodMarket } from '@sherwood/market-react';
import { useRouter } from 'next/navigation';

export default function ListingsPage() {
  const router = useRouter();
  
  const handleLead = (detail: any) => {
    console.log('Lead:', detail);
    // Send to your backend
    fetch('/api/crm/lead', {
      method: 'POST',
      body: JSON.stringify(detail)
    });
  };
  
  const handleNdaSigned = (detail: any) => {
    // Store access token in session
    sessionStorage.setItem('sherwood_access_token', detail.accessToken);
    router.push(`/listing/${detail.listingId}`);
  };
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8">Acquisition Opportunities</h1>
      
      <SherwoodMarket
        tenant="sherwood"
        module="marketplace"
        filters={{ industry: 'Software' }}
        onLead={handleLead}
        onNdaSigned={handleNdaSigned}
        onError={(detail) => console.error(detail)}
      />
    </div>
  );
}
```

---

### 3. SSR Support (Optional)

For SEO, render marketplace HTML server-side:

```tsx
// app/listings/page.tsx
import { Suspense } from 'react';

async function getListings() {
  const res = await fetch('https://api.sherwood.io/v1/marketplace?tenant=sherwood', {
    next: { revalidate: 300 } // Cache 5 min
  });
  return res.json();
}

export default async function ListingsPage() {
  const { data: listings } = await getListings();
  
  return (
    <div>
      {/* SSR'd fallback for crawlers */}
      <noscript>
        <div className="grid gap-4">
          {listings.map((listing) => (
            <article key={listing.id}>
              <h2>{listing.title}</h2>
              <p>{listing.description}</p>
              <a href={`/listing/${listing.slug}`}>View Details</a>
            </article>
          ))}
        </div>
      </noscript>
      
      {/* Client-side Web Component */}
      <Suspense fallback={<div>Loading...</div>}>
        <SherwoodMarket tenant="sherwood" module="marketplace" />
      </Suspense>
    </div>
  );
}
```

---

## CSP Configuration

If your site has strict Content Security Policy, add these directives:

```
Content-Security-Policy:
  script-src 'self' https://cdn.sherwood.io;
  style-src 'self' 'unsafe-inline';
  connect-src https://api.sherwood.io;
  img-src https://cdn.sherwood.io;
  frame-src https://embed.sherwood.io;
```

**For iframe fallback only:**
```html
<iframe
  src="https://embed.sherwood.io/v1/marketplace?tenant=sherwood"
  width="100%"
  height="800"
  frameborder="0"
  allow="clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-forms"
></iframe>
```

---

## Testing Embed

After adding the embed, verify:

1. **Visual Check**: Listings display correctly
2. **Console**: No errors in browser console
3. **Events**: `sherwood:ready` fires on load
4. **Theming**: Colors match your site
5. **Mobile**: Responsive on small screens
6. **SEO**: View page source → HTML contains listing data (if SSR enabled)

**Debugging:**
```javascript
// Check if component loaded
console.log(customElements.get('sherwood-market'));

// Force re-render
document.querySelector('sherwood-market').setAttribute('tenant', 'sherwood');
```

---

## Need Help?

- **Docs**: https://docs.sherwood.io/embed
- **Support**: support@sherwoodpartners.com
- **Community**: https://community.sherwood.io
