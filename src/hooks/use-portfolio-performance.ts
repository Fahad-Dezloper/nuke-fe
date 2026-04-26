/**
 * Hook to fetch aggregate portfolio performance for all four timeframes.
 * The response covers Day / Week / Month / All in one payload, so switching
 * tabs in the UI does not refetch.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { portfolioService, type PerformanceResponse } from '@/lib/api/services';
import { queryKeys } from '@/lib/query-keys';

interface UsePortfolioPerformanceOptions {
  evmAddress?: string;
  solanaAddress?: string;
  enabled?: boolean;
}

interface UsePortfolioPerformanceReturn {
  data: PerformanceResponse | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePortfolioPerformance(
  options: UsePortfolioPerformanceOptions = {}
): UsePortfolioPerformanceReturn {
  const { evmAddress, solanaAddress, enabled = true } = options;

  const query = useQuery({
    queryKey: queryKeys.portfolio.performance(evmAddress ?? '', solanaAddress ?? ''),
    queryFn: ({ signal }) =>
      portfolioService.getPerformance(evmAddress!, solanaAddress!, signal),
    enabled: enabled && !!evmAddress && !!solanaAddress,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}
