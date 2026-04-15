'use client';

import { useEffect, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { getUSDCBalanceOnSolana } from '@/lib/bridge/balance-api';
import { formatUSDCBalance } from '@/lib/bridge/balance';
import {
  usdcBalanceSolanaAtom,
  usdcBalanceSolanaLoadingAtom,
  usdcBalanceSolanaErrorAtom,
  usdcBalanceSolanaLastUpdatedAtom,
} from '@/lib/stores/usdc-balance.store';
import { queryKeys } from '@/lib/query-keys';

export function useUSDCBalanceSolana() {
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();

  const setBalance = useSetAtom(usdcBalanceSolanaAtom);
  const setLoading = useSetAtom(usdcBalanceSolanaLoadingAtom);
  const setError = useSetAtom(usdcBalanceSolanaErrorAtom);
  const setLastUpdated = useSetAtom(usdcBalanceSolanaLastUpdatedAtom);

  const solanaAddress = turnkeyState.userWallets?.length
    ? getSolanaAddress(turnkeyState.userWallets)
    : null;

  const isEnabled = turnkeyState.isLoggedIn && !!solanaAddress;

  const query = useQuery({
    queryKey: queryKeys.balance.usdcSolana(solanaAddress ?? ''),
    queryFn: async () => getUSDCBalanceOnSolana(solanaAddress!),
    enabled: isEnabled,
    staleTime: 15_000,
    gcTime: 60_000,
  });

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

  const refresh = useCallback(async () => {
    if (isEnabled) await query.refetch();
  }, [isEnabled, query]);

  const refreshWithAddress = useCallback(
    async (address: string) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.balance.usdcSolana(address) });
    },
    [queryClient]
  );

  return {
    balance,
    formattedBalance,
    isLoading: query.isLoading,
    error: query.error,
    lastUpdated: useAtomValue(usdcBalanceSolanaLastUpdatedAtom),
    refresh,
    refreshWithAddress,
  };
}

