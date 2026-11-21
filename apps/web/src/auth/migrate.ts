import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { deleteCurrentBoard, isExpired, readCurrentBoard } from '../board/local-boards.ts';
import { createServerBoard, getMyBoard, type ServerBoard } from './boards-api.ts';

/** The full Yjs state of a browser-only board, or null if it's empty or unreadable. */
export async function readLocalBoardState(id: string): Promise<Uint8Array | null> {
  const doc = new Y.Doc();
  try {
    const persistence = new IndexeddbPersistence(`archboard:${id}`, doc);
    await persistence.whenSynced;
    const empty = doc.getMap('nodes').size === 0 && doc.getMap('meta').size === 0;
    const state = empty ? null : Y.encodeStateAsUpdate(doc);
    await persistence.destroy();
    return state;
  } catch {
    return null;
  } finally {
    doc.destroy();
  }
}

export type OpenResult =
  | { kind: 'existing'; board: ServerBoard }
  | { kind: 'created'; board: ServerBoard; imported: boolean };

/**
 * Signed in: find the person's account board, or create it. A live browser-only board is moved
 * into the new account board (then removed from this browser), so signing in never loses work.
 */
export async function openOrCreateAccountBoard(
  getToken: () => Promise<string | null>,
): Promise<OpenResult> {
  const existing = await getMyBoard(getToken);
  if (existing) return { kind: 'existing', board: existing };
  const local = readCurrentBoard();
  const state = local && !isExpired(local) ? await readLocalBoardState(local.id) : null;
  const board = await createServerBoard(getToken, state ?? undefined);
  if (local) await deleteCurrentBoard();
  return { kind: 'created', board, imported: Boolean(state) };
}
