import { PROVIDER_LABELS, type IconEntry, type Provider } from '@archboard/icons';
import { cn, Kbd, SearchField, SegmentedControl } from '@archboard/ui';
import { forwardRef, useMemo, useState, type DragEvent } from 'react';
import { IconImage } from './icon-image.tsx';
import type { LoadedRegistry } from './registry.ts';

export const ICON_DRAG_TYPE = 'application/x-archboard-icon';
const RECENTS_KEY = 'archboard.recentIcons';

type Filter = 'all' | Provider;

export function readRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function pushRecent(id: string): void {
  try {
    const next = [id, ...readRecents().filter((x) => x !== id)].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export interface PaletteProps {
  registry: LoadedRegistry;
  /** Vendor packs still loading: show a hint instead of an empty provider tab. */
  vendorLoading: boolean;
  onAdd: (entry: IconEntry) => void;
  className?: string;
}

/**
 * The component panel (UX §5.1). Search matches labels and aliases ("lb", "elb", "load balancer"),
 * tabs filter by provider, recents sit on top. Click adds at the centre of the view; drag places
 * the component exactly where it's dropped.
 */
export const Palette = forwardRef<HTMLInputElement, PaletteProps>(function Palette(
  { registry, vendorLoading, onAdd, className },
  searchRef,
) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // Snapshot recents when the panel opens. Re-sorting while the user is clicking would move tiles
  // under the cursor and cause mis-clicks; the new order shows next time the panel opens.
  const [recents] = useState(readRecents);

  const hasProvider = (p: Provider) => registry.icons.some((i) => i.provider === p);
  const filters: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'generic', label: 'Generic' },
    ...(hasProvider('aws') || vendorLoading ? [{ value: 'aws' as const, label: 'AWS' }] : []),
    ...(hasProvider('azure') || vendorLoading ? [{ value: 'azure' as const, label: 'Azure' }] : []),
    ...(hasProvider('gcp') ? [{ value: 'gcp' as const, label: 'GCP' }] : []),
  ];

  const sections = useMemo(() => {
    const q = query.trim();
    if (q) {
      const hits = registry.search.search(q, { provider: filter, limit: 60 });
      return [
        {
          title: `${hits.length} result${hits.length === 1 ? '' : 's'}`,
          items: hits.map((h) => h.entry),
        },
      ];
    }
    const inScope = registry.icons.filter((i) =>
      filter === 'all' ? i.provider === 'generic' : i.provider === filter,
    );
    const byCategory = new Map<string, IconEntry[]>();
    for (const icon of inScope) {
      const list = byCategory.get(icon.category) ?? [];
      list.push(icon);
      byCategory.set(icon.category, list);
    }
    const out: Array<{ title: string; items: IconEntry[] }> = [];
    const recentEntries = recents
      .map((id) => registry.byId.get(id))
      .filter((e): e is IconEntry => !!e);
    if (recentEntries.length && filter === 'all')
      out.push({ title: 'Recently used', items: recentEntries });
    for (const [title, items] of [...byCategory].sort((a, b) => a[0].localeCompare(b[0]))) {
      out.push({ title, items: items.sort((a, b) => a.label.localeCompare(b.label)) });
    }
    return out;
  }, [query, filter, registry, recents]);

  const add = (entry: IconEntry) => {
    pushRecent(entry.id);
    onAdd(entry);
  };

  const onDragStart = (e: DragEvent, entry: IconEntry) => {
    e.dataTransfer.setData(ICON_DRAG_TYPE, entry.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="space-y-2 border-b border-border p-3">
        <SearchField
          ref={searchRef}
          aria-label="Search components"
          placeholder="Search components"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
            if (e.key === 'Enter') {
              const first = sections[0]?.items[0];
              if (first && query.trim()) add(first);
            }
          }}
          shortcutHint={<Kbd>/</Kbd>}
        />
        <SegmentedControl
          ariaLabel="Filter by provider"
          value={filter}
          onValueChange={setFilter}
          options={filters}
          className="w-full"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
        {(filter === 'aws' || filter === 'azure') && vendorLoading && !hasProvider(filter) ? (
          <p className="py-6 text-center text-sm text-text-muted">
            Loading {PROVIDER_LABELS[filter]} icons…
          </p>
        ) : null}
        {sections.map((section) => (
          <section key={section.title} className="pt-3">
            <h3 className="pb-1.5 text-xs font-medium text-text-muted">{section.title}</h3>
            {section.items.length === 0 ? (
              <p className="py-4 text-sm text-text-muted">
                No components match “{query}”. Try “cache”, “queue” or “database”.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-1.5">
                {section.items.map((entry) => (
                  <li key={`${section.title}-${entry.id}`}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => onDragStart(e, entry)}
                      onClick={() => add(entry)}
                      aria-label={
                        entry.provider === 'generic'
                          ? entry.label
                          : `${entry.label}, ${PROVIDER_LABELS[entry.provider]}`
                      }
                      title={`${entry.label} — click to add, or drag onto the board`}
                      className={cn(
                        'flex h-full w-full cursor-grab items-center gap-2 rounded-md border border-transparent p-1.5 text-left',
                        'hover:border-border hover:bg-surface-hover active:cursor-grabbing pointer-coarse:min-h-11',
                      )}
                    >
                      <IconImage
                        iconId={entry.id}
                        svgPath={entry.svgPath}
                        category={entry.category}
                        size="sm"
                      />
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-xs font-medium leading-tight">
                          {entry.label}
                        </span>
                        {entry.provider !== 'generic' && (filter === 'all' || query.trim()) ? (
                          <span className="block text-[10px] font-semibold uppercase leading-3 text-text-muted">
                            {entry.provider}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
});
