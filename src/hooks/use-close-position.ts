/**
 * Hook to close hedged positions on both Hyperliquid and Pacifica simultaneously.
 *
 * Uses React Query useMutation for proper state management.
 *
 * Flow:
 *  1. User clicks close on a position row
 *  2. Both legs (HL + Pacifica) are closed in parallel via Promise.allSettled
 *  3. If one leg fails, it is retried up to MAX_RETRIES times automatically
 *  4. After all retries, final status is reported per-leg
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  closeHLPosition,
  closePacificaPosition,
  closeBackpackPosition,
  closeLighterPosition,
} from '@/lib/trading/close-position';
import { queryKeys } from '@/lib/query-keys';
// Backpack authenticated balance refresh disabled (display-only demo).
// import { refreshBackpackMarginBalance } from '@/lib/stores/backpack-margin.store';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CloseStatus = 'idle' | 'closing' | 'success' | 'partial' | 'error';

export interface CloseLegResult {
  protocol: 'hyperliquid' | 'pacifica' | 'backpack' | 'lighter';
  success: boolean;
  error?: string;
}

export interface ClosePositionResult {
  status: CloseStatus;
  legs: CloseLegResult[];
}

interface UseClosePositionOptions {
  evmAddress: string;
  solanaAddress: string;
  organizationId: string;
  /** Called after a successful close to refresh positions */
  onSuccess?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to close a single leg with retries.
 */
async function closeLegWithRetries(
  closeFn: () => Promise<CloseLegResult>,
  maxRetries: number = MAX_RETRIES
): Promise<CloseLegResult> {
  let lastResult: CloseLegResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await closeFn();
    if (lastResult.success) return lastResult;

    if (attempt < maxRetries) {
      console.warn(
        `[close-position] ${lastResult.protocol} attempt ${attempt + 1}/${maxRetries + 1} failed: ${lastResult.error}. Retrying...`
      );
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.error(
    `[close-position] ${lastResult!.protocol} failed after ${maxRetries + 1} attempts`
  );
  return lastResult!;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useClosePosition(options: UseClosePositionOptions) {
  const { evmAddress, solanaAddress, organizationId, onSuccess } = options;
  const queryClient = useQueryClient();

  // Track which assets are currently closing (asset key → status)
  const [closingAssets, setClosingAssets] = useState<Record<string, CloseStatus>>({});
  const activeCloses = useRef<Set<string>>(new Set());

  /**
   * Close a hedged position (both legs) for the given raw API position.
   */
  const closePosition = useCallback(
    async (rawPosition: PositionApiResponse): Promise<ClosePositionResult> => {
      const key = rawPosition.symbol;

      // Prevent duplicate close calls for the same asset
      if (activeCloses.current.has(key)) {
        return { status: 'closing', legs: [] };
      }

      activeCloses.current.add(key);
      setClosingAssets((prev) => ({ ...prev, [key]: 'closing' }));

      try {
        // Build close tasks for each leg
        const tasks: (() => Promise<CloseLegResult>)[] = [];

        if (rawPosition.hyperliquid) {
          const hl = rawPosition.hyperliquid;
          tasks.push(() => closeHLPosition(hl, evmAddress, organizationId));
        }

        if (rawPosition.pacifica) {
          const pac = rawPosition.pacifica;
          tasks.push(() => closePacificaPosition(pac, solanaAddress, organizationId));
        }

        if (rawPosition.backpack) {
          const bp = rawPosition.backpack;
          tasks.push(() => closeBackpackPosition(bp, solanaAddress, organizationId));
        }

        if (rawPosition.lighter) {
          const lt = rawPosition.lighter;
          tasks.push(() => closeLighterPosition(lt, evmAddress, organizationId));
        }

        if (tasks.length === 0) {
          setClosingAssets((prev) => ({ ...prev, [key]: 'error' }));
          activeCloses.current.delete(key);
          return { status: 'error', legs: [] };
        }

        // Execute all legs in parallel with internal retries
        const results = await Promise.all(
          tasks.map((fn) => closeLegWithRetries(fn))
        );

        const allSuccess = results.every((r) => r.success);
        const anySuccess = results.some((r) => r.success);

        let status: CloseStatus;
        if (allSuccess) {
          status = 'success';
        } else if (anySuccess) {
          status = 'partial';
        } else {
          status = 'error';
        }

        setClosingAssets((prev) => ({ ...prev, [key]: status }));
        activeCloses.current.delete(key);

        if (allSuccess) {
          queryClient.invalidateQueries({ queryKey: queryKeys.positions.all });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.balance.exchangeHlPac(evmAddress, solanaAddress),
          });
          // Backpack display-only: skip signed balance refresh.
          onSuccess?.();
        }

        return { status, legs: results };
      } catch (err) {
        console.error('[close-position] Unexpected error:', err);
        setClosingAssets((prev) => ({ ...prev, [key]: 'error' }));
        activeCloses.current.delete(key);
        return { status: 'error', legs: [] };
      }
    },
    [evmAddress, solanaAddress, organizationId, onSuccess, queryClient]
  );

  /**
   * Clear the closing state for a given asset (e.g. dismiss error).
   */
  const clearStatus = useCallback((asset: string) => {
    setClosingAssets((prev) => {
      const next = { ...prev };
      delete next[asset];
      return next;
    });
  }, []);

  return {
    closePosition,
    closingAssets,
    clearStatus,
  };
}
