/**
 * Hook to fetch and manage positions using React Query.
 *
 * Handles automatic caching, deduplication, and cancellation via AbortSignal.
 * Stale responses can no longer overwrite fresh data.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import {
  positionsService,
  transformPositionData,
  type PositionApiResponse,
} from '@/lib/api/services';
import { queryKeys } from '@/lib/query-keys';
import type { ArbitragePosition } from '@/types/positions';

interface UsePositionsOptions {
  evmAddress?: string;
  solanaAddress?: string;
  enabled?: boolean;
}

interface UsePositionsReturn {
  positions: ArbitragePosition[];
  /** Raw API responses — needed for close position (contains size, side per protocol) */
  rawPositions: PositionApiResponse[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePositions(options: UsePositionsOptions = {}): UsePositionsReturn {
  const { evmAddress, solanaAddress, enabled = true } = options;

  const query = useQuery({
    queryKey: queryKeys.positions.open(evmAddress ?? '', solanaAddress ?? ''),
    queryFn: async () => {
      const rawData = await positionsService.getOpenPositionsRaw(evmAddress!, solanaAddress!);
      return rawData;
    },
    enabled: enabled && !!evmAddress && !!solanaAddress,
    staleTime: 2_000,
    // Poll every 3s when there are open positions, otherwise every 30s
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && data.length > 0 ? 3_000 : 30_000;
    },
  });

  const rawPositions = query.data ?? [];
  const positions = rawPositions.map(transformPositionData);

  return {
    positions,
    rawPositions,
    loading: query.isLoading,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}
