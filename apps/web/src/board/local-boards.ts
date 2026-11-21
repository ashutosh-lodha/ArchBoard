import { customAlphabet } from 'nanoid';

/**
 * Board policy: **one board per person at a time, deleted automatically 7 days after it was
 * created.** Boards currently live in this browser (IndexedDB), so the policy is enforced here;
 * when accounts and the server API arrive (Phase 3) the same rule is enforced server-side.
 */
export const BOARD_LIFETIME_DAYS = 7;
const LIFETIME_MS = BOARD_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

const newId = customAlphabet('23456789abcdefghijkmnopqrstuvwxyz', 12);
const CURRENT_KEY = 'archboard.currentBoard';

export interface BoardRecord {
  id: string;
  createdAt: number;
}

export function isLocalBoardId(id: string): boolean {
  return /^local-[a-z0-9]{12}$/.test(id);
}

export function readCurrentBoard(): BoardRecord | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as BoardRecord;
    return isLocalBoardId(rec.id) && Number.isFinite(rec.createdAt) ? rec : null;
  } catch {
    return null;
  }
}

function writeCurrentBoard(rec: BoardRecord | null): void {
  try {
    if (rec) localStorage.setItem(CURRENT_KEY, JSON.stringify(rec));
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    /* storage unavailable: policy can't persist, board still works for this visit */
  }
}

export function expiresAt(rec: BoardRecord): number {
  return rec.createdAt + LIFETIME_MS;
}

export function isExpired(rec: BoardRecord, now = Date.now()): boolean {
  return now >= expiresAt(rec);
}

/** Whole days left (at least 0); "today" is 0. */
export function daysLeft(rec: BoardRecord, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt(rec) - now) / (24 * 60 * 60 * 1000)) - 1);
}

export function deleteBoardData(id: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(`archboard:${id}`);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Delete the current board (data + record). */
export async function deleteCurrentBoard(): Promise<void> {
  const rec = readCurrentBoard();
  writeCurrentBoard(null);
  if (rec) await deleteBoardData(rec.id);
}

/**
 * Remove the current board if its 7 days are up. Returns true if something was deleted.
 * Called on every app start and board open, so expiry never depends on the user acting.
 */
export async function purgeExpiredBoard(now = Date.now()): Promise<boolean> {
  const rec = readCurrentBoard();
  if (!rec || !isExpired(rec, now)) return false;
  await deleteCurrentBoard();
  return true;
}

/** Start a new board. Only allowed when there's no live board (one at a time). */
export function createBoard(now = Date.now()): BoardRecord {
  const existing = readCurrentBoard();
  if (existing && !isExpired(existing, now)) {
    throw new Error('You already have a board. Delete it before starting a new one.');
  }
  const rec = { id: `local-${newId()}`, createdAt: now };
  writeCurrentBoard(rec);
  return rec;
}

/**
 * Can this board id be opened? Boards from before the policy existed (no record yet) are
 * adopted as the current board, with the 7 days counted from now.
 */
export function claimBoard(id: string, now = Date.now()): BoardRecord | null {
  const rec = readCurrentBoard();
  if (rec?.id === id) return isExpired(rec, now) ? null : rec;
  if (!rec) {
    const adopted = { id, createdAt: now };
    writeCurrentBoard(adopted);
    return adopted;
  }
  return null; // a different board is the current one
}
