import { customAlphabet } from 'nanoid';

/**
 * Boards created without signing in live only in this browser (IndexedDB). Their ids carry a
 * "local-" prefix so the app never tries to sync them to the server. After sign-in (Phase 3)
 * the user is offered to keep them in their account.
 */
const newId = customAlphabet('23456789abcdefghijkmnopqrstuvwxyz', 12);

export const LOCAL_PREFIX = 'local-';

export function newLocalBoardId(): string {
  return `${LOCAL_PREFIX}${newId()}`;
}

export function isLocalBoardId(id: string): boolean {
  return /^local-[a-z0-9]{12}$/.test(id);
}

const RECENT_KEY = 'archboard.recentLocalBoards';

/** Most recently opened local boards (for "continue where you left off"). */
export function rememberLocalBoard(id: string): void {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}
