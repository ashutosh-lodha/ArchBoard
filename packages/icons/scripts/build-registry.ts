/**
 * Build the normalised icon registry.
 *
 *   generated/registry.json            metadata for every icon (palette search + AI agent)
 *   generated/svg/<provider>/<slug>.svg optimised SVGs, served by the web app at /icons/...
 *
 * Generic icons are always built from src/generic.ts. Provider packs are included only if
 * `pnpm icons:import` has extracted them into vendor/<provider>/ (see sources.json).
 * Usage: tsx scripts/build-registry.ts
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';
import { genericEntries, GENERIC_ICONS, svgDocument } from '../src/generic.ts';
import { aliasesFor, NORMALISERS } from '../src/normalise.ts';
import type { IconEntry, IconRegistry, Provider } from '../src/types.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'generated');
const vendorDir = join(root, 'vendor');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.toLowerCase().endsWith('.svg') && !e.name.startsWith('._')) out.push(full);
  }
  return out;
}

function optimiseSvg(svg: string, idPrefix: string): string {
  return optimize(svg, {
    multipass: true,
    plugins: [
      'preset-default', // SVGO 4 keeps viewBox by default
      // Vendor SVGs reuse ids like "a" and "linearGradient-1"; prefix them so many icons can share a page.
      { name: 'prefixIds', params: { prefix: idPrefix, delim: '-' } },
      'removeDimensions',
      { name: 'removeAttrs', params: { attrs: ['data-name', 'class'] } },
    ],
  }).data;
}

async function main(): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(join(outDir, 'svg', 'generic'), { recursive: true });

  const icons: IconEntry[] = [];
  const providers: IconRegistry['providers'] = {};

  for (const icon of GENERIC_ICONS) {
    await writeFile(join(outDir, 'svg', 'generic', `${icon.slug}.svg`), svgDocument(icon));
  }
  icons.push(...genericEntries());
  providers.generic = { count: GENERIC_ICONS.length, source: 'ArchBoard', packVersion: '1' };

  let manifest: Record<string, { packVersion?: string; source?: string }> = {};
  try {
    manifest = JSON.parse(await readFile(join(vendorDir, 'manifest.json'), 'utf8'));
  } catch {
    // No vendor packs imported yet; generic-only registry.
  }

  for (const provider of Object.keys(NORMALISERS) as Array<Exclude<Provider, 'generic'>>) {
    const files = await walk(join(vendorDir, provider));
    if (files.length === 0) continue;
    const seen = new Set<string>();
    const skipped: string[] = [];
    await mkdir(join(outDir, 'svg', provider), { recursive: true });
    for (const file of files.sort()) {
      const rel = relative(join(vendorDir, provider), file);
      const name = NORMALISERS[provider](rel);
      if (!name || seen.has(name.slug)) {
        if (!name) skipped.push(rel);
        continue;
      }
      seen.add(name.slug);
      const svg = optimiseSvg(await readFile(file, 'utf8'), `${provider}-${name.slug}`);
      await writeFile(join(outDir, 'svg', provider, `${name.slug}.svg`), svg);
      icons.push({
        id: `${provider}/${name.slug}`,
        provider,
        category: name.category,
        label: name.label,
        aliases: aliasesFor(name.slug, name.label),
        svgPath: `/icons/${provider}/${name.slug}.svg`,
      });
    }
    providers[provider] = {
      count: seen.size,
      source: manifest[provider]?.source ?? 'unknown',
      packVersion: manifest[provider]?.packVersion ?? 'unknown',
    };
    console.log(`${provider}: ${seen.size} icons (${skipped.length} files skipped)`);
    if (skipped.length) {
      await writeFile(join(outDir, `skipped-${provider}.txt`), skipped.join('\n'));
    }
  }

  const registry: IconRegistry = {
    version: 1,
    generatedAt: new Date().toISOString(),
    providers,
    icons,
  };
  await writeFile(join(outDir, 'registry.json'), JSON.stringify(registry));
  console.log(
    `Registry: ${icons.length} icons → ${relative(process.cwd(), join(outDir, 'registry.json'))}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
