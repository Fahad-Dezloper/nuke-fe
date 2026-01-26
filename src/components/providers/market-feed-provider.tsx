'use client';

/**
 * Market Feed Provider
 * Initializes global polling for market feed data
 * This component should be placed high in the component tree
 */

import { useMarketFeedPolling } from '@/hooks/use-market-feed-polling';

export function MarketFeedProvider({ children }: { children: React.ReactNode }) {
  // Start polling when component mounts
  useMarketFeedPolling();

  return <>{children}</>;
}
