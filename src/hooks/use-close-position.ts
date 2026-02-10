/**
 * Hook to close hedged positions on both Hyperliquid and Pacifica simultaneously.
 *
 * Flow:
 *  1. User clicks close on a position row
 *  2. Both legs (HL + Pacifica) are closed in parallel via Promise.allSettled
 *  3. If one leg fails, it is retried up to MAX_RETRIES times automatically
 *  4. After all retries, final status is reported per-leg
 */

import { useState, useCallback, useRef } from 'react';
import { HyperLiquidService } from '@/lib/services/hyperliquid/hyperliquid.service';
import { PacificaService } from '@/lib/services/pacifica/pacifica.service';
import { perpTickerToIndex } from '@/dex/hyperliquid/utils/asset-index-converter';
import type { PositionApiResponse } from '@/lib/api/services/positions.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CloseStatus = 'idle' | 'closing' | 'success' | 'partial' | 'error';

export interface CloseLegResult {
  protocol: 'hyperliquid' | 'pacifica';
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

// ─── Services (singleton) ─────────────────────────────────────────────────────

const hlService = new HyperLiquidService();
const pacificaService = new PacificaService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Close a HyperLiquid position for a given asset.
 */
async function closeHLPosition(
  hl: NonNullable<PositionApiResponse['hyperliquid']>,
  evmAddress: string,
  organizationId: string
): Promise<CloseLegResult> {
  try {
    const assetIndex = await perpTickerToIndex(hl.symbol.toUpperCase());
    if (assetIndex === -1) {
      return { protocol: 'hyperliquid', success: false, error: `Unknown asset: ${hl.symbol}` };
    }

    const result = await hlService.closePosition(
      {
        assetIndex,
        assetName: hl.symbol.toUpperCase(),
        price: 0, // Market order — price is ignored
        size: hl.size,
        isLong: hl.side === 'Long',
        isMarket: true,
        userAddress: evmAddress,
      },
      evmAddress,
      organizationId
    );

    return {
      protocol: 'hyperliquid',
      success: result.success,
      error: result.success ? undefined : result.error || result.message,
    };
  } catch (err) {
    return {
      protocol: 'hyperliquid',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Close a Pacifica position by creating a reduce-only market order on the opposite side.
 */
async function closePacificaPosition(
  pac: NonNullable<PositionApiResponse['pacifica']>,
  solanaAddress: string,
  organizationId: string
): Promise<CloseLegResult> {
  try {
    // To close: submit opposite-side reduce_only market order
    const closeSide: 'bid' | 'ask' = pac.side === 'Long' ? 'ask' : 'bid';

    const result = await pacificaService.createMarketOrder(
      {
        symbol: pac.symbol.toUpperCase(),
        amount: pac.size,
        side: closeSide,
        slippage_percent: '3', // 3% slippage tolerance
        reduce_only: true,
      },
      solanaAddress,
      organizationId
    );

    return {
      protocol: 'pacifica',
      success: result.success,
      error: result.success ? undefined : result.error || result.message,
    };
  } catch (err) {
    return {
      protocol: 'pacifica',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
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

    // Don't sleep after the last attempt
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

  // Track which assets are currently closing  (asset key → status)
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

        if (allSuccess && onSuccess) {
          onSuccess();
        }

        return { status, legs: results };
      } catch (err) {
        console.error('[close-position] Unexpected error:', err);
        setClosingAssets((prev) => ({ ...prev, [key]: 'error' }));
        activeCloses.current.delete(key);
        return { status: 'error', legs: [] };
      }
    },
    [evmAddress, solanaAddress, organizationId, onSuccess]
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
