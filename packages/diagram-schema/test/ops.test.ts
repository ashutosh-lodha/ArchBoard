import * as Y from 'yjs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  absolutePosition,
  align,
  autoName,
  connect,
  deleteElements,
  distribute,
  duplicate,
  extractFragment,
  findFreeSpot,
  getDiagramDoc,
  groupNodes,
  pasteFragment,
  readEdges,
  readNodes,
  reparent,
  ungroup,
  updateNode,
  type DiagramDoc,
} from '../src/index.ts';
import { parseFragment, serializeFragment } from '../src/clipboard.ts';
import { computeCapacity, formatBytes, formatQps } from '../src/capacity.ts';

let d: DiagramDoc;
let counter: number;
const newId = () => `id${++counter}`;
const component = (label: string, x: number, y: number) =>
  ({ kind: 'component', iconId: 'generic/service', label, data: {}, position: { x, y } }) as const;

beforeEach(() => {
  d = getDiagramDoc(new Y.Doc());
  counter = 0;
});

describe('autoName', () => {
  it('numbers after the highest existing suffix', () => {
    expect(autoName('Service', [])).toBe('Service 1');
    expect(autoName('Service', ['Service 1', 'Service 3', 'Cache 9'])).toBe('Service 4');
    expect(autoName('C++ (svc)', ['C++ (svc) 2'])).toBe('C++ (svc) 3');
  });
});

describe('addNode / findFreeSpot', () => {
  it('never places a new node on top of an existing one', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 0, 0), { newId });
    const b = addNode(d, component('B', 0, 0), { newId });
    const nodes = readNodes(d);
    const pa = nodes.get(a)?.position;
    const pb = nodes.get(b)?.position;
    expect(pa).toEqual({ x: 0, y: 0 });
    expect(pb).not.toEqual(pa);
  });

  it('returns the desired point when free and snaps to the grid', () => {
    expect(findFreeSpot([], { x: 13, y: 21 }, { width: 10, height: 10 })).toEqual({ x: 16, y: 24 });
  });
});

describe('connect', () => {
  it('creates sync edges with an end arrow by default and rejects bad connections', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 0, 0), { newId });
    const b = addNode(d, component('B', 400, 0), { newId });
    const r = connect(d, { source: a, target: b }, { newId });
    expect(r.ok).toBe(true);
    expect([...readEdges(d).values()][0]).toMatchObject({ style: 'sync', arrow: 'end' });
    expect(connect(d, { source: a, target: b })).toEqual({ ok: false, reason: 'duplicate' });
    expect(connect(d, { source: a, target: a })).toEqual({ ok: false, reason: 'self' });
    expect(connect(d, { source: a, target: 'nope' })).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('groups', () => {
  it('groups nodes without moving them on screen, and ungroup restores them', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 100, 100), { newId });
    const b = addNode(d, component('B', 400, 300), { newId });
    const before = readNodes(d);
    const absBefore = [absolutePosition(before, a), absolutePosition(before, b)];

    const g = groupNodes(d, [a, b], 'vpc', { newId });
    expect(g).not.toBeNull();
    const grouped = readNodes(d);
    expect(grouped.get(a)?.parentId).toBe(g);
    expect(grouped.get(g as string)).toMatchObject({ kind: 'group', label: 'VPC 1' });
    expect([absolutePosition(grouped, a), absolutePosition(grouped, b)]).toEqual(absBefore);

    ungroup(d, g as string);
    const after = readNodes(d);
    expect(after.has(g as string)).toBe(false);
    expect(after.get(a)?.parentId).toBeUndefined();
    expect([absolutePosition(after, a), absolutePosition(after, b)]).toEqual(absBefore);
  });

  it('refuses to group nodes with different parents and to create cycles', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 0, 0), { newId });
    const b = addNode(d, component('B', 400, 0), { newId });
    const g1 = groupNodes(d, [a], 'vpc', { newId }) as string;
    expect(groupNodes(d, [a, b], 'subnet', { newId })).toBeNull();
    const g2 = groupNodes(d, [g1], 'region', { newId }) as string;
    expect(reparent(d, g2, g1)).toBe(false);
  });

  it('reparent keeps the absolute position', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 0, 0), { newId });
    const b = addNode(d, component('B', 600, 600), { newId });
    const g = groupNodes(d, [a], 'boundary', { newId }) as string;
    const abs = absolutePosition(readNodes(d), b);
    expect(reparent(d, b, g)).toBe(true);
    expect(readNodes(d).get(b)?.parentId).toBe(g);
    expect(absolutePosition(readNodes(d), b)).toEqual(abs);
  });
});

describe('deleteElements', () => {
  it('cascades to group children and connected edges', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 0, 0), { newId });
    const b = addNode(d, component('B', 400, 0), { newId });
    const c = addNode(d, component('C', 800, 0), { newId });
    connect(d, { source: a, target: b }, { newId });
    connect(d, { source: b, target: c }, { newId });
    const g = groupNodes(d, [a, b], 'vpc', { newId }) as string;
    const removed = deleteElements(d, [g]);
    expect(removed.nodes.sort()).toEqual([a, b, g].sort());
    expect(removed.edges).toHaveLength(2);
    expect([...readNodes(d).keys()]).toEqual([c]);
  });
});

