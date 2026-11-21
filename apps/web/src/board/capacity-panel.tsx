import {
  addNode,
  computeCapacity,
  formatBytes,
  formatQps,
  updateNode,
  type CapacityInput,
  type CapacityResult,
  type DiagramDoc,
} from '@archboard/diagram-schema';
import { Button, cn, IconButton, Input, Select } from '@archboard/ui';
import { Calculator, StickyNote, Paperclip, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { LOCAL_ORIGIN } from './use-board-doc.ts';

/**
 * Back-of-the-envelope capacity estimator (UX §5.6). Inputs are saved with the board, results
 * update as you type, every number shows its formula on hover, and the result can be attached
 * to a component (shown on its card) or dropped on the board as a sticky note.
 */

const UNITS = { B: 1, KB: 1_000, MB: 1_000_000, GB: 1_000_000_000 } as const;
type Unit = keyof typeof UNITS;

interface Draft {
  dau: string;
  reads: string;
  writes: string;
  payload: string;
  unit: Unit;
  retention: string;
  peak: string;
}

const DEFAULTS: Draft = {
  dau: '10000000',
  reads: '100',
  writes: '1',
  payload: '1',
  unit: 'KB',
  retention: '5',
  peak: '3',
};

const META_KEY = 'capacityInputs';

function toInput(d: Draft): CapacityInput | null {
  const n = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/[,_\s]/g, '')));
  const input = {
    dau: n(d.dau),
    readsPerUserPerDay: n(d.reads),
    writesPerUserPerDay: n(d.writes),
    payloadBytes: n(d.payload) * UNITS[d.unit],
    retentionYears: n(d.retention),
    peakFactor: n(d.peak),
  };
  const ok =
    Object.values(input).every((v) => Number.isFinite(v) && v >= 0) && input.peakFactor >= 1;
  return ok ? input : null;
}

export function formatCapacity(r: CapacityResult): string {
  return [
    `Capacity (${formatQps(r.dau)} DAU)`,
    `Reads: ${formatQps(r.avgReadQps)} QPS avg · ${formatQps(r.peakReadQps)} peak`,
    `Writes: ${formatQps(r.avgWriteQps)} QPS avg · ${formatQps(r.peakWriteQps)} peak`,
    `Storage: ${formatBytes(r.storagePerYearBytes)}/yr · ${formatBytes(r.totalStorageBytes)} over ${r.retentionYears} yr`,
    `Bandwidth: ${formatBytes(r.ingressBytesPerSec)}/s in · ${formatBytes(r.egressBytesPerSec)}/s out`,
  ].join('\n');
}

