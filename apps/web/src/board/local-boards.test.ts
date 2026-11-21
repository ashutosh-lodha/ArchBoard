import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimBoard,
  createBoard,
  daysLeft,
  isExpired,
  purgeExpiredBoard,
  readCurrentBoard,
} from './local-boards.ts';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe('board policy: one board at a time, deleted after 7 days', () => {
  it('creates a board and refuses a second while the first is live', () => {
    const t0 = Date.UTC(2026, 10, 21);
    const rec = createBoard(t0);
    expect(rec.id).toMatch(/^local-[a-z0-9]{12}$/);
    expect(readCurrentBoard()).toEqual(rec);
    expect(() => createBoard(t0 + DAY)).toThrow(/already have a board/);
  });

  it('counts down the days and expires exactly at 7 days', () => {
    const t0 = Date.UTC(2026, 10, 21);
    const rec = createBoard(t0);
    expect(daysLeft(rec, t0)).toBe(6);
    expect(daysLeft(rec, t0 + 6 * DAY + 1)).toBe(0);
    expect(isExpired(rec, t0 + 7 * DAY - 1)).toBe(false);
    expect(isExpired(rec, t0 + 7 * DAY)).toBe(true);
  });

  it('purges an expired board and then allows a new one', async () => {
    const t0 = Date.UTC(2026, 10, 21);
    createBoard(t0);
    expect(await purgeExpiredBoard(t0 + 3 * DAY)).toBe(false);
    expect(await purgeExpiredBoard(t0 + 7 * DAY)).toBe(true);
    expect(readCurrentBoard()).toBeNull();
    expect(() => createBoard(t0 + 7 * DAY)).not.toThrow();
  });

  it('opens only the current board; adopts a pre-policy board when none is recorded', () => {
    const t0 = Date.UTC(2026, 10, 21);
    const adopted = claimBoard('local-abcdefghijkm', t0);
    expect(adopted).toEqual({ id: 'local-abcdefghijkm', createdAt: t0 });
    expect(claimBoard('local-zzzzzzzzzzzz', t0)).toBeNull();
    expect(claimBoard('local-abcdefghijkm', t0 + 8 * DAY)).toBeNull();
  });
});
