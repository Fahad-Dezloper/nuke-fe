'use client';

/**
 * Market Feed Provider
 * Initializes global polling for market feed data and fetches spread APR data
 * This component should be placed high in the component tree
 */

import { useMarketFeedPolling } from '@/hooks/use-market-feed-polling';
import { useSpreadApr } from '@/hooks/use-spread-apr';
import { usePreloadMetadata } from '@/hooks/use-preload-metadata';

export function MarketFeedProvider({ children }: { children: React.ReactNode }) {
  // Pre-warm HL + Pacifica metadata caches (static data, fetched once)
  usePreloadMetadata();

  // Start polling when component mounts
  useMarketFeedPolling();

  // Fetch spread APR data once (CRON updates daily)
  useSpreadApr();

  return <>{children}</>;
}
