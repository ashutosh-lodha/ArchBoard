import {
  fromYMap,
  GROUP_LABELS,
  updateEdge,
  updateNode,
  type AlignMode,
  type DiagramDoc,
  type DiagramEdge,
  type DiagramNode,
  type GroupType,
} from '@archboard/diagram-schema';
import { PROVIDER_LABELS } from '@archboard/icons';
import {
  Badge,
  Button,
  cn,
  Field,
  IconButton,
  Input,
  Kbd,
  SegmentedControl,
  Select,
  Textarea,
} from '@archboard/ui';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Lightbulb,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { IconImage } from './icon-image.tsx';
import { INK_COLOURS, NOTE_COLOURS, SHAPE_FILLS } from './nodes.tsx';
import type { LoadedRegistry } from './registry.ts';
import { TRADEOFFS } from './tradeoffs.ts';
import { LOCAL_ORIGIN } from './use-board-doc.ts';

export const GROUP_TYPES: GroupType[] = ['region', 'az', 'vpc', 'subnet', 'k8s', 'boundary'];
const opts = { origin: LOCAL_ORIGIN };

export interface PropertiesPanelProps {
  diagram: DiagramDoc;
  registry: LoadedRegistry;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  onGroup: (type: GroupType) => void;
  onUngroup: (groupId: string) => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  onDelete: () => void;
  className?: string;
}

/** Contextual properties: shows only what applies to the current selection. */
export function PropertiesPanel(props: PropertiesPanelProps) {
  const { diagram, selectedNodeIds, selectedEdgeIds } = props;
  const total = selectedNodeIds.length + selectedEdgeIds.length;

  let body: ReactNode;
  if (total === 0) body = <BoardTips />;
  else if (total > 1) body = <MultiSelection {...props} count={total} />;
  else if (selectedEdgeIds[0]) {
    const y = diagram.edges.get(selectedEdgeIds[0]);
    body = y ? <EdgeProperties {...props} edge={fromYMap<DiagramEdge>(y)} /> : null;
  } else {
    const y = diagram.nodes.get(selectedNodeIds[0] as string);
    body = y ? <NodeProperties {...props} node={fromYMap<DiagramNode>(y)} /> : null;
  }

  return (
    <div className={cn('flex h-full flex-col overflow-y-auto overscroll-contain', props.className)}>
      {body}
    </div>
  );
}

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Text input that commits on blur or Enter (one undo step per edit, not per keystroke). */
function CommitInput({
  value,
  onCommit,
  multiline,
  validate,
  ...rest
}: {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  validate?: (value: string) => string | null;
  id?: string;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
  'aria-label'?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  // Reset the draft when the value changes underneath us (undo, another field) — computed
  // during render, per React docs, rather than in an effect.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }
  const commit = () => {
    const problem = validate?.(draft) ?? null;
    setError(problem);
    if (problem) return;
    if (draft !== value) onCommit(draft);
  };
  const shared = {
    ...rest,
    value: draft,
    'aria-invalid': error ? true : undefined,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: commit,
  };
  return (
    <>
      {multiline ? (
        <Textarea {...shared} className="min-h-24" />
      ) : (
        <Input
          {...shared}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(value);
              setError(null);
            }
          }}
        />
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </>
  );
}

