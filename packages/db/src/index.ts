import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export * from '../generated/prisma/client.ts';

export interface CreateClientOptions {
  connectionString: string;
  /** Pool size per process. */
  maxConnections?: number;
}

/** Create a Prisma client backed by node-postgres. One per process; call $disconnect on exit. */
export function createPrismaClient(options: CreateClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 5,
  });
  return new PrismaClient({ adapter });
}
