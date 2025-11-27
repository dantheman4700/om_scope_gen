# Theming & Design Tokens

## CSS Custom Properties

The Web Component inherits these CSS variables from the host page. Define them in your site's stylesheet:

```css
:root {
  /* Brand Colors */
  --sw-color-brand: #1a365d;        /* Primary brand color */
  --sw-color-accent: #d4af37;       /* Accent/CTA color */
  --sw-color-success: #10b981;      /* Success states */
  --sw-color-warning: #f59e0b;      /* Warning states */
  --sw-color-error: #ef4444;        /* Error states */
  
  /* Backgrounds */
  --sw-bg: #ffffff;                 /* Main background */
  --sw-bg-secondary: #f9fafb;       /* Secondary background */
  --sw-bg-elevated: #ffffff;        /* Cards, modals */
  
  /* Text */
  --sw-text: #111827;               /* Primary text */
  --sw-text-muted: #6b7280;         /* Secondary text */
  --sw-text-on-brand: #ffffff;      /* Text on brand color */
  
  /* Borders */
  --sw-border: #e5e7eb;             /* Default border */
  --sw-border-strong: #d1d5db;      /* Emphasized border */
  
  /* Radius */
  --sw-radius: 8px;                 /* Default border-radius */
  --sw-radius-sm: 4px;              /* Small elements */
  --sw-radius-lg: 12px;             /* Large elements */
  
  /* Shadows */
  --sw-shadow: 0 1px 3px rgba(0,0,0,0.1);
  --sw-shadow-lg: 0 10px 30px rgba(0,0,0,0.15);
  
  /* Typography */
  --sw-font-headings: 'Merriweather', serif;
  --sw-font-body: 'Inter', sans-serif;
  --sw-font-mono: 'Fira Code', monospace;
  
  /* Spacing (multiplier) */
  --sw-spacing-unit: 4px;           /* Base unit (4px grid) */
  
  /* Transitions */
  --sw-transition: 200ms ease-in-out;
}
```

---

## Dark Mode Support

Define dark mode tokens using `@media (prefers-color-scheme: dark)` or a `.dark` class:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --sw-bg: #111827;
    --sw-bg-secondary: #1f2937;
    --sw-bg-elevated: #374151;
    --sw-text: #f9fafb;
    --sw-text-muted: #9ca3af;
    --sw-border: #374151;
    --sw-border-strong: #4b5563;
  }
}

/* Or class-based dark mode */
.dark {
  --sw-bg: #111827;
  /* ... */
}
```

The Web Component automatically responds to color scheme changes.

---

## Programmatic Theme Override

Pass a JSON theme object via the `theme` prop to lock in specific values:

```html
<sherwood-market
  theme='{
    "brand": "#1a365d",
    "accent": "#d4af37",
    "bg": "#ffffff",
    "text": "#111827",
    "radius": "8px",
    "fontHeadings": "Merriweather, serif",
    "fontBody": "Inter, sans-serif"
  }'
></sherwood-market>
```

**When to Use:**
- Host page doesn't define CSS variables
- Need to override specific tokens per embed
- Multi-tenant sites with different branding per client

---

## Component-Specific Classes

For advanced customization, target Shadow DOM parts using `::part()`:

```css
sherwood-market::part(listing-card) {
  border: 2px solid var(--sw-color-brand);
}

sherwood-market::part(cta-button) {
  background: linear-gradient(135deg, var(--sw-color-brand), var(--sw-color-accent));
}
```

**Available Parts:**
- `listing-card`: Individual listing cards
- `cta-button`: Primary CTA buttons
- `modal-overlay`: NDA/password modals
- `filter-panel`: Search/filter sidebar
- `file-list-item`: File download items

---

## Typography Scale

The component uses a modular scale based on `--sw-font-body`:

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Heading 1 | 2.5rem (40px) | 700 | 1.2 |
| Heading 2 | 2rem (32px) | 700 | 1.3 |
| Heading 3 | 1.5rem (24px) | 600 | 1.4 |
| Body | 1rem (16px) | 400 | 1.6 |
| Small | 0.875rem (14px) | 400 | 1.5 |
| Caption | 0.75rem (12px) | 400 | 1.4 |

---

## Spacing System

Based on `--sw-spacing-unit` (default 4px):

```css
/* Internal component spacing */
.sherwood-stack-1 { gap: calc(var(--sw-spacing-unit) * 1); } /* 4px */
.sherwood-stack-2 { gap: calc(var(--sw-spacing-unit) * 2); } /* 8px */
.sherwood-stack-4 { gap: calc(var(--sw-spacing-unit) * 4); } /* 16px */
.sherwood-stack-6 { gap: calc(var(--sw-spacing-unit) * 6); } /* 24px */
```

---

## Example Integrations

### Ghost Blog Theme
```liquid
<!-- In your Ghost theme's default.hbs -->
<style>
  :root {
    --sw-color-brand: {{@site.accent_color}};
    --sw-font-headings: {{@site.font_heading}};
    --sw-font-body: {{@site.font_body}};
  }
</style>

<script type="module" src="https://cdn.sherwood.io/embed/v1/sherwood-market.js"></script>
```

### WordPress (Custom CSS)
```css
/* In Appearance > Customize > Additional CSS */
:root {
  --sw-color-brand: #1a365d; /* Match your theme */
  --sw-color-accent: #d4af37;
}
```

### Webflow
```html
<!-- In Page Settings > Custom Code (Head) -->
<style>
  :root {
    --sw-color-brand: #1a365d;
    --sw-font-headings: var(--font-heading); /* Use Webflow's font var */
  }
</style>
```

---

## Responsive Behavior

The component is fully responsive. Override breakpoints via custom properties:

```css
:root {
  --sw-breakpoint-sm: 640px;
  --sw-breakpoint-md: 768px;
  --sw-breakpoint-lg: 1024px;
  --sw-breakpoint-xl: 1280px;
}
```

**Mobile-First Design:**
- Cards stack vertically on mobile
- Filters collapse into a drawer
- NDA modal is full-screen on small devices

---

## Design Token Export

For design teams, download the full token JSON:

```bash
curl https://cdn.sherwood.io/embed/v1/tokens.json
```

**Output:**
```json
{
  "color": {
    "brand": { "value": "#1a365d", "type": "color" },
    "accent": { "value": "#d4af37", "type": "color" }
  },
  "typography": {
    "headings": { "value": "Merriweather, serif", "type": "fontFamily" },
    "body": { "value": "Inter, sans-serif", "type": "fontFamily" }
  }
}
```

Use with Figma Tokens, Style Dictionary, or design tools.
