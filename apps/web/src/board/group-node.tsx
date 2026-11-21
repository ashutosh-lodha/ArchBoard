import { GROUP_LABELS, updateNode, type GroupType } from '@archboard/diagram-schema';
import { cn } from '@archboard/ui';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useBoard } from './context.ts';
import { InlineEdit } from './inline-edit.tsx';
import type { FlowNode, GroupNodeData } from './projection.ts';
import { LOCAL_ORIGIN } from './use-board-doc.ts';

/**
 * Container colours (UX §10.1): a light tint with a stronger border. Logical boundaries
 * (subnet, boundary) are dashed; physical ones (region, AZ, VPC, cluster) are solid.
 */
const GROUP_STYLE: Record<GroupType, { box: string; tab: string; dashed: boolean }> = {
  region: {
    box: 'bg-[#64748b]/[0.06] border-[#64748b]/60',
    tab: 'bg-[#64748b] text-white',
    dashed: false,
  },
  az: {
    box: 'bg-[#0d9488]/[0.06] border-[#0d9488]/60',
    tab: 'bg-[#0f766e] text-white',
    dashed: true,
  },
  vpc: {
    box: 'bg-[#2b59c3]/[0.06] border-[#2b59c3]/60',
    tab: 'bg-[#2b59c3] text-white',
    dashed: false,
  },
  subnet: {
    box: 'bg-[#7c3aed]/[0.06] border-[#7c3aed]/60',
    tab: 'bg-[#6d28d9] text-white',
    dashed: true,
  },
  k8s: {
    box: 'bg-[#4f46e5]/[0.06] border-[#4f46e5]/60',
    tab: 'bg-[#4338ca] text-white',
    dashed: false,
  },
  boundary: {
    box: 'bg-text/[0.03] border-text-muted/60',
    tab: 'bg-[#4a5260] text-white',
    dashed: true,
  },
};

export const GroupNode = memo(function GroupNode({ id, data, selected }: NodeProps<FlowNode>) {
  const d = data as GroupNodeData;
  const { diagram, editingId, setEditingId, dropTargetId } = useBoard();
  const type = (d.groupType in GROUP_STYLE ? d.groupType : 'boundary') as GroupType;
  const style = GROUP_STYLE[type];
  const isDropTarget = dropTargetId === id;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
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
      <div
        className={cn(
          'ab-group size-full rounded-xl border-2 transition-colors duration-[var(--dur-1)]',
          style.dashed && 'border-dashed',
          style.box,
          selected && 'ring-2 ring-accent/30',
          isDropTarget && 'border-accent bg-accent/10 ring-4 ring-accent/20',
        )}
      >
        <div
          className="absolute left-3 top-0 flex max-w-[calc(100%-24px)] -translate-y-1/2 items-center gap-1.5"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingId(id);
          }}
        >
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              style.tab,
            )}
          >
            {GROUP_LABELS[type]}
          </span>
          {editingId === id ? (
            <span className="rounded bg-surface px-1.5 py-0.5 shadow-e1">
              <InlineEdit
                ariaLabel="Group name"
                value={d.label}
                className="w-40 text-xs font-semibold"
                onCommit={(label) => updateNode(diagram, id, { label }, { origin: LOCAL_ORIGIN })}
                onDone={() => setEditingId(null)}
              />
            </span>
          ) : d.label && d.label !== GROUP_LABELS[type] ? (
            <span
              className="truncate rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-text shadow-e1"
              title={d.label}
            >
              {d.label}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
});
