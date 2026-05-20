/**
 * useHedgeIntent — React Hook
 *
 * The main integration point for components.
 * Wraps the HedgeIntentEngine with React state management
 * and provides resumability via localStorage.
 *
 * Usage:
 *   const { openHedge, status, phase, detail, ... } = useHedgeIntent();
 *
 *   // User clicks "Open Hedged Position":
 *   await openHedge({ asset: 'BTC', marginUsd: 1000, leverage: 5, longExchange: 'pacifica', shortExchange: 'hyperliquid' });
 *
 *   // On page reload: hook auto-resumes if there's an active intent
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { marginAtom } from '@/components/features/position-controls/store';
import { useTurnkey } from '@/lib/turnkey/hooks';
import { getWalletContext } from '@/lib/wallet-context';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import {
  bestPairMetricAtom,
  selectedExchangesAtom,
  selectedVenuesList,
} from '@/lib/stores/arbitrage-table-filters.store';
import { marketFeedDataAtom } from '@/lib/stores/market-feed.store';
import { getBestPair } from '@/hooks/use-best-pair';
import { queryKeys } from '@/lib/query-keys';
import { isPhoenixTradingEnabled } from '@/lib/phoenix/env';
// Backpack authenticated balance refresh disabled (display-only demo).
// import { refreshBackpackMarginBalance } from '@/lib/stores/backpack-margin.store';
import { hedgeIntentApi } from './api';
import { HedgeIntentEngine, type EngineCallbacks } from './engine';
import type { ExecutorContext } from './action-executor';
import type {
  HedgeAction,
  HedgeIntentStatus,
  HedgeIntentDetail,
  Exchange,
  ExchangeName,
  HedgePair,
  ExecutionPhase,
} from './types';
import { ACTIVE_HEDGE_INTENT_KEY, ACTIVE_HEDGE_PAIR_KEY } from './types';

// ─── LocalStorage helpers ────────────────────────────────────────────────────

const LS_KEY = ACTIVE_HEDGE_INTENT_KEY;

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
    localStorage.removeItem(ACTIVE_HEDGE_PAIR_KEY);
  } catch { /* noop */ }
}

function storeHedgePair(pair: HedgePair): void {
  try {
    localStorage.setItem(ACTIVE_HEDGE_PAIR_KEY, JSON.stringify(pair));
  } catch { /* noop */ }
}

