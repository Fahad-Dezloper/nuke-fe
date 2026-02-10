/**
 * Hook for USDC Balance on Base
 *
 * Uses React Query for data fetching with automatic deduplication,
 * stale data management, and cancellation.
 * Syncs to Jotai atoms for global consumption.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { getUSDCBalanceOnBase, formatUSDCBalance } from '@/lib/bridge/balance';
import {
  usdcBalanceBaseAtom,
  usdcBalanceBaseLoadingAtom,
  usdcBalanceBaseErrorAtom,
  usdcBalanceBaseLastUpdatedAtom,
} from '@/lib/stores/usdc-balance.store';
import { queryKeys } from '@/lib/query-keys';

/**
 * Hook for managing USDC balance on Base
 */
export function useUSDCBalanceBase() {
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();

  const setBalance = useSetAtom(usdcBalanceBaseAtom);
  const setLoading = useSetAtom(usdcBalanceBaseLoadingAtom);
  const setError = useSetAtom(usdcBalanceBaseErrorAtom);
  const setLastUpdated = useSetAtom(usdcBalanceBaseLastUpdatedAtom);

  // Extract EVM address (stable reference unless wallets change)
  const evmAddress = turnkeyState.userWallets?.length
    ? getEVMAddress(turnkeyState.userWallets)
    : null;

  const isEnabled = turnkeyState.isLoggedIn && !!evmAddress;

  const query = useQuery({
    queryKey: queryKeys.balance.usdcBase(evmAddress ?? ''),
    queryFn: async () => {
      const balance = await getUSDCBalanceOnBase(evmAddress! as `0x${string}`);
      return balance;
    },
    enabled: isEnabled,
    staleTime: 15_000, // Balance is valid for 15 seconds
    gcTime: 60_000,
  });

  // Sync to Jotai atoms
  useEffect(() => {
    if (query.data !== undefined) {
      setBalance(query.data);
      setLastUpdated(Date.now());
    } else if (!isEnabled) {
      setBalance(null);
    }
  }, [query.data, isEnabled, setBalance, setLastUpdated]);

  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  useEffect(() => {
    setError(query.error ?? null);
  }, [query.error, setError]);

  const balance = query.data ?? null;
  const formattedBalance = balance !== null ? formatUSDCBalance(balance) : '0.00';

  /**
   * Refresh balance
   */
  const refresh = useCallback(async () => {
    if (isEnabled) {
      await query.refetch();
    }
  }, [isEnabled, query]);

  /**
   * Refresh balance using specific wallet address
   */
  const refreshWithAddress = useCallback(
    async (address: string) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.balance.usdcBase(address),
      });
    },
    [queryClient]
  );

  return {
    balance,
    formattedBalance,
    isLoading: query.isLoading,
    error: query.error,
    lastUpdated: useAtomValue(usdcBalanceBaseLastUpdatedAtom),
    refresh,
    refreshWithAddress,
  };
}
