import { updateNode } from '@archboard/diagram-schema';
import { cn } from '@archboard/ui';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useBoard } from './context.ts';
import { GroupNode } from './group-node.tsx';
import { IconImage } from './icon-image.tsx';
import { InlineEdit } from './inline-edit.tsx';
import type {
  ComponentNodeData,
  DrawingNodeData,
  FlowNode,
  NoteNodeData,
  ShapeNodeData,
  TextNodeData,
} from './projection.ts';
import { LOCAL_ORIGIN } from './use-board-doc.ts';

const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/** Four connection points. With ConnectionMode.Loose each works as both source and target. */
export function Handles() {
  return (
    <>
      {HANDLES.map((h) => (
        <Handle key={h.id} id={h.id} type="source" position={h.position} className="ab-handle" />
      ))}
    </>
  );
}

function Resizer({
  id,
  selected,
  minWidth,
  minHeight,
}: {
  id: string;
  selected: boolean;
  minWidth: number;
  minHeight: number;
}) {
  const { diagram } = useBoard();
  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      lineClassName="!border-accent"
      handleClassName="!size-2.5 !rounded-sm !border-accent !bg-surface"
      onResizeEnd={(_e, p) =>
        updateNode(
          diagram,
          id,
          {
            position: { x: Math.round(p.x), y: Math.round(p.y) },
            size: { width: Math.round(p.width), height: Math.round(p.height) },
          },
          { origin: LOCAL_ORIGIN },
        )
      }
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Architecture component

export const ComponentNode = memo(function ComponentNode({
  id,
  data,
  selected,
}: NodeProps<FlowNode>) {
  const d = data as ComponentNodeData;
  const { diagram, registry, editingId, setEditingId } = useBoard();
  const entry = registry.byId.get(d.iconId);
  const editing = editingId === id;
  const meta = [d.replicas && d.replicas > 1 ? `×${d.replicas}` : null, d.region]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(
        'ab-node group relative flex min-w-[152px] max-w-[240px] items-center gap-2.5 rounded-lg border bg-surface px-2.5 py-2 shadow-e1',
        selected ? 'border-accent ring-2 ring-accent/25' : 'border-border-strong',
      )}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingId(id);
      }}
    >
      <IconImage iconId={d.iconId} svgPath={entry?.svgPath} category={entry?.category} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <InlineEdit
            ariaLabel="Component name"
            value={d.label}
            className="text-sm font-medium"
            onCommit={(label) => updateNode(diagram, id, { label }, { origin: LOCAL_ORIGIN })}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <p className="line-clamp-2 text-sm font-medium leading-tight text-text" title={d.label}>
            {d.label}
          </p>
        )}
        {meta ? <p className="truncate text-xs text-text-muted">{meta}</p> : null}
      </div>
      {entry && entry.provider !== 'generic' ? (
        <span className="absolute -top-2 right-2 rounded-sm border border-border bg-surface px-1 text-[10px] font-semibold uppercase leading-4 text-text-muted">
          {entry.provider}
        </span>
      ) : null}
      {d.replicas && d.replicas > 1 ? (
        // Stacked-card hint for replicated services.
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 translate-x-1 translate-y-1 rounded-lg border border-border-strong bg-surface"
        />
      ) : null}
      <Handles />
    </div>
  );
});

// ---------------------------------------------------------------------------------------------
// Sticky note

export const NOTE_COLOURS: Record<string, string> = {
  yellow: 'bg-[#fff4c2] text-[#3d3400] border-[#ecd77a]',
  blue: 'bg-[#dcebff] text-[#0f2b52] border-[#a9c8f0]',
  green: 'bg-[#dcf5e6] text-[#0f3d24] border-[#9fd9b6]',
  pink: 'bg-[#fde2ef] text-[#4d0f2b] border-[#f0a9c9]',
  grey: 'bg-[#eceef2] text-[#22262d] border-[#c9ced6]',
};

