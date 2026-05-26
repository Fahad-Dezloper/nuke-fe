'use client';

/**
 * Syncs asset + best pair to URL query params. Must render inside <Suspense>
 * because it uses useSearchParams().
 */

import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { useTradingUrlParams, useUpdateTradingUrl } from '@/lib/hooks/use-trading-url-params';
import { useBestPair } from '@/hooks/use-best-pair';

export function TradingUrlSync() {
  useTradingUrlParams();

  const globalSelectedAsset = useAtomValue(selectedAssetAtom);
  const updateTradingUrl = useUpdateTradingUrl();
  const { getBestPairForAsset } = useBestPair();

  const bestPair = getBestPairForAsset(globalSelectedAsset);

  useEffect(() => {
    if (!globalSelectedAsset?.asset) return;
    updateTradingUrl({
      asset: globalSelectedAsset.asset,
      pair: bestPair,
    });
  }, [globalSelectedAsset?.asset, bestPair.long, bestPair.short, updateTradingUrl]);

  return null;
}
