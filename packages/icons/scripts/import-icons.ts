/**
 * Download the official AWS / Google Cloud / Azure architecture icon packs listed in
 * sources.json, verify their SHA-256, extract the SVGs into vendor/<provider>/ and rebuild the
 * registry. Raw packs are never committed (see docs/ICONS.md for licence terms).
 *
 * Usage:
 *   tsx scripts/import-icons.ts                 # all providers with a URL in sources.json
 *   tsx scripts/import-icons.ts aws             # one provider
 *   tsx scripts/import-icons.ts aws --zip ./Asset-Package.zip   # use a manually downloaded zip
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';

interface Pack {
  url: string;
  sha256: string;
  /** Sub-folder under vendor/<provider>/. Earlier folders win when two packs share an icon. */
  dir: string;
}

interface Source {
  page: string;
  packVersion: string;
  /** Single-pack providers. */
  url?: string;
  sha256?: string;
  /** Multi-pack providers (Google Cloud ships a 2025 core set plus a legacy set). */
  packs?: Pack[];
}

async function download(provider: string, url: string): Promise<Uint8Array> {
  console.log(`${provider}: downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${provider}: HTTP ${res.status} for ${url}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES)
    throw new Error(`${provider}: pack is ${len} bytes, over the ${MAX_BYTES} limit.`);
  return new Uint8Array(await res.arrayBuffer());
}

function verify(provider: string, expected: string | undefined, data: Uint8Array): string {
  const digest = sha256(data);
  if (expected && expected !== digest) {
    throw new Error(
      `${provider}: SHA-256 mismatch.
  expected ${expected}
  got      ${digest}
The pack changed upstream; review it and update sources.json.`,
    );
  }
  if (!expected)
    console.warn(`${provider}: no pinned SHA-256 yet. Pin this value in sources.json: ${digest}`);
  return digest;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'vendor');
const MAX_BYTES = 300 * 1024 * 1024;

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Extract only .svg files, refusing any path that would escape the target directory. */
async function extractSvgs(zip: Uint8Array, target: string): Promise<number> {
  const files = unzipSync(zip, { filter: (f) => f.name.toLowerCase().endsWith('.svg') });
  let count = 0;
  for (const [name, data] of Object.entries(files)) {
    // Some packs nest zips; those are handled by the caller re-running on inner archives.
    const safe = normalize(name).replace(/^(\.\.(\/|\\|$))+/, '');
    if (safe.startsWith('/') || safe.includes('..') || name.includes('__MACOSX')) continue;
    const dest = join(target, safe);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, data);
    count++;
  }
  // Nested zip files (Google publishes a zip of zips): extract their SVGs too.
  const nested = unzipSync(zip, { filter: (f) => f.name.toLowerCase().endsWith('.zip') });
  for (const [name, data] of Object.entries(nested)) {
    count += await extractSvgs(data, join(target, normalize(name).replace(/\.zip$/i, '')));
  }
  return count;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const zipFlag = args.indexOf('--zip');
  const localZip = zipFlag >= 0 ? args[zipFlag + 1] : undefined;
  const only = args.filter((a, i) => !a.startsWith('--') && (zipFlag < 0 || i !== zipFlag + 1));
  const sources = JSON.parse(await readFile(join(root, 'sources.json'), 'utf8')) as Record<
    string,
    Source
  >;
  const manifestPath = join(vendorDir, 'manifest.json');
  let manifest: Record<string, unknown> = {};
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    /* first import */
  }

  const providers = only.length ? only : Object.keys(sources);
  for (const provider of providers) {
    const source = sources[provider];
    if (!source) throw new Error(`Unknown provider "${provider}" (expected aws, gcp or azure).`);
    const target = join(vendorDir, provider);
    const packs: Pack[] =
      source.packs ??
      (source.url ? [{ url: source.url, sha256: source.sha256 ?? '', dir: '' }] : []);
    if (packs.length === 0 && !localZip) {
      console.warn(
        `${provider}: no download URL in sources.json yet — skipping (see ${source.page}).`,
      );
      continue;
    }
    await rm(target, { recursive: true, force: true });
    let count = 0;
    const digests: string[] = [];
    if (localZip) {
      const data = new Uint8Array(await readFile(localZip));
      digests.push(verify(provider, undefined, data));
      count += await extractSvgs(data, target);
    } else {
      for (const pack of packs) {
        const data = await download(provider, pack.url);
        digests.push(verify(provider, pack.sha256, data));
        count += await extractSvgs(data, pack.dir ? join(target, pack.dir) : target);
      }
    }
    manifest[provider] = {
      packVersion: source.packVersion,
      source: source.page,
      sha256: digests.join(','),
      importedAt: new Date().toISOString(),
    };
    console.log(`${provider}: extracted ${count} SVG files`);
  }

  await mkdir(vendorDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  execFileSync(process.execPath, ['--import', 'tsx', join(root, 'scripts', 'build-registry.ts')], {
    stdio: 'inherit',
  });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
