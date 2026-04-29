/**
 * Hook to fetch the portfolio PnL chart time series for a given timeframe.
 * Refetches when the timeframe changes; poll cadence relaxes for longer windows.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  portfolioService,
  type PerformanceTimeframe,
  type PnlChartResponse,
} from '@/lib/api/services';
import { queryKeys } from '@/lib/query-keys';

interface UsePortfolioPnlChartOptions {
  evmAddress?: string;
  solanaAddress?: string;
  timeframe: PerformanceTimeframe;
  enabled?: boolean;
}

interface UsePortfolioPnlChartReturn {
  data: PnlChartResponse | undefined;
  loading: boolean;
  error: Error | null;
}

const POLL_INTERVAL_MS: Record<PerformanceTimeframe, number> = {
  day: 15_000,
  week: 60_000,
  month: 5 * 60_000,
  all: 10 * 60_000,
};

const STALE_TIME_MS: Record<PerformanceTimeframe, number> = {
  day: 10_000,
  week: 30_000,
  month: 2 * 60_000,
  all: 5 * 60_000,
};

export function usePortfolioPnlChart(
  options: UsePortfolioPnlChartOptions
): UsePortfolioPnlChartReturn {
  const { evmAddress, solanaAddress, timeframe, enabled = true } = options;

  const query = useQuery({
    queryKey: queryKeys.portfolio.pnlChart(evmAddress ?? '', solanaAddress ?? '', timeframe),
    queryFn: ({ signal }) =>
      portfolioService.getPnlChart(evmAddress!, solanaAddress!, timeframe, signal),
    enabled: enabled && !!evmAddress && !!solanaAddress,
    staleTime: STALE_TIME_MS[timeframe],
    refetchInterval: POLL_INTERVAL_MS[timeframe],
  });

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.error,
  };
}
