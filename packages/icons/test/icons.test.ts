import { describe, expect, it } from 'vitest';
import { createIconSearch, GENERIC_ICONS, genericEntries, svgDocument } from '../src/index.ts';
import { aliasesFor, normaliseAws, normaliseAzure, normaliseGcp } from '../src/normalise.ts';
import type { IconEntry } from '../src/types.ts';

const providerSamples: IconEntry[] = [
  {
    id: 'aws/elastic-load-balancing',
    provider: 'aws',
    category: 'Networking',
    label: 'Elastic Load Balancing',
    aliases: aliasesFor('elastic-load-balancing', 'Elastic Load Balancing'),
    svgPath: '',
  },
  {
    id: 'aws/amazon-simple-storage-service',
    provider: 'aws',
    category: 'Storage',
    label: 'Amazon Simple Storage Service',
    aliases: aliasesFor('amazon-simple-storage-service', 'Amazon Simple Storage Service'),
    svgPath: '',
  },
  {
    id: 'gcp/cloud-load-balancing',
    provider: 'gcp',
    category: 'Networking',
    label: 'Cloud Load Balancing',
    aliases: aliasesFor('cloud-load-balancing', 'Cloud Load Balancing'),
    svgPath: '',
  },
];

describe('generic icon set', () => {
  it('covers all 21 generic blocks with ≥ 3 aliases each and unique slugs', () => {
    expect(GENERIC_ICONS).toHaveLength(21);
    expect(new Set(GENERIC_ICONS.map((i) => i.slug)).size).toBe(21);
    for (const icon of GENERIC_ICONS) {
      expect(icon.aliases.length, icon.slug).toBeGreaterThanOrEqual(3);
      expect(
        icon.aliases.every((a) => a === a.toLowerCase()),
        icon.slug,
      ).toBe(true);
    }
  });

  it('produces valid-looking SVG documents with a 24×24 viewBox', () => {
    const svg = svgDocument(GENERIC_ICONS[0]!);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 24 24"/);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('every entry id matches the diagram schema icon id format', () => {
    for (const e of genericEntries()) expect(e.id).toMatch(/^generic\/[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('icon search', () => {
  const search = createIconSearch([...genericEntries(), ...providerSamples]);

  it.each(['lb', 'elb', 'alb', 'load balancer', 'Load Balancer', 'load-balancer', 'LOAD BALANCER'])(
    '"%s" ranks the generic Load Balancer first',
    (q) => {
      expect(search.search(q)[0]?.entry.id).toBe('generic/load-balancer');
    },
  );

  it('also returns provider load balancers for "lb"', () => {
    const ids = search.search('lb').map((h) => h.entry.id);
    expect(ids).toContain('aws/elastic-load-balancing');
    expect(ids).toContain('gcp/cloud-load-balancing');
  });

  it.each([
    ['postgres', 'generic/sql-db'],
    ['redis', 'generic/cache'],
    ['kafka', 'generic/stream'],
    ['s3', 'generic/object-storage'],
    ['cron', 'generic/cron'],
    ['serv', 'generic/service'],
    ['databse', 'generic/sql-db'], // typo → fuzzy
  ])('"%s" → %s', (q, id) => {
    expect(search.search(q)[0]?.entry.id).toBe(id);
  });

  it('filters by provider', () => {
    const hits = search.search('lb', { provider: 'aws' });
    expect(hits.every((h) => h.entry.provider === 'aws')).toBe(true);
    expect(hits[0]?.entry.id).toBe('aws/elastic-load-balancing');
  });

  it('reports the matched alias for the UI hint', () => {
    expect(search.search('elb')[0]?.matchedAlias).toBe('elb');
  });

  it('boosts recents/favourites and lists everything for an empty query', () => {
    const hits = search.search('', { boost: (id) => (id === 'generic/queue' ? 20 : 0) });
    expect(hits[0]?.entry.id).toBe('generic/queue');
    expect(hits.length).toBe(search.size);
  });

  it('returns nothing for nonsense', () => {
    expect(search.search('zzzqqqxx')).toEqual([]);
  });
});

describe('vendor file normalisation', () => {
  it('AWS: keeps 64px service icons only', () => {
    expect(
      normaliseAws(
        'Architecture-Service-Icons_07312025/Arch_Storage/64/Arch_Amazon-Simple-Storage-Service_64.svg',
      ),
    ).toEqual({
      slug: 'amazon-simple-storage-service',
      label: 'Amazon Simple Storage Service',
      category: 'Storage',
    });
    expect(
      normaliseAws(
        'Architecture-Service-Icons_07312025/Arch_Storage/32/Arch_Amazon-Simple-Storage-Service_32.svg',
      ),
    ).toBeNull();
    expect(
      normaliseAws('Resource-Icons_07312025/Res_Storage/Res_Amazon-S3_Bucket_48.svg'),
    ).toBeNull();
    expect(
      normaliseAws('Architecture-Service-Icons_07312025/Arch_Compute/64/Arch_Amazon-EC2_64.svg')
        ?.label,
    ).toBe('Amazon EC2');
  });

  it('Azure: strips numeric prefix and "icon-service"', () => {
    expect(
      normaliseAzure(
        'Azure_Public_Service_Icons/Icons/compute/10021-icon-service-Virtual-Machine.svg',
      ),
    ).toEqual({
      slug: 'virtual-machine',
      label: 'Virtual Machine',
      category: 'Compute',
    });
    expect(normaliseAzure('Icons/compute/readme.svg')).toBeNull();
  });

  it('Google Cloud: strips size/colour suffixes', () => {
    expect(normaliseGcp('core-products/Cloud_Run/SVG/Cloud_Run-512-color.svg')).toMatchObject({
      slug: 'cloud-run',
      label: 'Cloud Run',
    });
    expect(normaliseGcp('category/BigQuery.svg')?.slug).toBe('bigquery');
  });

  it('derives acronym and short-name aliases', () => {
    const aliases = aliasesFor('amazon-simple-queue-service', 'Amazon Simple Queue Service');
    expect(aliases).toEqual(expect.arrayContaining(['sqs', 'queue', 'simple queue service']));
  });
});
