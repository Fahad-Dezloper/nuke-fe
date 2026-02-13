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

/** Minimum deposit amount per exchange (USD) */
const MIN_DEPOSIT = 11;

export interface MarginValidation {
  /** Whether the current margin value is valid */
  isValid: boolean;
  /** Validation error message (null if valid or empty input) */
  error: string | null;
  /** Maximum margin the user can enter given all balances */
  maxMargin: number;
  /** Deposit needed to Hyperliquid from Base (0 if covered by existing) */
  hlDeposit: number;
  /** Deposit needed to Pacifica from Base (0 if covered by existing) */
  pacDeposit: number;
}

/**
 * Compute the maximum usable margin respecting the minimum-deposit dead zone.
 *
 * There are three valid regions for perSide (= margin / 2):
 *   Case 1: perSide ≤ min(hlFree, pacFree) — no deposits needed
 *   Case 2: min(hl,pac) + MIN_DEPOSIT ≤ perSide ≤ max(hl,pac) — only
 *           the smaller-balance exchange needs a deposit (≥ MIN_DEPOSIT)
 *   Case 3: perSide ≥ max(hl,pac) + MIN_DEPOSIT — both need deposits
 *           (each ≥ MIN_DEPOSIT), total base usage ≤ baseBal
 *
 * Returns the largest valid margin (2 × maxPerSide) that the user can enter.
 */
function computeMaxUsableMargin(hlFree: number, pacFree: number, baseBal: number): number {
  const smaller = Math.min(hlFree, pacFree);
  const larger = Math.max(hlFree, pacFree);

  let maxPerSide = 0;

  // Case 1: No deposits (use only existing exchange balances)
  maxPerSide = Math.max(maxPerSide, smaller);

  // Case 2: Only the smaller-balance exchange needs a deposit
  // Valid when: smaller + MIN_DEPOSIT ≤ perSide ≤ larger
  // Base constraint: perSide - smaller ≤ baseBal
  const case2Max = Math.min(larger, smaller + baseBal);
  if (case2Max >= smaller + MIN_DEPOSIT) {
    maxPerSide = Math.max(maxPerSide, case2Max);
  }

  // Case 3: Both exchanges need deposits
  // Valid when: perSide ≥ larger + MIN_DEPOSIT
  // Base constraint: 2×perSide - hlFree - pacFree ≤ baseBal → perSide ≤ (baseBal + hlFree + pacFree) / 2
  const case3Max = (baseBal + hlFree + pacFree) / 2;
  if (case3Max >= larger + MIN_DEPOSIT) {
    maxPerSide = Math.max(maxPerSide, case3Max);
  }

  return Math.floor(maxPerSide * 2 * 100) / 100;
}

/**
 * Derived atom that validates the margin input against exchange balances
 * and minimum deposit constraints.
 *
 * Validation rules:
 * 1. Each side gets margin / 2
 * 2. If deposit is needed (perSide > existing), deposit must be >= MIN_DEPOSIT
 * 3. Total base usage must not exceed base balance
 */
export const marginValidationAtom = atom<MarginValidation>((get) => {
  const marginStr = get(marginAtom);
  const hlFree = get(hlBalanceAtom);
  const pacFree = get(pacBalanceAtom);
  const baseBal = get(baseBalanceAtom);

  const maxMargin = computeMaxUsableMargin(hlFree, pacFree, baseBal);

  const marginValue = parseFloat(marginStr);

  // Empty or zero — no error, just not valid for submission
  if (!marginStr || isNaN(marginValue) || marginValue <= 0) {
    return { isValid: false, error: null, maxMargin, hlDeposit: 0, pacDeposit: 0 };
  }

  const perSide = marginValue / 2;
  const hlDeposit = Math.max(0, perSide - hlFree);
  const pacDeposit = Math.max(0, perSide - pacFree);
  const totalBaseNeeded = hlDeposit + pacDeposit;

  // Rule 1: Sufficient total funds
  if (totalBaseNeeded > baseBal + 0.01) {
    return {
      isValid: false,
      error: `Insufficient funds. Maximum margin: $${maxMargin.toFixed(2)}`,
      maxMargin,
      hlDeposit,
      pacDeposit,
    };
  }

  // Rule 2: Minimum deposit check for each exchange
  const hlInDeadZone = hlDeposit > 0 && hlDeposit < MIN_DEPOSIT;
  const pacInDeadZone = pacDeposit > 0 && pacDeposit < MIN_DEPOSIT;

  if (hlInDeadZone || pacInDeadZone) {
    // Calculate the nearest valid boundary values
    const maxNoDeposit = Math.floor(Math.min(hlFree, pacFree) * 2 * 100) / 100;
    const hlMinPerSide = hlFree + MIN_DEPOSIT;
    const pacMinPerSide = pacFree + MIN_DEPOSIT;
    const minWithDeposits = Math.ceil(Math.max(hlMinPerSide, pacMinPerSide) * 2 * 100) / 100;

    const hints: string[] = [];
    if (maxNoDeposit > 0) {
      hints.push(`decrease to $${maxNoDeposit.toFixed(2)}`);
    }
    if (minWithDeposits <= maxMargin) {
      hints.push(`increase to $${minWithDeposits.toFixed(2)}`);
    }

    const hintStr = hints.length > 0 ? hints.join(' or ') : 'adjust your margin';

    return {
      isValid: false,
      error: `Min. deposit per exchange is $${MIN_DEPOSIT}. Please ${hintStr}.`,
      maxMargin,
      hlDeposit,
      pacDeposit,
    };
  }

  return { isValid: true, error: null, maxMargin, hlDeposit, pacDeposit };
});
