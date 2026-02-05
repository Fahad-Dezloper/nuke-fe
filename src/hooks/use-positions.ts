/**
 * Hook to fetch and manage positions
 */

import { useState, useEffect } from 'react';
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
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hardcoded test data matching the API response format
 */
const HARDCODED_TEST_DATA: PositionApiResponse[] = [
  {
    symbol: 'SOL',
    hyperliquid: {
      symbol: 'SOL',
      size: '18.023',
      side: 'Short',
      pnl: '214.940815',
      funding: '64.149738',
      margin: '1800.32',
      leverage: 5,
      liquidationPrice: '3294.6049140528',
    },
    pacifica: {
      symbol: 'SOL',
      size: '18.023',
      side: 'Long',
      pnl: '-212.659',
      funding: '-13.552109',
      margin: '1788',
      leverage: 5,
      liquidationPrice: '-2900.506504',
    },
  },
];

export function usePositions(options: UsePositionsOptions = {}): UsePositionsReturn {
  const { evmAddress, solanaAddress, enabled = true } = options;
  const [positions, setPositions] = useState<ArbitragePosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      // For testing: use hardcoded data
      // TODO: Replace with actual API call once ready
      // if (evmAddress && solanaAddress) {
      //   const data = await positionsService.getOpenPositions(evmAddress, solanaAddress);
      //   setPositions(data);
      // } else {
      //   setPositions([]);
      // }

      // For testing: use hardcoded data and transform it using the service's transform function
      const transformedData = HARDCODED_TEST_DATA.map(transformPositionData);
      setPositions(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch positions'));
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [enabled, evmAddress, solanaAddress]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
  };
}
