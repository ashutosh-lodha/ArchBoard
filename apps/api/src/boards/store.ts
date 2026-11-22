/**
 * Board storage, independent of the database so routes can be tested with an in-memory store.
 *
 * Board policy: **one board per account, deleted automatically 7 days after it was created.**
 * The Postgres store enforces "one per account" with a unique index on the owner, so the rule
 * holds even if two requests race.
 */
export const BOARD_LIFETIME_DAYS = 7;
export const BOARD_LIFETIME_MS = BOARD_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

/** Largest stored Yjs state. A busy 7-day board is well under 1 MB. */
export const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

export interface BoardMeta {
  id: string;
  title: string;
  createdAt: Date;
  expiresAt: Date;
  updatedAt: Date;
}

export interface OwnedBoard extends BoardMeta {
  /** Clerk user id of the owner. */
  ownerClerkId: string;
}

export class BoardExistsError extends Error {
  constructor(readonly existing: BoardMeta) {
    super('This person already has a board.');
  }
}

export interface BoardStore {
  /** The person's live, unexpired board, if any. */
  findLiveBoard(clerkId: string, now: Date): Promise<BoardMeta | null>;
  /** Create the person's board. Throws BoardExistsError if they already have a live one. */
  create(clerkId: string, content: Uint8Array | null, now: Date): Promise<BoardMeta>;
  /** A live board by id (expired or deleted boards are null). */
  get(id: string, now: Date): Promise<OwnedBoard | null>;
  getContent(id: string): Promise<Uint8Array | null>;
  /** Replace the stored state (the caller has already merged it). */
  saveContent(id: string, content: Uint8Array, now: Date): Promise<void>;
  delete(id: string): Promise<void>;
  /** Permanently delete every expired board. Returns how many were removed. */
  purgeExpired(now: Date): Promise<number>;
}
