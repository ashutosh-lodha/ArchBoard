import { baseEnvSchema, loadEnv } from '@archboard/shared/env';
import { createLogger } from '@archboard/shared/logger';
import { z } from 'zod';
import { createSyncServer } from './server.ts';

const env = loadEnv(
  baseEnvSchema.extend({
    SYNC_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  }),
);
const logger = createLogger('sync', env.LOG_LEVEL);
const sync = createSyncServer({ logger, publicOrigin: env.PUBLIC_ORIGIN });

sync.server.listen(env.SYNC_PORT, () => logger.info({ port: env.SYNC_PORT }, 'sync listening'));

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal, connections: sync.connections() }, 'shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  // Clients receive 1013 (try again) and reconnect to the other instance with backoff.
  await sync.close();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
