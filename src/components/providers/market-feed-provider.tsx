'use client';

/**
 * Market Feed Provider
 * Initializes global polling for market feed data and fetches spread APR data
 * This component should be placed high in the component tree
 */

import { useMarketFeedPolling } from '@/hooks/use-market-feed-polling';
import { useSpreadApr } from '@/hooks/use-spread-apr';

export function MarketFeedProvider({ children }: { children: React.ReactNode }) {
  // Start polling when component mounts
  useMarketFeedPolling();

  // Fetch spread APR data once (CRON updates daily)
  useSpreadApr();

  return <>{children}</>;
}