export const NoteNode = memo(function NoteNode({ id, data, selected }: NodeProps<FlowNode>) {
  const d = data as NoteNodeData;
  const { diagram, editingId, setEditingId } = useBoard();
  const editing = editingId === id;
  return (
    <>
      <Resizer id={id} selected={selected} minWidth={120} minHeight={80} />
      <div
        className={cn(
          'ab-node relative size-full rounded-md border p-3 shadow-e1',
          NOTE_COLOURS[d.color] ?? NOTE_COLOURS.yellow,
          selected && 'ring-2 ring-accent/40',
        )}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingId(id);
        }}
      >
        {editing ? (
          <InlineEdit
            multiline
            ariaLabel="Note text"
            value={d.text}
            className="size-full resize-none text-sm leading-snug"
            onCommit={(text) => updateNode(diagram, id, { text }, { origin: LOCAL_ORIGIN })}
            onDone={() => setEditingId(null)}
          />
        ) : (
          <p className="size-full overflow-hidden whitespace-pre-wrap text-sm leading-snug">
            {d.text || <span className="opacity-60">Double-click to write…</span>}
          </p>
        )}
        <Handles />
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------------------------
// Free text box

const TEXT_SIZES: Record<string, string> = {
  s: 'text-sm',
  m: 'text-md',
  l: 'text-xl font-semibold',
};

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps<FlowNode>) {
  const d = data as TextNodeData;
  const { diagram, editingId, setEditingId } = useBoard();
  const editing = editingId === id;
  const size = TEXT_SIZES[d.fontSize] ?? TEXT_SIZES.m;
  return (
    <div
      className={cn(
        'ab-node min-w-[60px] max-w-[480px] rounded-md px-1.5 py-1 text-text',
        selected ? 'ring-2 ring-accent/50' : 'hover:ring-1 hover:ring-border-strong',
      )}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingId(id);
      }}
    >
      {editing ? (
        <InlineEdit
          multiline
          allowEmpty
          ariaLabel="Text"
          placeholder="Type something…"
          value={d.text}
          className={cn(
            'field-sizing-content min-h-[1.5em] min-w-[180px] resize-none leading-snug',
            size,
          )}
          onCommit={(text) => updateNode(diagram, id, { text }, { origin: LOCAL_ORIGIN })}
          onDone={() => setEditingId(null)}
        />
      ) : (
        <p className={cn('whitespace-pre-wrap leading-snug', size)}>
          {d.text || <span className="text-text-muted">Double-click to type</span>}
        </p>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------------------------
// Shapes (Paint-style): rectangle, rounded, ellipse, diamond, cylinder, hexagon

export const SHAPE_FILLS: Record<string, string> = {
  none: 'fill-surface/0',
  grey: 'fill-[#eceef2] dark:fill-[#2a2f38]',
  blue: 'fill-[#dcebff] dark:fill-[#1a2a44]',
  green: 'fill-[#dcf5e6] dark:fill-[#15301f]',
  yellow: 'fill-[#fff4c2] dark:fill-[#3a3212]',
  pink: 'fill-[#fde2ef] dark:fill-[#3a1a2a]',
  purple: 'fill-[#ece4ff] dark:fill-[#2a2145]',
};

/** Shape outlines in a 100×100 box, stretched to the node size (strokes stay 2px). */
function ShapeOutline({ shape, className }: { shape: string; className: string }) {
  const common = { className, vectorEffect: 'non-scaling-stroke' as const };
  switch (shape) {
    case 'rounded':
      return <rect x="1" y="1" width="98" height="98" rx="12" ry="12" {...common} />;
    case 'ellipse':
      return <ellipse cx="50" cy="50" rx="49" ry="49" {...common} />;
    case 'diamond':
      return <polygon points="50,1 99,50 50,99 1,50" {...common} />;
    case 'hexagon':
      return <polygon points="25,1 75,1 99,50 75,99 25,99 1,50" {...common} />;
    case 'cylinder':
      return (
        <>
          <path d="M1,12 C1,-3 99,-3 99,12 L99,88 C99,103 1,103 1,88 Z" {...common} />
          <path d="M1,12 C1,27 99,27 99,12" {...common} fill="none" />
        </>
      );
    default:
      return <rect x="1" y="1" width="98" height="98" rx="2" {...common} />;
  }
}

export const ShapeNode = memo(function ShapeNode({ id, data, selected }: NodeProps<FlowNode>) {
  const d = data as ShapeNodeData;
  const { diagram, editingId, setEditingId } = useBoard();
  const editing = editingId === id;
  return (
    <>
      <Resizer id={id} selected={selected} minWidth={40} minHeight={30} />
      <div
        className="ab-node relative flex size-full items-center justify-center p-3"
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingId(id);
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden="true"
        >
          <ShapeOutline
            shape={d.shape}
            className={cn(
              'stroke-2',
              SHAPE_FILLS[d.fill] ?? SHAPE_FILLS.none,
              selected ? 'stroke-accent' : 'stroke-text-muted',
            )}
          />
        </svg>
        <div className="relative w-full text-center text-sm font-medium text-text">
          {editing ? (
            <InlineEdit
              multiline
              allowEmpty
              ariaLabel="Shape text"
              value={d.text}
              className="field-sizing-content resize-none text-center"
              onCommit={(text) => updateNode(diagram, id, { text }, { origin: LOCAL_ORIGIN })}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <p className="line-clamp-4 whitespace-pre-wrap">{d.text}</p>
          )}
        </div>
        <Handles />
      </div>
    </>
  );
});

// ---------------------------------------------------------------------------------------------
// Pen drawings

export const INK_COLOURS: Record<string, string> = {
  ink: 'var(--text)',
  blue: '#2b6cd9',
  red: '#d6453d',
  green: '#1f8a4c',
  orange: '#d97706',
  purple: '#7c4ddb',
};

/** Smooth a polyline with quadratic curves through the midpoints of each segment. */
export function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 0) return '';
  const [first] = points;
  if (!first) return '';
  if (points.length < 3)
    return `M${first[0]},${first[1]} ${points.map((p) => `L${p[0]},${p[1]}`).join(' ')}`;
  let d = `M${first[0]},${first[1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as readonly [number, number];
    const n = points[i + 1] as readonly [number, number];
    d += ` Q${p[0]},${p[1]} ${(p[0] + n[0]) / 2},${(p[1] + n[1]) / 2}`;
  }
  const last = points[points.length - 1] as readonly [number, number];
  return `${d} L${last[0]},${last[1]}`;
}

export const DrawingNode = memo(function DrawingNode({ data, selected }: NodeProps<FlowNode>) {
  const d = data as DrawingNodeData;
  return (
    <div
      className={cn(
        'ab-node relative size-full',
        selected && 'rounded-sm outline outline-1 outline-dashed outline-accent outline-offset-4',
      )}
    >
      <svg width={d.width} height={d.height} className="overflow-visible" aria-hidden="true">
        {/* Wide invisible stroke makes thin lines easy to click. */}
        <path
          d={smoothPath(d.points)}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(14, d.strokeWidth + 10)}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="stroke"
        />
        <path
          d={smoothPath(d.points)}
          fill="none"
          stroke={INK_COLOURS[d.color] ?? INK_COLOURS.ink}
          strokeWidth={d.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
});

export const nodeTypes = {
  component: ComponentNode,
  note: NoteNode,
  group: GroupNode,
  text: TextNode,
  shape: ShapeNode,
  drawing: DrawingNode,
};
