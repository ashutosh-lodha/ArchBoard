import { updateNode } from '@archboard/diagram-schema';
import { cn } from '@archboard/ui';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useBoard } from './context.ts';
import { IconImage } from './icon-image.tsx';
import type { ComponentNodeData, FlowNode, NoteNodeData } from './projection.ts';
import { LOCAL_ORIGIN } from './use-board-doc.ts';

const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/** Four connection points. With ConnectionMode.Loose each works as both source and target. */
function Handles() {
  return (
    <>
      {HANDLES.map((h) => (
        <Handle key={h.id} id={h.id} type="source" position={h.position} className="ab-handle" />
      ))}
    </>
  );
}

/** Inline label editor: Enter confirms, Esc cancels, blur confirms, empty reverts (UX §5.3). */
function InlineEdit({
  value,
  onCommit,
  onDone,
  multiline = false,
  className,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  onDone: () => void;
  multiline?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const next = multiline ? draft : draft.trim();
    if ((multiline || next) && next !== value) onCommit(next);
    onDone();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // keep Delete/Backspace/shortcuts inside the editor
    if (e.key === 'Escape') onDone();
    if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };
  const common = {
    value: draft,
    'aria-label': ariaLabel,
    onBlur: commit,
    onKeyDown,
    className: cn('nodrag nopan w-full bg-transparent outline-none', className),
  };
  return multiline ? (
    <textarea ref={ref} {...common} onChange={(e) => setDraft(e.target.value)} />
  ) : (
    <input ref={ref} {...common} maxLength={80} onChange={(e) => setDraft(e.target.value)} />
  );
}

export const ComponentNode = memo(function ComponentNode({
  id,
  data,
  selected,
}: NodeProps<FlowNode>) {
  const d = data as ComponentNodeData;
  const { diagram, registry, editingId, setEditingId } = useBoard();
  const entry = registry.byId.get(d.iconId);
  const editing = editingId === id;
  const meta = [d.replicas ? `×${d.replicas}` : null, d.region].filter(Boolean).join(' · ');

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
      <Handles />
    </div>
  );
});

const NOTE_COLOURS: Record<string, string> = {
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
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName="!border-accent"
        handleClassName="!size-2.5 !rounded-sm !border-accent !bg-surface"
        onResizeEnd={(_e, p) =>
          updateNode(
            diagram,
            id,
            {
              position: { x: p.x, y: p.y },
              size: { width: Math.round(p.width), height: Math.round(p.height) },
            },
            { origin: LOCAL_ORIGIN },
          )
        }
      />
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

export const nodeTypes = { component: ComponentNode, note: NoteNode };
