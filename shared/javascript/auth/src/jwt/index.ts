import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@ecotransit/core-utils';
import type { ITokenIssuer, ISessionStore, StaffClaims } from '@ecotransit/contracts';

export interface JwtTokenIssuerConfig {
  publicKey: string;
  privateKey?: string | undefined;
  issuer?: string | undefined;
}

export class JwtTokenIssuer implements ITokenIssuer {
  constructor(
    private readonly config: JwtTokenIssuerConfig,
    private readonly sessions?: ISessionStore | undefined,
  ) {}

  async issue(claims: StaffClaims, ttlSeconds: number): Promise<string> {
    if (!this.config.privateKey) {
      throw new Error('Cannot issue token: privateKey was not configured on this instance.');
    }

    return new Promise((resolve, reject) => {
      const payload = {
        sub: claims.staffId,
        role: claims.role,
        sid: claims.sessionId,
      };

      jwt.sign(
        payload,
        this.config.privateKey!,
        {
          algorithm: 'RS256',
          expiresIn: ttlSeconds,
          issuer: this.config.issuer || 'ecotransit-staff-service',
        },
        (err, token) => {
          if (err || !token) {
            reject(new Error(`Failed to sign JWT: ${err?.message}`));
          } else {
            resolve(token);
          }
        },
      );
    });
  }

  async verify(token: string): Promise<StaffClaims> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.config.publicKey,
        {
          algorithms: ['RS256'],
          issuer: this.config.issuer || 'ecotransit-staff-service',
        },
        async (err, decoded) => {
          if (err || !decoded || typeof decoded !== 'object') {
            return reject(new UnauthorizedError('Invalid or expired token'));
          }

          const payload = decoded as { sub?: string; role?: string; sid?: string };
          if (!payload.sub || !payload.role || !payload.sid) {
            return reject(new UnauthorizedError('Malformed token claims'));
          }

          const claims: StaffClaims = {
            staffId: payload.sub,
            role: payload.role as StaffClaims['role'],
            sessionId: payload.sid,
          };

          // If session store is wired, check if session is still valid / not revoked
          if (this.sessions) {
            try {
              const session = await this.sessions.get(claims.sessionId);
              if (!session) {
                return reject(new UnauthorizedError('Session has expired or been revoked'));
              }
            } catch (sessionErr) {
              return reject(sessionErr);
            }
          }

          resolve(claims);
        },
      );
    });
  }
}
