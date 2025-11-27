# Access Control & User Roles

## Role-Based Access Control (RBAC)

The M&A Platform implements a secure role-based access control system with four distinct user roles.

### User Roles

#### 1. **Buyer** (Default)
- **Assigned to**: All new user registrations automatically
- **Permissions**:
  - View public listings in the marketplace
  - Request NDA access for private listings
  - Sign NDAs to access confidential data rooms
  - Ask questions on listings (with or without NDA)
  - View their own Q&A threads
  - Track their access requests
- **Restrictions**:
  - Cannot create or edit listings
  - Cannot access admin functionality
  - Cannot view other buyers' information

#### 2. **Admin**
- **Assigned to**: Manual assignment only
- **Permissions**:
  - All buyer permissions
  - Create, edit, and delete listings
  - View all listings (public, private, unlisted)
  - Approve/reject NDA access requests
  - Answer Q&A questions
  - Mark Q&A threads as public or private
  - View full audit logs
  - Access all confidential files without NDA
  - Manage user roles
  - Configure tenant settings
- **Key Functions**:
  - Listing management
  - Lead qualification
  - Data room administration

#### 3. **Editor**
- **Assigned to**: Manual assignment only
- **Permissions**:
  - All buyer permissions
  - Create and edit listings
  - View all listings
  - Answer Q&A questions
  - Access confidential files without NDA
- **Restrictions**:
  - Cannot approve/reject access requests (admin only)
  - Cannot view full audit logs (admin only)
  - Cannot manage user roles

#### 4. **Reviewer** (Future Use)
- **Reserved for**: Read-only administrative access
- **Planned Permissions**:
  - View all listings
  - View Q&A threads
  - View analytics
  - No modification rights

## Access Control Matrix

| Feature | Buyer | Editor | Admin | Reviewer |
|---------|-------|--------|-------|----------|
| View public listings | ✅ | ✅ | ✅ | ✅ |
| Request NDA access | ✅ | ✅ | ✅ | ✅ |
| View private listing (with NDA) | ✅ | ✅ | ✅ | ✅ |
| View confidential files (with NDA) | ✅ | N/A* | N/A* | ✅ |
| Create listings | ❌ | ✅ | ✅ | ❌ |
| Edit listings | ❌ | ✅ | ✅ | ❌ |
| Delete listings | ❌ | ❌ | ✅ | ❌ |
| Approve NDA requests | ❌ | ❌ | ✅ | ❌ |
| View all audit logs | ❌ | ❌ | ✅ | ✅ |
| Answer Q&A | ❌ | ✅ | ✅ | ❌ |
| Manage user roles | ❌ | ❌ | ✅ | ❌ |

*Editors and Admins can view confidential files without signing NDAs

## Database Implementation

### Tables

```sql
-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  role app_role NOT NULL,  -- enum: 'admin', 'editor', 'reviewer', 'buyer'
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, tenant_id, role)
);

-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'reviewer', 'buyer');
```

### Security Functions

```sql
-- Check if user has a specific role
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user has NDA access
CREATE FUNCTION public.has_nda_access(_user_id uuid, _listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.access_requests
    WHERE listing_id = _listing_id
      AND email = (SELECT email FROM auth.users WHERE id = _user_id)
      AND status = 'approved'
      AND nda_signed_at IS NOT NULL
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Check if user can view a listing
CREATE FUNCTION public.can_view_listing(_user_id uuid, _listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = _listing_id
    AND (
      (visibility_level = 'public' AND status = 'active')
      OR public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'editor')
      OR (visibility_level = 'private' AND public.has_nda_access(_user_id, _listing_id))
    )
  )
$$;
```

## NDA Workflow

### For Buyers

1. **Discover Listing**
   - Browse public marketplace
   - Or receive private share link

2. **Request Access**
   ```typescript
   // Create access request
   const { data, error } = await supabase
     .from('access_requests')
     .insert({
       listing_id: listingId,
       email: user.email,
       full_name: user.full_name,
       company: user.company,
       status: 'pending'
     });
   ```

3. **Receive NDA**
   - System sends NDA document for e-signature
   - Buyer reviews terms and conditions

4. **Sign NDA**
   ```typescript
   // Record NDA signature
   const { error } = await supabase
     .from('access_requests')
     .update({
       status: 'approved',
       nda_signed_at: new Date().toISOString(),
       signature: buyerName,
       ip_address: buyerIP
     })
     .eq('id', accessRequestId);
   ```

5. **Access Granted**
   - View complete listing details
   - Download confidential documents
   - Access data room
   - All actions logged in audit_events

### For Admins

1. **Review Access Request**
   ```typescript
   // Get pending requests
   const { data: requests } = await supabase
     .from('access_requests')
     .select('*, profiles(*)')
     .eq('listing_id', listingId)
     .eq('status', 'pending')
     .order('created_at', { ascending: false });
   ```

