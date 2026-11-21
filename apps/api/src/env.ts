import { baseEnvSchema, loadEnv } from '@archboard/shared/env';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

export const apiEnvSchema = baseEnvSchema
  .extend({
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1),
    /** Optional: only the collaboration features need Redis. Board storage doesn't. */
    REDIS_URL: optional,
    /** Trust X-Forwarded-* from the edge proxy (Caddy) so logs see the real client IP. */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
    /** Clerk JWT public key (PEM, not a secret). Escaped "\n" sequences are accepted. */
    CLERK_JWT_KEY: optional.transform((v) => v?.replace(/\\n/g, '\n')),
    CLERK_SECRET_KEY: optional,
  })
  .refine((e) => e.CLERK_JWT_KEY ?? e.CLERK_SECRET_KEY, {
    message: 'Set CLERK_JWT_KEY (preferred) or CLERK_SECRET_KEY so the API can verify sign-ins.',
    path: ['CLERK_JWT_KEY'],
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source?: Record<string, string | undefined>): ApiEnv {
  return loadEnv(apiEnvSchema, source);
}
