# Listing Anonymization Feature

## Overview

The anonymization feature allows M&A listings to hide company-identifying information until a buyer signs an NDA. This protects the seller's confidentiality while still allowing qualified buyers to evaluate the opportunity.

## How It Works

### Database Schema

```sql
ALTER TABLE public.listings
ADD COLUMN company_name TEXT,
ADD COLUMN company_website TEXT,
ADD COLUMN is_anonymized BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN scraped_data JSONB DEFAULT '{}'::jsonb;
```

### Access Control Logic

```typescript
// Check if company info should be visible
const shouldShowCompanyInfo = () => {
  if (!listing) return false;
  // Show if NOT anonymized OR user has NDA access
  return !listing.is_anonymized || hasNdaAccess;
};
```

## User Flow

### For Sellers (Creating Anonymized Listings)

1. **Navigate to Create Listing** (`/admin/create`)
2. **Fill in Basic Information**
   - Title (keep generic, e.g., "SaaS Platform - B2B Enterprise")
   - Industry, Location, Description
3. **Enter Company Information**
   - Company Name: "Acme Corporation"
   - Company Website: "https://acme.com"
   - Click "Scrape Website" to auto-fill data
4. **Toggle "Anonymize Listing"**
   - When ON: Company name/website hidden until NDA signed
   - When OFF: Company info visible to all viewers
5. **Choose Visibility Level**
   - Public: Shows in marketplace (anonymized if toggled)
   - Private: Link-only access (anonymized if toggled)
   - Unlisted: Hidden (draft mode)

### For Buyers (Viewing Anonymized Listings)

#### Public Marketplace

```
Without NDA:
- ❌ Company name hidden
- ❌ Company website hidden
- ✅ Generic title shown: "SaaS Platform - B2B Enterprise"
- ✅ Industry, location, financials visible
- ✅ Business description visible
- 🔒 Badge: "Anonymized" displayed

With NDA Signed:
- ✅ Company name revealed: "Acme Corporation"  
- ✅ Company website revealed: "acme.com"
- ✅ Full title: "Acme Corporation - SaaS Platform"
- ✅ All confidential documents accessible
```

#### Private Share Links

```
Anonymized + Private:
- Share token: /listing/abc123?token=xyz789
- Company info hidden until NDA signed
- Maintains confidentiality even with direct link

Not Anonymized + Private:
- Share token: /listing/abc123?token=xyz789  
- Company name visible (since not anonymized)
- Still requires share token to access
```

## Implementation Details

### Website Scraping

The platform uses **Firecrawl** to automatically extract company information from websites:

```typescript
// Edge Function: scrape-website
const { data } = await supabase.functions.invoke('scrape-website', {
  body: { url: 'https://acme.com' }
});

// Auto-fills:
scrapedData = {
  title: "Acme Corporation - Enterprise Software",
  description: "Leading provider of...",
  industry: "Technology",
  metadata: {
    ogTitle, ogDescription, keywords, etc.
  }
}
```

**Scraped data is stored** in `listings.scraped_data` for reference but doesn't override manual edits.

### Conditional Rendering

```tsx
// In ListingDetail.tsx

// Title Display
const getDisplayTitle = () => {
  if (listing.is_anonymized && !hasNdaAccess) {
    return listing.title; // Generic: "SaaS Platform - B2B Enterprise"
  }
  if (listing.company_name) {
    return `${listing.company_name} - ${listing.title}`;
  }
  return listing.title;
};

// Company Info Display
{shouldShowCompanyInfo() && listing.company_name && (
  <div>
    <Building2 />
    <p>Company: {listing.company_name}</p>
  </div>
)}

// Anonymization Notice
{listing.is_anonymized && !hasNdaAccess && (
  <Badge>
    <EyeOff /> Anonymized
  </Badge>
  <p>Sign NDA to reveal company identity</p>
)}
```

### NDA Access Check

```typescript
const checkNdaAccess = async () => {
  const { data } = await supabase
    .from('access_requests')
    .select('*')
    .eq('listing_id', listingId)
    .eq('email', user.email)
    .eq('status', 'approved')
    .not('nda_signed_at', 'is', null)
    .maybeSingle();

  if (data) {
    setHasNdaAccess(true); // Reveal company info
  }
};
```

## Visibility Matrix

| Visibility | Anonymized | Public View | Share Link | NDA Required |
|------------|------------|-------------|------------|--------------|
| Public | ✅ Yes | Generic title, no company | N/A | Yes (for company name) |
| Public | ❌ No | Full title with company | N/A | No |
| Private | ✅ Yes | Not in marketplace | Generic title, no company | Yes (for company name) |
| Private | ❌ No | Not in marketplace | Full title with company | No (but needs token) |
| Unlisted | Either | Hidden | Hidden | N/A (draft) |

## Security Considerations

### RLS Policies

The anonymization is **client-side rendering logic only**. The database still contains the company name. Ensure RLS policies don't leak data:

```sql
-- Listings are accessible based on visibility, not anonymization
CREATE POLICY "Public listings viewable by all"
  ON public.listings FOR SELECT
  USING (
    visibility_level = 'public' 
    AND status = 'active'
  );

-- Anonymization is purely a UI concern
-- Company name is in the row but conditionally displayed
```

