/**
 * Tradeoff hint cards for generic components (spec: "e.g. Cache: eviction, consistency, what
 * happens on a miss"). Short prompts an interviewer is likely to ask about — not a textbook.
 */
export interface Tradeoff {
  summary: string;
  questions: string[];
}

export const TRADEOFFS: Record<string, Tradeoff> = {
  'generic/client': {
    summary: 'Where requests start. Think about what the client can cache and retry.',
    questions: [
      'Retries with backoff and idempotency keys?',
      'What works offline?',
      'Web, mobile, or both — different payloads?',
    ],
  },
  'generic/user': {
    summary: 'An actor. Useful for showing who triggers which flow.',
    questions: ['How many daily active users, and when is peak?', 'Read-heavy or write-heavy?'],
  },
  'generic/dns': {
    summary: 'Name resolution; also a cheap global traffic-steering layer.',
    questions: [
      'TTL vs how fast you can fail over?',
      'Geo or latency-based routing?',
      'Health checks on records?',
    ],
  },
  'generic/cdn': {
    summary: 'Serves cacheable content close to users and shields the origin.',
    questions: [
      'What is cacheable, and for how long?',
      'How do you invalidate on change?',
      'Signed URLs for private content?',
    ],
  },
  'generic/load-balancer': {
    summary: 'Spreads traffic across healthy instances.',
    questions: [
      'L4 or L7 (paths, headers, TLS termination)?',
      'Algorithm: round-robin, least connections, consistent hashing?',
      'Health checks and connection draining?',
      'Is the LB itself a single point of failure?',
    ],
  },
  'generic/api-gateway': {
    summary: 'One front door: auth, rate limits, routing, request shaping.',
    questions: [
      'What runs here vs in the services?',
      'Added latency per hop?',
      'Versioning and backwards compatibility?',
    ],
  },
  'generic/service': {
    summary: 'Application logic. Keep it stateless so it scales horizontally.',
    questions: [
      'Where does state live?',
      'How many replicas, and how does it autoscale?',
      'Timeouts, retries and circuit breakers to dependencies?',
    ],
  },
  'generic/worker': {
    summary: 'Processes jobs asynchronously, off the request path.',
    questions: [
      'At-least-once processing: are handlers idempotent?',
      'What happens to poison messages (DLQ)?',
      'How do you scale on queue depth?',
    ],
  },
  'generic/cron': {
    summary: 'Runs work on a schedule.',
    questions: [
      'What if a run overlaps the next one?',
      'Exactly one runner across replicas (leader election/lock)?',
      'Catch-up after downtime?',
    ],
  },
  'generic/cache': {
    summary: 'Keeps hot data in memory to cut latency and database load.',
    questions: [
      'Eviction policy (LRU, LFU, TTL)?',
      'Cache-aside, write-through or write-back?',
      'Consistency: how stale can reads be?',
      'What happens on a miss storm or cold start?',
    ],
  },
  'generic/sql-db': {
    summary: 'Relational store with transactions and joins.',
    questions: [
      'Read replicas for read-heavy load?',
      'Sharding key once one node is not enough?',
      'Indexes for the hot queries?',
      'Backups, RPO and RTO?',
    ],
  },
  'generic/nosql-db': {
    summary: 'Scales horizontally with flexible schemas; you design around access patterns.',
    questions: [
      'Partition key: does it avoid hot partitions?',
      'Consistency level: strong or eventual?',
      'Which queries are impossible without a secondary index?',
    ],
  },
  'generic/object-storage': {
    summary: 'Cheap, durable storage for files and blobs.',
    questions: [
      'Direct uploads with pre-signed URLs?',
      'Lifecycle rules to colder tiers?',
      'Serve through a CDN?',
    ],
  },
  'generic/queue': {
    summary: 'Decouples producers from consumers and absorbs spikes.',
    questions: [
      'Ordering guarantees needed?',
      'Delivery: at-least-once means duplicates — how are they handled?',
      'Visibility timeout vs processing time?',
      'Dead-letter queue?',
    ],
  },
  'generic/pubsub': {
    summary: 'Fans one event out to many independent subscribers.',
    questions: [
      'What if a subscriber is slow or down?',
      'Event schema versioning?',
      'Do subscribers need replay?',
    ],
  },
  'generic/stream': {
    summary: 'Ordered, replayable log of events (partitioned).',
    questions: [
      'Partition key and ordering per key?',
      'Retention period?',
      'Consumer lag monitoring and backpressure?',
    ],
  },
  'generic/search': {
    summary: 'Full-text and faceted queries over an index built from your source of truth.',
    questions: [
      'How does the index stay in sync (CDC, dual writes)?',
      'Acceptable indexing delay?',
      'Relevance tuning and typo tolerance?',
    ],
  },
  'generic/rate-limiter': {
    summary: 'Protects services from abuse and overload.',
    questions: [
      'Algorithm: token bucket, sliding window?',
      'Per user, per IP, per API key?',
      'Where is the counter stored, and is it shared across instances?',
      'What does the client see (429 + Retry-After)?',
    ],
  },
  'generic/auth': {
    summary: 'Identity and access decisions.',
    questions: [
      'Sessions or tokens (JWT), and how are they revoked?',
      'Where is authorization checked?',
      'SSO / OAuth providers?',
    ],
  },
  'generic/monitoring': {
    summary: 'Metrics, logs and traces that tell you something is wrong before users do.',
    questions: [
      'Which SLOs and alerts matter?',
      'Who monitors the monitoring?',
      'Trace IDs across services?',
    ],
  },
  'generic/external-api': {
    summary: 'A dependency you do not control.',
    questions: [
      'Timeouts, retries and a circuit breaker?',
      'Their rate limits?',
      'What does the product do when it is down?',
    ],
  },
};
