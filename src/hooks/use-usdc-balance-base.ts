/**
 * Hook for USDC Balance on Base
 * Provides easy access to USDC balance state and actions
 */

'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import { useTurnkey } from '@/lib/turnkey/hooks';
import {
  usdcBalanceBaseAtom,
  usdcBalanceBaseFormattedAtom,
  usdcBalanceBaseLoadingAtom,
  usdcBalanceBaseErrorAtom,
  usdcBalanceBaseLastUpdatedAtom,
  fetchUSDCBalanceBaseAtom,
  fetchUSDCBalanceBaseFromTurnkeyAtom,
} from '@/lib/stores/usdc-balance.store';
import { useCallback, useEffect } from 'react';

/**
 * Hook for managing USDC balance on Base
 */
export function useUSDCBalanceBase() {
  const { state: turnkeyState } = useTurnkey();
  const balance = useAtomValue(usdcBalanceBaseAtom);
  const formattedBalance = useAtomValue(usdcBalanceBaseFormattedAtom);
  const isLoading = useAtomValue(usdcBalanceBaseLoadingAtom);
  const error = useAtomValue(usdcBalanceBaseErrorAtom);
  const lastUpdated = useAtomValue(usdcBalanceBaseLastUpdatedAtom);
  const fetchBalance = useSetAtom(fetchUSDCBalanceBaseAtom);
  const fetchBalanceFromTurnkey = useSetAtom(fetchUSDCBalanceBaseFromTurnkeyAtom);

  /**
   * Refresh balance using Turnkey wallet
   */
  const refresh = useCallback(async () => {
    if (
      turnkeyState.isLoggedIn &&
      turnkeyState.userWallets &&
      turnkeyState.userWallets.length > 0
    ) {
      await fetchBalanceFromTurnkey(turnkeyState.userWallets);
    }
  }, [turnkeyState.userWallets, turnkeyState.isLoggedIn, fetchBalanceFromTurnkey]);

  /**
   * Auto-fetch balance on login / wallet change.
   * The store already deduplicates within MIN_FETCH_INTERVAL_MS,
   * so it's safe for multiple components to mount this hook.
   */
  useEffect(() => {
    if (
      turnkeyState.isLoggedIn &&
      turnkeyState.userWallets &&
      turnkeyState.userWallets.length > 0
    ) {
      fetchBalanceFromTurnkey(turnkeyState.userWallets);
    }
  }, [turnkeyState.isLoggedIn, turnkeyState.userWallets, fetchBalanceFromTurnkey]);

  /**
   * Refresh balance using specific wallet address
   */
  const refreshWithAddress = useCallback(
    async (address: string) => {
      await fetchBalance(address);
    },
    [fetchBalance]
  );

  return {
    balance,
    formattedBalance,
    isLoading,
    error,
    lastUpdated,
    refresh,
    refreshWithAddress,
  };
}
