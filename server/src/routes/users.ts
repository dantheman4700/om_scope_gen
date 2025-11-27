import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sql } from '../db';
import { HttpError } from '../utils/httpError';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/users
 * Get all users with their roles (admin only)
 */
router.get(
  '/',
  authenticate,
  requireRole('admin'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch all profiles with roles
      const profiles = await sql`
        SELECT p.id, p.email, p.full_name, p.created_at
        FROM profiles p
        ORDER BY p.created_at DESC
      `;

      const userRoles = await sql`
        SELECT user_id, role FROM user_roles
      `;

      // Combine profiles with roles
      const users = profiles.map(profile => ({
        ...profile,
        roles: userRoles
          .filter(ur => ur.user_id === profile.id)
          .map(ur => ur.role),
      }));

      res.json({ users });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/users/:id/roles
 * Get roles for a specific user
 */
router.get(
  '/:id/roles',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Users can see their own roles, admins can see any
      const isAdmin = req.user?.roles.includes('admin');
      if (!isAdmin && req.user?.userId !== id) {
        throw HttpError.forbidden('Cannot view other users\' roles');
      }

      const roles = await sql`
        SELECT role FROM user_roles WHERE user_id = ${id}
      `;

      res.json({ roles: roles.map(r => r.role) });
    } catch (error) {
      next(error);
    }
  }
);

const roleSchema = z.object({
  role: z.enum(['admin', 'editor', 'reviewer', 'buyer']),
});

/**
 * POST /api/users/:id/roles
 * Add a role to a user (admin only)
 */
router.post(
  '/:id/roles',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validation = roleSchema.safeParse(req.body);
      
      if (!validation.success) {
        throw HttpError.badRequest('Invalid role');
      }

      const { role } = validation.data;

      // Get default tenant
      const [tenant] = await sql`
        SELECT id FROM tenants WHERE slug = 'sherwood' LIMIT 1
      `;

      if (!tenant) {
        throw HttpError.internal('Default tenant not found');
      }

      // Check if user exists
      const [user] = await sql`SELECT id FROM users WHERE id = ${id}`;
      if (!user) {
        throw HttpError.notFound('User not found');
      }

      // Check if role already exists
      const [existing] = await sql`
        SELECT id FROM user_roles
        WHERE user_id = ${id} AND role = ${role}
      `;

      if (existing) {
        throw HttpError.conflict('User already has this role');
      }

      await sql`
        INSERT INTO user_roles (user_id, tenant_id, role)
        VALUES (${id}, ${tenant.id}, ${role})
      `;

      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/users/:id/roles/:role
 * Remove a role from a user (admin only)
 */
router.delete(
  '/:id/roles/:role',
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.params;

      const result = await sql`
        DELETE FROM user_roles
        WHERE user_id = ${id} AND role = ${role}
      `;

      if (result.count === 0) {
        throw HttpError.notFound('Role not found');
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

