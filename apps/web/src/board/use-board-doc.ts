import { getDiagramDoc, type DiagramDoc } from '@archboard/diagram-schema';
import { useEffect, useRef, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';

/** Transaction origin for this user's edits; only these are undoable. */
export const LOCAL_ORIGIN = Symbol('local-edit');
/** Origin for state loaded from the server: never undoable, never re-sent. */
const REMOTE_ORIGIN = Symbol('remote-load');

/** Where the board is kept besides this browser: nowhere ("off") or the user's account. */
export type CloudStatus = 'off' | 'saving' | 'saved' | 'offline' | 'error';

/** Load/save a board on the server (account boards). */
export interface RemoteSync {
  load: () => Promise<Uint8Array>;
  save: (state: Uint8Array) => Promise<void>;
}

export interface BoardDoc {
  diagram: DiagramDoc;
  undo: Y.UndoManager;
  /** True once the stored copy has been loaded (IndexedDB, then the server). */
  ready: boolean;
  /** False while the latest change is being written to IndexedDB. */
  saved: boolean;
  /** IndexedDB unavailable: edits work but won't survive a reload. */
  persistent: boolean;
  /** Account boards: the server save state. */
  cloud: CloudStatus;
}

const SAVE_DEBOUNCE_MS = 800;
const RETRY_MS = [3000, 6000, 15000, 30000];

/**
 * One Y.Doc per board, autosaved to IndexedDB on every change, with an UndoManager scoped to
 * local edits. With `remote`, the board is also loaded from and saved to the server: the server
 * copy is merged in on open (CRDT, so nothing is lost), and every change is sent ~1 s later,
 * retrying with backoff while offline. The doc is created inside the effect so React StrictMode's
 * mount → unmount → mount never leaves us holding a destroyed doc.
 */
export function useBoardDoc(boardId: string, remote?: RemoteSync): BoardDoc | null {
  const [state, setState] = useState<BoardDoc | null>(null);
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const hasRemote = Boolean(remote);

  useEffect(() => {
    let cancelled = false;
    const doc = new Y.Doc();
    const diagram = getDiagramDoc(doc);
    const undo = new Y.UndoManager([diagram.nodes, diagram.edges, diagram.meta], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      // Every user action is already one transaction (a drag writes once, on drop), so never
      // merge separate actions: merging made "add" + a quick "delete" undo together.
      captureTimeout: 0,
    });
    const base: BoardDoc = {
      diagram,
      undo,
      ready: false,
      saved: true,
      persistent: true,
      cloud: hasRemote ? 'saved' : 'off',
    };
    setState(base);
    const patch = (p: Partial<BoardDoc>) => !cancelled && setState((s) => (s ? { ...s, ...p } : s));

    // --- server sync (account boards) ---------------------------------------------------
    let dirty = false;
    let inFlight = false;
    let attempt = 0;
    let pushTimer: ReturnType<typeof setTimeout> | undefined;
    const push = async () => {
      const sync = remoteRef.current;
      if (!sync || cancelled || inFlight || !dirty) return;
      inFlight = true;
      dirty = false;
      patch({ cloud: 'saving' });
      try {
        await sync.save(Y.encodeStateAsUpdate(doc));
        attempt = 0;
        if (!dirty) patch({ cloud: 'saved' });
      } catch {
        dirty = true;
        patch({ cloud: navigator.onLine ? 'error' : 'offline' });
        const wait = RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)] ?? 30000;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(() => void push(), wait);
      } finally {
        inFlight = false;
      }
      if (dirty && attempt === 0) schedulePush();
    };
    const schedulePush = () => {
      if (!hasRemote) return;
      dirty = true;
      patch({ cloud: 'saving' });
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void push(), SAVE_DEBOUNCE_MS);
    };
    const onOnline = () => {
      if (dirty) void push();
    };
    window.addEventListener('online', onOnline);
    // Unsent changes are also in IndexedDB and are sent next time, but warn before leaving.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty || inFlight) e.preventDefault();
    };
    if (hasRemote) window.addEventListener('beforeunload', onBeforeUnload);

    const loadRemote = async () => {
      const sync = remoteRef.current;
      if (!sync) return patch({ ready: true });
      const hadLocal = diagram.nodes.size > 0 || diagram.meta.size > 0;
      try {
        Y.applyUpdate(doc, await sync.load(), REMOTE_ORIGIN);
        patch({ ready: true });
        // This browser may hold edits the server hasn't seen (saved offline): send them.
        if (hadLocal) schedulePush();
      } catch {
        patch({ ready: true, cloud: navigator.onLine ? 'error' : 'offline' });
        schedulePush();
      }
    };

    // --- IndexedDB ------------------------------------------------------------------------
    let persistence: IndexeddbPersistence | null = null;
    try {
      persistence = new IndexeddbPersistence(`archboard:${boardId}`, doc);
      persistence.whenSynced.then(
        () => void loadRemote(),
        () => {
          patch({ persistent: false });
          void loadRemote();
        },
      );
    } catch {
      patch({ persistent: false });
      void loadRemote();
    }

    // y-indexeddb stores each update immediately; show "Saving…" only for a moment so the
    // status pill reflects real activity without flickering on every keystroke.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      setState((s) => (s && s.saved ? { ...s, saved: false } : s));
      clearTimeout(timer);
      timer = setTimeout(() => patch({ saved: true }), 300);
      if (origin !== REMOTE_ORIGIN && origin !== persistence) schedulePush();
    };
    doc.on('update', onUpdate);

    return () => {
      cancelled = true;
      // Flush a pending save on the way out (e.g. navigating home).
      if (dirty && !inFlight)
        void remoteRef.current?.save(Y.encodeStateAsUpdate(doc)).catch(() => {});
      clearTimeout(timer);
      clearTimeout(pushTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('beforeunload', onBeforeUnload);
      doc.off('update', onUpdate);
      void persistence?.destroy();
      undo.destroy();
      doc.destroy();
    };
  }, [boardId, hasRemote]);

  return state;
}