function loadHedgePair(): HedgePair | null {
  try {
    const raw = localStorage.getItem(ACTIVE_HEDGE_PAIR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HedgePair;
    if (parsed?.long && parsed?.short) return parsed;
    return null;
  } catch {
    return null;
  }
}

function toHedgeExchangeName(exchange: Exchange): ExchangeName {
  switch (exchange) {
    case 'hyperliquid':
      return 'Hyperliquid';
    case 'pacifica':
      return 'Pacifica';
    case 'phoenix':
      return 'Phoenix';
    case 'backpack':
      return 'Backpack';
    case 'lighter':
      return 'Lighter';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Parameters for opening a hedged position */
export interface OpenHedgeParams {
  /** Asset symbol (e.g. "BTC", "ETH") */
  asset: string;
  /** Total margin in USD (split 50/50 across legs) */
  marginUsd: number;
  /** Leverage multiplier (≥ 1) */
  leverage: number;
  /** Long venue — must match position panel / asset table best pair */
  longExchange: Exchange;
  /** Short venue — must match position panel / asset table best pair */
  shortExchange: Exchange;
  /** Exchanges to use (default: derived from long/short) */
  exchanges?: [ExchangeName, ExchangeName];
}

/** Return type of the useHedgeIntent hook */
export interface UseHedgeIntentReturn {
  /** Create a new hedge intent and start execution */
  openHedge: (params: OpenHedgeParams) => Promise<void>;

  /** Resume an in-progress intent (called automatically on mount) */
  resume: (intentId: string) => Promise<void>;

  /** Abort the current execution (engine stops after current action) */
  abort: () => void;

  /** Whether the engine is currently running */
  isExecuting: boolean;

  /** Current execution phase (for UI display) */
  phase: ExecutionPhase;

  /** Human-readable status message */
  statusMessage: string;

  /** Current action being executed (null when idle/waiting) */
  currentAction: HedgeAction | null;

  /** Which leg is currently being acted on */
  currentLeg: string | null;

  /** Full intent detail (for status UI rendering) */
  detail: HedgeIntentDetail | null;

  /** Active hedge intent ID (null if none) */
  intentId: string | null;

  /** Error message (null if no error) */
  error: string | null;

  /** Refresh the intent detail from the backend */
  refreshDetail: () => Promise<void>;
}

// ─── Terminal statuses (don't resume these) ──────────────────────────────────

const TERMINAL_STATUSES: HedgeIntentStatus[] = ['ACTIVE', 'CANCELLED', 'FAILED'];

const IN_PROGRESS_STATUSES: HedgeIntentStatus[] = [
  'CREATED', 'FUNDING', 'READY', 'OPENING', 'CANCELLING',
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHedgeIntent(): UseHedgeIntentReturn {
  const { state: turnkeyState } = useTurnkey();
  const spreadAprData = useAtomValue(spreadAprDataAtom);
  const bestPairOverrides = useAtomValue(bestPairOverrideAtom);
  const selectedExchangesMap = useAtomValue(selectedExchangesAtom);
  const bestPairMetric = useAtomValue(bestPairMetricAtom);
  const marketFeedData = useAtomValue(marketFeedDataAtom);
  const queryClient = useQueryClient();
  const setMargin = useSetAtom(marginAtom);

  // ── State ───────────────────────────────────────────────────
  const [isExecuting, setIsExecuting] = useState(false);
  const [phase, setPhase] = useState<ExecutionPhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentAction, setCurrentAction] = useState<HedgeAction | null>(null);
  const [currentLeg, setCurrentLeg] = useState<string | null>(null);
  const [detail, setDetail] = useState<HedgeIntentDetail | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────
  const engineRef = useRef<HedgeIntentEngine | null>(null);
  const isRunningRef = useRef(false);
  const resumeAttemptedRef = useRef(false);
  const hedgePairRef = useRef<HedgePair | null>(null);

  const resolveHedgePairForAsset = useCallback(
    (asset: string, explicit?: HedgePair): HedgePair => {
      if (explicit) return explicit;
      const stored = loadHedgePair();
      if (stored) return stored;

      const assetItem = marketFeedData.find((a) => a.asset === asset) ?? null;
      const selectedList = selectedVenuesList(selectedExchangesMap);
      const pair = getBestPair(
        assetItem,
        spreadAprData,
        bestPairOverrides[asset] ?? null,
        { selectedExchanges: selectedList, metric: bestPairMetric }
      );
      return { long: pair.long, short: pair.short };
    },
    [marketFeedData, spreadAprData, bestPairOverrides, selectedExchangesMap, bestPairMetric]
  );

  // ── Build executor context from Turnkey state ──────────────
  const buildContext = useCallback((): ExecutorContext => {
    const wallet = getWalletContext(turnkeyState);
    const hedgePair = hedgePairRef.current;
    if (!hedgePair) {
      throw new Error('Hedge pair not set — cannot execute without long/short venues');
    }
    return {
      ...wallet,
      hedgePair,
    };
  }, [turnkeyState]);

  // ── Build engine callbacks ─────────────────────────────────
  const buildCallbacks = useCallback(
    (hedgeIntentId: string): EngineCallbacks => ({
      onActionStart: (action, leg) => {
        setCurrentAction(action);
        setCurrentLeg(leg);
      },

      onActionComplete: (action, success) => {
        if (!success) {
          console.warn(`[useHedgeIntent] Action ${action} failed — engine will stop and show error`);
        }
        // Refresh detail after each action completes
        hedgeIntentApi.getDetail(hedgeIntentId)
          .then(setDetail)
          .catch(() => { /* non-critical */ });
      },

      onStatusChange: (phaseStr, detailMsg) => {
        setPhase(phaseStr as ExecutionPhase);
        if (detailMsg) setStatusMessage(detailMsg);
      },

      onError: (errorMsg) => {
        setError(errorMsg);
        setPhase('failed');
        setIsExecuting(false);
        isRunningRef.current = false;
        setCurrentAction(null);
        setCurrentLeg(null);
        clearActiveIntentId();
        toast.error('Hedge Failed', {
          description: errorMsg || 'An unexpected error occurred.',
          duration: 8000,
        });
      },

      onComplete: (id, finalStatus) => {
        // Only treat ACTIVE as true success
        if (finalStatus === 'ACTIVE') {
          setPhase('complete');
          setStatusMessage('Hedge is live!');
          // Refresh the positions table so the new hedge appears immediately
          queryClient.invalidateQueries({ queryKey: queryKeys.positions.all });
          const wallet = getWalletContext(turnkeyState);
          void queryClient.invalidateQueries({
            queryKey: queryKeys.balance.exchangeHlPac(wallet.evmAddress, wallet.solanaAddress),
          });
          // Backpack display-only: skip signed balance refresh.

          toast.success('Hedge Position Live', {
            description: 'Delta-neutral hedge is live on both legs.',
            closeButton: true,
            duration: 6000,
          });

          // Reset UI after a few seconds so user can open a new position
          setTimeout(() => {
            setPhase('idle');
            setStatusMessage('');
            setDetail(null);
            setIntentId(null);
            setMargin('');
          }, 5_000);
        } else {
          // CANCELLED, FAILED, or unexpected — show as failed
          setPhase('failed');
          setStatusMessage(`Hedge ${finalStatus.toLowerCase()}`);
          toast.error('Hedge Failed', {
            description: `Hedge intent ${finalStatus.toLowerCase()}.`,
            duration: 8000,
          });
        }
        setIsExecuting(false);
        isRunningRef.current = false;
        setCurrentAction(null);
        setCurrentLeg(null);
        hedgePairRef.current = null;
        clearActiveIntentId();

        // Final detail refresh
        hedgeIntentApi.getDetail(id)
          .then(setDetail)
          .catch(() => { /* non-critical */ });
      },
    }),
    [queryClient, setMargin, turnkeyState]
  );

  // ── Run the engine ─────────────────────────────────────────
  const runEngine = useCallback(
    async (hedgeIntentId: string, explicitPair?: HedgePair) => {
      if (isRunningRef.current) {
        console.warn('[useHedgeIntent] Engine already running');
        return;
      }

      try {
        if (!hedgePairRef.current) {
          if (explicitPair) {
            hedgePairRef.current = explicitPair;
          } else {
            const detail = await hedgeIntentApi.getDetail(hedgeIntentId);
            hedgePairRef.current = resolveHedgePairForAsset(detail.intent.asset);
          }
        }

        const context = buildContext();

        setIntentId(hedgeIntentId);
        setIsExecuting(true);
        setError(null);
        setPhase('creating');
        isRunningRef.current = true;

        // Fetch initial detail
        try {
          const initialDetail = await hedgeIntentApi.getDetail(hedgeIntentId);
          setDetail(initialDetail);
        } catch {
          /* continue without detail — engine will handle it */
        }

        // Start engine
        const engine = new HedgeIntentEngine();
        engineRef.current = engine;

        const callbacks = buildCallbacks(hedgeIntentId);
        await engine.run(hedgeIntentId, context, callbacks);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setPhase('failed');
        setIsExecuting(false);
        isRunningRef.current = false;
        toast.error('Hedge Execution Error', {
          description: errorMessage,
          duration: 8000,
        });
      }
    },
    [buildContext, buildCallbacks, resolveHedgePairForAsset]
  );

  // ── Public: Open a new hedge ───────────────────────────────
  const openHedge = useCallback(
    async (params: OpenHedgeParams) => {
      setError(null);
      setPhase('creating');
      setStatusMessage('Creating hedge intent...');
      setIsExecuting(true);

      const pair: HedgePair = {
        long: params.longExchange,
        short: params.shortExchange,
      };
      hedgePairRef.current = pair;
      storeHedgePair(pair);

      try {
        if (
          !isPhoenixTradingEnabled() &&
          (params.longExchange === 'phoenix' || params.shortExchange === 'phoenix')
        ) {
          toast.error('Phoenix trading is disabled', {
            description:
              'Enable NEXT_PUBLIC_PHOENIX_TRADING_ENABLED after configuring invite codes and Flight builder env vars. See docs/phoenix-trading.md.',
            duration: 8000,
          });
          throw new Error('Phoenix trading is disabled');
        }

        const exchanges =
          params.exchanges ??
          ([
            toHedgeExchangeName(params.longExchange),
            toHedgeExchangeName(params.shortExchange),
          ] as [ExchangeName, ExchangeName]);

        const newIntentId = await hedgeIntentApi.create({
          asset: params.asset,
          exchanges,
          margin_usd: params.marginUsd,
          leverage: params.leverage,
        });

        storeActiveIntentId(newIntentId);
        await runEngine(newIntentId, pair);
      } catch (err) {
        hedgePairRef.current = null;
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setPhase('failed');
        setIsExecuting(false);
        toast.error('Failed to Create Hedge', {
          description: errorMessage,
          duration: 8000,
        });
      }
    },
    [runEngine]
  );

  // ── Public: Resume an existing intent ──────────────────────
  const resume = useCallback(
    async (existingIntentId: string) => {
      setError(null);
      setStatusMessage('Resuming hedge execution...');
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
    setCurrentLeg(null);
    setStatusMessage('Execution paused. You can safely close this window.');
  }, []);

  // ── Public: Refresh detail ─────────────────────────────────
  const refreshDetail = useCallback(async () => {
    if (!intentId) return;
    try {
      const freshDetail = await hedgeIntentApi.getDetail(intentId);
      setDetail(freshDetail);
    } catch (err) {
      console.warn('[useHedgeIntent] Failed to refresh detail:', err);
    }
  }, [intentId]);

  // ── Auto-resume on mount ───────────────────────────────────
  useEffect(() => {
    // Only attempt once, and only when logged in
    if (resumeAttemptedRef.current || !turnkeyState.isLoggedIn || isRunningRef.current) {
      return;
    }
    resumeAttemptedRef.current = true;

    const storedIntentId = loadActiveIntentId();
    if (!storedIntentId) return;

    // Validate the intent is still in-progress
    hedgeIntentApi
      .getDetail(storedIntentId)
      .then((storedDetail) => {
        const status = storedDetail.intent.status;
        if (IN_PROGRESS_STATUSES.includes(status)) {
          console.log(`[useHedgeIntent] Resuming intent ${storedIntentId} (status: ${status})`);
          setDetail(storedDetail);
          resume(storedIntentId);
        } else if (TERMINAL_STATUSES.includes(status)) {
          // Already terminal — clean up
          setDetail(storedDetail);
          setIntentId(storedIntentId);
          setPhase(status === 'ACTIVE' ? 'complete' : 'failed');
          clearActiveIntentId();
        }
      })
      .catch(() => {
        // Can't validate — clear stale entry
        clearActiveIntentId();
      });
  }, [turnkeyState.isLoggedIn, resume]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      // Abort engine on unmount (it's safe to call abort if not running)
      engineRef.current?.abort();
    };
  }, []);

  return {
    openHedge,
    resume,
    abort,
    isExecuting,
    phase,
    statusMessage,
    currentAction,
    currentLeg,
    detail,
    intentId,
    error,
    refreshDetail,
  };
}
