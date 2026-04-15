/**
 * USDC Balance Store
 * Global Jotai store for USDC balances (Base + Solana)
 */

'use client';

import { atom } from 'jotai';
import { getUSDCBalanceOnBase, getUSDCBalanceOnSolana } from '@/lib/bridge/balance-api';
import { formatUSDCBalance } from '@/lib/bridge/balance';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';
import type { Wallet } from '@/lib/turnkey/types';

/**
 * USDC balance on Base (in smallest unit - bigint)
 */
export const usdcBalanceBaseAtom = atom<bigint | null>(null);

/**
 * USDC balance formatted for display (string)
 */
export const usdcBalanceBaseFormattedAtom = atom<string>((get) => {
  const balance = get(usdcBalanceBaseAtom);
  if (balance === null) return '0.00';
  return formatUSDCBalance(balance);
});

/**
 * USDC balance loading state
 */
export const usdcBalanceBaseLoadingAtom = atom<boolean>(false);

/**
 * USDC balance error state
 */
export const usdcBalanceBaseErrorAtom = atom<Error | null>(null);

/**
 * USDC balance last updated timestamp
 */
export const usdcBalanceBaseLastUpdatedAtom = atom<number | null>(null);

/**
 * Last wallet address that was fetched (to prevent duplicate calls)
 */
const lastFetchedAddressAtom = atom<string | null>(null);
const lastFetchTimeAtom = atom<number | null>(null);

/**
 * Minimum time between fetches (5 seconds)
 */
const MIN_FETCH_INTERVAL_MS = 5000;

/**
 * Action atom to fetch USDC balance on Base
 * Usage: await set(fetchUSDCBalanceBaseAtom, walletAddress)
 * Prevents duplicate calls within MIN_FETCH_INTERVAL_MS
 */
export const fetchUSDCBalanceBaseAtom = atom(
  null,
  async (get, set, walletAddress: string | null) => {
    if (!walletAddress) {
      set(usdcBalanceBaseAtom, null);
      set(usdcBalanceBaseErrorAtom, null);
      set(lastFetchedAddressAtom, null);
      return;
    }

    // Check if we're already loading
    const isLoading = get(usdcBalanceBaseLoadingAtom);
    if (isLoading) {
      return; // Already fetching, skip
    }

    // Check if we recently fetched for this address
    const lastAddress = get(lastFetchedAddressAtom);
    const lastFetchTime = get(lastFetchTimeAtom);
    const now = Date.now();

    if (
      lastAddress === walletAddress &&
      lastFetchTime !== null &&
      now - lastFetchTime < MIN_FETCH_INTERVAL_MS
    ) {
      // Recently fetched for this address, skip
      return;
    }

    set(usdcBalanceBaseLoadingAtom, true);
    set(usdcBalanceBaseErrorAtom, null);
    set(lastFetchedAddressAtom, walletAddress);
    set(lastFetchTimeAtom, now);

    try {
      const balance = await getUSDCBalanceOnBase(walletAddress as `0x${string}`);
      set(usdcBalanceBaseAtom, balance);
      set(usdcBalanceBaseLastUpdatedAtom, now);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch USDC balance');
      set(usdcBalanceBaseErrorAtom, err);
      console.error('Error fetching USDC balance on Base:', error);
    } finally {
      set(usdcBalanceBaseLoadingAtom, false);
    }
  }
);

/**
 * Action atom to fetch USDC balance using Turnkey wallet
 * Automatically gets EVM address from Turnkey state
 * Usage: await set(fetchUSDCBalanceBaseFromTurnkeyAtom, turnkeyWallets)
 */
export const fetchUSDCBalanceBaseFromTurnkeyAtom = atom(
  null,
  async (get, set, wallets: Wallet[] | null) => {
    if (!wallets || wallets.length === 0) {
      set(usdcBalanceBaseAtom, null);
      set(usdcBalanceBaseErrorAtom, null);
      return;
    }

    const walletAddress = getEVMAddress(wallets);
    if (!walletAddress) {
      set(usdcBalanceBaseAtom, null);
      set(usdcBalanceBaseErrorAtom, null);
      return;
    }

    await set(fetchUSDCBalanceBaseAtom, walletAddress);
  }
);

// ─── Solana USDC balance ─────────────────────────────────────────────────────

/** USDC balance on Solana (in smallest unit - bigint) */
export const usdcBalanceSolanaAtom = atom<bigint | null>(null);

/** USDC balance formatted for display (string) */
export const usdcBalanceSolanaFormattedAtom = atom<string>((get) => {
  const balance = get(usdcBalanceSolanaAtom);
  if (balance === null) return '0.00';
  return formatUSDCBalance(balance);
});

/** USDC balance loading state */
export const usdcBalanceSolanaLoadingAtom = atom<boolean>(false);

/** USDC balance error state */
export const usdcBalanceSolanaErrorAtom = atom<Error | null>(null);

/** USDC balance last updated timestamp */
export const usdcBalanceSolanaLastUpdatedAtom = atom<number | null>(null);

/**
 * Action atom to fetch USDC balance on Solana.
 * Usage: await set(fetchUSDCBalanceSolanaAtom, solanaAddress)
 */
export const fetchUSDCBalanceSolanaAtom = atom(
  null,
  async (get, set, solanaAddress: string | null) => {
    if (!solanaAddress) {
      set(usdcBalanceSolanaAtom, null);
      set(usdcBalanceSolanaErrorAtom, null);
      return;
    }

    const isLoading = get(usdcBalanceSolanaLoadingAtom);
    if (isLoading) return;

    set(usdcBalanceSolanaLoadingAtom, true);
    set(usdcBalanceSolanaErrorAtom, null);

    try {
      const balance = await getUSDCBalanceOnSolana(solanaAddress);
      set(usdcBalanceSolanaAtom, balance);
      set(usdcBalanceSolanaLastUpdatedAtom, Date.now());
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch USDC balance on Solana');
      set(usdcBalanceSolanaErrorAtom, err);
      console.error('Error fetching USDC balance on Solana:', error);
    } finally {
      set(usdcBalanceSolanaLoadingAtom, false);
    }
  }
);

/**
 * Action atom to fetch Solana USDC balance using Turnkey wallet list.
 * Usage: await set(fetchUSDCBalanceSolanaFromTurnkeyAtom, turnkeyWallets)
 */
export const fetchUSDCBalanceSolanaFromTurnkeyAtom = atom(
  null,
  async (_get, set, wallets: Wallet[] | null) => {
    if (!wallets || wallets.length === 0) {
      set(usdcBalanceSolanaAtom, null);
      set(usdcBalanceSolanaErrorAtom, null);
      return;
    }

    const solanaAddress = getSolanaAddress(wallets);
    if (!solanaAddress) {
      set(usdcBalanceSolanaAtom, null);
      set(usdcBalanceSolanaErrorAtom, null);
      return;
    }

    await set(fetchUSDCBalanceSolanaAtom, solanaAddress);
  }
);
