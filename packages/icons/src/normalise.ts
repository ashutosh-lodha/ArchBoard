import type { Provider } from './types.ts';

/**
 * Turn a vendor pack file path into a registry entry (slug, label, category).
 * Rules are per provider because each pack names files differently. They are checked against
 * real pack layouts in the import tests; unknown files return null and are reported.
 */
export interface NormalisedName {
  slug: string;
  label: string;
  category: string;
}

const SPECIAL_CASE: Record<string, string> = { devops: 'DevOps', nosql: 'NoSQL', iot: 'IoT' };
const SMALL_WORDS = new Set(['of', 'and', 'for', 'the', 'to', 'in', 'on', 'with']);

const ACRONYMS = new Map(
  [
    'api',
    'aws',
    'cdn',
    'dns',
    'ec2',
    'ecs',
    'eks',
    'efs',
    'iam',
    'iot',
    'kms',
    'rds',
    'sns',
    'sqs',
    'vpc',
    'vpn',
    'waf',
    'sql',
    'ai',
    'ml',
    'gke',
    'gpu',
    'tpu',
    'nat',
    'sdk',
    'cli',
    'ddos',
    'sap',
    'hpc',
    'vm',
    'vms',
    'b2c',
    'ad',
    'ssl',
    'tls',
    'sftp',
    'msk',
    'emr',
    'ebs',
    'elb',
    'ecr',
    'fsx',
    'devops',
    'nosql',
    'ui',
    'bi',
    'etl',
  ].map((a) => [a, SPECIAL_CASE[a] ?? a.toUpperCase()]),
);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w, i) =>
      i > 0 && SMALL_WORDS.has(w) ? w : (ACRONYMS.get(w) ?? w.charAt(0).toUpperCase() + w.slice(1)),
    )
    .join(' ');
}

/**
 * Human label from a vendor file-name token, keeping the vendor's own casing ("CodeGuru",
 * "IoT SiteWise", "AKS"). Only all-lower-case words are re-cased.
 */
