/**
 * Turnkey Hooks
 * React hooks for accessing Turnkey state and actions via Jotai
 */

'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import {
  turnkeyStateAtom,
  loginWithGoogleAtom,
  logoutAtom,
  signTransactionAtom,
  createWalletAtom,
  checkSessionAtom,
  loginWithEVMWalletAtom,
  loginWithSolanaWalletAtom,
} from './store';
import type { WalletCreationResult, SignTransactionResult } from './types';

/**
 * Main hook for accessing Turnkey state and actions
 * Replaces the old useTurnkey hook from Context
 */
export function useTurnkey() {
  const state = useAtomValue(turnkeyStateAtom);
  const loginWithGoogle = useSetAtom(loginWithGoogleAtom);
  const logout = useSetAtom(logoutAtom);
  const signTransaction = useSetAtom(signTransactionAtom);
  const createWallet = useSetAtom(createWalletAtom);
  const checkSession = useSetAtom(checkSessionAtom);
  const loginWithEVMWallet = useSetAtom(loginWithEVMWalletAtom);
  const loginWithSolanaWallet = useSetAtom(loginWithSolanaWalletAtom);

  return {
    state,
    loginWithGoogle: async () => {
      await loginWithGoogle();
    },
    logout: async () => {
      return await logout();
    },
    signTransaction: async (
      unsignedTx: string,
      walletId: string
    ): Promise<SignTransactionResult> => {
      return await signTransaction({ unsignedTx, walletId });
    },
    createWallet: async (
      name: string
    ): Promise<WalletCreationResult> => {
      return await createWallet(name);
    },
    checkSession: async () => {
      await checkSession();
    },
    loginWithEVMWallet: async () => {
      return await loginWithEVMWallet();
    },
    loginWithSolanaWallet: async () => {
      return await loginWithSolanaWallet();
    },
  };
}
