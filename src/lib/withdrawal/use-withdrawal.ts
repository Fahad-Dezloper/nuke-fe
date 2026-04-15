/**
 * useWithdrawal — React Hook
 *
 * The main integration point for components.
 * Wraps the WithdrawalEngine with React state management
 * and provides resumability via localStorage.
 *
 * Usage:
 *   const { startWithdrawal, phase, detail, ... } = useWithdrawal();
 *
 *   await startWithdrawal({ exchange: 'hyperliquid', amountUsd: 100 });
 *
 *   // On page reload: hook auto-resumes if there's an active intent
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getWalletContext } from '@/lib/wallet-context';
import { queryKeys } from '@/lib/query-keys';
import { withdrawalApi } from './api';
import { WithdrawalEngine, type EngineCallbacks } from './engine';
import type { ExecutorContext } from './action-executor';
import type {
  WithdrawalAction,
  WithdrawalStatus,
  WithdrawalIntentDetail,
  WithdrawalExchange,
  WithdrawalPhase,
} from './types';
import { ACTIVE_WITHDRAWAL_INTENT_KEY, toExchangeName } from './types';

// ─── LocalStorage helpers ────────────────────────────────────────────────────

const LS_KEY = ACTIVE_WITHDRAWAL_INTENT_KEY;

function storeActiveIntentId(id: string): void {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch { /* noop */ }
}

