export type Provider = 'generic' | 'aws' | 'gcp' | 'azure';

export const PROVIDERS: readonly Provider[] = ['generic', 'aws', 'gcp', 'azure'];

export const PROVIDER_LABELS: Record<Provider, string> = {
  generic: 'Generic',
  aws: 'AWS',
  gcp: 'Google Cloud',
  azure: 'Azure',
};

/** One entry in the normalised icon registry (shared by the palette search and the AI agent). */
export interface IconEntry {
  /** "<provider>/<slug>", stable across pack updates. */
  id: string;
  provider: Provider;
  category: string;
  label: string;
  /** Lower-case search aliases, e.g. ["lb", "elb", "alb"]. */
  aliases: string[];
  /** URL path the web app serves the SVG from, e.g. "/icons/generic/cache.svg". */
  svgPath: string;
}

export interface IconRegistry {
  version: 1;
  generatedAt: string;
  providers: Partial<Record<Provider, { count: number; source: string; packVersion: string }>>;
  icons: IconEntry[];
}
