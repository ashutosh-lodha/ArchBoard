import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createIconSearch } from '../src/search.ts';
import type { IconRegistry } from '../src/types.ts';

/**
 * Checks against the real generated registry (run `pnpm --filter @archboard/icons build`, and
 * `pnpm icons:import` for vendor packs). Vendor assertions are skipped when packs are absent,
 * e.g. in CI before the import step is wired up.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = join(root, 'generated', 'registry.json');
const registry: IconRegistry | null = existsSync(registryPath)
  ? (JSON.parse(readFileSync(registryPath, 'utf8')) as IconRegistry)
  : null;
const hasVendor = Boolean(registry?.providers.aws && registry.providers.azure);

describe.skipIf(!registry)('generated registry', () => {
  it('has unique ids that match the diagram schema icon id format', () => {
    const ids = registry!.icons.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(generic|aws|gcp|azure)\/[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every entry has an SVG file on disk', () => {
    for (const icon of registry!.icons) {
      expect(
        existsSync(join(root, 'generated', 'svg', icon.svgPath.replace(/^\/icons\//, ''))),
        icon.id,
      ).toBe(true);
    }
  });
});

describe.skipIf(!hasVendor)('search over the real AWS + Azure packs', () => {
  const search = createIconSearch(registry?.icons ?? []);

  it.each(['lb', 'elb', 'load balancer'])(
    '"%s" still ranks the generic Load Balancer first',
    (q) => {
      expect(search.search(q)[0]?.entry.id).toBe('generic/load-balancer');
    },
  );

  it.each([
    ['s3', 'aws', 'aws/amazon-simple-storage-service'],
    ['lb', 'aws', 'aws/elastic-load-balancing'],
    ['sqs', 'aws', 'aws/amazon-simple-queue-service'],
    ['lambda', 'aws', 'aws/aws-lambda'],
    ['dynamodb', 'aws', 'aws/amazon-dynamodb'],
    ['load balancer', 'azure', 'azure/load-balancers'],
    ['k8s', 'azure', 'azure/kubernetes-services'],
    ['vm', 'azure', 'azure/virtual-machine'],
  ] as const)('"%s" in %s → %s', (q, provider, id) => {
    const top3 = search
      .search(q, { provider })
      .slice(0, 3)
      .map((h) => h.entry.id);
    expect(top3).toContain(id);
  });

  it('imports at least 95% of the files that match the service-icon rules', () => {
    // AWS ≈ 300 service icons per release, Azure ≈ 640 (V25). Guard against a silent layout change.
    expect(registry!.providers.aws!.count).toBeGreaterThan(250);
    expect(registry!.providers.azure!.count).toBeGreaterThan(550);
  });
});
