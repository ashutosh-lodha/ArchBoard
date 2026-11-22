import { createSign, generateKeyPairSync } from 'node:crypto';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createApp } from '../src/app.ts';
import { clerkAuthenticate } from '../src/auth.ts';
import type { Authenticate } from '../src/boards/routes.ts';
import {
  BOARD_LIFETIME_MS,
  BoardExistsError,
  type BoardStore,
  type OwnedBoard,
} from '../src/boards/store.ts';

const logger = pino({ level: process.env.DEBUG_TEST ? 'debug' : 'silent' });

/** In-memory store with the same rules as the Postgres one. */
function memoryStore(): BoardStore & {
  rows: Map<string, OwnedBoard & { content: Uint8Array | null }>;
} {
  const rows = new Map<string, OwnedBoard & { content: Uint8Array | null }>();
  let n = 0;
  const live = (b: OwnedBoard, now: Date) => b.expiresAt > now;
  const meta = ({ ownerClerkId: _o, content: _c, ...m }: OwnedBoard & { content: unknown }) => m;
  return {
    rows,
    async findLiveBoard(clerkId, now) {
      const b = [...rows.values()].find((r) => r.ownerClerkId === clerkId && live(r, now));
      return b ? meta(b) : null;
    },
    async create(clerkId, content, now) {
      const existing = await this.findLiveBoard(clerkId, now);
      if (existing) throw new BoardExistsError(existing);
      const row = {
        id: `b${++n}`,
        title: 'Untitled board',
        ownerClerkId: clerkId,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + BOARD_LIFETIME_MS),
        content,
      };
      rows.set(row.id, row);
      return meta(row);
    },
    async get(id, now) {
      const b = rows.get(id);
      return b && live(b, now) ? { ...meta(b), ownerClerkId: b.ownerClerkId } : null;
    },
    async getContent(id) {
      return rows.get(id)?.content ?? null;
    },
    async saveContent(id, content) {
      const b = rows.get(id);
      if (b) b.content = content;
    },
    async delete(id) {
      rows.delete(id);
    },
    async purgeExpired(now) {
      let count = 0;
      for (const [id, b] of rows) {
        if (live(b, now)) continue;
        rows.delete(id);
        count++;
      }
      return count;
    },
  };
}

/** Test auth: "Authorization: Bearer user:<id>". */
const fakeAuth: Authenticate = async (req) => {
  const m = /^Bearer user:(\w+)$/.exec(req.headers.authorization ?? '');
  return m?.[1] ?? null;
};

function setup(now = () => new Date('2026-11-22T10:00:00Z')) {
  const store = memoryStore();
  const app = createApp({ logger, checks: {}, boards: { store, authenticate: fakeAuth, now } });
  return { app, store };
}

function docWith(text: string): Uint8Array {
  const doc = new Y.Doc();
  doc.getMap('meta').set('title', text);
  return Y.encodeStateAsUpdate(doc);
}

const asUser = (id: string) => ({ Authorization: `Bearer user:${id}` });

