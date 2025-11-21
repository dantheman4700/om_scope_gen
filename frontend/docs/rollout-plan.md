# Rollout Plan & Implementation Phases

## Phase 0: Foundation (Weeks 1-2)

### Backend Infrastructure
- [ ] Enable Lovable Cloud (Supabase)
- [ ] Create multi-tenant database schema (see `data-model.md`)
- [ ] Implement RLS policies for all tables
- [ ] Set up storage buckets (public + confidential)
- [ ] Deploy initial edge functions:
  - `GET /v1/marketplace`
  - `GET /v1/listings/:id`
  - `POST /v1/access-requests`

### Deliverables
- Database fully seeded with test data (3 tenants, 20 listings)
- Postman collection for API testing
- RLS verification tests passing

---

## Phase 1: Core Embed (Weeks 3-5)

### Web Component Development
- [ ] Build `<sherwood-market>` base component (Lit)
- [ ] Implement modules:
  - `marketplace`: Grid view with search/filter
  - `listing`: Detail page with image gallery
  - `nda-gate`: Modal for access request form
- [ ] Theming system (CSS custom properties)
- [ ] Event emitters (`sherwood:lead`, `sherwood:error`)

### SSR Layer
- [ ] Edge function for marketplace HTML rendering
- [ ] Edge function for listing detail HTML rendering
- [ ] Structured data (JSON-LD) generation
- [ ] Dynamic `robots` meta handling

### Testing
- [ ] Unit tests (Jest + Testing Library)
- [ ] E2E tests (Playwright):
  - Marketplace loads and displays listings
  - Filter by industry works
  - Listing detail shows correct data
  - Access request form submits successfully
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Deliverables
- CDN-deployed Web Component (`cdn.sherwood.io/embed/v1/`)
- Demo site: `demo.sherwood.io/embed-test.html`
- Integration guide for Ghost (see `integration-examples.md`)

---

## Phase 2: NDA & File Access (Weeks 6-8)

### Magic Link Auth
- [ ] Implement passwordless flow:
  - `POST /v1/access-requests` → sends email
  - `GET /v1/auth/magic?token=...` → validates token
  - Returns session JWT (24h expiry)
- [ ] Email templates (Resend/SendGrid)
- [ ] Token expiry + cleanup cron

### NDA Signing
- [ ] `POST /v1/nda/sign` endpoint
- [ ] NDA PDF generation (with signature metadata)
- [ ] Store signed NDA in confidential storage
- [ ] Issue NDA-scoped access token

### File Access
- [ ] `GET /v1/listings/:id/files` (auth-gated)
- [ ] Signed URL generation (5min expiry)
- [ ] Watermarking service:
  - PDF: Text overlay on each page
  - Images: Text overlay (email + timestamp)
- [ ] Audit logging (`file_access_logs` table)

### Web Component Updates
- [ ] `nda-gate` module enhancements:
  - Magic link "check your email" screen
  - NDA agreement display
  - E-signature input
- [ ] File list with download buttons
- [ ] `sherwood:nda-signed` event

### Testing
- [ ] E2E: Full NDA flow (request → email → sign → file access)
- [ ] Security: Verify watermarks embed correctly
- [ ] Security: Verify expired tokens rejected

### Deliverables
- Full NDA workflow functional
- Watermarked sample files
- Audit log dashboard (basic admin view)

---

## Phase 3: Q&A System (Weeks 9-10)

### Backend
- [ ] `POST /v1/qna` endpoint
- [ ] `GET /v1/qna?listing_id=...` (public FAQ filter)
- [ ] `POST /v1/qna/:thread_id/reply` (admin only)
- [ ] Email notifications:
  - Seller: New question submitted
  - Buyer: Answer received
- [ ] Webhook: `question.submitted` → CRM

### Web Component
- [ ] `qna` module:
  - Question submission form
  - FAQ display (accordion)
  - Real-time updates (Supabase Realtime)
- [ ] `sherwood:question-submitted` event

### Admin Console
- [ ] Q&A inbox:
  - List unanswered questions
  - Reply interface (rich text editor)
  - Mark as public FAQ toggle

### Testing
- [ ] E2E: Submit question → admin replies → buyer notified
- [ ] Realtime: Verify FAQ updates without refresh

### Deliverables
- Live Q&A on demo site
- Admin console Q&A section

---

## Phase 4: Admin Console (Weeks 11-13)

### Features
- [ ] Listing management:
  - Create/edit listing form (WYSIWYG editor)
  - Upload public/confidential files
  - Visibility settings (public/private/unlisted)
  - Password protection toggle
  - SEO settings (`meta_title`, `meta_description`, `is_searchable`)
- [ ] Share link generator:
  - Auto-generate `share_token`
  - Copy-to-clipboard button
  - View access stats (views, unique visitors)
- [ ] Analytics dashboard:
  - Total views, leads, NDA sign rate
  - Top-performing listings
  - Funnel visualization (view → lead → NDA → file access)
