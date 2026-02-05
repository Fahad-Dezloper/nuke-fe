'use client';

/**
 * Hook to sync asset selection with URL query parameter
 * Enables shareable URLs like /?asset=BTC
 */

import { useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  selectedAssetSymbolAtom,
  marketFeedDataAtom,
  selectedAssetAtom,
} from '@/lib/stores/market-feed.store';

const ASSET_QUERY_PARAM = 'asset';
const DEFAULT_ASSET = 'BTC';

/**
 * Hook that syncs the selected asset with URL query parameter
 * - On mount: reads ?asset= from URL and sets it in the atom
 * - On asset change: updates the URL without page reload
 * - Falls back to DEFAULT_ASSET if no param and no selection
 */
export function useAssetQueryParam() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const selectedSymbol = useAtomValue(selectedAssetSymbolAtom);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);

  // Initialize from URL on mount (only when market data is available)
  useEffect(() => {
    if (marketFeedData.length === 0) return;

    const assetFromUrl = searchParams.get(ASSET_QUERY_PARAM);
    
    if (assetFromUrl) {
      // Find the asset in market data
      const asset = marketFeedData.find(
        (a) => a.asset.toUpperCase() === assetFromUrl.toUpperCase()
      );
      if (asset) {
        setSelectedAsset(asset);
      } else {
        // Asset not found, fallback to default
        const defaultAsset = marketFeedData.find(
          (a) => a.asset.toUpperCase() === DEFAULT_ASSET
        ) || marketFeedData[0];
        if (defaultAsset) {
          setSelectedAsset(defaultAsset);
        }
      }
    } else if (!selectedSymbol) {
      // No URL param and no selection, use default
      const defaultAsset = marketFeedData.find(
        (a) => a.asset.toUpperCase() === DEFAULT_ASSET
      ) || marketFeedData[0];
      if (defaultAsset) {
        setSelectedAsset(defaultAsset);
      }
    }
  }, [marketFeedData, searchParams, selectedSymbol, setSelectedAsset]);

  // Update URL when selection changes
  const updateUrlWithAsset = useCallback(
    (symbol: string) => {
      const params = new URLSearchParams(searchParams.toString());
      
      // If it's the default asset, we can optionally keep URL clean
      // But for better UX, let's always show the asset in URL
      params.set(ASSET_QUERY_PARAM, symbol);
      
      // Use router.replace to avoid adding to history for every change
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  return {
    updateUrlWithAsset,
    currentAssetFromUrl: searchParams.get(ASSET_QUERY_PARAM),
  };
}
