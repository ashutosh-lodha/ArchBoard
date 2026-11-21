import { customAlphabet } from 'nanoid';
import type * as Y from 'yjs';
import {
  absolutePosition,
  absoluteRect,
  boundingBox,
  findFreeSpot,
  GROUP_PADDING,
  nodeSize,
  snap,
  type Measure,
  type Rect,
} from './geometry.ts';
import type { DiagramEdge, DiagramNode, GroupType, Handle, Point } from './schema.ts';
import { fromYMap, getDiagramDoc, toYMap, type DiagramDoc } from './ydoc.ts';

/**
 * Diagram operations: the only code that mutates the diagram part of a Y.Doc. Each operation
 * runs in a single transaction, so it is one undo step and one network update.
 */

const defaultNewId = customAlphabet(
  '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
  10,
);

export interface OpOptions {
  /** Transaction origin; the editor passes its tracked origin so UndoManager records the op. */
  origin?: unknown;
  /** Id generator (injectable for deterministic tests). */
  newId?: () => string;
  measure?: Measure;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewNode = DistributiveOmit<DiagramNode, 'id' | 'position'> & { position?: Point };
export type NewEdge = Omit<DiagramEdge, 'id' | 'style' | 'arrow'> &
  Partial<Pick<DiagramEdge, 'style' | 'arrow'>>;

function doc(d: DiagramDoc): Y.Doc {
  return d.doc;
}

export function readNodes(d: DiagramDoc): Map<string, DiagramNode> {
  const out = new Map<string, DiagramNode>();
  for (const [id, m] of d.nodes) out.set(id, fromYMap<DiagramNode>(m));
  return out;
}

export function readEdges(d: DiagramDoc): Map<string, DiagramEdge> {
  const out = new Map<string, DiagramEdge>();
  for (const [id, m] of d.edges) out.set(id, fromYMap<DiagramEdge>(m));
  return out;
}

/** "Service" + existing ["Service 1", "Service 3"] → "Service 4". */
export function autoName(base: string, existingLabels: Iterable<string>): string {
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped} (\\d+)$`);
  let max = 0;
  for (const label of existingLabels) {
    const m = pattern.exec(label);
    if (m?.[1]) max = Math.max(max, Number(m[1]));
  }
  return `${base} ${max + 1}`;
}

function labelsOf(nodes: Map<string, DiagramNode>): string[] {
  const labels: string[] = [];
  for (const n of nodes.values())
    if (n.kind === 'component' || n.kind === 'group') labels.push(n.label);
  return labels;
}

function topLevelRects(
  nodes: Map<string, DiagramNode>,
  measure?: Measure,
  exclude?: Set<string>,
): Rect[] {
  const rects: Rect[] = [];
  for (const n of nodes.values()) {
    if (n.parentId === undefined && !exclude?.has(n.id))
      rects.push(absoluteRect(nodes, n.id, measure));
  }
  return rects;
}

/**
 * Add a node. Top-level nodes are nudged to the nearest free spot so nothing overlaps on
 * placement (UX §5.1). Returns the new id.
 */
export function addNode(
  d: DiagramDoc,
  input: NewNode,
  options: OpOptions & { at?: Point; avoidOverlap?: boolean; snap?: boolean } = {},
): string {
  const newId = options.newId ?? defaultNewId;
  const nodes = readNodes(d);
  const id = newId();
  const desired = options.at ?? input.position ?? { x: 0, y: 0 };
  const draft = { ...input, id, position: desired } as DiagramNode;
  let position = options.snap === false ? desired : { x: snap(desired.x), y: snap(desired.y) };
  if ((options.avoidOverlap ?? true) && draft.parentId === undefined) {
    position = findFreeSpot(topLevelRects(nodes, options.measure), desired, nodeSize(draft));
  }
  const node = { ...draft, position } as DiagramNode;
  doc(d).transact(() => d.nodes.set(id, toYMap(node)), options.origin);
  return id;
}

export type ConnectResult =
  { ok: true; id: string } | { ok: false; reason: 'self' | 'missing' | 'duplicate' };

/** Connect two nodes. Rejects self-loops, missing endpoints and an existing source→target edge. */
export function connect(d: DiagramDoc, input: NewEdge, options: OpOptions = {}): ConnectResult {
  if (input.source === input.target) return { ok: false, reason: 'self' };
  if (!d.nodes.has(input.source) || !d.nodes.has(input.target))
    return { ok: false, reason: 'missing' };
  for (const e of d.edges.values()) {
    if (e.get('source') === input.source && e.get('target') === input.target) {
      return { ok: false, reason: 'duplicate' };
    }
  }
  const id = (options.newId ?? defaultNewId)();
  const edge: DiagramEdge = { style: 'sync', arrow: 'end', ...input, id };
  doc(d).transact(() => d.edges.set(id, toYMap(edge)), options.origin);
  return { ok: true, id };
}

/** All descendants of the given nodes (children of groups, recursively). */
export function withDescendants(
  nodes: Map<string, DiagramNode>,
  ids: Iterable<string>,
): Set<string> {
  const result = new Set<string>();
  const children = new Map<string, string[]>();
  for (const n of nodes.values()) {
    if (n.parentId !== undefined) {
      const list = children.get(n.parentId) ?? [];
      list.push(n.id);
      children.set(n.parentId, list);
    }
  }
  // Breadth-first so the result keeps the caller's order (parents before their children).
  const queue = [...ids].filter((id) => nodes.has(id));
  while (queue.length) {
    const id = queue.shift() as string;
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

/**
 * Delete nodes and edges by id. Deleting a group deletes its contents; deleting a node deletes
 * its edges. Returns what was removed (for the "Deleted 3 items · Undo" toast).
 */
export function deleteElements(
  d: DiagramDoc,
  ids: Iterable<string>,
  options: OpOptions = {},
): { nodes: string[]; edges: string[] } {
  const idList = [...ids];
  const nodes = readNodes(d);
  const nodeIds = withDescendants(nodes, idList);
  const edgeIds = new Set(idList.filter((id) => d.edges.has(id)));
  for (const [id, e] of d.edges) {
    if (nodeIds.has(e.get('source') as string) || nodeIds.has(e.get('target') as string))
      edgeIds.add(id);
  }
  doc(d).transact(() => {
    for (const id of edgeIds) d.edges.delete(id);
    for (const id of nodeIds) d.nodes.delete(id);
  }, options.origin);
  return { nodes: [...nodeIds], edges: [...edgeIds] };
}

export function updateNode(
  d: DiagramDoc,
  id: string,
  patch: Record<string, unknown>,
  options: OpOptions = {},
): void {
  const node = d.nodes.get(id);
  if (!node) return;
  doc(d).transact(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'id' || key === 'kind') continue;
      if (value === undefined) node.delete(key);
      else node.set(key, structuredClone(value));
    }
  }, options.origin);
}

export function updateEdge(
  d: DiagramDoc,
  id: string,
  patch: Partial<Omit<DiagramEdge, 'id'>>,
  options: OpOptions = {},
): void {
  const edge = d.edges.get(id);
  if (!edge) return;
  doc(d).transact(() => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) edge.delete(key);
      else edge.set(key, value);
    }
  }, options.origin);
}

/** Move nodes by absolute positions (keeps parents). */
export function moveNodes(
  d: DiagramDoc,
  positions: ReadonlyMap<string, Point>,
  options: OpOptions = {},
): void {
  const nodes = readNodes(d);
  doc(d).transact(() => {
    for (const [id, abs] of positions) {
      const node = nodes.get(id);
      const y = d.nodes.get(id);
      if (!node || !y) continue;
      const parentAbs =
        node.parentId === undefined ? { x: 0, y: 0 } : absolutePosition(nodes, node.parentId);
      y.set('position', { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y });
    }
  }, options.origin);
}

/**
 * Move a node into a group (or to the canvas when `parentId` is undefined), keeping its
 * absolute position on screen. Refuses to create cycles.
 */
export function reparent(
  d: DiagramDoc,
  nodeId: string,
  parentId: string | undefined,
  options: OpOptions = {},
): boolean {
  const nodes = readNodes(d);
  const node = nodes.get(nodeId);
  if (!node) return false;
  if (parentId !== undefined) {
    const parent = nodes.get(parentId);
    if (!parent || parent.kind !== 'group') return false;
    if (withDescendants(nodes, [nodeId]).has(parentId)) return false;
  }
  if (node.parentId === parentId) return true;
  const abs = absolutePosition(nodes, nodeId);
  const parentAbs = parentId === undefined ? { x: 0, y: 0 } : absolutePosition(nodes, parentId);
  const y = d.nodes.get(nodeId) as Y.Map<unknown>;
  doc(d).transact(() => {
    y.set('position', { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y });
    if (parentId === undefined) y.delete('parentId');
    else y.set('parentId', parentId);
  }, options.origin);
  return true;
}

export const GROUP_LABELS: Record<GroupType, string> = {
  region: 'Region',
  az: 'Availability zone',
  vpc: 'VPC',
  subnet: 'Subnet',
  k8s: 'Kubernetes cluster',
  boundary: 'Boundary',
};

/**
 * Wrap the selected nodes in a new group sized to fit them. Selected nodes must share a parent
 * (the new group goes inside that parent). Returns the group id, or null if nothing to group.
 */
export function groupNodes(
  d: DiagramDoc,
  ids: Iterable<string>,
  groupType: GroupType,
  options: OpOptions & { label?: string } = {},
): string | null {
  const nodes = readNodes(d);
  const selected = [...ids].map((id) => nodes.get(id)).filter((n): n is DiagramNode => !!n);
  if (selected.length === 0) return null;
  const parentId = selected[0]?.parentId;
  if (selected.some((n) => n.parentId !== parentId)) return null;

  const box = boundingBox(selected.map((n) => absoluteRect(nodes, n.id, options.measure)));
  if (!box) return null;
  const parentAbs = parentId === undefined ? { x: 0, y: 0 } : absolutePosition(nodes, parentId);
  const groupAbs = { x: box.x - GROUP_PADDING.x, y: box.y - GROUP_PADDING.top };
  const id = (options.newId ?? defaultNewId)();
  const group: DiagramNode = {
    id,
    kind: 'group',
    groupType,
    label: options.label ?? autoName(GROUP_LABELS[groupType], labelsOf(nodes)),
    position: { x: groupAbs.x - parentAbs.x, y: groupAbs.y - parentAbs.y },
    size: {
      width: box.width + GROUP_PADDING.x * 2,
      height: box.height + GROUP_PADDING.top + GROUP_PADDING.bottom,
    },
    ...(parentId === undefined ? {} : { parentId }),
  };
  doc(d).transact(() => {
    d.nodes.set(id, toYMap(group));
    for (const n of selected) {
      const abs = absolutePosition(nodes, n.id);
      const y = d.nodes.get(n.id) as Y.Map<unknown>;
      y.set('parentId', id);
      y.set('position', { x: abs.x - groupAbs.x, y: abs.y - groupAbs.y });
    }
  }, options.origin);
  return id;
}

/** Remove a group, moving its direct children to the group's parent without visual change. */
export function ungroup(d: DiagramDoc, groupId: string, options: OpOptions = {}): string[] {
  const nodes = readNodes(d);
  const group = nodes.get(groupId);
  if (!group || group.kind !== 'group') return [];
  const groupAbs = absolutePosition(nodes, groupId);
  const newParentAbs =
    group.parentId === undefined ? { x: 0, y: 0 } : absolutePosition(nodes, group.parentId);
  const children = [...nodes.values()].filter((n) => n.parentId === groupId);
  doc(d).transact(() => {
    for (const child of children) {
      const y = d.nodes.get(child.id) as Y.Map<unknown>;
      y.set('position', {
        x: groupAbs.x + child.position.x - newParentAbs.x,
        y: groupAbs.y + child.position.y - newParentAbs.y,
      });
      if (group.parentId === undefined) y.delete('parentId');
      else y.set('parentId', group.parentId);
    }
    d.nodes.delete(groupId);
  }, options.origin);
  return children.map((c) => c.id);
}

// ---------------------------------------------------------------------------------------------
// Fragments: copy / paste / duplicate (also across boards via the system clipboard)

export interface DiagramFragment {
  /** Positions of fragment-root nodes are absolute; children stay relative to their group. */
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export function extractFragment(d: DiagramDoc, ids: Iterable<string>): DiagramFragment {
  const nodes = readNodes(d);
  const included = withDescendants(nodes, ids);
  const fragNodes: DiagramNode[] = [];
  for (const id of included) {
    const node = structuredClone(nodes.get(id) as DiagramNode);
    if (node.parentId !== undefined && !included.has(node.parentId)) {
      node.position = absolutePosition(nodes, id);
      delete node.parentId;
    }
    fragNodes.push(node);
  }
  const fragEdges = [...readEdges(d).values()].filter(
    (e) => included.has(e.source) && included.has(e.target),
  );
  return { nodes: fragNodes, edges: structuredClone(fragEdges) };
}

/**
 * Insert a fragment with fresh ids. The fragment's top-left lands at `at`, or is offset by 24px
 * from where it came from. Returns the new ids of the fragment's root nodes (to select them).
 */
export function pasteFragment(
  d: DiagramDoc,
  fragment: DiagramFragment,
  options: OpOptions & { at?: Point; offset?: number } = {},
): { nodeIds: string[]; rootIds: string[]; edgeIds: string[] } {
  const newId = options.newId ?? defaultNewId;
  const idMap = new Map<string, string>();
  for (const n of fragment.nodes) idMap.set(n.id, newId());
  const roots = fragment.nodes.filter((n) => n.parentId === undefined || !idMap.has(n.parentId));
  const rootBox = boundingBox(roots.map((n) => ({ ...n.position, ...nodeSize(n) })));
  const offset = options.offset ?? 24;
  const delta =
    options.at && rootBox
      ? { x: snap(options.at.x - rootBox.x), y: snap(options.at.y - rootBox.y) }
      : { x: offset, y: offset };

  const created: DiagramNode[] = fragment.nodes.map((n) => {
    const copy = structuredClone(n);
    copy.id = idMap.get(n.id) as string;
    const isRoot = n.parentId === undefined || !idMap.has(n.parentId);
    if (isRoot) {
      delete copy.parentId;
      copy.position = { x: n.position.x + delta.x, y: n.position.y + delta.y };
    } else {
      copy.parentId = idMap.get(n.parentId as string) as string;
    }
    return copy;
  });
  const edges: DiagramEdge[] = fragment.edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...structuredClone(e),
      id: newId(),
      source: idMap.get(e.source) as string,
      target: idMap.get(e.target) as string,
    }));

  doc(d).transact(() => {
    for (const n of created) d.nodes.set(n.id, toYMap(n));
    for (const e of edges) d.edges.set(e.id, toYMap(e));
  }, options.origin);

  return {
    nodeIds: created.map((n) => n.id),
    rootIds: roots.map((n) => idMap.get(n.id) as string),
    edgeIds: edges.map((e) => e.id),
  };
}

export function duplicate(
  d: DiagramDoc,
  ids: Iterable<string>,
  options: OpOptions = {},
): ReturnType<typeof pasteFragment> {
  return pasteFragment(d, extractFragment(d, ids), { ...options, offset: 24 });
}

// ---------------------------------------------------------------------------------------------
// Align & distribute (absolute coordinates; works across groups)

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function align(
  d: DiagramDoc,
  ids: Iterable<string>,
  mode: AlignMode,
  options: OpOptions = {},
): void {
  const nodes = readNodes(d);
  const rects = [...ids]
    .filter((id) => nodes.has(id))
    .map((id) => ({ id, r: absoluteRect(nodes, id, options.measure) }));
  if (rects.length < 2) return;
  const box = boundingBox(rects.map((x) => x.r)) as Rect;
  const target = new Map<string, Point>();
  for (const { id, r } of rects) {
    let { x, y } = r;
    if (mode === 'left') x = box.x;
    if (mode === 'center') x = box.x + box.width / 2 - r.width / 2;
    if (mode === 'right') x = box.x + box.width - r.width;
    if (mode === 'top') y = box.y;
    if (mode === 'middle') y = box.y + box.height / 2 - r.height / 2;
    if (mode === 'bottom') y = box.y + box.height - r.height;
    target.set(id, { x, y });
  }
  moveNodes(d, target, options);
}

/** Equal gaps between nodes along an axis; the outermost two stay put. */
export function distribute(
  d: DiagramDoc,
  ids: Iterable<string>,
  axis: 'horizontal' | 'vertical',
  options: OpOptions = {},
): void {
  const nodes = readNodes(d);
  const rects = [...ids]
    .filter((id) => nodes.has(id))
    .map((id) => ({ id, r: absoluteRect(nodes, id, options.measure) }));
  if (rects.length < 3) return;
  const pos = axis === 'horizontal' ? 'x' : 'y';
  const len = axis === 'horizontal' ? 'width' : 'height';
  rects.sort((a, b) => a.r[pos] - b.r[pos]);
  const first = rects[0] as (typeof rects)[number];
  const last = rects[rects.length - 1] as (typeof rects)[number];
  const span = last.r[pos] + last.r[len] - first.r[pos];
  const occupied = rects.reduce((sum, x) => sum + x.r[len], 0);
  const gap = (span - occupied) / (rects.length - 1);
  const target = new Map<string, Point>();
  let cursor = first.r[pos];
  for (const { id, r } of rects) {
    target.set(id, axis === 'horizontal' ? { x: cursor, y: r.y } : { x: r.x, y: cursor });
    cursor += r[len] + gap;
  }
  moveNodes(d, target, options);
}

export { getDiagramDoc };
export type { Handle };
