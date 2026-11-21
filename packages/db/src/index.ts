import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export * from '../generated/prisma/client.ts';

export interface CreateClientOptions {
  connectionString: string;
  /** Pool size per process. Small VM: keep api + 2×sync + staging under max_connections (40). */
  maxConnections?: number;
}

/** Create a Prisma client backed by node-postgres. One per process; call $disconnect on exit. */
export function createPrismaClient(options: CreateClientOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 8,
  });
  return new PrismaClient({ adapter });
}

/** "u_<userId>" / "g_<guestId>" principal helpers, shared by api and sync. */
export const principalOfUser = (userId: string): string => `u_${userId}`;
export const principalOfGuest = (guestId: string): string => `g_${guestId}`;
