import { z } from 'zod';

/**
 * DiagramV1: the single diagram format used by templates, JSON import/export, the clipboard and
 * the AI agent. The live board is a Y.Doc; see ydoc.ts for the converters.
 */

export const DIAGRAM_FORMAT = 'archboard.diagram' as const;
export const DIAGRAM_VERSION = 1 as const;

export const LIMITS = {
  nodes: 2000,
  edges: 4000,
  label: 80,
  title: 120,
  description: 2000,
  noteText: 4000,
  freeText: 2000,
  notes: 4000,
  drawingPoints: 4000,
} as const;

export const Id = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/, 'Ids may only contain letters, digits, "_" and "-" (max 40).');

/** "<provider>/<slug>", e.g. "generic/load-balancer" or "aws/elastic-load-balancing". */
export const IconId = z
  .string()
  .regex(/^(generic|aws|gcp|azure)\/[a-z0-9]+(-[a-z0-9]+)*$/, 'Not a valid icon id.');

export const Point = z.object({ x: z.number(), y: z.number() });
export const Size = z.object({
  width: z.number().min(8).max(20_000),
  height: z.number().min(8).max(20_000),
});

export const Handle = z.enum(['top', 'right', 'bottom', 'left']);
export const GroupType = z.enum(['region', 'az', 'vpc', 'subnet', 'k8s', 'boundary']);
export const NoteColor = z.enum(['yellow', 'blue', 'green', 'pink', 'grey']);
export const EdgeStyle = z.enum(['sync', 'async']);
export const Protocol = z.enum(['http', 'grpc', 'websocket', 'tcp', 'pubsub']);
export const Arrow = z.enum(['end', 'both', 'none']);
export const FontSize = z.enum(['s', 'm', 'l']);

export const CapacityInput = z.object({
  dau: z.number().min(0).max(1e11),
  readsPerUserPerDay: z.number().min(0).max(1e6),
  writesPerUserPerDay: z.number().min(0).max(1e6),
  payloadBytes: z.number().min(0).max(1e10),
  retentionYears: z.number().min(0).max(100),
  peakFactor: z.number().min(1).max(100),
});

export const CapacityResult = CapacityInput.extend({
  avgReadQps: z.number(),
  peakReadQps: z.number(),
  avgWriteQps: z.number(),
  peakWriteQps: z.number(),
  storagePerYearBytes: z.number(),
  totalStorageBytes: z.number(),
  ingressBytesPerSec: z.number(),
  egressBytesPerSec: z.number(),
});

const nodeBase = {
  id: Id,
  /** Relative to the parent group when parentId is set, otherwise absolute. */
  position: Point,
  parentId: Id.optional(),
  zIndex: z.int().min(-1000).max(1000).optional(),
};

export const ComponentData = z.object({
  replicas: z.int().min(1).max(10_000).optional(),
  region: z.string().max(40).optional(),
  notes: z.string().max(LIMITS.notes).optional(),
  /** Short text shown on the card itself (notes stay in the properties panel). */
  description: z.string().max(LIMITS.description).optional(),
  capacity: CapacityResult.optional(),
});

export const ComponentNode = z.object({
  ...nodeBase,
  kind: z.literal('component'),
  iconId: IconId,
  label: z.string().trim().min(1, 'Labels cannot be empty.').max(LIMITS.label),
  data: ComponentData.default({}),
  /** Set once the user resizes the card; otherwise it sizes to its content. */
  size: Size.optional(),
});

export const GroupNode = z.object({
  ...nodeBase,
  kind: z.literal('group'),
  groupType: GroupType,
  label: z.string().max(LIMITS.label),
  size: Size,
});

export const NoteNode = z.object({
  ...nodeBase,
  kind: z.literal('note'),
  text: z.string().max(LIMITS.noteText),
  color: NoteColor.default('yellow'),
  size: Size,
});

export const TextNode = z.object({
  ...nodeBase,
  kind: z.literal('text'),
  text: z.string().max(LIMITS.freeText),
  fontSize: FontSize.default('m'),
});