export function CapacityPanel({
  diagram,
  selectedComponentId,
  onClose,
  onNoteAdded,
}: {
  diagram: DiagramDoc;
  /** A single selected component to attach results to, if any. */
  selectedComponentId: string | null;
  onClose: () => void;
  onNoteAdded: (id: string) => void;
}) {
  const uid = useId();
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = diagram.meta.get(META_KEY) as Partial<Draft> | undefined;
    return { ...DEFAULTS, ...(saved ?? {}) };
  });

  // Save inputs with the board (debounced), so they're there next time and in exports.
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = JSON.stringify(diagram.meta.get(META_KEY) ?? null);
      if (saved !== JSON.stringify(draft))
        diagram.doc.transact(() => diagram.meta.set(META_KEY, draft), LOCAL_ORIGIN);
    }, 400);
    return () => clearTimeout(t);
  }, [diagram, draft]);

  const input = toInput(draft);
  const result = useMemo(() => (input ? computeCapacity(input) : null), [input]);
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const attach = () => {
    if (!result || !selectedComponentId) return;
    const y = diagram.nodes.get(selectedComponentId);
    if (!y) return;
    const data = {
      ...((y.get('data') as Record<string, unknown>) ?? {}),
      capacity: result,
      description: formatCapacity(result),
    };
    updateNode(diagram, selectedComponentId, { data }, { origin: LOCAL_ORIGIN });
  };

  const addAsNote = () => {
    if (!result) return;
    const id = addNode(
      diagram,
      {
        kind: 'note',
        text: formatCapacity(result),
        color: 'blue',
        size: { width: 300, height: 150 },
      },
      { origin: LOCAL_ORIGIN },
    );
    onNoteAdded(id);
  };

  const field = (key: keyof Draft, label: string, hint: string, suffix?: React.ReactNode) => (
    <label className="flex flex-col gap-1" htmlFor={`${uid}-${key}`}>
      <span className="text-sm font-medium">{label}</span>
      <span className="flex gap-1.5">
        <Input
          id={`${uid}-${key}`}
          inputMode="decimal"
          value={draft[key] as string}
          onChange={(e) => set(key)(e.target.value)}
          aria-describedby={`${uid}-${key}-hint`}
        />
        {suffix}
      </span>
      <span id={`${uid}-${key}-hint`} className="text-xs text-text-muted">
        {hint}
      </span>
    </label>
  );

  const out = (label: string, value: string, formula: string, strong = false) => (
    <div className="flex items-baseline justify-between gap-3 py-1" title={formula}>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className={cn('font-mono text-sm tabular', strong && 'font-semibold text-text')}>
        {value}
      </dd>
    </div>
  );

  return (
    <section
      aria-label="Capacity calculator"
      className="absolute right-3 top-3 z-20 flex max-h-[calc(100%-96px)] w-[min(360px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-border bg-surface-raised shadow-e3 animate-pop-in"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Calculator className="size-4 text-accent" aria-hidden="true" />
        <h2 className="flex-1 text-md font-semibold">Capacity estimate</h2>
        <IconButton label="Close calculator" onClick={onClose}>
          <X />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            {field('dau', 'Daily active users', 'e.g. 10000000 (10M)')}
          </div>
          {field('reads', 'Reads / user / day', 'Requests that read data')}
          {field('writes', 'Writes / user / day', 'Requests that create data')}
          <div className="col-span-2">
            {field(
              'payload',
              'Size per write',
              'Average stored record or request size',
              <Select
                ariaLabel="Size unit"
                value={draft.unit}
                onValueChange={(u) => setDraft((d) => ({ ...d, unit: u }))}
                options={(Object.keys(UNITS) as Unit[]).map((u) => ({ value: u, label: u }))}
                className="w-24 shrink-0"
              />,
            )}
          </div>
          {field('retention', 'Keep data for (years)', 'Retention period')}
          {field('peak', 'Peak factor', 'Peak ÷ average, often 2–5')}
        </div>

        {result ? (
          <dl className="divide-y divide-border rounded-lg border border-border bg-bg-subtle px-3 py-1">
            <div className="py-1">
              {out(
                'Read QPS (avg)',
                formatQps(result.avgReadQps),
                'DAU × reads per user ÷ 86,400 s',
              )}
              {out(
                'Read QPS (peak)',
                formatQps(result.peakReadQps),
                'Average read QPS × peak factor',
                true,
              )}
            </div>
            <div className="py-1">
              {out(
                'Write QPS (avg)',
                formatQps(result.avgWriteQps),
                'DAU × writes per user ÷ 86,400 s',
              )}
              {out(
                'Write QPS (peak)',
                formatQps(result.peakWriteQps),
                'Average write QPS × peak factor',
                true,
              )}
            </div>
            <div className="py-1">
              {out(
                'Storage / year',
                formatBytes(result.storagePerYearBytes),
                'Writes per day × size × 365',
              )}
              {out(
                `Storage over ${result.retentionYears} yr`,
                formatBytes(result.totalStorageBytes),
                'Storage per year × retention',
                true,
              )}
            </div>
            <div className="py-1">
              {out(
                'Ingress',
                `${formatBytes(result.ingressBytesPerSec)}/s`,
                'Average write QPS × size',
              )}
              {out(
                'Egress',
                `${formatBytes(result.egressBytesPerSec)}/s`,
                'Average read QPS × size (reads return similar-sized data)',
              )}
            </div>
          </dl>
        ) : (
          <p role="alert" className="rounded-lg bg-warning-subtle px-3 py-2 text-sm">
            Enter numbers in every field (peak factor at least 1) to see the estimate.
          </p>
        )}
        <p className="text-xs text-text-muted">
          Rough numbers for an interview: decimal units (1 KB = 1,000 B), no replication or index
          overhead. Hover a result for its formula.
        </p>
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        <Button
          size="sm"
          variant="primary"
          disabled={!result || !selectedComponentId}
          title={
            selectedComponentId
              ? 'Write the estimate onto the selected component card'
              : 'Select one component on the board first'
          }
          onClick={attach}
        >
          <Paperclip /> Attach to component
        </Button>
        <Button size="sm" disabled={!result} onClick={addAsNote}>
          <StickyNote /> Add as note
        </Button>
      </footer>
    </section>
  );
}
