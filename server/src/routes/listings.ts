import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sql } from '../db';
import { HttpError } from '../utils/httpError';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';

const router = Router();

// Validation schemas
const createListingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  revenue: z.number().optional(),
  ebitda: z.number().optional(),
  askingPrice: z.number().optional(),
  visibilityLevel: z.enum(['public', 'private']).default('public'),
  isAnonymized: z.boolean().default(false),
  status: z.enum(['draft', 'active', 'closed', 'archived']).default('draft'),
  sourceCodeRepository: z.string().optional(),
  patentCount: z.number().optional(),
  patents: z.array(z.string()).optional(),
  trademarks: z.array(z.string()).optional(),
  copyrights: z.array(z.string()).optional(),
  dataBreakdown: z.any().optional(),
  meta: z.any().optional(),
});

const updateListingSchema = createListingSchema.partial();

/**
 * GET /api/listings
 * Get all public listings (or all if admin/editor)
 */
router.get('/', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user?.roles.includes('admin');
    const isEditor = req.user?.roles.includes('editor');

    let listings;
    
    if (isAdmin || isEditor) {
      // Admin/editor can see all listings
      listings = await sql`
        SELECT * FROM listings
        ORDER BY created_at DESC
      `;
    } else {
      // Public can only see active public listings
      listings = await sql`
        SELECT * FROM listings
        WHERE visibility_level = 'public' AND status = 'active'
        ORDER BY created_at DESC
      `;
    }

    res.json({ listings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/listings/:id
 * Get a single listing by ID
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.roles.includes('admin');
    const isEditor = req.user?.roles.includes('editor');

    const [listing] = await sql`
      SELECT * FROM listings WHERE id = ${id}
    `;

    if (!listing) {
      throw HttpError.notFound('Listing not found');
    }

    // Check access
    if (!isAdmin && !isEditor) {
      if (listing.visibility_level !== 'public' || listing.status !== 'active') {
        throw HttpError.notFound('Listing not found');
      }
    }

    res.json({ listing });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/listings
 * Create a new listing (admin/editor only)
 */
router.post(
  '/',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = createListingSchema.safeParse(req.body);
      
      if (!validation.success) {
        throw HttpError.badRequest(
          validation.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        );
      }

      const data = validation.data;

      // Get default tenant
      const [tenant] = await sql`
        SELECT id FROM tenants WHERE slug = 'sherwood' LIMIT 1
      `;

      if (!tenant) {
        throw HttpError.internal('Default tenant not found');
      }

      // Generate slug
      const slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Generate share token for private listings
      const shareToken = data.visibilityLevel === 'private'
        ? Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        : null;

      const [listing] = await sql`
        INSERT INTO listings (
          tenant_id, slug, title, description, industry, location,
          company_name, company_website, revenue, ebitda, asking_price,
          visibility_level, is_anonymized, status, share_token,
          source_code_repository, patent_count, patents, trademarks, copyrights,
          data_breakdown, meta, published_at
        ) VALUES (
          ${tenant.id}, ${slug}, ${data.title}, ${data.description || null},
          ${data.industry || null}, ${data.location || null},
          ${data.companyName || null}, ${data.companyWebsite || null},
          ${data.revenue || null}, ${data.ebitda || null}, ${data.askingPrice || null},
          ${data.visibilityLevel}, ${data.isAnonymized}, ${data.status}, ${shareToken},
          ${data.sourceCodeRepository || null}, ${data.patentCount || null},
          ${data.patents || null}, ${data.trademarks || null}, ${data.copyrights || null},
          ${data.dataBreakdown ? JSON.stringify(data.dataBreakdown) : null},
          ${data.meta ? JSON.stringify(data.meta) : null},
          ${data.status === 'active' ? new Date().toISOString() : null}
        )
        RETURNING *
      `;

      res.status(201).json({ listing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/listings/:id
 * Update a listing (admin/editor only)
 */
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validation = updateListingSchema.safeParse(req.body);
      
      if (!validation.success) {
        throw HttpError.badRequest(
          validation.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        );
      }

      const data = validation.data;

      // Check if listing exists
      const [existing] = await sql`SELECT id FROM listings WHERE id = ${id}`;
      if (!existing) {
        throw HttpError.notFound('Listing not found');
      }

      // Build update object
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      
      if (data.title !== undefined) updates.title = data.title;
      if (data.description !== undefined) updates.description = data.description;
      if (data.industry !== undefined) updates.industry = data.industry;
      if (data.location !== undefined) updates.location = data.location;
      if (data.companyName !== undefined) updates.company_name = data.companyName;
      if (data.companyWebsite !== undefined) updates.company_website = data.companyWebsite;
      if (data.revenue !== undefined) updates.revenue = data.revenue;
      if (data.ebitda !== undefined) updates.ebitda = data.ebitda;
      if (data.askingPrice !== undefined) updates.asking_price = data.askingPrice;
      if (data.visibilityLevel !== undefined) updates.visibility_level = data.visibilityLevel;
      if (data.isAnonymized !== undefined) updates.is_anonymized = data.isAnonymized;
      if (data.status !== undefined) {
        updates.status = data.status;
        if (data.status === 'active') {
          updates.published_at = new Date().toISOString();
        }
      }
      if (data.sourceCodeRepository !== undefined) updates.source_code_repository = data.sourceCodeRepository;
      if (data.patentCount !== undefined) updates.patent_count = data.patentCount;
      if (data.patents !== undefined) updates.patents = data.patents;
      if (data.trademarks !== undefined) updates.trademarks = data.trademarks;
      if (data.copyrights !== undefined) updates.copyrights = data.copyrights;
      if (data.dataBreakdown !== undefined) updates.data_breakdown = JSON.stringify(data.dataBreakdown);
      if (data.meta !== undefined) updates.meta = JSON.stringify(data.meta);

      const [listing] = await sql`
        UPDATE listings
        SET ${sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({ listing });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/listings/:id
 * Delete a listing (admin only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await sql`
        DELETE FROM listings WHERE id = ${id}
      `;

      if (result.count === 0) {
        throw HttpError.notFound('Listing not found');
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

