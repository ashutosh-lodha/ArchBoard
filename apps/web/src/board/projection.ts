import {
  sortParentsFirst,
  type DiagramDoc,
  type DiagramEdge,
  type DiagramNode,
  fromYMap,
} from '@archboard/diagram-schema';
import { MarkerType, type Edge, type Node } from '@xyflow/react';

/**
 * Y.Doc → React Flow projection. The Y.Doc is the source of truth; React Flow only renders.
 * Unchanged nodes keep object identity so memoised node components don't re-render.
 */

export type ComponentNodeData = {
  kind: 'component';
  iconId: string;
  label: string;
  replicas?: number;
  region?: string;
};
export type NoteNodeData = { kind: 'note'; text: string; color: string };
export type GroupNodeData = { kind: 'group'; label: string; groupType: string };
export type TextNodeData = { kind: 'text'; text: string; fontSize: string };
export type FlowNodeData = ComponentNodeData | NoteNodeData | GroupNodeData | TextNodeData;
export type FlowNode = Node<FlowNodeData>;

function toFlowNode(n: DiagramNode): FlowNode {
  const base = {
    id: n.id,
    position: n.position,
    ...(n.parentId ? { parentId: n.parentId } : {}),
    ...(n.zIndex !== undefined ? { zIndex: n.zIndex } : {}),
  };
  switch (n.kind) {
    case 'component':
      return {
        ...base,
        type: 'component',
        data: {
          kind: 'component',
          iconId: n.iconId,
          label: n.label,
          ...(n.data?.replicas ? { replicas: n.data.replicas } : {}),
          ...(n.data?.region ? { region: n.data.region } : {}),
        },
      };
    case 'note':
      return {
        ...base,
        type: 'note',
        style: { width: n.size.width, height: n.size.height },
        data: { kind: 'note', text: n.text, color: n.color ?? 'yellow' },
      };
    case 'group':
      return {
        ...base,
        type: 'group',
        style: { width: n.size.width, height: n.size.height },
        data: { kind: 'group', label: n.label, groupType: n.groupType },
        zIndex: n.zIndex ?? -1,
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        data: { kind: 'text', text: n.text, fontSize: n.fontSize ?? 'm' },
      };
  }
}

function toFlowEdge(e: DiagramEdge): Edge {
  const arrow = e.arrow ?? 'end';
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    type: 'smoothstep',
    ...(e.label ? { label: e.label } : {}),
    ...(arrow !== 'none'
      ? { markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 } }
      : {}),
    ...(arrow === 'both'
      ? { markerStart: { type: MarkerType.ArrowClosed, width: 18, height: 18 } }
      : {}),
    className: e.style === 'async' ? 'ab-edge-async' : 'ab-edge-sync',
    data: { style: e.style ?? 'sync', protocol: e.protocol },
  };
}

export interface Projection {
  nodes: FlowNode[];
  edges: Edge[];
}

/** Build a fresh projection, reusing previous objects for nodes/edges whose Y data is unchanged. */
export function project(d: DiagramDoc, previous?: Projection): Projection {
  const prevNodes = new Map(previous?.nodes.map((n) => [n.id, n]));
  const prevEdges = new Map(previous?.edges.map((e) => [e.id, e]));

  const raw = [...d.nodes.values()].map((m) => fromYMap<DiagramNode>(m));
  const nodes = sortParentsFirst(raw).map((n) => {
    const next = toFlowNode(n);
    const prev = prevNodes.get(n.id);
    return prev && sameJson(prev, next) ? prev : next;
  });
  const edges = [...d.edges.values()].map((m) => {
    const next = toFlowEdge(fromYMap<DiagramEdge>(m));
    const prev = prevEdges.get(next.id);
    return prev && sameJson(prev, next) ? prev : next;
  });
  return { nodes, edges };
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
