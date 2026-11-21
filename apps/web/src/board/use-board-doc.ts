import { getDiagramDoc, type DiagramDoc } from '@archboard/diagram-schema';
import { useEffect, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';

/** Transaction origin for this user's edits; only these are undoable. */
export const LOCAL_ORIGIN = Symbol('local-edit');

export interface BoardDoc {
  diagram: DiagramDoc;
  undo: Y.UndoManager;
  /** True once the stored copy has been loaded from IndexedDB. */
  ready: boolean;
  /** False while the latest change is being written to IndexedDB. */
  saved: boolean;
  /** IndexedDB unavailable: edits work but won't survive a reload. */
  persistent: boolean;
}

/**
 * One Y.Doc per board, autosaved to IndexedDB on every change, with an UndoManager scoped to
 * local edits (drags within 400 ms merge into one step). The doc is created inside the effect so
 * React StrictMode's mount → unmount → mount never leaves us holding a destroyed doc.
 */
export function useBoardDoc(boardId: string): BoardDoc | null {
  const [state, setState] = useState<BoardDoc | null>(null);

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
    const base = { diagram, undo, ready: false, saved: true, persistent: true };
    setState(base);

    let persistence: IndexeddbPersistence | null = null;
    try {
      persistence = new IndexeddbPersistence(`archboard:${boardId}`, doc);
      persistence.whenSynced.then(
        () => !cancelled && setState((s) => (s ? { ...s, ready: true } : s)),
        () => !cancelled && setState((s) => (s ? { ...s, ready: true, persistent: false } : s)),
      );
    } catch {
      setState({ ...base, ready: true, persistent: false });
    }

    // y-indexeddb stores each update immediately; show "Saving…" only for a moment so the
    // status pill reflects real activity without flickering on every keystroke.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      setState((s) => (s && s.saved ? { ...s, saved: false } : s));
      clearTimeout(timer);
      timer = setTimeout(() => !cancelled && setState((s) => (s ? { ...s, saved: true } : s)), 300);
    };
    doc.on('update', onUpdate);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      doc.off('update', onUpdate);
      void persistence?.destroy();
      undo.destroy();
      doc.destroy();
    };
  }, [boardId]);

  return state;
}