function Swatches({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; name: string; className?: string; style?: React.CSSProperties }>;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.name}
          title={o.name}
          onClick={() => onChange(o.value)}
          className={cn(
            'size-7 rounded-full border border-border-strong pointer-coarse:size-11',
            value === o.value && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
            o.className,
          )}
          style={o.style}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function BoardTips() {
  const tips: Array<[string, ReactNode]> = [
    ['Add a component', <Kbd key="k">/</Kbd>],
    ['Draw with the pen', <Kbd key="k">D</Kbd>],
    ['Draw a shape (type inside)', <Kbd key="k">R</Kbd>],
    ['Add text', <Kbd key="k">T</Kbd>],
    ['Group the selection', <Kbd key="k">G</Kbd>],
    ['Rename the selection', <Kbd key="k">Enter</Kbd>],
    ['Undo / redo', <Kbd key="k">Ctrl+Z</Kbd>],
  ];
  return (
    <Section title="Properties">
      <p className="text-base text-text-muted">Select something on the board to edit it here.</p>
      <ul className="space-y-2">
        {tips.map(([text, key]) => (
          <li key={text} className="flex items-center justify-between gap-2 text-sm">
            <span>{text}</span>
            {key}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function MultiSelection(props: PropertiesPanelProps & { count: number }) {
  const nodeCount = props.selectedNodeIds.length;
  const align: Array<[AlignMode, string, ReactNode]> = [
    ['left', 'Align left', <AlignStartVertical key="i" />],
    ['center', 'Align centres horizontally', <AlignCenterVertical key="i" />],
    ['right', 'Align right', <AlignEndVertical key="i" />],
    ['top', 'Align top', <AlignStartHorizontal key="i" />],
    ['middle', 'Align middles vertically', <AlignCenterHorizontal key="i" />],
    ['bottom', 'Align bottom', <AlignEndHorizontal key="i" />],
  ];
  return (
    <>
      <Section title={`${props.count} selected`}>
        <Button variant="danger" size="sm" onClick={props.onDelete}>
          <Trash2 /> Delete selection
        </Button>
      </Section>
      {nodeCount >= 2 ? (
        <Section title="Arrange">
          <div className="flex flex-wrap gap-0.5" role="group" aria-label="Align">
            {align.map(([mode, label, icon]) => (
              <IconButton
                key={mode}
                label={label}
                tooltipSide="bottom"
                onClick={() => props.onAlign(mode)}
              >
                {icon}
              </IconButton>
            ))}
          </div>
          <div className="flex gap-0.5" role="group" aria-label="Distribute">
            <IconButton
              label="Distribute horizontally"
              disabled={nodeCount < 3}
              disabledReason="Select 3 or more to distribute"
              onClick={() => props.onDistribute('horizontal')}
            >
              <AlignHorizontalSpaceAround />
            </IconButton>
            <IconButton
              label="Distribute vertically"
              disabled={nodeCount < 3}
              disabledReason="Select 3 or more to distribute"
              onClick={() => props.onDistribute('vertical')}
            >
              <AlignVerticalSpaceAround />
            </IconButton>
          </div>
        </Section>
      ) : null}
      {nodeCount >= 1 ? <GroupPicker onGroup={props.onGroup} /> : null}
    </>
  );
}

export function GroupPicker({ onGroup }: { onGroup: (type: GroupType) => void }) {
  return (
    <Section title="Group into" aside={<Kbd>G</Kbd>}>
      <div className="grid grid-cols-2 gap-1.5">
        {GROUP_TYPES.map((t) => (
          <Button key={t} size="sm" onClick={() => onGroup(t)} className="justify-start">
            {GROUP_LABELS[t]}
          </Button>
        ))}
      </div>
    </Section>
  );
}

function NodeProperties(props: PropertiesPanelProps & { node: DiagramNode }) {
  const { node, diagram, registry } = props;
  const uid = useId();
  const update = (patch: Record<string, unknown>) => updateNode(diagram, node.id, patch, opts);

  switch (node.kind) {
    case 'component': {
      const entry = registry.byId.get(node.iconId);
      const tradeoff = TRADEOFFS[node.iconId];
      const data = node.data ?? {};
      const setData = (patch: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...data, ...patch };
        for (const k of Object.keys(next))
          if (next[k] === undefined || next[k] === '') delete next[k];
        update({ data: next });
      };
      return (
        <>
          <Section title="Component">
            <div className="flex items-center gap-3">
              <IconImage iconId={node.iconId} svgPath={entry?.svgPath} category={entry?.category} />
              <div className="min-w-0">
                <p className="truncate font-medium">{entry?.label ?? node.iconId}</p>
                <p className="text-sm text-text-muted">
                  {entry
                    ? `${PROVIDER_LABELS[entry.provider]} · ${entry.category}`
                    : 'Unknown icon'}
                </p>
              </div>
            </div>
            <Field id={`${uid}-label`} label="Label">
              <CommitInput
                value={node.label}
                validate={(v) => (v.trim() ? null : 'Labels cannot be empty.')}
                onCommit={(v) => update({ label: v.trim().slice(0, 80) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${uid}-replicas`} label="Replicas">
                <CommitInput
                  inputMode="numeric"
                  placeholder="1"
                  value={data.replicas ? String(data.replicas) : ''}
                  validate={(v) =>
                    v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 10_000)
                      ? null
                      : 'Use a whole number from 1 to 10,000.'
                  }
                  onCommit={(v) => setData({ replicas: v === '' ? undefined : Number(v) })}
                />
              </Field>
              <Field id={`${uid}-region`} label="Region">
                <CommitInput
                  placeholder="e.g. ap-south-1"
                  value={data.region ?? ''}
                  onCommit={(v) => setData({ region: v.trim().slice(0, 40) || undefined })}
                />
              </Field>
            </div>
            <Field
              id={`${uid}-text`}
              label="Text on card"
              hint="Shown on the board under the name. Resize the card to fit more."
            >
              <CommitInput
                multiline
                placeholder="Responsibilities, numbers, notes…"
                value={data.description ?? ''}
                onCommit={(v) => setData({ description: v.trim() ? v.slice(0, 2000) : undefined })}
              />
            </Field>
            <Field
              id={`${uid}-notes`}
              label="Notes"
              hint="Kept here in the panel; not drawn on the board."
            >
              <CommitInput
                multiline
                placeholder="Design notes, assumptions, numbers…"
                value={data.notes ?? ''}
                onCommit={(v) => setData({ notes: v.slice(0, 4000) || undefined })}
              />
            </Field>
          </Section>
          {tradeoff ? (
            <Section
              title="Things to consider"
              aside={<Lightbulb className="size-4 text-pen" aria-hidden="true" />}
            >
              <p className="text-sm text-text-muted">{tradeoff.summary}</p>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {tradeoff.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </Section>
          ) : null}
          {node.parentId ? (
            <InGroup diagram={diagram} parentId={node.parentId} />
          ) : (
            <GroupPicker onGroup={props.onGroup} />
          )}
        </>
      );
    }
    case 'group':
      return (
        <Section title="Group">
          <Field id={`${uid}-name`} label="Name">
            <CommitInput
              value={node.label}
              onCommit={(v) => update({ label: v.trim().slice(0, 80) })}
            />
          </Field>
          <Field id={`${uid}-type`} label="Type">
            <Select
              id={`${uid}-type`}
              value={node.groupType}
              onValueChange={(groupType) => update({ groupType })}
              options={GROUP_TYPES.map((t) => ({ value: t, label: GROUP_LABELS[t] }))}
            />
          </Field>
          <p className="text-sm text-text-muted">
            Drag components in or out of the box to change what it contains.
          </p>
          <Button size="sm" onClick={() => props.onUngroup(node.id)}>
            <Ungroup /> Ungroup <Kbd>Shift+G</Kbd>
          </Button>
        </Section>
      );
    case 'note':
      return (
        <Section title="Sticky note">
          <Swatches
            label="Note colour"
            value={node.color ?? 'yellow'}
            onChange={(color) => update({ color })}
            options={Object.keys(NOTE_COLOURS).map((c) => ({
              value: c,
              name: c,
              className: NOTE_COLOURS[c] ?? '',
            }))}
          />
          <p className="text-sm text-text-muted">Double-click the note to edit its text.</p>
        </Section>
      );
    case 'shape':
      return (
        <Section title="Shape">
          <Field id={`${uid}-shape`} label="Shape">
            <Select
              id={`${uid}-shape`}
              value={node.shape}
              onValueChange={(shape) => update({ shape })}
              options={[
                { value: 'rectangle', label: 'Rectangle' },
                { value: 'rounded', label: 'Rounded rectangle' },
                { value: 'ellipse', label: 'Ellipse' },
                { value: 'diamond', label: 'Diamond' },
                { value: 'cylinder', label: 'Cylinder' },
                { value: 'hexagon', label: 'Hexagon' },
              ]}
            />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Fill</span>
            <Swatches
              label="Shape fill"
              value={node.fill ?? 'none'}
              onChange={(fill) => update({ fill })}
              options={Object.keys(SHAPE_FILLS).map((f) => ({
                value: f,
                name: f === 'none' ? 'No fill' : f,
                className:
                  f === 'none'
                    ? 'bg-[repeating-linear-gradient(45deg,transparent_0_4px,var(--border)_4px_5px)]'
                    : (FILL_SWATCH[f] ?? ''),
              }))}
            />
          </div>
          <p className="text-sm text-text-muted">Double-click the shape to write inside it.</p>
        </Section>
      );
    case 'text':
      return (
        <Section title="Text">
          <SegmentedControl
            ariaLabel="Text size"
            value={(node.fontSize ?? 'm') as 's' | 'm' | 'l'}
            onValueChange={(fontSize) => update({ fontSize })}
            options={[
              { value: 's', label: 'Small' },
              { value: 'm', label: 'Medium' },
              { value: 'l', label: 'Heading' },
            ]}
            className="w-full"
          />
          <p className="text-sm text-text-muted">Double-click the text to edit it.</p>
        </Section>
      );
    case 'drawing':
      return (
        <Section title="Drawing">
          <Swatches
            label="Ink colour"
            value={node.color ?? 'ink'}
            onChange={(color) => update({ color })}
            options={Object.entries(INK_COLOURS).map(([c, css]) => ({
              value: c,
              name: c === 'ink' ? 'Ink' : c,
              style: { background: css },
            }))}
          />
          <SegmentedControl
            ariaLabel="Line width"
            value={String(node.strokeWidth ?? 2.5)}
            onValueChange={(w) => update({ strokeWidth: Number(w) })}
            options={STROKE_OPTIONS}
            className="w-full"
          />
        </Section>
      );
  }
}

export const STROKE_OPTIONS = [
  { value: '1.5', label: 'Thin' },
  { value: '2.5', label: 'Medium' },
  { value: '5', label: 'Thick' },
];

const FILL_SWATCH: Record<string, string> = {
  grey: 'bg-[#eceef2]',
  blue: 'bg-[#dcebff]',
  green: 'bg-[#dcf5e6]',
  yellow: 'bg-[#fff4c2]',
  pink: 'bg-[#fde2ef]',
  purple: 'bg-[#ece4ff]',
};

function InGroup({ diagram, parentId }: { diagram: DiagramDoc; parentId: string }) {
  const parent = diagram.nodes.get(parentId);
  if (!parent) return null;
  const g = fromYMap<DiagramNode>(parent);
  if (g.kind !== 'group') return null;
  return (
    <Section title="Inside">
      <p className="text-sm">
        <Badge>{GROUP_LABELS[g.groupType]}</Badge> {g.label}
      </p>
      <p className="text-sm text-text-muted">Drag it outside the box to take it out.</p>
    </Section>
  );
}

function EdgeProperties(props: PropertiesPanelProps & { edge: DiagramEdge }) {
  const { edge, diagram } = props;
  const uid = useId();
  const update = (patch: Partial<DiagramEdge>) => updateEdge(diagram, edge.id, patch, opts);
  return (
    <Section title="Connection">
      <Field id={`${uid}-label`} label="Label">
        <CommitInput
          placeholder="e.g. reads, writes, events"
          value={edge.label ?? ''}
          onCommit={(v) => update({ label: v.trim().slice(0, 80) || undefined })}
        />
      </Field>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Style</span>
        <SegmentedControl
          ariaLabel="Connection style"
          value={edge.style ?? 'sync'}
          onValueChange={(style) => update({ style })}
          options={[
            { value: 'sync', label: 'Sync (solid)' },
            { value: 'async', label: 'Async (dashed)' },
          ]}
          className="w-full"
        />
      </div>
      <Field id={`${uid}-protocol`} label="Protocol">
        <Select
          id={`${uid}-protocol`}
          value={edge.protocol ?? 'none'}
          onValueChange={(p) =>
            update({ protocol: p === 'none' ? undefined : (p as DiagramEdge['protocol']) })
          }
          options={[
            { value: 'none', label: 'None' },
            { value: 'http', label: 'HTTP' },
            { value: 'grpc', label: 'gRPC' },
            { value: 'websocket', label: 'WebSocket' },
            { value: 'tcp', label: 'TCP' },
            { value: 'pubsub', label: 'Pub/Sub' },
          ]}
        />
      </Field>
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Arrows</span>
        <SegmentedControl
          ariaLabel="Arrow heads"
          value={edge.arrow ?? 'end'}
          onValueChange={(arrow) => update({ arrow })}
          options={[
            { value: 'end', label: 'One way' },
            { value: 'both', label: 'Both' },
            { value: 'none', label: 'None' },
          ]}
          className="w-full"
        />
      </div>
      <Button variant="danger" size="sm" onClick={props.onDelete}>
        <Trash2 /> Delete connection
      </Button>
    </Section>
  );
}
