import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fromYDoc, sortParentsFirst, toYDoc } from '../src/ydoc.ts';
import { parseDiagram, validateDiagram } from '../src/validate.ts';
import type { DiagramV1 } from '../src/schema.ts';
import { diagramArb } from './arbitraries.ts';

const normalise = (d: DiagramV1): DiagramV1 => ({
  ...d,
  nodes: sortParentsFirst(d.nodes),
  edges: [...d.edges].sort((a, b) => (a.id < b.id ? -1 : 1)),
});

const base = (patch: Partial<DiagramV1> = {}): unknown => ({
  format: 'archboard.diagram',
  version: 1,
  meta: { title: 'Test' },
  nodes: [
    {
      id: 'lb',
      kind: 'component',
      iconId: 'generic/load-balancer',
      label: 'LB',
      position: { x: 0, y: 0 },
    },
    {
      id: 'api',
      kind: 'component',
      iconId: 'generic/service',
      label: 'API',
      position: { x: 240, y: 0 },
    },
  ],
  edges: [{ id: 'e1', source: 'lb', target: 'api' }],
  ...patch,
});

describe('DiagramV1 round-trip', () => {
  it('every valid diagram survives toYDoc → fromYDoc unchanged (1,000 cases)', () => {
    fc.assert(
      fc.property(diagramArb, (diagram) => {
        const valid = parseDiagram(diagram);
        expect(fromYDoc(toYDoc(valid))).toEqual(normalise(valid));
      }),
      { numRuns: 1000 },
    );
  });

  it('generated diagrams always pass validation', () => {
    fc.assert(
      fc.property(diagramArb, (diagram) => {
        expect(validateDiagram(diagram).ok).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

describe('validateDiagram', () => {
  it('applies defaults (sync edges with end arrows, empty data)', () => {
    const result = validateDiagram(base());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.edges[0]).toMatchObject({ style: 'sync', arrow: 'end' });
    expect(result.diagram.nodes[0]).toMatchObject({ data: {} });
  });

  const cases: Array<[string, unknown, string, RegExp]> = [
    ['wrong format', { ...(base() as object), format: 'other' }, 'format', /expected/i],
    [
      'missing edge target',
      base({ edges: [{ id: 'e1', source: 'lb', target: 'db-1', style: 'sync', arrow: 'end' }] }),
      'edges[0].target',
      /Edge 1 points to a missing node "db-1"/,
    ],
    [
      'duplicate id',
      base({
        edges: [{ id: 'lb', source: 'lb', target: 'api', style: 'sync', arrow: 'end' }],
      }),
      'edges[0].id',
      /already used by node 1/,
    ],
    [
      'self loop',
      base({ edges: [{ id: 'e1', source: 'lb', target: 'lb', style: 'sync', arrow: 'end' }] }),
      'edges[0]',
      /connects a node to itself/,
    ],
    [
      'empty label',
      base({
        nodes: [
          {
            id: 'lb',
            kind: 'component',
            iconId: 'generic/load-balancer',
            label: '  ',
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        edges: [],
      }),
      'nodes[0].label',
      /cannot be empty/,
    ],
    [
      'parent is not a group',
      base({
        nodes: [
          {
            id: 'lb',
            kind: 'component',
            iconId: 'generic/load-balancer',
            label: 'LB',
            position: { x: 0, y: 0 },
            data: {},
          },
          {
            id: 'api',
            kind: 'component',
            iconId: 'generic/service',
            label: 'API',
            position: { x: 0, y: 0 },
            parentId: 'lb',
            data: {},
          },
        ],
        edges: [],
      }),
      'nodes[1].parentId',
      /not a group/,
    ],
    [
      'bad icon id format',
      base({
        nodes: [
          {
            id: 'x',
            kind: 'component',
            iconId: 'Not An Icon',
            label: 'X',
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
        edges: [],
      }),
      'nodes[0].iconId',
      /Not a valid icon id/,
    ],
    [
      'non-numeric position',
      base({
        nodes: [
          {
            id: 'x',
            kind: 'component',
            iconId: 'generic/service',
            label: 'X',
            position: { x: 'a', y: 0 } as never,
            data: {},
          },
        ],
        edges: [],
      }),
      'nodes[0].position.x',
      /number/i,
    ],
    ['not an object', 42, '(root)', /object/i],
    [
      'too many nodes',
      base({ nodes: Array.from({ length: 2001 }, () => ({})) as never }),
      'nodes',
      /at most 2000/,
    ],
  ];

  it.each(cases)('rejects %s with a path-specific message', (_name, input, path, message) => {
    const result = validateDiagram(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues.find((i) => i.path === path);
    expect(issue, JSON.stringify(result.issues)).toBeDefined();
    expect(issue?.message).toMatch(message);
  });

  it('detects group nesting cycles', () => {
    const result = validateDiagram(
      base({
        nodes: [
          {
            id: 'g1',
            kind: 'group',
            groupType: 'vpc',
            label: 'A',
            size: { width: 100, height: 100 },
            position: { x: 0, y: 0 },
            parentId: 'g2',
          },
          {
            id: 'g2',
            kind: 'group',
            groupType: 'vpc',
            label: 'B',
            size: { width: 100, height: 100 },
            position: { x: 0, y: 0 },
            parentId: 'g1',
          },
        ],
        edges: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => /loops back/.test(i.message))).toBe(true);
  });

  it('checks icon ids against the registry when asked', () => {
    const result = validateDiagram(base(), { iconExists: (id) => id === 'generic/service' });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues[0]?.message).toMatch(/unknown icon "generic\/load-balancer"/);
  });
});
