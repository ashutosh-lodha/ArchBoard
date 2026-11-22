import { createServer } from 'node:http';
import { createPrismaClient } from '@archboard/db';
import { createLogger } from '@archboard/shared/logger';
import { createApp, type HealthCheck } from './app.ts';
import { clerkAuthenticate } from './auth.ts';
import { createPrismaBoardStore } from './boards/prisma-store.ts';
import { startExpiryJob } from './boards/routes.ts';
import { loadApiEnv } from './env.ts';

const env = loadApiEnv();
const logger = createLogger('api', env.LOG_LEVEL);
const prisma = createPrismaClient({ connectionString: env.DATABASE_URL, maxConnections: 5 });

const checks: Record<string, HealthCheck> = {
  database: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
};

const store = createPrismaBoardStore(prisma);
const app = createApp({
  logger,
  trustProxy: env.TRUST_PROXY,
  version: process.env.APP_VERSION ?? 'dev',
  checks,
  boards: {
    store,
    authenticate: clerkAuthenticate({
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: [env.PUBLIC_ORIGIN],
      logger,
    }),
  },
});
const stopExpiryJob = startExpiryJob(store, logger);

const server = createServer(app);
server.listen(env.API_PORT, () => logger.info({ port: env.API_PORT }, 'api listening'));

// Graceful shutdown: stop accepting, finish in-flight requests, close pools (12-factor).
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  stopExpiryJob();
  server.close();
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
