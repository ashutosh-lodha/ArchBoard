import fc from 'fast-check';
import type { DiagramEdge, DiagramNode, DiagramV1 } from '../src/schema.ts';

const coord = fc.integer({ min: -5000, max: 5000 });
const point = fc.record({ x: coord, y: coord });
const size = fc.record({
  width: fc.integer({ min: 40, max: 1200 }),
  height: fc.integer({ min: 40, max: 900 }),
});
const label = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0 && s.trim() === s);
const iconId = fc.constantFrom(
  'generic/service',
  'generic/load-balancer',
  'generic/sql-db',
  'aws/amazon-s3',
  'gcp/cloud-run',
  'azure/app-service',
);

/** Node content without id/position/parentId (assigned by the diagram arbitrary). */
const nodeBody = fc.oneof(
  fc.record(
    {
      kind: fc.constant('component' as const),
      iconId,
      label,
      data: fc.record(
        {
          replicas: fc.integer({ min: 1, max: 50 }),
          region: fc.constantFrom('ap-south-1', 'us-east-1'),
          notes: fc.string({ maxLength: 40 }),
          description: fc.string({ maxLength: 40 }),
        },
        { requiredKeys: [] },
      ),
    },
    { requiredKeys: ['kind', 'iconId', 'label', 'data'] },
  ),
  fc.record({
    kind: fc.constant('group' as const),
    groupType: fc.constantFrom('region', 'az', 'vpc', 'subnet', 'k8s', 'boundary' as const),
    label: fc.string({ maxLength: 30 }),
    size,
  }),
  fc.record({
    kind: fc.constant('note' as const),
    text: fc.string({ maxLength: 60 }),
    color: fc.constantFrom('yellow', 'blue', 'green', 'pink', 'grey' as const),
    size,
  }),
  fc.record({
    kind: fc.constant('text' as const),
    text: fc.string({ maxLength: 60 }),
    fontSize: fc.constantFrom('s', 'm', 'l' as const),
  }),
  fc.record({
    kind: fc.constant('shape' as const),
    shape: fc.constantFrom(
      'rectangle',
      'rounded',
      'ellipse',
      'diamond',
      'cylinder',
      'hexagon' as const,
    ),
    text: fc.string({ maxLength: 40 }),
    fill: fc.constantFrom('none', 'grey', 'blue', 'green', 'yellow', 'pink', 'purple' as const),
    size,
  }),
  fc.record({
    kind: fc.constant('drawing' as const),
    points: fc.array(fc.tuple(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 400 })), {
      minLength: 2,
      maxLength: 30,
    }),
    color: fc.constantFrom('ink', 'blue', 'red', 'green', 'orange', 'purple' as const),
    strokeWidth: fc.integer({ min: 1, max: 16 }),
    size,
  }),
);

/** Arbitrary *valid* DiagramV1: unique ids, parents are earlier groups (no cycles). */
export const diagramArb: fc.Arbitrary<DiagramV1> = fc
  .record({
    bodies: fc.array(fc.tuple(nodeBody, point, fc.nat()), { maxLength: 25 }),
    edgeSeeds: fc.array(
      fc.record(
        {
          a: fc.nat(),
          b: fc.nat(),
          label: fc.string({ maxLength: 20 }),
          style: fc.constantFrom('sync', 'async' as const),
          protocol: fc.constantFrom('http', 'grpc', 'websocket', 'tcp', 'pubsub' as const),
          arrow: fc.constantFrom('end', 'both', 'none' as const),
          sourceHandle: fc.constantFrom('top', 'right', 'bottom', 'left' as const),
        },
        { requiredKeys: ['a', 'b', 'style', 'arrow'] },
      ),
      { maxLength: 30 },
    ),
    title: fc.string({ maxLength: 40 }),
  })
  .map(({ bodies, edgeSeeds, title }) => {
    const nodes: DiagramNode[] = [];
    const groupIds: string[] = [];
    bodies.forEach(([body, position, parentSeed], i) => {
      const id = `n${i}`;
      const node = { ...body, id, position } as DiagramNode;
      if (groupIds.length > 0 && parentSeed % 3 === 0) {
        node.parentId = groupIds[parentSeed % groupIds.length] as string;
      }
      nodes.push(node);
      if (body.kind === 'group') groupIds.push(id);
    });
    const edges: DiagramEdge[] = [];
    if (nodes.length >= 2) {
      edgeSeeds.forEach((seed, i) => {
        const { a, b, ...rest } = seed;
        const source = `n${a % nodes.length}`;
        const target = `n${b % nodes.length}`;
        if (source !== target) edges.push({ ...rest, id: `e${i}`, source, target } as DiagramEdge);
      });
    }
    return {
      format: 'archboard.diagram' as const,
      version: 1 as const,
      meta: { title },
      nodes,
      edges,
    };
  });
