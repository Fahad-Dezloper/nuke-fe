/**
 * Best Pair Hook
 * Single source of truth for determining the best long/short pair for an asset.
 * Uses 7-day spread APR data when available, falls back to live funding rates.
 */

import { useAtomValue } from 'jotai';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import type { AssetDropdownItem } from '@/types/positions';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';

export type Protocol = 'hyperliquid' | 'pacifica' | 'backpack';

export interface BestPairResult {
  long: Protocol;
  short: Protocol;
}

/**
 * Pure function — no hooks, works anywhere.
 * Pass the spreadAprData map + an asset to get the best pair.
 */
export function getBestPair(
  asset: AssetDropdownItem | null | undefined,
  spreadAprData: SpreadAprMap,
  override?: BestPairResult | null
): BestPairResult {
  const DEFAULT: BestPairResult = { long: 'hyperliquid', short: 'pacifica' };
  if (!asset) return DEFAULT;

  if (override) return override;

  // Prefer spread APR data (7-day average from backend CRON)
  const spreadData = spreadAprData[asset.asset];
  if (spreadData) {
    return {
      long: spreadData.longPlatform,
      short: spreadData.shortPlatform,
    };
  }

  // Fallback: compare live funding rates
  const protocols = asset.protocols ?? {};
  const entries = Object.entries(protocols)
    .map(([id, p]) => ({ id: id as Protocol, yearly: p.fundingRateYearly }))
    .filter((e) => typeof e.yearly === 'number' && Number.isFinite(e.yearly));

  if (entries.length < 2) return DEFAULT;

  entries.sort((a, b) => a.yearly - b.yearly);
  const long = entries[0]!.id;
  const short = entries[entries.length - 1]!.id;
  return { long, short };
}

/**
 * React hook — reads spreadAprDataAtom automatically.
 * Returns a stable `getBestPairForAsset(asset)` helper + the current
 * spread APR map so callers can grab 7D APR numbers if needed.
 */
export function useBestPair() {
  const spreadAprData = useAtomValue(spreadAprDataAtom);
  const overrides = useAtomValue(bestPairOverrideAtom);

  const getBestPairForAsset = (
    asset: AssetDropdownItem | null | undefined
  ): BestPairResult => getBestPair(asset, spreadAprData, asset ? overrides[asset.asset] ?? null : null);

  return { getBestPairForAsset, spreadAprData };
}
