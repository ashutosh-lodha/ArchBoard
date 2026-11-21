import { baseEnvSchema, loadEnv } from '@archboard/shared/env';
import { z } from 'zod';

export const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /** Trust X-Forwarded-* from the edge proxy (Caddy) so rate limits see the real client IP. */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(source?: Record<string, string | undefined>): ApiEnv {
  return loadEnv(apiEnvSchema, source);
}
