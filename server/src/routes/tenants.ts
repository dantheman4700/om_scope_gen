import { Router, Request, Response, NextFunction } from 'express';
import { sql } from '../db';
import { HttpError } from '../utils/httpError';

const router = Router();

/**
 * GET /api/tenants
 * Get all tenants (public)
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await sql`
      SELECT id, slug, name, settings, created_at
      FROM tenants
      ORDER BY created_at DESC
    `;

    res.json({ tenants });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tenants/:slug
 * Get a tenant by slug
 */
router.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const [tenant] = await sql`
      SELECT id, slug, name, settings, created_at
      FROM tenants
      WHERE slug = ${slug}
    `;

    if (!tenant) {
      throw HttpError.notFound('Tenant not found');
    }

    res.json({ tenant });
  } catch (error) {
    next(error);
  }
});

export default router;

