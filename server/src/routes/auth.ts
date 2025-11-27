import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sql } from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { HttpError } from '../utils/httpError';
import { authenticate } from '../middleware/auth';

const router = Router();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = signUpSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw HttpError.badRequest(
        validation.error.issues.map((e: any) => e.message).join(', ')
      );
    }

    const { email, password, fullName } = validation.data;

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (existing.length > 0) {
      throw HttpError.conflict('Email already registered');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);

    const [user] = await sql`
      INSERT INTO users (email, password_hash, raw_user_meta_data)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${JSON.stringify({ full_name: fullName })})
      RETURNING id, email, created_at
    `;

    // Create profile
    await sql`
      INSERT INTO profiles (id, email, full_name)
      VALUES (${user.id}, ${email.toLowerCase()}, ${fullName})
    `;

    // Generate JWT
    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
router.post('/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = signInSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw HttpError.badRequest(
        validation.error.issues.map((e: any) => e.message).join(', ')
      );
    }

    const { email, password } = validation.data;

    // Find user
    const [user] = await sql`
      SELECT id, email, password_hash, raw_user_meta_data
      FROM users
      WHERE email = ${email.toLowerCase()}
    `;

    if (!user) {
      throw HttpError.unauthorized('Invalid email or password');
    }

    // Verify password
    const valid = await verifyPassword(password, user.password_hash);
    
    if (!valid) {
      throw HttpError.unauthorized('Invalid email or password');
    }

    // Get user roles
    const roles = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;

    // Generate JWT
    const token = signToken({
      userId: user.id,
      email: user.email,
    });

    const fullName = user.raw_user_meta_data?.full_name || null;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName,
        roles: roles.map(r => r.role),
      },
      token,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user] = await sql`
      SELECT u.id, u.email, u.raw_user_meta_data, p.full_name
      FROM users u
      LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = ${req.user!.userId}
    `;

    if (!user) {
      throw HttpError.notFound('User not found');
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name || user.raw_user_meta_data?.full_name || null,
        roles: req.user!.roles,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/signout
 * Sign out (client should discard token)
 */
router.post('/signout', (_req: Request, res: Response) => {
  // JWT is stateless, so we just return success
  // Client should delete the token from storage
  res.json({ success: true });
});

export default router;

