/**
 * useWithdrawal — client-orchestrated withdrawals (same model as useFundExchange).
 *
 * Hyperliquid: Relay bridge perps USDC → Solana (chain 1337 → 792703809)
 * Pacifica / Phoenix: direct to Solana USDC
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getWalletContext } from '@/lib/wallet-context';
import { invalidateTradingBalances } from '@/lib/trading/invalidate-trading-balances';
import {
  bridgeHyperliquidToSolana,
  withdrawFromPacifica,
  withdrawFromPhoenix,
  loadWithdrawResumeState,
  storeWithdrawResumeState,
  clearWithdrawResumeState,
  type WithdrawWalletContext,
} from './client-withdraw';
import type { WithdrawalExchange, WithdrawPhase, StartWithdrawalParams } from './types';

const MIN_WITHDRAW_USD = 1;

export interface UseWithdrawalReturn {
  startWithdrawal: (params: StartWithdrawalParams) => Promise<void>;
  reset: () => void;
  isExecuting: boolean;
  phase: WithdrawPhase;
  statusMessage: string;
  activeExchange: WithdrawalExchange | null;
  error: string | null;
}

export type { StartWithdrawalParams };

function getExchangeLabel(exchange: WithdrawalExchange): string {
  if (exchange === 'hyperliquid') return 'Hyperliquid';
  if (exchange === 'phoenix') return 'Phoenix';
  if (exchange === 'lighter') return 'Lighter';
  return 'Pacifica';
}

export function useWithdrawal(): UseWithdrawalReturn {
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();
  const isRunningRef = useRef(false);
  const resumeAttemptedRef = useRef(false);

  const [phase, setPhase] = useState<WithdrawPhase>('idle');
  const [isExecuting, setIsExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [activeExchange, setActiveExchange] = useState<WithdrawalExchange | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setIsExecuting(false);
    setStatusMessage('');
    setActiveExchange(null);
    setError(null);
    isRunningRef.current = false;
  }, []);

  const runHyperliquidWithdraw = useCallback(
    async (
      ctx: WithdrawWalletContext,
      amountUsd: number,
      bridgeRequestId?: string
    ) => {
      const label = getExchangeLabel('hyperliquid');

      if (!bridgeRequestId) {
        setPhase('getting-quote');
        setStatusMessage(`Getting Relay quote (${label} → Solana)...`);
        setPhase('signing');
        setStatusMessage('Sign to move USDC from Hyperliquid to your Solana wallet...');
      }

      setPhase('bridging');
      setStatusMessage('Bridging USDC to Solana via Relay...');

      const requestId = await bridgeHyperliquidToSolana(ctx, amountUsd, bridgeRequestId);

      storeWithdrawResumeState({
        exchange: 'hyperliquid',
        step: 'bridging',
        amountUsd,
        bridgeRequestId: requestId,
      });

      setPhase('waiting-bridge');
      setStatusMessage('Confirming transfer to Solana...');

      clearWithdrawResumeState();
    },
    []
  );

  const completeSuccess = useCallback(
    async (ctx: WithdrawWalletContext, exchange: WithdrawalExchange, amountUsd: number) => {
      const label = getExchangeLabel(exchange);
      setPhase('completed');
      setStatusMessage('Withdrawal complete!');
      setIsExecuting(false);
      isRunningRef.current = false;
      clearWithdrawResumeState();

      await invalidateTradingBalances(queryClient, ctx);

      toast.success('Withdrawal Complete', {
        description: `$${amountUsd.toFixed(2)} USDC sent to your Solana wallet from ${label}.`,
        duration: 6000,
      });

      setTimeout(() => {
        setPhase('idle');
        setStatusMessage('');
        setActiveExchange(null);
      }, 4_000);
    },
    [queryClient]
  );

  const fail = useCallback((errMsg: string) => {
    setError(errMsg);
    setPhase('failed');
    setIsExecuting(false);
    isRunningRef.current = false;
    clearWithdrawResumeState();
    toast.error('Withdrawal Failed', { description: errMsg, duration: 8000 });
  }, []);

  const startWithdrawal = useCallback(
    async (params: StartWithdrawalParams) => {
      if (isRunningRef.current) return;
      if (params.exchange === 'lighter') {
        fail('Lighter withdrawal is not supported yet.');
        return;
      }

      if (!Number.isFinite(params.amountUsd) || params.amountUsd < MIN_WITHDRAW_USD) {
        fail(`Minimum withdrawal is $${MIN_WITHDRAW_USD} USDC.`);
        return;
      }

      isRunningRef.current = true;
      setError(null);
      setIsExecuting(true);
      setActiveExchange(params.exchange);

      const label = getExchangeLabel(params.exchange);

      try {
        const wallet = getWalletContext(turnkeyState);
        const ctx: WithdrawWalletContext = {
          evmAddress: wallet.evmAddress,
          solanaAddress: params.recipient || wallet.solanaAddress,
          organizationId: wallet.organizationId,
        };

        if (params.exchange === 'phoenix') {
          setPhase('withdrawing');
          setStatusMessage(`Withdrawing from ${label} to Solana...`);
          await withdrawFromPhoenix(ctx, params.amountUsd);
          await completeSuccess(ctx, params.exchange, params.amountUsd);
          return;
        }

        if (params.exchange === 'pacifica') {
          setPhase('withdrawing');
          setStatusMessage(`Withdrawing from ${label} to Solana...`);
          await withdrawFromPacifica(ctx, params.amountUsd);
          await completeSuccess(ctx, params.exchange, params.amountUsd);
          return;
        }

        await runHyperliquidWithdraw(ctx, params.amountUsd);
        await completeSuccess(ctx, params.exchange, params.amountUsd);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        fail(errMsg);
        setStatusMessage(`Failed to withdraw from ${label}`);
      }
    },
    [turnkeyState, runHyperliquidWithdraw, completeSuccess, fail]
  );

  const resumeIfNeeded = useCallback(async () => {
    const stored = loadWithdrawResumeState();
    if (!stored || stored.exchange !== 'hyperliquid') return;

    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsExecuting(true);
    setActiveExchange('hyperliquid');
    setError(null);

    try {
      const wallet = getWalletContext(turnkeyState);
      const ctx: WithdrawWalletContext = {
        evmAddress: wallet.evmAddress,
        solanaAddress: wallet.solanaAddress,
        organizationId: wallet.organizationId,
      };

      setStatusMessage('Resuming Hyperliquid → Solana bridge...');
      await runHyperliquidWithdraw(ctx, stored.amountUsd, stored.bridgeRequestId);
      await completeSuccess(ctx, 'hyperliquid', stored.amountUsd);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      fail(errMsg);
    }
  }, [turnkeyState, runHyperliquidWithdraw, completeSuccess, fail]);

  useEffect(() => {
    if (resumeAttemptedRef.current || !turnkeyState.isLoggedIn) return;
    resumeAttemptedRef.current = true;
    const stored = loadWithdrawResumeState();
    if (stored) {
      void resumeIfNeeded();
    }
  }, [turnkeyState.isLoggedIn, resumeIfNeeded]);

  return {
    startWithdrawal,
    reset,
    isExecuting,
    phase,
    statusMessage,
    activeExchange,
    error,
  };
}
