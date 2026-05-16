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
import type {
  WalletCreationResult,
  SignTransactionResult,
  LoginResult,
} from './types';
import type { Eip1193Requester } from '@/lib/wallet-discovery/eip6963';
import type { SolanaWalletKind } from '@/lib/wallet-discovery/solana-injected';

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
    createWallet: async (name: string): Promise<WalletCreationResult> => {
      return await createWallet(name);
    },
    checkSession: async () => {
      await checkSession();
    },
    loginWithEVMWallet: async (provider?: Eip1193Requester): Promise<LoginResult> => {
      return await loginWithEVMWallet(provider);
    },
    loginWithSolanaWallet: async (kind?: SolanaWalletKind): Promise<LoginResult> => {
      return await loginWithSolanaWallet(kind);
    },
  };
}
