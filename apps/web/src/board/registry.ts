import {
  createIconSearch,
  GENERIC_ICONS,
  genericEntries,
  type IconEntry,
  type IconRegistry,
  type IconSearch,
} from '@archboard/icons';

/** Inner SVG markup of our own generic icons, rendered inline so they can take theme colours. */
export const GENERIC_BODY = new Map(GENERIC_ICONS.map((i) => [`generic/${i.slug}`, i.body]));

export interface LoadedRegistry {
  icons: IconEntry[];
  byId: Map<string, IconEntry>;
  search: IconSearch;
}

const genericOnly = (): LoadedRegistry => {
  const icons = genericEntries();
  return { icons, byId: new Map(icons.map((i) => [i.id, i])), search: createIconSearch(icons) };
};

/** Generic icons are available synchronously, so the canvas never waits on the network. */
export const GENERIC_REGISTRY: LoadedRegistry = genericOnly();

let pending: Promise<LoadedRegistry> | null = null;

/**
 * Load the full registry (≈ 1,000 icons including AWS and Azure). It is a separate chunk so the
 * first paint of the board doesn't wait for it; until it arrives the palette shows generic blocks.
 */
export function loadRegistry(): Promise<LoadedRegistry> {
  pending ??= import('@archboard/icons/registry.json')
    .then((mod) => {
      const registry = (mod as { default: IconRegistry }).default;
      const icons = registry.icons;
      return { icons, byId: new Map(icons.map((i) => [i.id, i])), search: createIconSearch(icons) };
    })
    .catch(() => {
      pending = null; // allow a retry
      return genericOnly();
    });
  return pending;
}
