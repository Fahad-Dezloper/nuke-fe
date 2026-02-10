/**
 * React Query Client Configuration
 *
 * Centralized QueryClient with sensible defaults for a trading terminal:
 * - Short staleTime for market data (prices change frequently)
 * - Retry with exponential backoff for network resilience
 * - gcTime to keep cache around during tab switches
 */

import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 10 seconds
        staleTime: 10 * 1000,
        // Cache is kept for 5 minutes after last subscriber unmounts
        gcTime: 5 * 60 * 1000,
        // Retry up to 2 times with exponential backoff
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
        // Don't refetch on window focus by default (market feed has its own polling)
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Don't retry mutations (trading operations should be explicit)
        retry: false,
      },
    },
  });
}

// Singleton for use across the app — created lazily to avoid SSR issues
let _queryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!_queryClient) {
    _queryClient = createQueryClient();
  }
  return _queryClient;
}
