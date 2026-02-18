/**
 * Position Controls Store
 * Jotai atoms for managing position control state (leverage, margin, etc.)
 */

import { atom } from 'jotai';
import type { ArbitragePair } from '@/lib/arbitrage';

// Leverage state (1-5x)
export const leverageAtom = atom<number>(3);

// Margin/Position size state (in USD)
export const marginAtom = atom<string>('');

// Currency selection for margin
export const marginCurrencyAtom = atom<string>('USD');

// Selected arbitrage pair
export const selectedArbitragePairAtom = atom<ArbitragePair | null>(null);

// Selected asset (for filtering pairs)
export const selectedAssetAtom = atom<string>('BTC');

// ─── Exchange Balance Atoms ──────────────────────────────────────────────────
// Set by the useExchangeBalances hook, read by validation and UI components.

/** Hyperliquid withdrawable balance (free margin) in USD */
export const hlBalanceAtom = atom<number>(0);

/** Pacifica available_to_spend balance (free margin) in USD */
export const pacBalanceAtom = atom<number>(0);

/** Base USDC wallet balance in USD */
export const baseBalanceAtom = atom<number>(0);

// ─── Margin Validation ──────────────────────────────────────────────────────

export interface MarginValidation {
  /** Whether the current margin value is valid */
  isValid: boolean;
  /** Validation error message (null if valid or empty input) */
  error: string | null;
  /** Maximum margin the user can enter given existing exchange balances */
  maxMargin: number;
}

/**
 * Derived atom that validates the margin input against existing exchange balances.
 *
 * Validation uses ONLY what's already deposited on each exchange — no Base
 * balance is considered. Users pre-fund exchanges via the "Add Margin" buttons.
 *
 * Max margin = 2 × min(hlFree, pacFree), since each side gets margin / 2
 * and the bottleneck is whichever exchange has less.
 */
export const marginValidationAtom = atom<MarginValidation>((get) => {
  const marginStr = get(marginAtom);
  const hlFree = get(hlBalanceAtom);
  const pacFree = get(pacBalanceAtom);

  const maxPerSide = Math.min(hlFree, pacFree);
  const maxMargin = Math.floor(maxPerSide * 2 * 100) / 100;

  const marginValue = parseFloat(marginStr);

  if (!marginStr || isNaN(marginValue) || marginValue <= 0) {
    return { isValid: false, error: null, maxMargin };
  }

  const perSide = marginValue / 2;

  if (perSide > hlFree + 0.01) {
    const shortfall = (perSide - hlFree).toFixed(2);
    return {
      isValid: false,
      error: `Insufficient HyperLiquid margin. Add $${shortfall} via "Add Margin".`,
      maxMargin,
    };
  }

  if (perSide > pacFree + 0.01) {
    const shortfall = (perSide - pacFree).toFixed(2);
    return {
      isValid: false,
      error: `Insufficient Pacifica margin. Add $${shortfall} via "Add Margin".`,
      maxMargin,
    };
  }

  return { isValid: true, error: null, maxMargin };
});
