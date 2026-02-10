/**
 * Best Pair Hook
 * Single source of truth for determining the best long/short pair for an asset.
 * Uses 7-day spread APR data when available, falls back to live funding rates.
 */

import { useAtomValue } from 'jotai';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import type { AssetDropdownItem } from '@/types/positions';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';

export type Protocol = 'hyperliquid' | 'pacifica';

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
  spreadAprData: SpreadAprMap
): BestPairResult {
  const DEFAULT: BestPairResult = { long: 'hyperliquid', short: 'pacifica' };
  if (!asset) return DEFAULT;

  // Prefer spread APR data (7-day average from backend CRON)
  const spreadData = spreadAprData[asset.asset];
  if (spreadData) {
    return {
      long: spreadData.longPlatform,
      short: spreadData.shortPlatform,
    };
  }

  // Fallback: compare live funding rates
  const hyperliquidRate = asset.hyperliquidFundingRate ?? 0;
  const pacificaRate = asset.pacificaFundingRate ?? 0;
  const isHyperliquidLower = hyperliquidRate < pacificaRate;

  return {
    long: isHyperliquidLower ? 'hyperliquid' : 'pacifica',
    short: isHyperliquidLower ? 'pacifica' : 'hyperliquid',
  };
}

/**
 * React hook — reads spreadAprDataAtom automatically.
 * Returns a stable `getBestPairForAsset(asset)` helper + the current
 * spread APR map so callers can grab 7D APR numbers if needed.
 */
export function useBestPair() {
  const spreadAprData = useAtomValue(spreadAprDataAtom);

  const getBestPairForAsset = (
    asset: AssetDropdownItem | null | undefined
  ): BestPairResult => getBestPair(asset, spreadAprData);

  return { getBestPairForAsset, spreadAprData };
}
