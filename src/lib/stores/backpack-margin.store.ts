/**
 * Backpack perp USDC margin (signed balanceQuery) — minimize Turnkey signatures.
 *
 * - Cached in Jotai (`bpBalanceAtom`) + sessionStorage for same-tab refresh UX.
 * - At most one automatic signed fetch per (Solana wallet + org) per full JS load,
 *   unless `refreshBackpackMarginBalance` is called explicitly (deposit, hedge, close).
 */

'use client';

import { getDefaultStore } from 'jotai';
// Backpack authenticated balance fetch disabled (display-only demo).
// import { backpackService } from '@/lib/services/backpack/backpack.service';
import { bpBalanceAtom } from '@/components/features/position-controls/store';

const STORAGE_PREFIX = 'nuke_bp_margin_v1_';

/** After a successful auto-fetch for this key, skip duplicate auto-fetches until full page reload. */
let autoFetchCompletedKey: string | null = null;

const inflight = new Map<string, Promise<number>>();

export function backpackMarginCacheKey(solanaAddress: string, organizationId: string): string {
  return `${solanaAddress}:${organizationId}`;
}

function readSessionCache(k: string): number | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + k);
    if (raw == null) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSessionCache(k: string, value: number): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + k, String(value));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Signed Backpack API call — updates `bpBalanceAtom` and sessionStorage.
 * Deduplicates concurrent calls for the same wallet key.
 */
export async function refreshBackpackMarginBalance(params: {
  solanaAddress: string;
  organizationId: string;
}): Promise<number> {
  // Disabled: would trigger signed `balanceQuery` + Turnkey cost (and browser CORS).
  // Keep function for easy re-enable later.
  void params;
  const v = 0;
  getDefaultStore().set(bpBalanceAtom, v);
  return v;
}

/**
 * Hydrate atom from sessionStorage only (no signature). Call before `ensureBackpackMarginFetchedOncePerJsSession`.
 */
export function hydrateBackpackMarginFromSessionCache(params: {
  solanaAddress: string;
  organizationId: string;
}): void {
  const k = backpackMarginCacheKey(params.solanaAddress, params.organizationId);
  const n = readSessionCache(k);
  if (n !== null) {
    getDefaultStore().set(bpBalanceAtom, n);
  }
}

/**
 * One automatic signed fetch per (wallet + org) per full page load (new JS context).
 * Safe across Strict Mode / hook remount / asset changes: duplicate in-flight calls merge.
 */
export async function ensureBackpackMarginFetchedOncePerJsSession(params: {
  solanaAddress: string;
  organizationId: string;
}): Promise<void> {
  const k = backpackMarginCacheKey(params.solanaAddress, params.organizationId);
  if (autoFetchCompletedKey === k) return;
  await refreshBackpackMarginBalance(params);
  autoFetchCompletedKey = k;
}

/** Call on logout so the next login can auto-fetch again. */
export function resetBackpackMarginAutoFetchState(): void {
  autoFetchCompletedKey = null;
}

export function clearBackpackMarginBalanceForLogout(): void {
  resetBackpackMarginAutoFetchState();
  getDefaultStore().set(bpBalanceAtom, 0);
}
