import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import type { Logger } from '@archboard/shared/logger';
import type { Authenticate } from './boards/routes.ts';

export interface ClerkAuthOptions {
  /**
   * Clerk's JWT public key (PEM). Verifies session tokens with no network call. It's a public
   * key, so it isn't a secret. Preferred in production.
   */
  jwtKey?: string | undefined;
  /** Alternative: the Clerk secret key, used to fetch (and cache) Clerk's signing keys. */
  secretKey?: string | undefined;
  /** Only tokens issued for these origins are accepted (Clerk's "azp" claim). */
  authorizedParties: string[];
  logger: Logger;
}

/**
 * Verify the Clerk session token sent as `Authorization: Bearer <token>`.
 * Returns the Clerk user id, or null for a missing, expired or forged token.
 */
export function clerkAuthenticate(options: ClerkAuthOptions): Authenticate {
  return async (req: Request) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    if (!token) return null;
    let result: unknown;
    try {
      result = await verifyToken(token, {
        ...(options.jwtKey ? { jwtKey: options.jwtKey } : {}),
        ...(options.secretKey ? { secretKey: options.secretKey } : {}),
        authorizedParties: options.authorizedParties,
      });
    } catch (err) {
      // Some checks (e.g. the authorized party) throw instead of returning errors.
      options.logger.debug({ reason: (err as Error).message }, 'session token rejected');
      return null;
    }
    // verifyToken returns the verified claims and throws on any failure.
    const sub = (result as { sub?: unknown } | null)?.sub;
    return typeof sub === 'string' && sub ? sub : null;
  };
}
