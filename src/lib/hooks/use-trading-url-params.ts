'use client';

/**
 * Sync asset + best pair (long/short venues) with URL query params.
 * Example: /?asset=JUP&long=pacifica&short=phoenix
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  selectedAssetSymbolAtom,
  marketFeedDataAtom,
  selectedAssetAtom,
} from '@/lib/stores/market-feed.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import type { HedgeVenueProtocol } from '@/types/hedge-venues';
import type { BestPairResult } from '@/hooks/use-best-pair';
import type { AssetDropdownItem } from '@/types/positions';
import type { BestPairOverrideMap } from '@/lib/stores/best-pair-override.store';

const ASSET_QUERY_PARAM = 'asset';
const LONG_QUERY_PARAM = 'long';
const SHORT_QUERY_PARAM = 'short';
const DEFAULT_ASSET = 'BTC';

const HEDGE_VENUES: readonly HedgeVenueProtocol[] = [
  'hyperliquid',
  'pacifica',
  'phoenix',
  'backpack',
  'lighter',
];

function parseVenueParam(value: string | null): HedgeVenueProtocol | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return HEDGE_VENUES.includes(normalized as HedgeVenueProtocol)
    ? (normalized as HedgeVenueProtocol)
    : null;
}

function findAssetBySymbol(assets: AssetDropdownItem[], symbol: string) {
  return assets.find((a) => a.asset.toUpperCase() === symbol.toUpperCase()) ?? null;
}

function applyUrlToState(
  assetFromUrl: string | null,
  longFromUrl: HedgeVenueProtocol | null,
  shortFromUrl: HedgeVenueProtocol | null,
  marketFeedData: AssetDropdownItem[],
  setSelectedAsset: (asset: AssetDropdownItem | null) => void,
  setBestPairOverride: (updater: (prev: BestPairOverrideMap) => BestPairOverrideMap) => void
): void {
  const pickDefaultAsset = () =>
    findAssetBySymbol(marketFeedData, DEFAULT_ASSET) ?? marketFeedData[0] ?? null;

  if (!assetFromUrl) return;

  const asset = findAssetBySymbol(marketFeedData, assetFromUrl) ?? pickDefaultAsset();
  if (!asset) return;

  setSelectedAsset(asset);
  if (longFromUrl && shortFromUrl && longFromUrl !== shortFromUrl) {
    const pair: BestPairResult = { long: longFromUrl, short: shortFromUrl };
    setBestPairOverride((prev) => ({ ...prev, [asset.asset]: pair }));
  }
}

export interface TradingUrlPair {
  long: HedgeVenueProtocol;
  short: HedgeVenueProtocol;
}

/**
 * Update URL query params without reading useSearchParams().
 * Safe to call from any client component (e.g. asset dropdown on select).
 */
export function useUpdateTradingUrl() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (params: { asset: string; pair?: TradingUrlPair | null }) => {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const next = new URLSearchParams(search);
      next.set(ASSET_QUERY_PARAM, params.asset);

      if (params.pair) {
        next.set(LONG_QUERY_PARAM, params.pair.long);
        next.set(SHORT_QUERY_PARAM, params.pair.short);
      } else {
        next.delete(LONG_QUERY_PARAM);
        next.delete(SHORT_QUERY_PARAM);
      }

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );
}

/**
 * @deprecated Use useUpdateTradingUrl or TradingUrlSync inside Suspense.
 */
export function useAssetQueryParam() {
  const updateTradingUrl = useUpdateTradingUrl();
  return {
    updateUrlWithAsset: (symbol: string, pair?: TradingUrlPair | null) =>
      updateTradingUrl({ asset: symbol, pair: pair ?? undefined }),
    currentAssetFromUrl: null as string | null,
  };
}

/**
 * Hydrate Jotai from URL on load and on browser navigation (back/forward).
 * Must be used inside a React Suspense boundary.
 *
 * State → URL is handled by useUpdateTradingUrl (dropdown + TradingUrlSync).
 * Do NOT push URL → state when selectedSymbol changes — router.replace is async
 * and stale searchParams would revert the user's click back to the old asset.
 */
export function useTradingUrlParams() {
  const searchParams = useSearchParams();
  const selectedSymbol = useAtomValue(selectedAssetSymbolAtom);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const setBestPairOverride = useSetAtom(bestPairOverrideAtom);

  const initializedFromUrlRef = useRef(false);
  const lastAppliedSearchRef = useRef<string | null>(null);

  const updateTradingUrl = useUpdateTradingUrl();

  // One-time init + react to URL changes (back/forward, shared links) — not to selectedSymbol
  useEffect(() => {
    if (marketFeedData.length === 0) return;

    const searchKey = searchParams.toString();
    const assetFromUrl = searchParams.get(ASSET_QUERY_PARAM);
    const longFromUrl = parseVenueParam(searchParams.get(LONG_QUERY_PARAM));
    const shortFromUrl = parseVenueParam(searchParams.get(SHORT_QUERY_PARAM));

    if (!initializedFromUrlRef.current) {
      initializedFromUrlRef.current = true;
      lastAppliedSearchRef.current = searchKey;

      if (assetFromUrl) {
        applyUrlToState(
          assetFromUrl,
          longFromUrl,
          shortFromUrl,
          marketFeedData,
          setSelectedAsset,
          setBestPairOverride
        );
      } else if (!selectedSymbol) {
        const defaultAsset =
          findAssetBySymbol(marketFeedData, DEFAULT_ASSET) ?? marketFeedData[0] ?? null;
        if (defaultAsset) {
          setSelectedAsset(defaultAsset);
        }
      }
      return;
    }

    // URL changed externally (navigation) — apply to state
    if (searchKey === lastAppliedSearchRef.current) return;
    lastAppliedSearchRef.current = searchKey;

    if (assetFromUrl) {
      applyUrlToState(
        assetFromUrl,
        longFromUrl,
        shortFromUrl,
        marketFeedData,
        setSelectedAsset,
        setBestPairOverride
      );
    }
  }, [marketFeedData, searchParams, selectedSymbol, setSelectedAsset, setBestPairOverride]);

  return {
    updateTradingUrl,
    currentAssetFromUrl: searchParams.get(ASSET_QUERY_PARAM),
    currentPairFromUrl:
      parseVenueParam(searchParams.get(LONG_QUERY_PARAM)) &&
      parseVenueParam(searchParams.get(SHORT_QUERY_PARAM))
        ? {
            long: parseVenueParam(searchParams.get(LONG_QUERY_PARAM))!,
            short: parseVenueParam(searchParams.get(SHORT_QUERY_PARAM))!,
          }
        : null,
  };
}