2. **Approve or Reject**
   ```typescript
   // Approve request
   await supabase
     .from('access_requests')
     .update({ 
       status: 'approved',
       access_token: generateAccessToken() 
     })
     .eq('id', requestId);
   ```

3. **Monitor Access**
   - View audit logs for document access
   - Track buyer engagement
   - Revoke access if needed

## Frontend Implementation

### Check User Role

```typescript
import { useAuth } from '@/hooks/useAuth';

function AdminPanel() {
  const { user, hasRole } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const adminAccess = await hasRole('admin');
      setIsAdmin(adminAccess);
    };
    
    if (user) {
      checkRole();
    }
  }, [user, hasRole]);

  if (!isAdmin) {
    return <div>Access denied</div>;
  }

  return <div>Admin content</div>;
}
```

### Conditional Rendering

```typescript
function ListingCard({ listing }) {
  const { user, hasRole } = useAuth();
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const isAdmin = await hasRole('admin');
      const isEditor = await hasRole('editor');
      setCanEdit(isAdmin || isEditor);
    };
    
    if (user) {
      checkPermissions();
    }
  }, [user, hasRole]);

  return (
    <div>
      <h3>{listing.title}</h3>
      {canEdit && (
        <button onClick={() => navigate(`/admin/edit/${listing.id}`)}>
          Edit Listing
        </button>
      )}
    </div>
  );
}
```

### Protected Routes

```typescript
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

function ProtectedRoute({ children, requiredRole }) {
  const { user, hasRole, loading } = useAuth();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const roleCheck = await hasRole(requiredRole);
      setHasAccess(roleCheck);
    };
    
    if (user) {
      checkAccess();
    }
  }, [user, hasRole, requiredRole]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (!hasAccess) {
    return <Navigate to="/" />;
  }

  return children;
}

// Usage
<Route path="/admin/create" element={
  <ProtectedRoute requiredRole="admin">
    <AdminCreate />
  </ProtectedRoute>
} />
```

## Assigning Roles Manually

To assign admin or editor roles to users:

```sql
-- Assign admin role
INSERT INTO public.user_roles (user_id, tenant_id, role)
VALUES (
  '<user_id>',
  (SELECT id FROM public.tenants WHERE slug = 'sherwood'),
  'admin'
);

-- Assign editor role
INSERT INTO public.user_roles (user_id, tenant_id, role)
VALUES (
  '<user_id>',
  (SELECT id FROM public.tenants WHERE slug = 'sherwood'),
  'editor'
);
```

You can run these queries in the Cloud backend SQL editor.

## Security Best Practices

### 1. Always Use Security Definer Functions
```sql
-- ✅ CORRECT - Uses security definer
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER  -- Critical!
SET search_path = public
AS $$
  SELECT EXISTS (...)
$$;
```

### 2. Never Check Roles in RLS Policies Directly
```sql
-- ❌ WRONG - Causes infinite recursion
CREATE POLICY "Admins can view"
ON public.listings
USING (
  (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);

-- ✅ CORRECT - Uses security definer function
CREATE POLICY "Admins can view"
ON public.listings
USING (public.has_role(auth.uid(), 'admin'));
```

### 3. Validate Client-Side, Enforce Server-Side
```typescript
// Client-side check (for UX only)
const canEdit = await hasRole('admin');

// Server-side enforcement (in RLS policy)
CREATE POLICY "Only admins can update"
ON public.listings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));
```

## Audit Logging

All sensitive actions are logged to the `audit_events` table:

```typescript
// Log file access
await supabase.from('audit_events').insert({
  listing_id: listingId,
  user_id: userId,
  event_type: 'file_downloaded',
  metadata: {
    filename: file.name,
    asset_id: assetId,
    watermark: `${email}|${ipAddress}|${timestamp}`
  },
  ip_address: request.headers.get('x-forwarded-for'),
  user_agent: request.headers.get('user-agent')
});
```

### Event Types
- `listing_viewed`
- `listing_created`
- `listing_updated`
- `file_viewed`
- `file_downloaded`
- `nda_requested`
- `nda_signed`
- `nda_rejected`
- `question_submitted`
- `question_answered`
- `access_revoked`

## Multi-Tenancy (Future)

The system is designed for multi-tenancy:

```typescript
// Each tenant has isolated users and listings
interface Tenant {
  id: string;
  slug: string;  // e.g., 'sherwood', 'acme-corp'
  name: string;
  settings: {
    marketplace_enabled: boolean;
    custom_domain?: string;
    branding?: {
      logo_url: string;
      primary_color: string;
    };
  };
}
```

Users can have different roles across tenants:
- Admin at Tenant A
- Buyer at Tenant B
