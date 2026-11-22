import type { PrismaClient } from '@archboard/db';
import { BOARD_LIFETIME_MS, BoardExistsError, type BoardStore } from './store.ts';

const META = { id: true, title: true, createdAt: true, expiresAt: true, updatedAt: true } as const;

/** Copy into a plain ArrayBuffer-backed array (Prisma's Bytes type rejects other views). */
const bytes = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002';
}

/** Postgres-backed board storage (Prisma). "One per account" is the unique index on ownerId. */
export function createPrismaBoardStore(prisma: PrismaClient): BoardStore {
  const findLiveBoard: BoardStore['findLiveBoard'] = (ownerId, now) =>
    prisma.board.findFirst({ where: { ownerId, expiresAt: { gt: now } }, select: META });

  return {
    findLiveBoard,

    async create(ownerId, content, now) {
      // An expired board still holds the account's slot until the cleanup job runs: remove it.
      await prisma.board.deleteMany({ where: { ownerId, expiresAt: { lte: now } } });
      try {
        return await prisma.board.create({
          data: {
            ownerId,
            createdAt: now,
            expiresAt: new Date(now.getTime() + BOARD_LIFETIME_MS),
            ...(content ? { content: bytes(content) } : {}),
          },
          select: META,
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        const existing = await findLiveBoard(ownerId, now);
        if (!existing) throw err;
        throw new BoardExistsError(existing);
      }
    },

    async get(id, now) {
      const row = await prisma.board.findFirst({
        where: { id, expiresAt: { gt: now } },
        select: { ...META, ownerId: true },
      });
      if (!row) return null;
      const { ownerId, ...meta } = row;
      return { ...meta, ownerClerkId: ownerId };
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
