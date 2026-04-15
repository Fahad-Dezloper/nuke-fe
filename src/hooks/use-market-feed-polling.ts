/**
 * Market Feed Polling Hook
 *
 * Uses React Query with refetchInterval for automatic polling.
 * Syncs data into Jotai atoms for global consumption.
 *
 * React Query handles:
 * - Request deduplication (multiple components can mount this safely)
 * - Automatic cancellation on unmount
 * - Stale data management
 * - Error retry
 */

'use client';

import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import {
  marketFeedDataAtom,
  marketFeedLoadingAtom,
  marketFeedErrorAtom,
  marketFeedLastUpdatedAtom,
} from '@/lib/stores/market-feed.store';
import { mergeStableMarketFeed } from '@/lib/stores/market-feed-merge';
import { marketFeedService } from '@/lib/api/services/market-feed.service';
import { queryKeys } from '@/lib/query-keys';

const POLLING_INTERVAL = 3000; // 3 seconds

/**
 * Hook to start polling market feed data.
 * Polls every 3 seconds and syncs with the global Jotai store.
 */
export function useMarketFeedPolling() {
  const setMarketFeedData = useSetAtom(marketFeedDataAtom);
  const setLoading = useSetAtom(marketFeedLoadingAtom);
  const setError = useSetAtom(marketFeedErrorAtom);
  const setLastUpdated = useSetAtom(marketFeedLastUpdatedAtom);

  const query = useQuery({
    queryKey: queryKeys.marketFeed.live,
    queryFn: () => marketFeedService.getMarketFeed(),
    refetchInterval: POLLING_INTERVAL,
    // Keep staleTime short — we're polling for real-time data
    staleTime: POLLING_INTERVAL - 500,
  });

  // Sync React Query → Jotai. Reuse row objects when values are unchanged so
  // `selectedAssetAtom` and list subscribers do not re-render every poll tick.
  useEffect(() => {
    if (!query.data) return;
    setMarketFeedData((prev) => mergeStableMarketFeed(prev, query.data!));
    setLastUpdated(Date.now());
  }, [query.data, setMarketFeedData, setLastUpdated]);

  useEffect(() => {
    // Only set loading on initial load, not on background refetches
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  useEffect(() => {
    setError(query.error ?? null);
  }, [query.error, setError]);

  return {
    refetch: query.refetch,
  };
}
