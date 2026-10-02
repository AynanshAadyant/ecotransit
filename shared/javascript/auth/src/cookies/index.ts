import type { Request, Response } from 'express';
import cookie from 'cookie';

export const AUTH_COOKIE_NAME = 'ecotransit_auth';

export interface CookieOptions {
  name?: string | undefined;
  secure?: boolean | undefined;
}

export function setAuthCookie(
  res: Response,
  token: string,
  ttlSeconds: number,
  options: CookieOptions = {},
): void {
  const cookieName = options.name || AUTH_COOKIE_NAME;
  const isSecure = options.secure ?? process.env['NODE_ENV'] === 'production';

  const serialized = cookie.serialize(cookieName, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: ttlSeconds,
    path: '/',
  });

  res.setHeader('Set-Cookie', serialized);
}

export function clearAuthCookie(res: Response, options: CookieOptions = {}): void {
  const cookieName = options.name || AUTH_COOKIE_NAME;

  const serialized = cookie.serialize(cookieName, '', {
    httpOnly: true,
    secure: options.secure ?? process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  res.setHeader('Set-Cookie', serialized);
}

export function readAuthCookie(req: Request, options: CookieOptions = {}): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const cookies = cookie.parse(cookieHeader);
  const cookieName = options.name || AUTH_COOKIE_NAME;
  return cookies[cookieName] || null;
}
