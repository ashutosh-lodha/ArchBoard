import type { IconEntry } from './types.ts';

/**
 * ArchBoard's own cloud-neutral icon set: 24×24 line icons drawn to one style (1.75px stroke,
 * round joins, currentColor). The node renderer tints them per category.
 */
export interface GenericIcon {
  slug: string;
  label: string;
  category: GenericCategory;
  aliases: string[];
  /** Inner SVG markup (paths only; the wrapper is added by svgDocument). */
  body: string;
}

export type GenericCategory =
  'Clients' | 'Networking' | 'Compute' | 'Data' | 'Messaging' | 'Operations';

export const GENERIC_ICONS: readonly GenericIcon[] = [
  {
    slug: 'client',
    label: 'Client',
    category: 'Clients',
    aliases: ['browser', 'web', 'web app', 'mobile', 'mobile app', 'app', 'frontend', 'spa'],
    body: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h6M9 14v4"/><rect x="17" y="8" width="5" height="11" rx="1"/>',
  },
  {
    slug: 'user',
    label: 'User',
    category: 'Clients',
    aliases: ['person', 'actor', 'customer', 'end user', 'people'],
    body: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  },
  {
    slug: 'dns',
    label: 'DNS',
    category: 'Networking',
    aliases: ['domain', 'name server', 'route 53', 'route53', 'cloud dns', 'resolver'],
    body: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  },
  {
    slug: 'cdn',
    label: 'CDN',
    category: 'Networking',
    aliases: [
      'content delivery',
      'edge',
      'edge cache',
      'cloudfront',
      'akamai',
      'fastly',
      'cloud cdn',
      'front door',
    ],
    body: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M5.6 6.4l4.2 3.8M18.4 6.4l-4.2 3.8M5.6 17.6l4.2-3.8M18.4 17.6l-4.2-3.8"/>',
  },
  {
    slug: 'load-balancer',
    label: 'Load Balancer',
    category: 'Networking',
    aliases: [
      'lb',
      'elb',
      'alb',
      'nlb',
      'balancer',
      'load balancing',
      'haproxy',
      'nginx',
      'reverse proxy',
      'l7',
      'l4',
    ],
    body: '<rect x="2" y="9" width="6" height="6" rx="1"/><path d="M8 12h3M11 12V5h5M11 12h5M11 12v7h5"/><rect x="16" y="3" width="6" height="4" rx="1"/><rect x="16" y="10" width="6" height="4" rx="1"/><rect x="16" y="17" width="6" height="4" rx="1"/>',
  },
  {
    slug: 'api-gateway',
    label: 'API Gateway',
    category: 'Networking',
    aliases: ['gateway', 'apigw', 'api gw', 'kong', 'bff', 'edge proxy', 'ingress'],
    body: '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/><path d="M8 11h8"/>',
  },
  {
    slug: 'service',
    label: 'Service',
    category: 'Compute',
    aliases: [
      'microservice',
      'server',
      'app server',
      'backend',
      'api',
      'application',
      'web server',
      'container',
      'vm',
    ],
    body: '<path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z"/><path d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5"/>',
  },
  {
    slug: 'worker',
    label: 'Worker',
    category: 'Compute',
    aliases: ['consumer', 'background job', 'job runner', 'processor', 'async worker'],
    body: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  },
  {
    slug: 'cron',
    label: 'Cron / Scheduler',
    category: 'Compute',
    aliases: ['cron', 'scheduler', 'scheduled job', 'timer', 'batch', 'periodic job'],
    body: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  },
  {
    slug: 'cache',
    label: 'Cache',
    category: 'Data',
    aliases: ['redis', 'memcached', 'elasticache', 'in-memory', 'memorystore', 'cache layer'],
    body: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  },
  {
    slug: 'sql-db',
    label: 'SQL Database',
    category: 'Data',
    aliases: [
      'database',
      'db',
      'sql',
      'postgres',
      'postgresql',
      'mysql',
      'rdbms',
      'relational',
      'aurora',
      'rds',
      'cloud sql',
    ],
    body: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  },
  {
    slug: 'nosql-db',
    label: 'NoSQL Database',
    category: 'Data',
    aliases: [
      'nosql',
      'mongodb',
      'mongo',
      'dynamodb',
      'cassandra',
      'document db',
      'key value',
      'kv store',
      'bigtable',
      'cosmos db',
      'wide column',
    ],
    body: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M10 11c-1 0-1.5.5-1.5 1.5v.5c0 .5-.5 1-1 1 .5 0 1 .5 1 1v.5c0 1 .5 1.5 1.5 1.5M14 11c1 0 1.5.5 1.5 1.5v.5c0 .5.5 1 1 1-.5 0-1 .5-1 1v.5c0 1-.5 1.5-1.5 1.5"/>',
  },
  {
    slug: 'object-storage',
    label: 'Object Storage',
    category: 'Data',
    aliases: [
      's3',
      'blob',
      'blob storage',
      'bucket',
      'gcs',
      'cloud storage',
      'files',
      'file storage',
    ],
    body: '<path d="M3 6h18l-2 14a2 2 0 0 1-2 1.7H7A2 2 0 0 1 5 20z"/><ellipse cx="12" cy="6" rx="9" ry="2.5"/>',
  },
  {
    slug: 'queue',
    label: 'Queue',
    category: 'Messaging',
    aliases: ['message queue', 'mq', 'sqs', 'rabbitmq', 'task queue', 'job queue', 'buffer'],
    body: '<rect x="2" y="8" width="4.5" height="8" rx="1"/><rect x="9.75" y="8" width="4.5" height="8" rx="1"/><path d="M17 12h5M19.5 9.5L22 12l-2.5 2.5"/>',
  },
  {
    slug: 'pubsub',
    label: 'Pub/Sub',
    category: 'Messaging',
    aliases: [
      'pub sub',
      'publish subscribe',
      'topic',
      'sns',
      'event bus',
      'fan out',
      'fanout',
      'eventbridge',
    ],
    body: '<circle cx="5" cy="12" r="2.5"/><path d="M7.5 12H12M12 12l6-6M12 12h6M12 12l6 6"/><circle cx="19.5" cy="6" r="1.5"/><circle cx="19.5" cy="12" r="1.5"/><circle cx="19.5" cy="18" r="1.5"/>',
  },
  {
    slug: 'stream',
    label: 'Stream',
    category: 'Messaging',
    aliases: [
      'kafka',
      'kinesis',
      'event stream',
      'log stream',
      'event hub',
      'event hubs',
      'streaming',
    ],
    body: '<path d="M2 7c3-2 5 2 8 0s5-2 8 0 3 1 4 0M2 12c3-2 5 2 8 0s5-2 8 0 3 1 4 0M2 17c3-2 5 2 8 0s5-2 8 0 3 1 4 0"/>',
  },
  {
    slug: 'search',
    label: 'Search',
    category: 'Data',
    aliases: [
      'search engine',
      'elasticsearch',
      'opensearch',
      'solr',
      'full text',
      'full-text search',
      'index',
    ],
    body: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  },
  {
    slug: 'rate-limiter',
    label: 'Rate Limiter',
    category: 'Networking',
    aliases: ['rate limit', 'throttle', 'throttling', 'token bucket', 'leaky bucket', 'quota'],
    body: '<path d="M3.5 17a9 9 0 1 1 17 0"/><path d="M12 14l4-5.5"/><circle cx="12" cy="14" r="1.5"/>',
  },
  {
    slug: 'auth',
    label: 'Auth Service',
    category: 'Operations',
    aliases: [
      'auth',
      'authentication',
      'authorization',
      'identity',
      'login',
      'oauth',
      'sso',
      'iam',
      'cognito',
    ],
    body: '<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  },
  {
    slug: 'monitoring',
    label: 'Monitoring',
    category: 'Operations',
    aliases: [
      'metrics',
      'observability',
      'logging',
      'logs',
      'prometheus',
      'grafana',
      'alerts',
      'tracing',
    ],
    body: '<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M5.5 13h3l2-4 3 7 2-3h3"/>',
  },
  {
    slug: 'external-api',
    label: 'External API',
    category: 'Operations',
    aliases: [
      'third party',
      '3rd party',
      'external service',
      'webhook',
      'partner api',
      'payment provider',
      'stripe',
    ],
    body: '<path d="M14 3h7v7M21 3l-9 9"/><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
  },
];

/** Full SVG document for a generic icon. */
export function svgDocument(icon: GenericIcon): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon.body}</svg>\n`;
}

export function genericEntries(): IconEntry[] {
  return GENERIC_ICONS.map((icon) => ({
    id: `generic/${icon.slug}`,
    provider: 'generic',
    category: icon.category,
    label: icon.label,
    aliases: icon.aliases,
    svgPath: `/icons/generic/${icon.slug}.svg`,
  }));
}
