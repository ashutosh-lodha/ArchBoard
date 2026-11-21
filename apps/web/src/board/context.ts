import type { DiagramDoc } from '@archboard/diagram-schema';
import { createContext, useContext } from 'react';
import type { LoadedRegistry } from './registry.ts';

export interface BoardContextValue {
  diagram: DiagramDoc;
  registry: LoadedRegistry;
  /** Id of the node whose label is being edited inline, if any. */
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used inside <BoardContext>');
  return ctx;
}
