import Fuse from 'fuse.js';
import type { IconEntry, Provider } from './types.ts';

export interface SearchOptions {
  provider?: Provider | 'all';
  limit?: number;
  /** Extra score for recents/favourites (0–20 is a sensible range). */
  boost?: (id: string) => number;
}

export interface SearchHit {
  entry: IconEntry;
  score: number;
  /** The alias that matched, for the "matches elb" hint in the UI. */
  matchedAlias?: string;
}

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

interface Indexed {
  entry: IconEntry;
  label: string;
  aliases: string[];
}

/**
 * Ranked search: exact label/alias match → label prefix → alias prefix → word match → fuzzy.
 * Generic blocks win ties when no provider filter is active (UX §5.1).
 */
export function createIconSearch(entries: readonly IconEntry[]) {
  const indexed: Indexed[] = entries.map((entry) => ({
    entry,
    label: normalise(entry.label),
    aliases: entry.aliases.map(normalise),
  }));
  const fuse = new Fuse(indexed, {
    keys: [
      { name: 'label', weight: 2 },
      { name: 'aliases', weight: 1 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true,
  });

  function search(query: string, options: SearchOptions = {}): SearchHit[] {
    const provider = options.provider ?? 'all';
    const limit = options.limit ?? 50;
    const q = normalise(query);
    const inScope = (e: IconEntry) => provider === 'all' || e.provider === provider;
    const boost = options.boost ?? (() => 0);

    if (!q) {
      return indexed
        .filter((x) => inScope(x.entry))
        .map((x) => ({ entry: x.entry, score: boost(x.entry.id) }))
        .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
        .slice(0, limit);
    }

    const hits = new Map<string, SearchHit>();
    const add = (entry: IconEntry, score: number, matchedAlias?: string) => {
      const total =
        score + boost(entry.id) + (provider === 'all' && entry.provider === 'generic' ? 5 : 0);
      const existing = hits.get(entry.id);
      if (!existing || existing.score < total) {
        hits.set(entry.id, { entry, score: total, ...(matchedAlias ? { matchedAlias } : {}) });
      }
    };

    for (const x of indexed) {
      if (!inScope(x.entry)) continue;
      const words = x.label.split(' ');
      if (x.label === q) add(x.entry, 100);
      else if (x.aliases.includes(q)) add(x.entry, 95, q);
      else if (x.label.startsWith(q)) add(x.entry, 80);
      else if (words.some((w) => w.startsWith(q))) add(x.entry, 70);
      else {
        const alias = x.aliases.find(
          (a) => a.startsWith(q) || a.split(' ').some((w) => w.startsWith(q)),
        );
        if (alias) add(x.entry, 65, alias);
      }
    }

    if (q.length >= 3) {
      for (const result of fuse.search(q, { limit: 100 })) {
        if (!inScope(result.item.entry)) continue;
        // Fuse score: 0 = perfect, 1 = no match → map to 0–50.
        add(result.item.entry, Math.round(50 * (1 - (result.score ?? 1))));
      }
    }

    return [...hits.values()]
      .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
      .slice(0, limit);
  }

  return { search, size: entries.length };
}

export type IconSearch = ReturnType<typeof createIconSearch>;
