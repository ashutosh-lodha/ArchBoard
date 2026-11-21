import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageProvider, assertSafeKey } from './index.ts';

describe('assertSafeKey', () => {
  it.each(['snapshots/b1/42.bin', 'thumbs/a.png', 'a'])('accepts %s', (key) => {
    expect(() => assertSafeKey(key)).not.toThrow();
  });

  it.each(['../etc/passwd', '/abs', 'a/../b', 'a\\b', 'a//b', '', './a', 'a/.'])(
    'rejects %s',
    (key) => {
      expect(() => assertSafeKey(key)).toThrow();
    },
  );
});

describe('LocalStorageProvider', () => {
  let dir: string;
  let store: LocalStorageProvider;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ab-storage-'));
    store = new LocalStorageProvider(dir);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('round-trips bytes and reports existence', async () => {
    const data = new Uint8Array([1, 2, 3]);
    await store.put('snapshots/b1/1.bin', data, 'application/octet-stream');
    expect(await store.exists('snapshots/b1/1.bin')).toBe(true);
    expect(await store.get('snapshots/b1/1.bin')).toEqual(data);
    await store.delete('snapshots/b1/1.bin');
    expect(await store.get('snapshots/b1/1.bin')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    expect(await store.get('nope/missing.bin')).toBeNull();
  });
});
