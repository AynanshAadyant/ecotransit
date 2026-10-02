import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError } from '@ecotransit/core-utils';
import type { ITokenIssuer, StaffClaims, StaffRole } from '@ecotransit/contracts';
import { readAuthCookie } from '../cookies/index.js';

// Extend Express Request declaration to carry staffClaims
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: StaffClaims;
    }
  }
}

export function extractToken(req: Request): string | null {
  // Check Authorization header first (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Fallback to cookie
  return readAuthCookie(req);
}

export function requireAuth(issuer: ITokenIssuer): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = extractToken(req);
      if (!token) {
        throw new UnauthorizedError('Authentication token is required');
      }

      const claims = await issuer.verify(token);
      req.staff = claims;
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        next(err);
      } else {
        next(new UnauthorizedError((err as Error).message));
      }
    }
  };
}

export function requireRole(...roles: StaffRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) {
      return next(new UnauthorizedError('Unauthenticated request'));
    }

    if (!roles.includes(req.staff.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: required role '${roles.join(' | ')}', got '${req.staff.role}'`,
        ),
      );
    }

    next();
  };
}
