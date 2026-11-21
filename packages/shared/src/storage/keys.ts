const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** Reject absolute paths, "..", backslashes and other path-traversal tricks. */
export function assertSafeKey(key: string): void {
  if (
    key.length > 512 ||
    !SAFE_KEY.test(key) ||
    key.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
  }
}
