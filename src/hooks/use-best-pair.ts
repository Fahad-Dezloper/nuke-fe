/**
 * Best Pair Hook
 * Uses selected exchanges + Net vs 7D metric from arbitrage table filters.
 */

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import {
  bestPairMetricAtom,
  selectedExchangesAtom,
  selectedVenuesList,
} from '@/lib/stores/arbitrage-table-filters.store';
import type { AssetDropdownItem } from '@/types/positions';
import type { SpreadAprMap } from '@/lib/api/services/apr.service';
import type { HedgeVenueProtocol } from '@/types/hedge-venues';
import {
  getBestPairResolved,
  type GetBestPairOptions,
} from '@/lib/arbitrage/asset-table-pairs';

export type Protocol = HedgeVenueProtocol;

export interface BestPairResult {
  long: Protocol;
  short: Protocol;
}

export type { GetBestPairOptions };

/**
 * Pure helper for non-React callers (e.g. Jotai atoms) when you already have filter state.
 */
export function getBestPair(
  asset: AssetDropdownItem | null | undefined,
  spreadAprData: SpreadAprMap,
  override: BestPairResult | null | undefined,
  options?: GetBestPairOptions
): BestPairResult {
  return getBestPairResolved(asset, spreadAprData, override, options);
}

/**
 * React hook — reads spread APR + table filter atoms.
 */
export function useBestPair() {
  const spreadAprData = useAtomValue(spreadAprDataAtom);
  const overrides = useAtomValue(bestPairOverrideAtom);
  const selectedMap = useAtomValue(selectedExchangesAtom);
  const metric = useAtomValue(bestPairMetricAtom);

  const selectedList = useMemo(() => selectedVenuesList(selectedMap), [selectedMap]);

  const options: GetBestPairOptions = useMemo(
    () => ({ selectedExchanges: selectedList, metric }),
    [selectedList, metric]
  );

  const getBestPairForAsset = (asset: AssetDropdownItem | null | undefined): BestPairResult =>
    getBestPairResolved(
      asset,
      spreadAprData,
      asset ? overrides[asset.asset] ?? null : null,
      options
    );

  return { getBestPairForAsset, spreadAprData, selectedExchanges: selectedList, metric, options };
}