- [ ] Audit log viewer:
  - Filter by event type, date range
  - Export to CSV
- [ ] User management:
  - Invite team members (email)
  - Assign roles (admin/editor/reviewer)
  - Revoke access

### Web Component
- [ ] `admin` module (full SPA):
  - React-based for richer UX
  - Auth-gated (JWT required)
  - Responsive design

### Testing
- [ ] E2E: Create listing → publish → verify on marketplace
- [ ] E2E: Generate share link → access via token
- [ ] Security: Verify editor cannot delete listings

### Deliverables
- Admin console live at `admin.sherwood.io`
- User guide (video walkthrough)

---

## Phase 5: CRM Integrations (Weeks 14-15)

### Webhooks
- [ ] Webhook configuration UI (admin settings)
- [ ] Retry logic (3 attempts, exponential backoff)
- [ ] Event catalog:
  - `lead.created`
  - `nda.signed`
  - `question.submitted`
  - `file.downloaded`

### Pre-Built Integrations
- [ ] **HubSpot**: Create contact + deal on lead
- [ ] **Salesforce**: Create lead record
- [ ] **Pipedrive**: Add person + deal
- [ ] **Zapier**: Generic webhook trigger

### Testing
- [ ] E2E: Access request → HubSpot contact created
- [ ] Retry: Simulate webhook failure, verify retry

### Deliverables
- Integration guides for each CRM
- Zapier app published (if time permits)

---

## Phase 6: Polish & Launch (Weeks 16-17)

### Performance Optimization
- [ ] Lighthouse audit (target 90+ score)
- [ ] Image optimization (WebP conversion, lazy loading)
- [ ] Code splitting (marketplace vs admin bundles)
- [ ] CDN cache tuning

### SEO Finalization
- [ ] Sitemap generation + auto-submit to Google
- [ ] Verify no confidential URLs indexed
- [ ] Submit to Google Search Console

### Documentation
- [ ] API reference (OpenAPI spec)
- [ ] Embed guide (Ghost, WordPress, Webflow)
- [ ] Video tutorials (5-10 min each):
  - Embedding the marketplace
  - Creating a listing
  - Managing NDA flows

### Security Audit
- [ ] Penetration testing (third-party)
- [ ] Fix identified vulnerabilities
- [ ] GDPR compliance review

### Beta Launch
- [ ] Invite 3-5 beta customers
- [ ] Gather feedback (surveys, interviews)
- [ ] Iterate on UX pain points

### Deliverables
- Production-ready platform
- Public marketing site (`sherwood.io/embed`)
- Case study (beta customer testimonial)

---

## Post-Launch (Ongoing)

### v2 Features (Months 2-4)
- [ ] Advanced analytics (Google Analytics integration)
- [ ] A/B testing framework (test NDA forms, CTAs)
- [ ] Multi-language support (i18n)
- [ ] White-label customization (remove Sherwood branding)
- [ ] Mobile app (React Native) for admin

### Maintenance
- [ ] Monthly security updates
- [ ] Quarterly dependency upgrades
- [ ] Performance monitoring (track Core Web Vitals)
- [ ] Customer support (dedicated Slack channel)

---

## Success Metrics

### Phase 1 (Core Embed)
- [ ] 3 beta customers onboarded
- [ ] 90+ Lighthouse score
- [ ] < 2.5s LCP on marketplace page

### Phase 2 (NDA)
- [ ] 50+ NDAs signed (across all tenants)
- [ ] 0 security incidents (leaked files)
- [ ] < 10s average NDA sign time

### Phase 3 (Q&A)
- [ ] 100+ questions submitted
- [ ] 80% answer rate within 24h

### Phase 6 (Launch)
- [ ] 20+ production customers
- [ ] 1000+ listings published
- [ ] 5000+ monthly active buyers
- [ ] $50k+ MRR (SaaS revenue)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLS policy bugs (data leak) | Critical | Automated RLS tests, manual audits |
| Watermarking service downtime | High | Fallback: Block downloads, queue retries |
| CDN outage | High | Multi-CDN (Cloudflare + Fastly) |
| Customer onboarding slow | Medium | Pre-built templates, onboarding wizard |
| SEO penalties (duplicate content) | Medium | Canonical tags, unique descriptions |

---

## Team & Resources

**Roles:**
- **Tech Lead** (1): Architecture, code reviews
- **Backend Dev** (1): Edge functions, database
- **Frontend Dev** (1): Web Component, admin console
- **Designer** (0.5): Theming, UX polish
- **QA** (0.5): E2E tests, security audit

**Tools:**
- **Project Management**: Linear
- **Design**: Figma
- **Code**: GitHub (monorepo: `sherwood-embed`)
- **CI/CD**: GitHub Actions → Lovable Cloud auto-deploy
- **Monitoring**: Sentry (errors), Vercel Analytics (performance)
