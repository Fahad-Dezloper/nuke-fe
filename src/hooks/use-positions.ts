/**
 * Hook to fetch and manage positions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  positionsService,
  transformPositionData,
  type PositionApiResponse,
} from '@/lib/api/services';
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
  const [positions, setPositions] = useState<ArbitragePosition[]>([]);
  const [rawPositions, setRawPositions] = useState<PositionApiResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!enabled || !evmAddress || !solanaAddress) {
      setPositions([]);
      setRawPositions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rawData = await positionsService.getOpenPositionsRaw(evmAddress, solanaAddress);
      setRawPositions(rawData);
      setPositions(rawData.map(transformPositionData));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch positions'));
      setPositions([]);
      setRawPositions([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, evmAddress, solanaAddress]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    rawPositions,
    loading,
    error,
    refetch: fetchPositions,
  };
}
