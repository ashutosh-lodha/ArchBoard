// Integration check for the Postgres store: `DATABASE_URL=... tsx test/prisma-store.int.ts`
import assert from 'node:assert/strict';
import { createPrismaClient } from '@archboard/db';
import { createPrismaBoardStore } from '../src/boards/prisma-store.ts';
import { BoardExistsError } from '../src/boards/store.ts';

const prisma = createPrismaClient({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://archboard:archboard@localhost:5432/archboard',
});
const store = createPrismaBoardStore(prisma);
const who = `int_${Date.now()}`;
const t0 = new Date();
try {
  const a = await store.create(who, new Uint8Array([0, 0]), t0);
  assert.equal((await store.findLiveBoard(who, t0))?.id, a.id);
  // Race: two concurrent creates → exactly one wins, the other sees BoardExistsError.
  await store.delete(a.id);
  const results = await Promise.allSettled([
    store.create(who, null, t0),
    store.create(who, null, t0),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected');
  assert.ok(rejected && rejected.reason instanceof BoardExistsError, String(rejected?.reason));
  const live = await store.findLiveBoard(who, t0);
  assert.ok(live);
  await store.saveContent(live.id, new Uint8Array([1, 2, 3]), t0);
  assert.deepEqual([...(await store.getContent(live.id))!], [1, 2, 3]);
  // 7 days later: expired, slot freed by create(), and purge removes leftovers.
  const later = new Date(t0.getTime() + 7 * 864e5 + 1000);
  assert.equal(await store.get(live.id, later), null);
  const fresh = await store.create(who, null, later);
  assert.notEqual(fresh.id, live.id);
  assert.equal((await store.purgeExpired(new Date(later.getTime() + 8 * 864e5))) >= 1, true);
  console.log('prisma store: all checks passed');
} finally {
  await prisma.board.deleteMany({ where: { ownerId: who } });
  await prisma.$disconnect();
}
