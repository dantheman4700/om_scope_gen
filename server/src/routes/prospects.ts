import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sql } from '../db';
import { HttpError } from '../utils/httpError';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Validation schemas
const createProspectSchema = z.object({
  listingId: z.string().uuid('Invalid listing ID'),
  company: z.string().min(1, 'Company name is required'),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  stage: z.enum([
    'unknown', 'new', 'disqualified', 'sent_outreach',
    'reviewing', 'nda_signed', 'loi_submitted', 'passed', 'buyer'
  ]).default('new'),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

const updateProspectSchema = createProspectSchema.partial().omit({ listingId: true });

/**
 * GET /api/prospects
 * Get prospects for a listing (admin/editor only)
 */
router.get(
  '/',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const listingId = req.query.listing_id as string;

      if (!listingId) {
        throw HttpError.badRequest('listing_id parameter required');
      }

      const prospects = await sql`
        SELECT * FROM listing_prospects
        WHERE listing_id = ${listingId}
        ORDER BY created_at DESC
      `;

      res.json({ prospects });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/prospects/:id
 * Get a single prospect
 */
router.get(
  '/:id',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const [prospect] = await sql`
        SELECT * FROM listing_prospects WHERE id = ${id}
      `;

      if (!prospect) {
        throw HttpError.notFound('Prospect not found');
      }

      res.json({ prospect });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/prospects
 * Create a new prospect (also used as webhook endpoint)
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = createProspectSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw HttpError.badRequest(
        validation.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }

    const data = validation.data;

    // Check if prospect already exists by email
    if (data.contactEmail) {
      const [existing] = await sql`
        SELECT id FROM listing_prospects
        WHERE listing_id = ${data.listingId}
        AND contact_email = ${data.contactEmail}
      `;

      if (existing) {
        // Update existing prospect
        const [prospect] = await sql`
          UPDATE listing_prospects
          SET 
            company = ${data.company},
            contact_name = ${data.contactName || null},
            contact_phone = ${data.contactPhone || null},
            stage = ${data.stage},
            notes = ${data.notes || null},
            metadata = ${data.metadata ? JSON.stringify(data.metadata) : null},
            updated_at = ${new Date().toISOString()}
          WHERE id = ${existing.id}
          RETURNING *
        `;

        res.json({ success: true, prospect, action: 'updated' });
        return;
      }
    }

    // Create new prospect
    const [prospect] = await sql`
      INSERT INTO listing_prospects (
        listing_id, company, contact_name, contact_email,
        contact_phone, stage, notes, metadata
      ) VALUES (
        ${data.listingId}, ${data.company}, ${data.contactName || null},
        ${data.contactEmail || null}, ${data.contactPhone || null},
        ${data.stage}, ${data.notes || null},
        ${data.metadata ? JSON.stringify(data.metadata) : null}
      )
      RETURNING *
    `;

    res.status(201).json({ success: true, prospect, action: 'created' });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/prospects/:id
 * Update a prospect
 */
router.patch(
  '/:id',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validation = updateProspectSchema.safeParse(req.body);
      
      if (!validation.success) {
        throw HttpError.badRequest(
          validation.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        );
      }

      const data = validation.data;

      // Check if prospect exists
      const [existing] = await sql`SELECT id FROM listing_prospects WHERE id = ${id}`;
      if (!existing) {
        throw HttpError.notFound('Prospect not found');
      }

      // Build update object
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      
      if (data.company !== undefined) updates.company = data.company;
      if (data.contactName !== undefined) updates.contact_name = data.contactName;
      if (data.contactEmail !== undefined) updates.contact_email = data.contactEmail;
      if (data.contactPhone !== undefined) updates.contact_phone = data.contactPhone;
      if (data.stage !== undefined) updates.stage = data.stage;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

      const [prospect] = await sql`
        UPDATE listing_prospects
        SET ${sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      res.json({ success: true, prospect });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/prospects/:id
 * Delete a prospect
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const result = await sql`
        DELETE FROM listing_prospects WHERE id = ${id}
      `;

      if (result.count === 0) {
        throw HttpError.notFound('Prospect not found');
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

