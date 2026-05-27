/**
 * Realized funding APR from accumulated funding PNL and time since open.
 */

import { formatPercentWithSign } from '@/lib/utils';

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
/** Avoid extreme APR spikes for very new positions. */
const MIN_ELAPSED_MS = 60 * 60 * 1000;

export function parseSignedCurrency(value: string): number {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
}

export function computeFundingAprPercent(
  fundingPnlUsd: number,
  marginUsd: number,
  openedAtMs: number,
  nowMs: number = Date.now()
): number | null {
  if (!Number.isFinite(openedAtMs) || openedAtMs <= 0 || marginUsd <= 0) return null;

  const elapsedMs = Math.max(nowMs - openedAtMs, MIN_ELAPSED_MS);
  const elapsedYears = elapsedMs / MS_PER_YEAR;
  if (elapsedYears <= 0) return null;

  return (fundingPnlUsd / marginUsd / elapsedYears) * 100;
}

export function formatFundingApr(aprPercent: number | null | undefined): string {
  if (aprPercent == null || !Number.isFinite(aprPercent)) return '—';
  return formatPercentWithSign(aprPercent, 1);
}
