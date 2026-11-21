import type { DiagramNode, Point, Size } from './schema.ts';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Default rendered sizes for kinds that don't store a size (UX §10.5). */
export const DEFAULT_COMPONENT_SIZE: Size = { width: 160, height: 56 };
export const DEFAULT_TEXT_SIZE: Size = { width: 120, height: 32 };
export const DEFAULT_NOTE_SIZE: Size = { width: 200, height: 140 };
export const GRID = 8;
/** Space between a group's border and its children; the top includes the label tab. */
export const GROUP_PADDING = { x: 24, top: 40, bottom: 24 } as const;

/** Optional callback giving the real rendered size (from React Flow measurements). */
export type Measure = (id: string) => Size | undefined;

export function nodeSize(node: DiagramNode, measure?: Measure): Size {
  const measured = measure?.(node.id);
  if (measured) return measured;
  switch (node.kind) {
    case 'group':
    case 'note':
      return node.size;
    case 'text':
      return DEFAULT_TEXT_SIZE;
    case 'component':
      return DEFAULT_COMPONENT_SIZE;
  }
}

/** Absolute canvas position, walking up through parent groups. */
export function absolutePosition(nodes: ReadonlyMap<string, DiagramNode>, id: string): Point {
  let x = 0;
  let y = 0;
  let current = nodes.get(id);
  let guard = 0;
  while (current && guard++ <= nodes.size) {
    x += current.position.x;
    y += current.position.y;
    current = current.parentId === undefined ? undefined : nodes.get(current.parentId);
  }
  return { x, y };
}

export function absoluteRect(
  nodes: ReadonlyMap<string, DiagramNode>,
  id: string,
  measure?: Measure,
): Rect {
  const node = nodes.get(id);
  if (!node) throw new Error(`Unknown node ${id}`);
  return { ...absolutePosition(nodes, id), ...nodeSize(node, measure) };
}

export function rectsOverlap(a: Rect, b: Rect, padding = 0): boolean {
  return (
    a.x < b.x + b.width + padding &&
    b.x < a.x + a.width + padding &&
    a.y < b.y + b.height + padding &&
    b.y < a.y + a.height + padding
  );
}

export function boundingBox(rects: readonly Rect[]): Rect | undefined {
  if (rects.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function snap(value: number, grid = GRID): number {
  return Math.round(value / grid) * grid;
}

/**
 * Find the spot nearest to `desired` where a node of `size` overlaps none of `occupied`.
 * Searches rings of grid positions outward (a square spiral), so placement is deterministic.
 */
export function findFreeSpot(
  occupied: readonly Rect[],
  desired: Point,
  size: Size,
  options: { step?: number; padding?: number; maxRings?: number } = {},
): Point {
  const step = options.step ?? 24;
  const padding = options.padding ?? 16;
  const maxRings = options.maxRings ?? 80;
  const origin = { x: snap(desired.x), y: snap(desired.y) };
  const fits = (p: Point) => !occupied.some((r) => rectsOverlap({ ...p, ...size }, r, padding));

  if (fits(origin)) return origin;
  for (let ring = 1; ring <= maxRings; ring++) {
    // Prefer right, then below, then left, then above at each ring distance.
    const candidates: Point[] = [];
    for (let i = -ring; i <= ring; i++) {
      candidates.push({ x: origin.x + ring * step, y: origin.y + i * step });
      candidates.push({ x: origin.x + i * step, y: origin.y + ring * step });
      candidates.push({ x: origin.x - ring * step, y: origin.y + i * step });
      candidates.push({ x: origin.x + i * step, y: origin.y - ring * step });
    }
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y),
    );
    const found = candidates.find(fits);
    if (found) return found;
  }
  // Extremely crowded canvas: fall back to below everything.
  const box = boundingBox(occupied);
  return box ? { x: origin.x, y: snap(box.y + box.height + padding * 2) } : origin;
}
