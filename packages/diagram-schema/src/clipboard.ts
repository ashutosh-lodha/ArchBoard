import { z } from 'zod';
import { DiagramEdge, DiagramNode } from './schema.ts';
import type { DiagramFragment } from './ops.ts';

/** Prefix that marks ArchBoard data on the system clipboard (text/plain). */
export const CLIPBOARD_PREFIX = 'archboard:';

const FragmentSchema = z.object({
  v: z.literal(1),
  nodes: z.array(DiagramNode).max(2000),
  edges: z.array(DiagramEdge).max(4000),
});

export function serializeFragment(fragment: DiagramFragment): string {
  return CLIPBOARD_PREFIX + JSON.stringify({ v: 1, ...fragment });
}

/**
 * Parse clipboard text. Returns null for anything that isn't valid ArchBoard data (so pasting
 * ordinary text falls through to the default behaviour). Dangling references are dropped.
 */
export function parseFragment(text: string): DiagramFragment | null {
  if (!text.startsWith(CLIPBOARD_PREFIX)) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
  } catch {
    return null;
  }
  const parsed = FragmentSchema.safeParse(json);
  if (!parsed.success) return null;
  const ids = new Set<string>();
  const nodes = parsed.data.nodes.filter((n) => (ids.has(n.id) ? false : (ids.add(n.id), true)));
  for (const n of nodes) {
    if (n.parentId !== undefined && !ids.has(n.parentId)) delete n.parentId;
  }
  const edges = parsed.data.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target,
  );
  return { nodes, edges };
}