describe('board API', () => {
  it('requires sign-in', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/me/board');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('creates one board per person and returns it from /me/board', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/me/board').set(asUser('alice'))).body).toEqual({
      board: null,
    });

    const created = await request(app).post('/api/boards').set(asUser('alice'));
    expect(created.status).toBe(201);
    expect(created.body.board.expiresAt).toBe('2026-11-29T10:00:00.000Z');

    const second = await request(app).post('/api/boards').set(asUser('alice'));
    expect(second.status).toBe(409);
    expect(second.body.title).toMatch(/one board at a time/);

    const mine = await request(app).get('/api/me/board').set(asUser('alice'));
    expect(mine.body.board.id).toBe(created.body.board.id);
  });

  it("hides other people's boards behind a 404", async () => {
    const { app } = setup();
    const { body } = await request(app).post('/api/boards').set(asUser('alice'));
    for (const path of [`/api/boards/${body.board.id}`, `/api/boards/${body.board.id}/content`]) {
      expect((await request(app).get(path).set(asUser('mallory'))).status).toBe(404);
    }
    const del = await request(app).delete(`/api/boards/${body.board.id}`).set(asUser('mallory'));
    expect(del.status).toBe(404);
  });

  it('imports initial content and merges saves instead of overwriting', async () => {
    const { app } = setup();
    // Two "tabs" edit different keys of the same document.
    const base = new Y.Doc();
    base.getMap('nodes').set('a', 1);
    const created = await request(app)
      .post('/api/boards')
      .set(asUser('alice'))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from(Y.encodeStateAsUpdate(base)));
    const id = created.body.board.id as string;

    const tab2 = new Y.Doc();
    Y.applyUpdate(tab2, Y.encodeStateAsUpdate(base));
    tab2.getMap('nodes').set('b', 2);
    const put = await request(app)
      .put(`/api/boards/${id}/content`)
      .set(asUser('alice'))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from(Y.encodeStateAsUpdate(tab2)));
    expect(put.status).toBe(204);

    const tab1 = new Y.Doc();
    tab1.getMap('nodes').set('c', 3);
    await request(app)
      .put(`/api/boards/${id}/content`)
      .set(asUser('alice'))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from(Y.encodeStateAsUpdate(tab1)));

    const res = await request(app)
      .get(`/api/boards/${id}/content`)
      .set(asUser('alice'))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    const loaded = new Y.Doc();
    Y.applyUpdate(loaded, new Uint8Array(res.body as Buffer));
    expect(loaded.getMap('nodes').toJSON()).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('rejects content that is not a board document', async () => {
    const { app } = setup();
    const { body } = await request(app).post('/api/boards').set(asUser('alice'));
    const res = await request(app)
      .put(`/api/boards/${body.board.id}/content`)
      .set(asUser('alice'))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from([1, 2, 3, 250, 251]));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('expires boards after 7 days and frees the slot for a new one', async () => {
    let now = new Date('2026-11-22T10:00:00Z');
    const { app, store } = setup(() => now);
    const { body } = await request(app).post('/api/boards').set(asUser('alice'));

    now = new Date('2026-11-29T10:00:01Z');
    expect(
      (await request(app).get(`/api/boards/${body.board.id}`).set(asUser('alice'))).status,
    ).toBe(404);
    expect((await request(app).get('/api/me/board').set(asUser('alice'))).body.board).toBeNull();
    expect(await store.purgeExpired(now)).toBe(1);
    expect((await request(app).post('/api/boards').set(asUser('alice'))).status).toBe(201);
  });

  it('lets the owner delete their board', async () => {
    const { app } = setup();
    const { body } = await request(app)
      .post('/api/boards')
      .set(asUser('alice'))
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from(docWith('x')));
    expect(
      (await request(app).delete(`/api/boards/${body.board.id}`).set(asUser('alice'))).status,
    ).toBe(204);
    expect((await request(app).get('/api/me/board').set(asUser('alice'))).body.board).toBeNull();
  });
});

describe('Clerk session tokens', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const b64 = (v: object | Buffer) =>
    (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString('base64url');

  function token(claims: Record<string, unknown>): string {
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: 'RS256', typ: 'JWT', kid: 'test' });
    const body = b64({ sub: 'user_123', iat: now, nbf: now - 5, exp: now + 60, ...claims });
    const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
    return `${head}.${body}.${b64(sig)}`;
  }

  const authenticate = clerkAuthenticate({
    jwtKey: pem,
    authorizedParties: ['https://archboard.example'],
    logger,
  });
  const req = (authorization?: string) =>
    ({ headers: authorization ? { authorization } : {} }) as Parameters<Authenticate>[0];

  it('accepts a valid token for our origin', async () => {
    expect(await authenticate(req(`Bearer ${token({ azp: 'https://archboard.example' })}`))).toBe(
      'user_123',
    );
  });

  it('rejects tokens for other origins, expired tokens, forgeries and missing headers', async () => {
    expect(await authenticate(req(`Bearer ${token({ azp: 'https://evil.example' })}`))).toBeNull();
    expect(
      await authenticate(
        req(`Bearer ${token({ azp: 'https://archboard.example', exp: 1, nbf: 0, iat: 0 })}`),
      ),
    ).toBeNull();
    const forged = token({ azp: 'https://archboard.example' }).replace(/\.[^.]+$/, '.AAAA');
    expect(await authenticate(req(`Bearer ${forged}`))).toBeNull();
    expect(await authenticate(req())).toBeNull();
  });
});

describe('CLERK_JWT_KEY formats', () => {
  it('accepts the PEM with newlines, escaped newlines, or spaces', async () => {
    const { normalizePem } = await import('../src/env.ts');
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();
    expect(normalizePem(pem)).toBe(pem);
    expect(normalizePem(pem.replace(/\n/g, '\n'))).toBe(pem);
    expect(normalizePem(pem.replace(/\n/g, ' '))).toBe(pem);
    expect(normalizePem('not a key')).toBeUndefined();
  });
});