export function labelFromToken(token: string): string {
  return token
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w, i) => {
      if (w !== w.toLowerCase()) return w;
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return ACRONYMS.get(w) ?? w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function parts(path: string): string[] {
  return path.replace(/\\/g, '/').split('/').filter(Boolean);
}

function base(path: string): string {
  return (parts(path).at(-1) ?? '').replace(/\.svg$/i, '');
}

/**
 * AWS Architecture Icons: ".../Architecture-Service-Icons_<date>/Arch_<Category>/64/Arch_<Service-Name>_64.svg".
 * Only the 64px service icons are imported (resource and category icons are skipped).
 */
export function normaliseAws(path: string): NormalisedName | null {
  const p = parts(path);
  const file = base(path);
  const m = /^Arch_(.+?)_(?:16|32|48|64)$/.exec(file);
  if (!m?.[1] || !p.some((x) => x.startsWith('Architecture-Service-Icons'))) return null;
  if (!p.includes('64')) return null;
  const categoryDir = p.find((x) => /^Arch_/.test(x) && x !== p.at(-1));
  const slug = slugify(m[1]);
  return {
    slug,
    label: labelFromToken(m[1]),
    category: categoryDir ? titleCase(slugify(categoryDir.replace(/^Arch_/, ''))) : 'Other',
  };
}

/** Azure: ".../Icons/<category>/10021-icon-service-Virtual-Machine.svg". */
export function normaliseAzure(path: string): NormalisedName | null {
  const p = parts(path);
  const file = base(path);
  // Microsoft occasionally ships names like "030777508 -icon-service-…" (stray space).
  const m = /^\d+\s*-icon-service-(.+)$/.exec(file);
  if (!m?.[1]) return null;
  const slug = slugify(m[1]);
  const folder = (p.at(-2) ?? 'other').toLowerCase();
  // "new icons" is a release bucket, not a category.
  const category = folder === 'new icons' ? 'other' : folder;
  return { slug, label: labelFromToken(m[1]), category: titleCase(slugify(category)) };
}

/** Google product words whose casing a generic title-caser gets wrong. */
const GCP_WORDS = new Map([
  ['bigquery', 'BigQuery'],
  ['pubsub', 'Pub/Sub'],
  ['bigtable', 'Bigtable'],
  ['alloydb', 'AlloyDB'],
  ['vertexai', 'Vertex AI'],
  ['dataproc', 'Dataproc'],
  ['dataflow', 'Dataflow'],
  ['datastream', 'Datastream'],
  ['firestore', 'Firestore'],
  ['memorystore', 'Memorystore'],
  ['vmware', 'VMware'],
  ['looker', 'Looker'],
  ['apigee', 'Apigee'],
  ['anthos', 'Anthos'],
  ['gke', 'GKE'],
  ['kms', 'KMS'],
  ['iap', 'IAP'],
]);

function gcpLabel(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (GCP_WORDS.has(lower)) return GCP_WORDS.get(lower) as string;
      if (w !== lower) return w; // keep the pack's own casing ("Cloud Run", "AlloyDB")
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return ACRONYMS.get(lower) ?? lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Google Cloud ships two layouts:
 * - 2025 core icons: ".../Unique Icons/<Product Name>/SVG/<File>-512-color.svg" — the product
 *   folder has the proper name, so use it.
 * - legacy icons:    ".../<snake_name>/<snake_name>.svg".
 */
export function normaliseGcp(path: string): NormalisedName | null {
  const p = parts(path);
  const svgDir = p.findIndex((d) => /^svg$/i.test(d));
  if (svgDir > 0) {
    const product = p[svgDir - 1] as string;
    const slug = slugify(product.replace(/_/g, ' '));
    return slug ? { slug, label: gcpLabel(product), category: 'Products' } : null;
  }
  const file = base(path)
    .replace(/[-_](512|256|128|64|48|32|24)([-_]color|[-_]colour|[-_]rgb)?$/i, '')
    .replace(/[-_](color|colour|rgb)$/i, '');
  if (!file || /^(icon|logo)$/i.test(file)) return null;
  const slug = slugify(file);
  return slug ? { slug, label: gcpLabel(file), category: 'Products' } : null;
}

export const NORMALISERS: Record<
  Exclude<Provider, 'generic'>,
  (path: string) => NormalisedName | null
> = {
  aws: normaliseAws,
  azure: normaliseAzure,
  gcp: normaliseGcp,
};

/**
 * Aliases for well-known provider services so a search for "lb", "s3" or "queue" finds both the
 * generic block and the provider icon. Patterns match the normalised slug.
 */
export const PROVIDER_ALIASES: Array<[RegExp, string[]]> = [
  [/bigquery|redshift|synapse/, ['data warehouse', 'analytics', 'olap']],
  [/load-balanc/, ['lb', 'elb', 'alb', 'nlb', 'load balancer']],
  [
    /simple-storage-service|^cloud-storage$|storage-accounts|blob/,
    ['s3', 'object storage', 'bucket', 'blob'],
  ],
  [/cloudfront|cloud-cdn|front-door|^cdn/, ['cdn', 'edge']],
  [/route-53|cloud-dns|dns-zones/, ['dns']],
  [/api-gateway|api-management|apigee/, ['api gateway', 'gateway', 'apigw']],
  [/simple-queue-service|cloud-tasks|service-bus|storage-queue/, ['queue', 'sqs', 'mq']],
  [
    /simple-notification-service|pub-?sub|eventbridge|event-grid/,
    ['pub/sub', 'pubsub', 'topic', 'sns', 'event bus'],
  ],
  [/kinesis|managed-streaming|event-hubs|dataflow/, ['stream', 'kafka', 'streaming']],
  [/elasticache|memorystore|cache-redis|redis/, ['cache', 'redis']],
  [
    /^amazon-rds|aurora|cloud-sql|sql-database|azure-database|spanner|alloydb/,
    ['sql', 'database', 'db', 'postgres', 'mysql'],
  ],
  [
    /dynamodb|firestore|bigtable|cosmos-db|documentdb|keyspaces/,
    ['nosql', 'database', 'db', 'key value'],
  ],
  [/^aws-lambda$|cloud-functions|function-apps|cloud-run/, ['serverless', 'function', 'faas']],
  [/^amazon-ec2$|compute-engine|virtual-machine/, ['vm', 'server', 'instance', 'compute']],
  [
    /elastic-kubernetes|kubernetes-engine|kubernetes-services|^gke$|^aks$/,
    ['k8s', 'kubernetes', 'cluster'],
  ],
  [
    /elastic-container-service|fargate|container-instances|container-apps/,
    ['containers', 'docker'],
  ],
  [/opensearch|elasticsearch|cognitive-search|ai-search/, ['search', 'elasticsearch']],
  [/cognito|identity-platform|entra|active-directory|iam/, ['auth', 'identity', 'login', 'sso']],
  [
    /cloudwatch|cloud-monitoring|monitor|application-insights/,
    ['monitoring', 'metrics', 'observability'],
  ],
  [/waf|cloud-armor|firewall|shield/, ['waf', 'firewall', 'security', 'rate limit']],
];

export function aliasesFor(slug: string, label: string): string[] {
  const out = new Set<string>();
  for (const [pattern, aliases] of PROVIDER_ALIASES) {
    if (pattern.test(slug)) aliases.forEach((a) => out.add(a));
  }
  // Short product name without vendor prefix: "Amazon Simple Queue Service" → "simple queue service".
  const short = label.replace(/^(Amazon|AWS|Azure|Google Cloud|Cloud)\s+/i, '').toLowerCase();
  if (short !== label.toLowerCase()) out.add(short);
  // Acronym of multi-word names: "simple queue service" → "sqs".
  const words = short.split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 3) out.add(words.map((w) => w[0]).join(''));
  return [...out];
}