describe('fragments, clipboard and duplicate', () => {
  it('duplicate remaps ids, keeps internal edges and offsets by 24px', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 0, 0), { newId });
    const b = addNode(d, component('B', 400, 0), { newId });
    connect(d, { source: a, target: b }, { newId });
    const result = duplicate(d, [a, b], { newId });
    expect(result.rootIds).toHaveLength(2);
    expect(result.edgeIds).toHaveLength(1);
    const nodes = readNodes(d);
    expect(nodes.size).toBe(4);
    const copyOfA = nodes.get(result.rootIds[0] as string);
    expect(copyOfA?.position).toEqual({ x: 24, y: 24 });
  });

  it('round-trips through the clipboard format and pastes at a point', async () => {
    const { addNode } = await import('../src/ops.ts');
    const a = addNode(d, component('A', 100, 100), { newId });
    const g = groupNodes(d, [a], 'subnet', { newId }) as string;
    const text = serializeFragment(extractFragment(d, [g]));
    expect(text.startsWith('archboard:')).toBe(true);
    const fragment = parseFragment(text);
    expect(fragment?.nodes).toHaveLength(2);

    const other = getDiagramDoc(new Y.Doc());
    const pasted = pasteFragment(other, fragment as NonNullable<typeof fragment>, {
      at: { x: 1000, y: 1000 },
      newId,
    });
    const nodes = readNodes(other);
    const root = nodes.get(pasted.rootIds[0] as string);
    expect(root?.position).toEqual({ x: 1000, y: 1000 });
    const child = [...nodes.values()].find((n) => n.kind === 'component');
    expect(child?.parentId).toBe(root?.id);
  });

  it('ignores non-ArchBoard clipboard text and malformed data', () => {
    expect(parseFragment('hello')).toBeNull();
    expect(parseFragment('archboard:{not json')).toBeNull();
    expect(parseFragment('archboard:{"v":2,"nodes":[],"edges":[]}')).toBeNull();
  });
});

describe('align / distribute', () => {
  it('aligns left edges and distributes with equal gaps', async () => {
    const { addNode } = await import('../src/ops.ts');
    const ids = [
      addNode(d, component('A', 0, 0), { newId, avoidOverlap: false }),
      addNode(d, component('B', 96, 200), { newId, avoidOverlap: false }),
      addNode(d, component('C', 40, 800), { newId, avoidOverlap: false }),
    ];
    align(d, ids, 'left');
    expect(ids.map((id) => readNodes(d).get(id)?.position.x)).toEqual([0, 0, 0]);
    distribute(d, ids, 'vertical');
    const ys = ids.map((id) => readNodes(d).get(id)?.position.y ?? 0);
    expect(ys[1]! - ys[0]!).toBeCloseTo(ys[2]! - ys[1]!);
  });
});

describe('undo integration', () => {
  it('every op is a single undo step for the tracked origin', async () => {
    const { addNode } = await import('../src/ops.ts');
    const LOCAL = Symbol('local');
    const undo = new Y.UndoManager([d.nodes, d.edges], {
      trackedOrigins: new Set([LOCAL]),
      captureTimeout: 0,
    });
    const a = addNode(d, component('A', 0, 0), { newId, origin: LOCAL });
    const b = addNode(d, component('B', 400, 0), { newId, origin: LOCAL });
    groupNodes(d, [a, b], 'vpc', { newId, origin: LOCAL });
    updateNode(d, a, { label: 'Renamed' }, { origin: LOCAL });
    expect(readNodes(d).size).toBe(3);
    undo.undo(); // rename
    expect(readNodes(d).get(a)).toMatchObject({ label: 'A' });
    undo.undo(); // group
    expect(readNodes(d).size).toBe(2);
    expect(readNodes(d).get(a)?.parentId).toBeUndefined();
  });
});

describe('capacity calculator', () => {
  it('matches hand-computed reference values', () => {
    // 10M DAU, 100 reads + 1 write per user per day, 1 KB payload, 5 years, 3x peak.
    const r = computeCapacity({
      dau: 10_000_000,
      readsPerUserPerDay: 100,
      writesPerUserPerDay: 1,
      payloadBytes: 1000,
      retentionYears: 5,
      peakFactor: 3,
    });
    expect(r.avgReadQps).toBeCloseTo(11_574.07, 1);
    expect(r.peakReadQps).toBeCloseTo(34_722.2, 0);
    expect(r.avgWriteQps).toBeCloseTo(115.74, 1);
    expect(r.storagePerYearBytes).toBe(3.65e12);
    expect(r.totalStorageBytes).toBe(1.825e13);
    expect(formatBytes(r.storagePerYearBytes)).toBe('3.65 TB');
    expect(formatQps(r.peakReadQps)).toBe('34.7K');
  });

  it('handles zero traffic', () => {
    const r = computeCapacity({
      dau: 0,
      readsPerUserPerDay: 0,
      writesPerUserPerDay: 0,
      payloadBytes: 0,
      retentionYears: 0,
      peakFactor: 1,
    });
    expect(r.peakReadQps).toBe(0);
    expect(formatBytes(0)).toBe('0 B');
  });
});
