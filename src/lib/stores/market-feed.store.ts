/**
 * Market Feed Store
 * Global Jotai store for market feed data with polling support
 */

import { atom } from 'jotai';
import type { AssetDropdownItem } from '@/types/positions';

/**
 * Market feed data atom
 */
export const marketFeedDataAtom = atom<AssetDropdownItem[]>([]);

/**
 * Selected asset symbol atom (for tracking which asset is selected)
 * This stores just the asset symbol/name
 */
export const selectedAssetSymbolAtom = atom<string | null>(null);

/**
 * Selected asset atom
 * Derived atom that automatically syncs with latest market feed data
 * When market feed data updates, this atom will update the selected asset with fresh data
 */
export const selectedAssetAtom = atom(
  (get) => {
    const marketFeedData = get(marketFeedDataAtom);
    const selectedSymbol = get(selectedAssetSymbolAtom);

    if (marketFeedData.length === 0) {
      return null;
    }

    // If no symbol selected, return first asset (auto-selection handled in component)
    if (!selectedSymbol) {
      return marketFeedData[0];
    }

    // Find the asset in the latest market feed data
    // This ensures we always get the most up-to-date data from polling
    const asset = marketFeedData.find((a) => a.asset === selectedSymbol);
    return asset || marketFeedData[0]; // Fallback to first if not found
  },
  (get, set, newAsset: AssetDropdownItem | null) => {
    // When setting, store the symbol
    if (newAsset) {
      set(selectedAssetSymbolAtom, newAsset.asset);
    } else {
      set(selectedAssetSymbolAtom, null);
    }
  }
);

/**
 * Market feed loading state atom
 */
export const marketFeedLoadingAtom = atom<boolean>(false);

/**
 * Market feed error state atom
 */
export const marketFeedErrorAtom = atom<Error | null>(null);

/**
 * Market feed last updated timestamp atom
 */
export const marketFeedLastUpdatedAtom = atom<number | null>(null);
