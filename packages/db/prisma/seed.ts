/**
 * Development seed: one sample user with two boards whose content is stored as an initial
 * Yjs snapshot, exactly as the sync server will store it. Idempotent (safe to re-run).
 * Templates are seeded in Phase 5.
 */
import * as Y from 'yjs';
import { parseDiagram, toYDoc, type DiagramV1 } from '@archboard/diagram-schema';
import { createPrismaClient } from '../src/index.ts';

const prisma = createPrismaClient({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://archboard:archboard@localhost:5432/archboard',
  maxConnections: 2,
});

const urlShortener: DiagramV1 = parseDiagram({
  format: 'archboard.diagram',
  version: 1,
  meta: { title: 'URL shortener (seed)' },
  nodes: [
    {
      id: 'client',
      kind: 'component',
      iconId: 'generic/client',
      label: 'Browser',
      position: { x: 0, y: 120 },
    },
    {
      id: 'lb',
      kind: 'component',
      iconId: 'generic/load-balancer',
      label: 'Load balancer',
      position: { x: 240, y: 120 },
    },
    {
      id: 'api',
      kind: 'component',
      iconId: 'generic/service',
      label: 'URL service',
      position: { x: 480, y: 120 },
      data: { replicas: 3 },
    },
    {
      id: 'cache',
      kind: 'component',
      iconId: 'generic/cache',
      label: 'Redis cache',
      position: { x: 720, y: 32 },
    },
    {
      id: 'db',
      kind: 'component',
      iconId: 'generic/sql-db',
      label: 'Postgres',
      position: { x: 720, y: 208 },
    },
  ],
  edges: [
    { id: 'e1', source: 'client', target: 'lb', protocol: 'http' },
    { id: 'e2', source: 'lb', target: 'api', protocol: 'http' },
    { id: 'e3', source: 'api', target: 'cache', label: 'read-through' },
    { id: 'e4', source: 'api', target: 'db', label: 'writes' },
  ],
});

const blank: DiagramV1 = parseDiagram({
  format: 'archboard.diagram',
  version: 1,
  meta: { title: 'Blank board (seed)' },
  nodes: [],
  edges: [],
});

async function seedBoard(ownerId: string, id: string, diagram: DiagramV1): Promise<void> {
  // Copy into a plain ArrayBuffer-backed array (Prisma's Bytes type rejects SharedArrayBuffer views).
  const state = new Uint8Array(Y.encodeStateAsUpdate(toYDoc(diagram)));
  await prisma.board.upsert({
    where: { id },
    update: {},
    create: {
      id,
      ownerId,
      title: diagram.meta.title,
      members: { create: { userId: ownerId, role: 'OWNER' } },
      snapshots: { create: { upToSeq: 0n, sizeBytes: state.byteLength, data: state } },
    },
  });
}

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { clerkId: 'seed_user' },
    update: {},
    create: { clerkId: 'seed_user', name: 'Seed User', email: null },
  });
  await seedBoard(user.id, 'seed-url-shortener', urlShortener);
  await seedBoard(user.id, 'seed-blank', blank);
  const boards = await prisma.board.count();
  console.log(`Seeded: user ${user.id}, ${boards} board(s) in total.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
