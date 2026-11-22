import { baseEnvSchema, loadEnv } from '@archboard/shared/env';
import { z } from 'zod';

const PEM = /-----BEGIN PUBLIC KEY-----([\s\S]*?)-----END PUBLIC KEY-----/;

/**
 * Rebuild a PEM public key from however it arrived: real newlines, escaped "\n", or everything
 * on one line separated by spaces (env files can't hold multi-line values).
 */
export function normalizePem(value: string): string | undefined {
  const match = PEM.exec(value.replace(/\\n/g, '\n'));
  const body = match?.[1]?.replace(/\s+/g, '');
  if (!body) return undefined;
  const lines = body.match(/.{1,64}/g) ?? [];
  return ['-----BEGIN PUBLIC KEY-----', ...lines, '-----END PUBLIC KEY-----'].join('\n');
}

export const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  /** Trust X-Forwarded-* from the edge proxy (nginx) so logs see the real client IP. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  /**
   * Clerk's JWT public key (Dashboard → API keys → JWKS public key). It's public, not a secret:
   * the API verifies session tokens with it, with no network call.
   */
  CLERK_JWT_KEY: z.string().transform((v, ctx) => {
    const pem = normalizePem(v);
    if (!pem) ctx.addIssue({ code: 'custom', message: 'must be a PEM public key' });
    return pem ?? '';
  }),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source?: Record<string, string | undefined>): ApiEnv {
  return loadEnv(apiEnvSchema, source);
}
