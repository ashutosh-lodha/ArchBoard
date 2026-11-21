import type { PrismaClient } from '@archboard/db';
import { BoardExistsError, type BoardMeta, type BoardStore } from './store.ts';

const META = { id: true, title: true, createdAt: true, expiresAt: true, updatedAt: true } as const;

/** Copy into a plain ArrayBuffer-backed array (Prisma's Bytes type rejects other views). */
const bytes = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

/** Postgres-backed board storage (Prisma). */
export function createPrismaBoardStore(prisma: PrismaClient): BoardStore {
  const live = (now: Date) => ({ deletedAt: null, expiresAt: { gt: now } });

  return {
    async findLiveBoard(clerkId, now) {
      return prisma.board.findFirst({
        where: { owner: { clerkId }, ...live(now) },
        select: META,
      });
    },

    async create(clerkId, content, now) {
      // Expired boards still hold the "one per person" slot until the cleanup job runs:
      // remove this person's expired boards first.
      await prisma.board.deleteMany({
        where: { owner: { clerkId }, deletedAt: null, expiresAt: { lte: now } },
      });
      // No personal data is stored: Clerk owns the profile, we keep only the id.
      const user = await prisma.user.upsert({
        where: { clerkId },
        update: {},
        create: { clerkId, name: 'ArchBoard user' },
        select: { id: true },
      });
      try {
        return await prisma.board.create({
          data: {
            ownerId: user.id,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            members: { create: { userId: user.id, role: 'OWNER' } },
            ...(content ? { content: bytes(content) } : {}),
          },
          select: META,
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const existing: BoardMeta | null = await this.findLiveBoard(clerkId, now);
        if (!existing) throw err;
        throw new BoardExistsError(existing);
      }
    },

    async get(id, now) {
      const row = await prisma.board.findFirst({
        where: { id, ...live(now) },
        select: { ...META, owner: { select: { clerkId: true } } },
      });
      if (!row) return null;
      const { owner, ...meta } = row;
      return { ...meta, ownerClerkId: owner.clerkId };
    },

    async getContent(id) {
      const row = await prisma.board.findUnique({ where: { id }, select: { content: true } });
      return row?.content ? new Uint8Array(row.content) : null;
    },

    async saveContent(id, content, now) {
      await prisma.board.update({
        where: { id },
        data: { content: bytes(content), lastActivityAt: now },
      });
    },

    async delete(id) {
      await prisma.board.deleteMany({ where: { id } });
    },

    async purgeExpired(now) {
      const { count } = await prisma.board.deleteMany({ where: { expiresAt: { lte: now } } });
      return count;
    },
  };
}