function loadActiveIntentId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function clearActiveIntentId(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch { /* noop */ }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StartWithdrawalParams {
  exchange: WithdrawalExchange;
  amountUsd: number;
  /** Destination address on Solana. Defaults to user's Solana address. */
  recipient?: string;
}

export interface UseWithdrawalReturn {
  startWithdrawal: (params: StartWithdrawalParams) => Promise<void>;
  resume: (intentId: string) => Promise<void>;
  abort: () => void;
  isExecuting: boolean;
  phase: WithdrawalPhase;
  statusMessage: string;
  currentAction: WithdrawalAction | null;
  detail: WithdrawalIntentDetail | null;
  intentId: string | null;
  error: string | null;
  refreshDetail: () => Promise<void>;
}

// ─── Terminal statuses (don't resume these) ──────────────────────────────────

const TERMINAL_STATUSES: WithdrawalStatus[] = ['COMPLETED', 'FAILED'];

const IN_PROGRESS_STATUSES: WithdrawalStatus[] = [
  'CREATED', 'WITHDRAWING', 'WITHDRAWN', 'BRIDGING',
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWithdrawal(): UseWithdrawalReturn {
  const { state: turnkeyState } = useTurnkey();
  const queryClient = useQueryClient();

  // ── State ───────────────────────────────────────────────────
  const [isExecuting, setIsExecuting] = useState(false);
  const [phase, setPhase] = useState<WithdrawalPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentAction, setCurrentAction] = useState<WithdrawalAction | null>(null);
  const [detail, setDetail] = useState<WithdrawalIntentDetail | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────
  const engineRef = useRef<WithdrawalEngine | null>(null);
  const isRunningRef = useRef(false);
  const resumeAttemptedRef = useRef(false);
  // Store exchange for resumability (engine needs it)
  const exchangeRef = useRef<WithdrawalExchange>('hyperliquid');

  // ── Build executor context from Turnkey state ──────────────
  const buildContext = useCallback((): ExecutorContext => {
    const wallet = getWalletContext(turnkeyState);
    return {
      evmAddress: wallet.evmAddress,
      solanaAddress: wallet.solanaAddress,
      organizationId: wallet.organizationId,
    };
  }, [turnkeyState]);

  // ── Build engine callbacks ─────────────────────────────────
  const buildCallbacks = useCallback(
    (withdrawalIntentId: string): EngineCallbacks => ({
      onActionStart: (action) => {
        setCurrentAction(action);
      },

      onActionComplete: (_action, success) => {
        if (!success) {
          console.warn(`[useWithdrawal] Action ${_action} failed — engine will stop and show error`);
        }
        withdrawalApi.getDetail(withdrawalIntentId)
          .then(setDetail)
          .catch(() => { /* non-critical */ });
      },

      onStatusChange: (phaseStr, detailMsg) => {
        setPhase(phaseStr as WithdrawalPhase);
        if (detailMsg) setStatusMessage(detailMsg);
      },

      onError: (errorMsg) => {
        setError(errorMsg);
        setPhase('failed');
        setIsExecuting(false);
        isRunningRef.current = false;
        setCurrentAction(null);
        clearActiveIntentId();
        toast.error('Withdrawal Failed', {
          description: errorMsg || 'An unexpected error occurred.',
          duration: 8000,
        });
      },

      onComplete: (_id, finalStatus) => {
        if (finalStatus === 'COMPLETED') {
          setPhase('completed');
          setStatusMessage('Withdrawal complete!');
          const wallet = getWalletContext(turnkeyState);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.balance.exchangeHlPac(wallet.evmAddress, wallet.solanaAddress),
          });

          toast.success('Withdrawal Complete', {
            description: 'Funds have been withdrawn to your Solana wallet.',
            closeButton: true,
            duration: 6000,
          });

          setTimeout(() => {
            setPhase('idle');
            setStatusMessage('');
            setDetail(null);
            setIntentId(null);
          }, 5_000);
        } else {
          setPhase('failed');
          setStatusMessage(`Withdrawal ${finalStatus.toLowerCase()}`);
          toast.error('Withdrawal Failed', {
            description: `Withdrawal intent ${finalStatus.toLowerCase()}.`,
            duration: 8000,
          });
        }
        setIsExecuting(false);
        isRunningRef.current = false;
        setCurrentAction(null);
        clearActiveIntentId();

        withdrawalApi.getDetail(_id)
          .then(setDetail)
          .catch(() => { /* non-critical */ });
      },
    }),
    [queryClient, turnkeyState]
  );

  // ── Run the engine ─────────────────────────────────────────
  const runEngine = useCallback(
    async (withdrawalIntentId: string) => {
      if (isRunningRef.current) {
        console.warn('[useWithdrawal] Engine already running');
        return;
      }

      try {
        const context = buildContext();

        setIntentId(withdrawalIntentId);
        setIsExecuting(true);
        setError(null);
        setPhase('creating');
        isRunningRef.current = true;

        try {
          const initialDetail = await withdrawalApi.getDetail(withdrawalIntentId);
          setDetail(initialDetail);
          exchangeRef.current = initialDetail.intent.exchange;
        } catch {
          /* continue without detail — engine will handle it */
        }

        const engine = new WithdrawalEngine();
        engineRef.current = engine;

        const callbacks = buildCallbacks(withdrawalIntentId);
        await engine.run(withdrawalIntentId, context, exchangeRef.current, callbacks);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setPhase('failed');
        setIsExecuting(false);
        isRunningRef.current = false;
        toast.error('Withdrawal Error', {
          description: errorMessage,
          duration: 8000,
        });
      }
    },
    [buildContext, buildCallbacks]
  );

  // ── Public: Start a new withdrawal ─────────────────────────
  const startWithdrawal = useCallback(
    async (params: StartWithdrawalParams) => {
      setError(null);
      setPhase('creating');
      setStatusMessage('Creating withdrawal intent...');
      setIsExecuting(true);

      try {
        const context = buildContext();
        exchangeRef.current = params.exchange;

        const newIntentId = await withdrawalApi.create({
          exchange: toExchangeName(params.exchange),
          amount_usd: params.amountUsd,
          recipient: params.recipient || context.solanaAddress,
          destination_chain_id: 792703809,
        });

        storeActiveIntentId(newIntentId);

        await runEngine(newIntentId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setPhase('failed');
        setIsExecuting(false);
        toast.error('Failed to Create Withdrawal', {
          description: errorMessage,
          duration: 8000,
        });
      }
    },
    [buildContext, runEngine]
  );

  // ── Public: Resume an existing intent ──────────────────────
  const resume = useCallback(
    async (existingIntentId: string) => {
      setError(null);
      setStatusMessage('Resuming withdrawal...');
      await runEngine(existingIntentId);
    },
    [runEngine]
  );

  // ── Public: Abort ──────────────────────────────────────────
  const abort = useCallback(() => {
    engineRef.current?.abort();
    setIsExecuting(false);
    isRunningRef.current = false;
    setCurrentAction(null);
    setStatusMessage('Withdrawal paused. You can safely close this window.');
  }, []);

  // ── Public: Refresh detail ─────────────────────────────────
  const refreshDetail = useCallback(async () => {
    if (!intentId) return;
    try {
      const freshDetail = await withdrawalApi.getDetail(intentId);
      setDetail(freshDetail);
    } catch (err) {
      console.warn('[useWithdrawal] Failed to refresh detail:', err);
    }
  }, [intentId]);

  // ── Auto-resume on mount ───────────────────────────────────
  useEffect(() => {
    if (resumeAttemptedRef.current || !turnkeyState.isLoggedIn || isRunningRef.current) {
      return;
    }
    resumeAttemptedRef.current = true;

    const storedIntentId = loadActiveIntentId();
    if (!storedIntentId) return;

    withdrawalApi
      .getDetail(storedIntentId)
      .then((storedDetail) => {
        const status = storedDetail.intent.status;
        if (IN_PROGRESS_STATUSES.includes(status)) {
          console.log(`[useWithdrawal] Resuming intent ${storedIntentId} (status: ${status})`);
          setDetail(storedDetail);
          exchangeRef.current = storedDetail.intent.exchange;
          resume(storedIntentId);
        } else if (TERMINAL_STATUSES.includes(status)) {
          setDetail(storedDetail);
          setIntentId(storedIntentId);
          setPhase(status === 'COMPLETED' ? 'completed' : 'failed');
          clearActiveIntentId();
        }
      })
      .catch(() => {
        clearActiveIntentId();
      });
  }, [turnkeyState.isLoggedIn, resume]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      engineRef.current?.abort();
    };
  }, []);

  return {
    startWithdrawal,
    resume,
    abort,
    isExecuting,
    phase,
    statusMessage,
    currentAction,
    detail,
    intentId,
    error,
    refreshDetail,
  };
}
