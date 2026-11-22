/**
 * Development seed: one sample board (a URL shortener), stored as Yjs state exactly as the API
 * stores it. Idempotent (safe to re-run).
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

async function main(): Promise<void> {
  // Copy into a plain ArrayBuffer-backed array (Prisma's Bytes type rejects other views).
  const content = new Uint8Array(Y.encodeStateAsUpdate(toYDoc(urlShortener)));
  await prisma.board.upsert({
    where: { ownerId: 'user_seed' },
    update: {},
    create: {
      id: 'seed-url-shortener',
      ownerId: 'user_seed',
      title: urlShortener.meta.title,
      content,
      // Seed data shouldn't expire during a dev session.
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`Seeded: ${await prisma.board.count()} board(s) in total.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
