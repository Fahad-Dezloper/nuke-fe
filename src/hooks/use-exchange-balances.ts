/**
 * Hook to fetch exchange margin balances (Hyperliquid + Pacifica)
 * and combine with Base USDC wallet balance.
 *
 * Used by the position controls to validate margin input.
 */

'use client';

import { useEffect } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import { queryKeys } from '@/lib/query-keys';
import { HyperLiquidService } from '@/lib/services/hyperliquid/hyperliquid.service';
import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { usdcBalanceBaseAtom } from '@/lib/stores/usdc-balance.store';
import { formatUSDCBalance } from '@/lib/bridge/balance';
import {
  hlBalanceAtom,
  pacBalanceAtom,
  baseBalanceAtom,
} from '@/components/features/position-controls/store';

const hlService = new HyperLiquidService();
const pacService = new PacificaService();

export interface ExchangeBalances {
  /** Hyperliquid withdrawable (free margin) in USD */
  hlBalance: number;
  /** Pacifica available_to_spend (free margin) in USD */
  pacBalance: number;
  /** Base USDC wallet balance in USD */
  baseBalance: number;
  isLoading: boolean;
  error: Error | null;
}

export function useExchangeBalances(): ExchangeBalances {
  const { state: turnkeyState } = useTurnkey();

  const setHlBalance = useSetAtom(hlBalanceAtom);
  const setPacBalance = useSetAtom(pacBalanceAtom);
  const setBaseBalance = useSetAtom(baseBalanceAtom);

  // Read Base USDC balance from existing atom (set by useUSDCBalanceBase hook)
  const baseBalanceRaw = useAtomValue(usdcBalanceBaseAtom);

  const evmAddress = turnkeyState.userWallets?.length
    ? getEVMAddress(turnkeyState.userWallets)
    : null;
  const solanaAddress = turnkeyState.userWallets?.length
    ? getSolanaAddress(turnkeyState.userWallets)
    : null;

  const isEnabled = turnkeyState.isLoggedIn && !!evmAddress && !!solanaAddress;

  const query = useQuery({
    queryKey: queryKeys.balance.exchangeBalances(evmAddress ?? '', solanaAddress ?? ''),
    queryFn: async () => {
      const [hlResult, pacResult] = await Promise.allSettled([
        hlService.fetchAccountBalance(evmAddress!),
        pacService.fetchAccountBalance(solanaAddress!),
      ]);

      const hl =
        hlResult.status === 'fulfilled' && hlResult.value.success
          ? hlResult.value.withdrawable
          : 0;
      const pac =
        pacResult.status === 'fulfilled' && pacResult.value.success
          ? pacResult.value.availableToSpend
          : 0;

      return { hl, pac };
    },
    enabled: isEnabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const hlBalance = query.data?.hl ?? 0;
  const pacBalance = query.data?.pac ?? 0;

  // Convert Base USDC from bigint (6 decimals) to USD number
  const baseBalance = baseBalanceRaw !== null
    ? parseFloat(formatUSDCBalance(baseBalanceRaw))
    : 0;

  // Sync to Jotai atoms so other components can read without prop drilling
  useEffect(() => {
    setHlBalance(hlBalance);
  }, [hlBalance, setHlBalance]);

  useEffect(() => {
    setPacBalance(pacBalance);
  }, [pacBalance, setPacBalance]);

  useEffect(() => {
    setBaseBalance(baseBalance);
  }, [baseBalance, setBaseBalance]);

  return {
    hlBalance,
    pacBalance,
    baseBalance,
    isLoading: query.isLoading,
    error: query.error,
  };
}
