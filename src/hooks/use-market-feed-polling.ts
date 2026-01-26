/**
 * Market Feed Polling Hook
 * Polls the market feed API every 3 seconds and updates global store
 */

import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import {
  marketFeedDataAtom,
  marketFeedLoadingAtom,
  marketFeedErrorAtom,
  marketFeedLastUpdatedAtom,
} from '@/lib/stores/market-feed.store';
import { marketFeedService } from '@/lib/api/services/market-feed.service';

const POLLING_INTERVAL = 3000; // 3 seconds

/**
 * Hook to start polling market feed data
 * Polls every 3 seconds and updates the global Jotai store
 */
export function useMarketFeedPolling() {
  const setMarketFeedData = useSetAtom(marketFeedDataAtom);
  const setLoading = useSetAtom(marketFeedLoadingAtom);
  const setError = useSetAtom(marketFeedErrorAtom);
  const setLastUpdated = useSetAtom(marketFeedLastUpdatedAtom);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const fetchMarketFeed = async () => {
    // Prevent concurrent requests
    if (isPollingRef.current) {
      return;
    }

    try {
      isPollingRef.current = true;
      setLoading(true);
      setError(null);

      const data = await marketFeedService.getMarketFeed();
      setMarketFeedData(data);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Error polling market feed:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setLoading(false);
      isPollingRef.current = false;
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchMarketFeed();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      fetchMarketFeed();
    }, POLLING_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Empty deps - only run once on mount

  return {
    refetch: fetchMarketFeed,
  };
}
