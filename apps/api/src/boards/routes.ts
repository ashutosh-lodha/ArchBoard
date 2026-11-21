import express, { Router, type Request, type RequestHandler } from 'express';
import * as Y from 'yjs';
import {
  ConflictError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from '@archboard/shared/errors';
import type { Logger } from '@archboard/shared/logger';
import {
  BOARD_LIFETIME_DAYS,
  BoardExistsError,
  MAX_CONTENT_BYTES,
  type BoardMeta,
  type BoardStore,
} from './store.ts';

/** Resolve the signed-in user's id (Clerk "sub") from a request, or null if signed out. */
export type Authenticate = (req: Request) => Promise<string | null>;

export interface BoardRouteDeps {
  store: BoardStore;
  authenticate: Authenticate;
  logger: Logger;
  now?: () => Date;
}

const toJson = (b: BoardMeta) => ({
  id: b.id,
  title: b.title,
  createdAt: b.createdAt.toISOString(),
  expiresAt: b.expiresAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
});

const rawBody = express.raw({ type: 'application/octet-stream', limit: MAX_CONTENT_BYTES });

/** A Yjs update must decode and apply cleanly; anything else is rejected, never stored. */
function parseUpdate(body: unknown): Uint8Array | null {
  if (!Buffer.isBuffer(body) || body.byteLength === 0) return null;
  const update = new Uint8Array(body);
  try {
    Y.applyUpdate(new Y.Doc(), update);
    return update;
  } catch {
    throw new ValidationError('Board content is not a valid board document.');
  }
}

/**
 * Board API. Every route needs a signed-in user, and a board is only visible to its owner:
 * someone else's board id gets the same 404 as one that doesn't exist.
 *
 *   GET    /api/me/board            → { board: Board | null }
 *   POST   /api/boards              → 201 { board }   (body: optional Yjs state to import)
 *   GET    /api/boards/:id          → { board }
 *   GET    /api/boards/:id/content  → the Yjs state (application/octet-stream)
 *   PUT    /api/boards/:id/content  → 204            (body: Yjs update, merged server-side)
 *   DELETE /api/boards/:id          → 204
 */
export function boardRoutes(deps: BoardRouteDeps): Router {
  const router = Router();
  const now = deps.now ?? (() => new Date());

  const userOf = async (req: Request): Promise<string> => {
    const userId = await deps.authenticate(req);
    if (!userId) throw new UnauthenticatedError('Sign in to save boards to your account.');
    return userId;
  };

  const ownedBoard = async (req: Request) => {
    const userId = await userOf(req);
    const id = String(req.params.id ?? '');
    const board = await deps.store.get(id, now());
    if (!board || board.ownerClerkId !== userId) {
      throw new NotFoundError('Board');
    }
    return board;
  };

  router.get('/me/board', (async (req, res) => {
    const userId = await userOf(req);
    const board = await deps.store.findLiveBoard(userId, now());
    res.set('Cache-Control', 'no-store').json({ board: board ? toJson(board) : null });
  }) as RequestHandler);

  router.post('/boards', rawBody, (async (req, res) => {
    const userId = await userOf(req);
    const content = parseUpdate(req.body);
    try {
      const board = await deps.store.create(userId, content, now());
      deps.logger.info({ boardId: board.id, imported: Boolean(content) }, 'board created');
      res.status(201).json({ board: toJson(board) });
    } catch (err) {
      if (err instanceof BoardExistsError) {
        throw new ConflictError(
          `You already have a board. Each person can have one board at a time, deleted ${BOARD_LIFETIME_DAYS} days after it's created.`,
        );
      }
      throw err;
    }
  }) as RequestHandler);

  router.get('/boards/:id', (async (req, res) => {
    const board = await ownedBoard(req);
    res.set('Cache-Control', 'no-store').json({ board: toJson(board) });
  }) as RequestHandler);

  router.get('/boards/:id/content', (async (req, res) => {
    const board = await ownedBoard(req);
    const content = await deps.store.getContent(board.id);
    res
      .set('Cache-Control', 'no-store')
      .type('application/octet-stream')
      .send(Buffer.from(content ?? Y.encodeStateAsUpdate(new Y.Doc())));
  }) as RequestHandler);

  router.put('/boards/:id/content', rawBody, (async (req, res) => {
    const board = await ownedBoard(req);
    const update = parseUpdate(req.body);
    if (!update) throw new ValidationError('Board content is empty.');
    // CRDT merge: saves from two tabs (or a stale tab) combine instead of overwriting.
    const stored = await deps.store.getContent(board.id);
    const merged = stored ? Y.mergeUpdates([stored, update]) : update;
    if (merged.byteLength > MAX_CONTENT_BYTES) {
      throw new ValidationError('This board has reached its size limit (2 MB).');
    }
    await deps.store.saveContent(board.id, merged, now());
    res.status(204).end();
  }) as RequestHandler);

  router.delete('/boards/:id', (async (req, res) => {
    const board = await ownedBoard(req);
    await deps.store.delete(board.id);
    deps.logger.info({ boardId: board.id }, 'board deleted by owner');
    res.status(204).end();
  }) as RequestHandler);

  return router;
}

/** Hourly cleanup: permanently delete boards whose 7 days are up. */
export function startExpiryJob(
  store: BoardStore,
  logger: Logger,
  intervalMs = 60 * 60 * 1000,
): () => void {
  const run = () =>
    store.purgeExpired(new Date()).then(
      (count) => count > 0 && logger.info({ count }, 'deleted expired boards'),
      (err: unknown) => logger.error({ err }, 'expired-board cleanup failed'),
    );
  void run();
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
