/**
 * Blob storage abstraction: local disk in development and tests, Google Cloud Storage in
 * staging and production (the GCS driver lands in Phase 6 with snapshot offload).
 * Keys are POSIX-style relative paths such as "snapshots/b1/42.bin".
 */
export interface StorageProvider {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export { LocalStorageProvider } from './local.ts';
export { assertSafeKey } from './keys.ts';
