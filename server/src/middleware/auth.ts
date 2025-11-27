import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { HttpError } from '../utils/httpError';
import { sql } from '../db';

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      throw HttpError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    // Fetch user roles from database
    const roles = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${payload.userId}
    `;

    req.user = {
      ...payload,
      roles: roles.map(r => r.role),
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
    } else {
      next(HttpError.unauthorized('Invalid or expired token'));
    }
  }
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(HttpError.unauthorized('Authentication required'));
      return;
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasRole) {
      next(HttpError.forbidden('Insufficient permissions'));
      return;
    }

    next();
  };
}

/**
 * Optional authentication - attaches user if token present, but doesn't fail
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    const roles = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${payload.userId}
    `;

    req.user = {
      ...payload,
      roles: roles.map(r => r.role),
    };

    next();
  } catch {
    // Silently continue without user
    next();
  }
}

