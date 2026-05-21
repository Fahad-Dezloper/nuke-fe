/**
 * Wallet Context Utility
 *
 * Shared validation and extraction of wallet addresses from Turnkey state.
 * Eliminates duplication across hooks that all need the same wallet checks.
 */

import type { TurnkeyState } from '@/lib/turnkey/types';
import { requireAuthUserId } from '@/lib/auth/auth.service';
import { getEVMAddress, getSolanaAddress } from '@/lib/turnkey/wallet-utils';

export interface WalletContext {
  evmAddress: string;
  solanaAddress: string;
  /** Turnkey sub-organization id (wallet signing only). */
  organizationId: string;
  /** Nuke backend user UUID (JWT `sub` / `user_id`) — for `/user/*` APIs. */
  userId: string;
}

/**
 * Validate Turnkey state and extract wallet addresses.
 * Throws descriptive errors if any required wallet data is missing.
 */
export function getWalletContext(state: TurnkeyState): WalletContext {
  if (!state.isLoggedIn) {
    throw new Error('Please connect your wallet first');
  }

  if (!state.turnkeySubOrgId) {
    throw new Error('Turnkey organization not found');
  }

  const wallets = state.userWallets;
  if (!wallets || wallets.length === 0) {
    throw new Error('No wallets found');
  }

  const evmAddress = getEVMAddress(wallets);
  if (!evmAddress) {
    throw new Error('No EVM wallet address found');
  }

  const solanaAddress = getSolanaAddress(wallets);
  if (!solanaAddress) {
    throw new Error('No Solana wallet address found');
  }

  return {
    evmAddress,
    solanaAddress,
    organizationId: state.turnkeySubOrgId,
    userId: requireAuthUserId(),
  };
}

/**
 * Try to extract wallet context without throwing.
 * Returns null if any required data is missing.
 */
export function tryGetWalletContext(state: TurnkeyState): WalletContext | null {
  try {
    return getWalletContext(state);
  } catch {
    return null;
  }
}
