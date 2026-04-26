/**
 * Hook to fetch per-venue balances and equity, plus aggregated totals.
 * Backend always returns all 4 venue rows; FE renders `--` when a row's
 * values are null (disconnected, upstream errored, or `not_implemented`).
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { portfolioService, type ExchangesResponse } from '@/lib/api/services';
import { queryKeys } from '@/lib/query-keys';

interface UsePortfolioExchangesOptions {
  evmAddress?: string;
  solanaAddress?: string;
  enabled?: boolean;
}

interface UsePortfolioExchangesReturn {
  data: ExchangesResponse | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePortfolioExchanges(
  options: UsePortfolioExchangesOptions = {}
): UsePortfolioExchangesReturn {
  const { evmAddress, solanaAddress, enabled = true } = options;

  const query = useQuery({
    queryKey: queryKeys.portfolio.exchanges(evmAddress ?? '', solanaAddress ?? ''),
    queryFn: ({ signal }) =>
      portfolioService.getExchanges(evmAddress!, solanaAddress!, signal),
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
