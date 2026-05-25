/**
 * Hook to fetch exchange margin balances (Hyperliquid, Pacifica, Backpack, Lighter)
 * and combine with Solana USDC wallet balance.
 *
 * Backpack authenticated reads are DISABLED for demo (Turnkey cost + CORS).
 * Backpack is display-only; we do not fetch signed Backpack balances in FE.
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
import { PhoenixService } from '@/lib/services/phoenix/phoenix.service';
import { fetchLighterAvailableUsd } from '@/lib/services/lighter/lighter-reads';
import { tryApplyStoredLighterCredentials } from '@/lib/services/lighter/lighter-onboarding';
import { usdcBalanceSolanaAtom } from '@/lib/stores/usdc-balance.store';
import { formatUSDCBalance } from '@/lib/bridge/balance';
import {
  hlBalanceAtom,
  pacBalanceAtom,
  phxBalanceAtom,
  bpBalanceAtom,
  ltBalanceAtom,
  baseBalanceAtom,
} from '@/components/features/position-controls/store';

const hlService = new HyperLiquidService();
const pacService = new PacificaService();
const phoenixBalanceService = new PhoenixService();

export interface ExchangeBalances {
  /** Hyperliquid withdrawable (free margin) in USD */
  hlBalance: number;
  /** Pacifica available_to_spend (free margin) in USD */
  pacBalance: number;
  /** Backpack USDC available (perp collateral) in USD */
  bpBalance: number;
  /** Lighter available USDC (perp collateral) in USD */
  ltBalance: number;
  /** Phoenix free collateral (USDC) in USD */
  phoenixBalance: number;
  /** Solana USDC wallet balance in USD */
  solanaBalance: number;
  isLoading: boolean;
  error: Error | null;
}

export function useExchangeBalances(): ExchangeBalances {
  const { state: turnkeyState } = useTurnkey();

  const setHlBalance = useSetAtom(hlBalanceAtom);
  const setPacBalance = useSetAtom(pacBalanceAtom);
  const setPhxBalance = useSetAtom(phxBalanceAtom);
  const setBpBalance = useSetAtom(bpBalanceAtom);
  const bpBalance = useAtomValue(bpBalanceAtom);
  const setLtBalance = useSetAtom(ltBalanceAtom);
  const setBaseBalance = useSetAtom(baseBalanceAtom);

  // Read Solana USDC balance from existing atom (set by useUSDCBalanceSolana hook)
  const solanaBalanceRaw = useAtomValue(usdcBalanceSolanaAtom);

  const evmAddress = turnkeyState.userWallets?.length
    ? getEVMAddress(turnkeyState.userWallets)
    : null;
  const solanaAddress = turnkeyState.userWallets?.length
    ? getSolanaAddress(turnkeyState.userWallets)
    : null;

  const orgId = turnkeyState.turnkeySubOrgId ?? '';
  const isEnabled = turnkeyState.isLoggedIn && !!evmAddress && !!solanaAddress;
  void orgId;

  useEffect(() => {
    if (evmAddress) tryApplyStoredLighterCredentials(evmAddress);
  }, [evmAddress]);

  const hlPacQuery = useQuery({
    queryKey: queryKeys.balance.exchangeHlPac(evmAddress ?? '', solanaAddress ?? ''),
    queryFn: async () => {
      const [hlResult, pacResult, phxResult, ltResult] = await Promise.allSettled([
        hlService.fetchAccountBalance(evmAddress!),
        pacService.fetchAccountBalance(solanaAddress!),
        phoenixBalanceService.fetchFreeCollateralUsd(solanaAddress!),
        fetchLighterAvailableUsd(evmAddress!),
      ]);

      const hl =
        hlResult.status === 'fulfilled' && hlResult.value.success
          ? hlResult.value.withdrawable
          : 0;
      const pac =
        pacResult.status === 'fulfilled' && pacResult.value.success
          ? pacResult.value.availableToSpend
          : 0;
      const phx =
        phxResult.status === 'fulfilled' && phxResult.value.success ? phxResult.value.usd : 0;
      const lt = ltResult.status === 'fulfilled' ? ltResult.value : 0;

      return { hl, pac, phx, lt };
    },
    enabled: isEnabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    // Backpack is display-only for now (no signed balanceQuery).
    setBpBalance(0);
  }, [setBpBalance, solanaAddress, turnkeyState.isLoggedIn]);

  const hlBalance = hlPacQuery.data?.hl ?? 0;
  const pacBalance = hlPacQuery.data?.pac ?? 0;
  const phoenixBalance = hlPacQuery.data?.phx ?? 0;
  const ltBalance = hlPacQuery.data?.lt ?? 0;

  const solanaBalance = solanaBalanceRaw !== null
    ? parseFloat(formatUSDCBalance(solanaBalanceRaw))
    : 0;

  useEffect(() => {
    setHlBalance(hlBalance);
  }, [hlBalance, setHlBalance]);

  useEffect(() => {
    setPacBalance(pacBalance);
  }, [pacBalance, setPacBalance]);

  useEffect(() => {
    setPhxBalance(phoenixBalance);
  }, [phoenixBalance, setPhxBalance]);

  useEffect(() => {
    setLtBalance(ltBalance);
  }, [ltBalance, setLtBalance]);

  useEffect(() => {
    setBaseBalance(solanaBalance);
  }, [solanaBalance, setBaseBalance]);

  return {
    hlBalance,
    pacBalance,
    phoenixBalance,
    bpBalance,
    ltBalance,
    solanaBalance,
    isLoading: hlPacQuery.isLoading,
    error: hlPacQuery.error,
  };
}
