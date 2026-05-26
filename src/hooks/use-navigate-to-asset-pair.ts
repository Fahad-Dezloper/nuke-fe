'use client';

import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { marketFeedDataAtom, selectedAssetAtom } from '@/lib/stores/market-feed.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import { useUpdateTradingUrl } from '@/lib/hooks/use-trading-url-params';
import { getProtocolConfig, getProtocolConfigByDisplayName } from '@/lib/protocols/config';
import type { HedgeVenueProtocol } from '@/types/hedge-venues';

const HEDGE_VENUES: readonly HedgeVenueProtocol[] = [
  'hyperliquid',
  'pacifica',
  'phoenix',
  'backpack',
  'lighter',
];

function normalizeAssetSymbol(asset: string): string {
  return asset.replace(/-PERP$/i, '').trim();
}

function toHedgeVenue(protocol: string): HedgeVenueProtocol | null {
  const id = protocol.trim().toLowerCase();
  if (HEDGE_VENUES.includes(id as HedgeVenueProtocol)) {
    return id as HedgeVenueProtocol;
  }
  const byName = getProtocolConfigByDisplayName(protocol);
  if (byName && HEDGE_VENUES.includes(byName.id as HedgeVenueProtocol)) {
    return byName.id as HedgeVenueProtocol;
  }
  const cfg = getProtocolConfig(id);
  if (cfg && HEDGE_VENUES.includes(cfg.id as HedgeVenueProtocol)) {
    return cfg.id as HedgeVenueProtocol;
  }
  return null;
}

/**
 * Select asset + long/short pair in global state and sync the URL (?asset=&long=&short=).
 */
export function useNavigateToAssetPair() {
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const setSelectedAsset = useSetAtom(selectedAssetAtom);
  const setBestPairOverride = useSetAtom(bestPairOverrideAtom);
  const updateTradingUrl = useUpdateTradingUrl();

  return useCallback(
    (asset: string, longProtocol: string, shortProtocol: string) => {
      const long = toHedgeVenue(longProtocol);
      const short = toHedgeVenue(shortProtocol);
      if (!long || !short) return;

      const symbol = normalizeAssetSymbol(asset);
      const feedAsset =
        marketFeedData.find((a) => a.asset.toUpperCase() === symbol.toUpperCase()) ?? null;

      const assetKey = feedAsset?.asset ?? symbol;
      const pair = { long, short };

      if (feedAsset) {
        setSelectedAsset(feedAsset);
      }

      setBestPairOverride((prev) => ({ ...prev, [assetKey]: pair }));
      updateTradingUrl({ asset: assetKey, pair });
    },
    [marketFeedData, setSelectedAsset, setBestPairOverride, updateTradingUrl]
  );
}
