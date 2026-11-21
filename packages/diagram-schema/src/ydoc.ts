import * as Y from 'yjs';
import {
  DIAGRAM_FORMAT,
  DIAGRAM_VERSION,
  type DiagramEdge,
  type DiagramMeta,
  type DiagramNode,
  type DiagramV1,
} from './schema.ts';

/**
 * Y.Doc layout (DESIGN §4.1):
 *   nodes: Y.Map<nodeId, Y.Map<field, value>>
 *   edges: Y.Map<edgeId, Y.Map<field, value>>
 *   meta:  Y.Map { title, description?, schemaVersion }
 * Field-level maps let concurrent edits to different fields merge cleanly. Values are plain JSON
 * (positions are stored as one {x, y} object so a drag never produces a torn position).
 */

export type YNode = Y.Map<unknown>;
export type YEdge = Y.Map<unknown>;

export interface DiagramDoc {
  doc: Y.Doc;
  nodes: Y.Map<YNode>;
  edges: Y.Map<YEdge>;
  meta: Y.Map<unknown>;
}

export const SCHEMA_VERSION = 1;

export function getDiagramDoc(doc: Y.Doc): DiagramDoc {
  return {
    doc,
    nodes: doc.getMap<YNode>('nodes'),
    edges: doc.getMap<YEdge>('edges'),
    meta: doc.getMap<unknown>('meta'),
  };
}

/** Copy every defined field of a plain object into a new Y.Map. */
export function toYMap(record: object): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) map.set(key, structuredClone(value));
  }
  return map;
}

/** Read a Y.Map back into a plain object (shallow; values are already plain JSON). */
export function fromYMap<T>(map: Y.Map<unknown>): T {
  return map.toJSON() as T;
}

/**
 * Replace the doc's diagram content with `diagram` in one transaction. Used for templates,
 * imports and tests. Callers that want an undo step pass their tracked origin.
 */
export function loadDiagramIntoDoc(diagram: DiagramV1, doc: Y.Doc, origin: unknown = null): void {
  const d = getDiagramDoc(doc);
  doc.transact(() => {
    d.nodes.clear();
    d.edges.clear();
    d.meta.clear();
    d.meta.set('title', diagram.meta.title);
    if (diagram.meta.description !== undefined) d.meta.set('description', diagram.meta.description);
    d.meta.set('schemaVersion', SCHEMA_VERSION);
    for (const node of diagram.nodes) d.nodes.set(node.id, toYMap(node));
    for (const edge of diagram.edges) d.edges.set(edge.id, toYMap(edge));
  }, origin);
}

export function toYDoc(diagram: DiagramV1): Y.Doc {
  const doc = new Y.Doc();
  loadDiagramIntoDoc(diagram, doc);
  return doc;
}

/**
 * Export the doc as a DiagramV1. Nodes are ordered parents-first (then by id) so the output is
 * deterministic and React Flow can render groups before their children.
 */
export function fromYDoc(doc: Y.Doc): DiagramV1 {
  const d = getDiagramDoc(doc);
  const nodes = [...d.nodes.values()].map((m) => fromYMap<DiagramNode>(m));
  const edges = [...d.edges.values()]
    .map((m) => fromYMap<DiagramEdge>(m))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const meta: DiagramMeta = {
    title: (d.meta.get('title') as string | undefined) ?? 'Untitled board',
  };
  const description = d.meta.get('description');
  if (typeof description === 'string') meta.description = description;
  return {
    format: DIAGRAM_FORMAT,
    version: DIAGRAM_VERSION,
    meta,
    nodes: sortParentsFirst(nodes),
    edges,
  };
}

/** Stable topological order: every group appears before its children. */
export function sortParentsFirst<T extends { id: string; parentId?: string | undefined }>(
  nodes: T[],
): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = (n: T): number => {
    let d = 0;
    let p = n.parentId;
    while (p !== undefined && d <= nodes.length) {
      d++;
      p = byId.get(p)?.parentId;
    }
    return d;
  };
  return [...nodes]
    .map((n) => ({ n, d: depth(n) }))
    .sort((a, b) => a.d - b.d || (a.n.id < b.n.id ? -1 : a.n.id > b.n.id ? 1 : 0))
    .map((x) => x.n);
}
