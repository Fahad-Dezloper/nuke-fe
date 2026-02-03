/**
 * Hook for USDC Balance on Base
 * Provides easy access to USDC balance state and actions
 */

'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
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
import { useCallback } from 'react';

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
   * Only recreates when login state or wallet count changes
   */
  const refresh = useCallback(async () => {
    if (turnkeyState.isLoggedIn && turnkeyState.userWallets && turnkeyState.userWallets.length > 0) {
      await fetchBalanceFromTurnkey(turnkeyState.userWallets);
    }
  }, [turnkeyState.isLoggedIn, turnkeyState.userWallets?.length, fetchBalanceFromTurnkey]);

  /**
   * Refresh balance using specific wallet address
   */
  const refreshWithAddress = useCallback(async (address: string) => {
    await fetchBalance(address);
  }, [fetchBalance]);

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
