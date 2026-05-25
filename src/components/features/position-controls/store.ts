/**
 * Position Controls Store
 * Jotai atoms for managing position control state (leverage, margin, etc.)
 */

import { atom } from 'jotai';
import type { ArbitragePair } from '@/lib/arbitrage';
import { getBestPair, type Protocol } from '@/hooks/use-best-pair';
import { selectedAssetAtom as marketSelectedAssetAtom } from '@/lib/stores/market-feed.store';
import { spreadAprDataAtom } from '@/lib/stores/spread-apr.store';
import { bestPairOverrideAtom } from '@/lib/stores/best-pair-override.store';
import {
  bestPairMetricAtom,
  selectedExchangesAtom,
  selectedVenuesList,
} from '@/lib/stores/arbitrage-table-filters.store';

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

/** Phoenix free collateral (USDC) in USD — from Rise trader snapshot */
export const phxBalanceAtom = atom<number>(0);

/** Backpack USDC available (perp collateral) in USD */
export const bpBalanceAtom = atom<number>(0);

/** Lighter available balance (USDC) in USD — from Lighter account by L1 address */
export const ltBalanceAtom = atom<number>(0);

/** Funding wallet USDC balance in USD (Solana) */
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

function protocolLabel(p: Protocol): string {
  if (p === 'hyperliquid') return 'Hyperliquid';
  if (p === 'pacifica') return 'Pacifica';
  if (p === 'phoenix') return 'Phoenix';
  if (p === 'backpack') return 'Backpack';
  return 'Lighter';
}

/**
 * Derived atom that validates the margin input against existing exchange balances.
 *
 * Validation uses ONLY what's already deposited on each exchange — no wallet
 * balance is considered. Users pre-fund exchanges via the "Add Margin" buttons.
 *
 * Max margin = 2 × min(longVenueFree, shortVenueFree) for the current best pair.
 */
export const marginValidationAtom = atom<MarginValidation>((get) => {
  const marginStr = get(marginAtom);
  const asset = get(marketSelectedAssetAtom);
  const spreadAprData = get(spreadAprDataAtom);
  const overrides = get(bestPairOverrideAtom);
  const override = asset ? overrides[asset.asset] ?? null : null;
  const selectedList = selectedVenuesList(get(selectedExchangesAtom));
  const metric = get(bestPairMetricAtom);
  const { long, short } = getBestPair(asset, spreadAprData, override, {
    selectedExchanges: selectedList,
    metric,
  });

  const longFree =
    long === 'hyperliquid'
      ? get(hlBalanceAtom)
      : long === 'pacifica'
        ? get(pacBalanceAtom)
        : long === 'phoenix'
          ? get(phxBalanceAtom)
          : long === 'backpack'
            ? get(bpBalanceAtom)
            : long === 'lighter'
              ? get(ltBalanceAtom)
              : 0;
  const shortFree =
    short === 'hyperliquid'
      ? get(hlBalanceAtom)
      : short === 'pacifica'
        ? get(pacBalanceAtom)
        : short === 'phoenix'
          ? get(phxBalanceAtom)
          : short === 'backpack'
            ? get(bpBalanceAtom)
            : short === 'lighter'
              ? get(ltBalanceAtom)
              : 0;

  const maxPerSide = Math.min(longFree, shortFree);
  const maxMargin = Math.floor(maxPerSide * 2 * 100) / 100;

  const marginValue = parseFloat(marginStr);

  if (!marginStr || isNaN(marginValue) || marginValue <= 0) {
    return { isValid: false, error: null, maxMargin };
  }

  const perSide = marginValue / 2;

  if (perSide > longFree + 0.01) {
    const shortfall = (perSide - longFree).toFixed(2);
    return {
      isValid: false,
      error: `Insufficient ${protocolLabel(long)} margin. Add $${shortfall} via "Add Margin".`,
      maxMargin,
    };
  }

  if (perSide > shortFree + 0.01) {
    const shortfall = (perSide - shortFree).toFixed(2);
    return {
      isValid: false,
      error: `Insufficient ${protocolLabel(short)} margin. Add $${shortfall} via "Add Margin".`,
      maxMargin,
    };
  }

  return { isValid: true, error: null, maxMargin };
});