**Important**: The company name is **always returned** from the database. Anonymization is enforced by:
1. **Frontend**: Conditional rendering based on `is_anonymized` + `hasNdaAccess`
2. **Backend**: No special filtering (company name is in the response)

This approach allows flexibility but means:
- ⚠️ Client-side source code can reveal company name
- ⚠️ API responses include company_name field
- ✅ Normal users won't see it in UI (unless they inspect)

For **maximum security**, consider:
1. Server-side filtering in API/RPC functions
2. Separate confidential fields into a different table
3. Return company_name only when `has_nda_access()` is true

## Example Scenarios

### Scenario 1: Confidential Sale

```
Seller: TechCorp (publicly traded, seeking discreet buyer)

Settings:
- Visibility: Private
- Anonymized: Yes
- Title: "AI Analytics Platform - Series C"

Outcome:
- Only buyers with share link can find listing
- Company name "TechCorp" hidden until NDA signed
- Financial metrics visible (no company-identifying info)
- After NDA: Full details including "TechCorp" revealed
```

### Scenario 2: Public Marketplace Sale

```
Seller: StartupABC (seeking broad exposure)

Settings:
- Visibility: Public  
- Anonymized: No
- Company Name: "StartupABC"
- Title: "E-commerce Platform"

Outcome:
- Listed on public marketplace
- Full title: "StartupABC - E-commerce Platform"
- Company website visible: "startabc.com"
- NDA still required for confidential docs/financials
```

### Scenario 3: Semi-Public with Anonymization

```
Seller: FinanceCo (public exposure but identity protected)

Settings:
- Visibility: Public
- Anonymized: Yes  
- Title: "Wealth Management Platform"

Outcome:
- Shows in public marketplace
- Title: "Wealth Management Platform" (company name hidden)
- Badge: "Anonymized" displayed
- Buyers see: Industry, location, revenue, EBITDA
- Company identity revealed only post-NDA
```

## Testing Checklist

- [ ] Create anonymized + public listing
  - [ ] Company name hidden on marketplace
  - [ ] Company name hidden on detail page (no NDA)
  - [ ] Company name revealed after signing NDA
- [ ] Create anonymized + private listing
  - [ ] Not shown in marketplace
  - [ ] Share link shows generic info only
  - [ ] NDA reveals company name
- [ ] Create non-anonymized + public listing
  - [ ] Company name visible everywhere
  - [ ] No "Anonymized" badge
- [ ] Website scraping
  - [ ] Scrape real company website
  - [ ] Verify auto-fill of title, description, industry
  - [ ] Scraped data stored in `scraped_data` field
- [ ] Edge cases
  - [ ] Anonymous user viewing anonymized listing
  - [ ] Authenticated user (no NDA) viewing anonymized listing
  - [ ] Admin/editor viewing anonymized listing (bypass check?)

## Future Enhancements

1. **Server-Side Anonymization**
   - Create view or RPC function that filters company_name
   - Only return company_name if `has_nda_access()`

2. **Partial Anonymization**
   - Option to hide company name but show website
   - Option to show industry-specific hints (e.g., "Fortune 500 SaaS")

3. **Automatic De-anonymization**
   - After NDA signed, send email with company reveal
   - Update listing UI with animation/notification

4. **Analytics**
   - Track how many views anonymized listing gets
   - Measure NDA conversion rate (views → NDA signed)

5. **AI-Generated Anonymous Titles**
   - Use Lovable AI to create compelling anonymous titles
   - "High-Growth SaaS Platform with 150% YoY Growth"
   - Based on scraped data without revealing company

## Troubleshooting

### Company Name Still Showing

**Check:**
- Is `is_anonymized = true` in database?
- Is `hasNdaAccess` state being set correctly?
- Is `shouldShowCompanyInfo()` logic correct?

**Debug:**
```typescript
console.log('Anonymized:', listing.is_anonymized);
console.log('Has NDA:', hasNdaAccess);
console.log('Should show:', shouldShowCompanyInfo());
```

### Scraping Fails

**Common Issues:**
- Invalid URL format
- FIRECRAWL_API_KEY not set in secrets
- Website blocks scraping (Cloudflare, etc.)
- Rate limiting on Firecrawl API

**Solutions:**
- Verify URL is valid HTTPS
- Check secret is configured: `supabase secrets list`
- Try different website or manual entry
- Check Firecrawl dashboard for rate limit status

### NDA Access Not Working

**Check:**
- User is authenticated (`user` is not null)
- `access_requests` row exists for user's email
- `status = 'approved'`
- `nda_signed_at` is not null
- `expires_at` is null or in future

**Fix:**
```sql
-- Manually grant NDA access for testing
INSERT INTO access_requests (
  listing_id, email, full_name, status, nda_signed_at
) VALUES (
  'listing-uuid',
  'buyer@example.com', 
  'John Doe',
  'approved',
  now()
);
```

## Related Documentation

- [Access Control & Roles](./access-control.md)
- [Papermark Integration](./papermark-integration.md)
- [API Specification](./api-spec.md)
