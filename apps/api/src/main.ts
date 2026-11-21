import { createServer } from 'node:http';
import { Redis } from 'ioredis';
import { createPrismaClient } from '@archboard/db';
import { createLogger } from '@archboard/shared/logger';
import { createApp } from './app.ts';
import { loadApiEnv } from './env.ts';

const env = loadApiEnv();
const logger = createLogger('api', env.LOG_LEVEL);
const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
redis.on('error', (err) => logger.warn({ err }, 'redis error'));

const app = createApp({
  logger,
  trustProxy: env.TRUST_PROXY,
  version: process.env.APP_VERSION ?? 'dev',
  checks: {
    database: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    redis: async () => {
      await redis.ping();
    },
  },
});

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
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