export const ShapeKind = z.enum([
  'rectangle',
  'rounded',
  'ellipse',
  'diamond',
  'cylinder',
  'hexagon',
]);
export const ShapeFill = z.enum(['none', 'grey', 'blue', 'green', 'yellow', 'pink', 'purple']);
export const InkColor = z.enum(['ink', 'blue', 'red', 'green', 'orange', 'purple']);

/** Plain diagram shapes with optional text inside (flowcharts, callouts, decision diamonds). */
export const ShapeNode = z.object({
  ...nodeBase,
  kind: z.literal('shape'),
  shape: ShapeKind,
  text: z.string().max(LIMITS.freeText).default(''),
  fill: ShapeFill.default('none'),
  size: Size,
});

/**
 * A freehand pen stroke. Points are relative to `position` (the stroke's top-left), so moving
 * the stroke only changes `position`. Coordinates are rounded to 0.5 px to keep docs small.
 */
export const DrawingNode = z.object({
  ...nodeBase,
  kind: z.literal('drawing'),
  points: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2, 'A drawing needs at least two points.')
    .max(LIMITS.drawingPoints, `A drawing can have at most ${LIMITS.drawingPoints} points.`),
  color: InkColor.default('ink'),
  strokeWidth: z.number().min(1).max(16).default(2.5),
  size: Size,
});

export const DiagramNode = z.discriminatedUnion('kind', [
  ComponentNode,
  GroupNode,
  NoteNode,
  TextNode,
  ShapeNode,
  DrawingNode,
]);

export const DiagramEdge = z.object({
  id: Id,
  source: Id,
  target: Id,
  sourceHandle: Handle.optional(),
  targetHandle: Handle.optional(),
  label: z.string().max(LIMITS.label).optional(),
  style: EdgeStyle.default('sync'),
  protocol: Protocol.optional(),
  arrow: Arrow.default('end'),
});

export const DiagramMeta = z.object({
  title: z.string().max(LIMITS.title).default('Untitled board'),
  description: z.string().max(LIMITS.description).optional(),
});

/** Structural schema only; cross-field rules live in validate.ts. */
export const DiagramV1Shape = z.object({
  format: z.literal(DIAGRAM_FORMAT),
  version: z.literal(DIAGRAM_VERSION),
  meta: DiagramMeta.default({ title: 'Untitled board' }),
  nodes: z
    .array(DiagramNode)
    .max(LIMITS.nodes, `A diagram can have at most ${LIMITS.nodes} nodes.`),
  edges: z
    .array(DiagramEdge)
    .max(LIMITS.edges, `A diagram can have at most ${LIMITS.edges} edges.`),
});

export type Point = z.infer<typeof Point>;
export type Size = z.infer<typeof Size>;
export type Handle = z.infer<typeof Handle>;
export type GroupType = z.infer<typeof GroupType>;
export type NoteColor = z.infer<typeof NoteColor>;
export type EdgeStyle = z.infer<typeof EdgeStyle>;
export type Protocol = z.infer<typeof Protocol>;
export type Arrow = z.infer<typeof Arrow>;
export type CapacityInput = z.infer<typeof CapacityInput>;
export type CapacityResult = z.infer<typeof CapacityResult>;
export type ComponentData = z.infer<typeof ComponentData>;
export type ComponentNode = z.infer<typeof ComponentNode>;
export type GroupNode = z.infer<typeof GroupNode>;
export type NoteNode = z.infer<typeof NoteNode>;
export type TextNode = z.infer<typeof TextNode>;
export type ShapeNode = z.infer<typeof ShapeNode>;
export type DrawingNode = z.infer<typeof DrawingNode>;
export type ShapeKind = z.infer<typeof ShapeKind>;
export type ShapeFill = z.infer<typeof ShapeFill>;
export type InkColor = z.infer<typeof InkColor>;
export type DiagramNode = z.infer<typeof DiagramNode>;
export type DiagramEdge = z.infer<typeof DiagramEdge>;
export type DiagramMeta = z.infer<typeof DiagramMeta>;
export type DiagramV1 = z.infer<typeof DiagramV1Shape>;
export type NodeKind = DiagramNode['kind'];
