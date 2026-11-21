import type { CapacityInput, CapacityResult } from './schema.ts';

export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_YEAR = 365;

/**
 * Back-of-the-envelope capacity estimate used by the interview panel (UX §5.6).
 * - QPS = DAU × requests per user per day ÷ 86,400; peak = average × peak factor.
 * - Storage per year = writes per day × payload × 365 (no replication or index overhead).
 * - Ingress = average write QPS × payload; egress = average read QPS × payload.
 */
export function computeCapacity(input: CapacityInput): CapacityResult {
  const readsPerDay = input.dau * input.readsPerUserPerDay;
  const writesPerDay = input.dau * input.writesPerUserPerDay;
  const avgReadQps = readsPerDay / SECONDS_PER_DAY;
  const avgWriteQps = writesPerDay / SECONDS_PER_DAY;
  const storagePerYearBytes = writesPerDay * input.payloadBytes * DAYS_PER_YEAR;
  return {
    ...input,
    avgReadQps,
    peakReadQps: avgReadQps * input.peakFactor,
    avgWriteQps,
    peakWriteQps: avgWriteQps * input.peakFactor,
    storagePerYearBytes,
    totalStorageBytes: storagePerYearBytes * input.retentionYears,
    ingressBytesPerSec: avgWriteQps * input.payloadBytes,
    egressBytesPerSec: avgReadQps * input.payloadBytes,
  };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const;

/** Decimal units (1 KB = 1000 B), as is conventional in capacity estimates. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = value >= 100 || unit === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${UNITS[unit]}`;
}

export function formatQps(qps: number): string {
  if (!Number.isFinite(qps) || qps < 0) return '—';
  if (qps >= 1e6) return `${(qps / 1e6).toFixed(1)}M`;
  if (qps >= 1e3) return `${(qps / 1e3).toFixed(1)}K`;
  return qps >= 10 ? qps.toFixed(0) : qps.toFixed(1);
}
