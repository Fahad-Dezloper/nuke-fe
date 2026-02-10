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
    staleTime: 15_000, // Positions are relatively stable — 15s staleness
    refetchInterval: 30_000, // Auto-refresh every 30s
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
