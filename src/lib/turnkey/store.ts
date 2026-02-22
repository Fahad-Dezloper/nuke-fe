/**
 * Turnkey Store
 * Jotai-based state management for Turnkey wallet operations
 */

'use client';

import { atom } from 'jotai';
import { turnkeyClient } from './client';
import type { TurnkeyState } from './types';
import { loginWithEVMWallet, loginWithSolanaWallet } from './wallet-helpers';

// Initial state
const initialState: TurnkeyState = {
  isLoggedIn: false,
  isLoading: true,
  isLoggingIn: false,
  isCreatingWallet: false,
  userWallets: [],
  turnkeySubOrgId: null,
  publicKey: null,
  nonce: null,
  googleIdToken: null,
};

// Main state atom
export const turnkeyStateAtom = atom<TurnkeyState>(initialState);

// Derived atoms for convenience
export const isLoggedInAtom = atom((get) => get(turnkeyStateAtom).isLoggedIn);
export const isLoadingAtom = atom((get) => get(turnkeyStateAtom).isLoading);
export const isLoggingInAtom = atom((get) => get(turnkeyStateAtom).isLoggingIn);
export const isCreatingWalletAtom = atom((get) => get(turnkeyStateAtom).isCreatingWallet);
export const userWalletsAtom = atom((get) => get(turnkeyStateAtom).userWallets);
export const turnkeySubOrgIdAtom = atom((get) => get(turnkeyStateAtom).turnkeySubOrgId);
export const publicKeyAtom = atom((get) => get(turnkeyStateAtom).publicKey);
export const nonceAtom = atom((get) => get(turnkeyStateAtom).nonce);

// Action atoms
export const loginWithGoogleAtom = atom(null, async (_get, _set) => {
  const state = turnkeyClient.getState();

  if (!state.publicKey) {
    await turnkeyClient.prepareForLogin();
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
  const redirectUri = window.location.origin.replace(/\/$/, '');

  turnkeyClient.redirectToGoogle(clientId, redirectUri);
  return true;
});

export const logoutAtom = atom(null, async (_get, set) => {
  const success = await turnkeyClient.logout();
  if (success) {
    const newState = turnkeyClient.getState();
    set(turnkeyStateAtom, newState);
  }
  return success;
});

export const signTransactionAtom = atom(
  null,
  async (_get, _set, { unsignedTx, walletId }: { unsignedTx: string; walletId: string }) => {
    return await turnkeyClient.signTransaction(unsignedTx, walletId);
  }
);

export const createWalletAtom = atom(null, async (_get, set, name: string) => {
  const result = await turnkeyClient.createWallet(name);
  if (result.success) {
    const newState = turnkeyClient.getState();
    set(turnkeyStateAtom, newState);
  }
  return result;
});

export const checkSessionAtom = atom(null, async (_get, set) => {
  try {
    const session = await turnkeyClient.getSession();

    if (session && session.organizationId) {
      const sessionValid = await turnkeyClient.refreshSessionIfNeeded();
      if (sessionValid) {
        await turnkeyClient.loadUserData(session.organizationId);
        const newState = turnkeyClient.getState();
        set(turnkeyStateAtom, newState);
        return;
      }
    }

    await turnkeyClient.initialize();
    const newState = turnkeyClient.getState();
    set(turnkeyStateAtom, newState);
  } catch (error) {
    console.error('Session check failed:', error);
    const newState = turnkeyClient.getState();
    set(turnkeyStateAtom, newState);
  }
});

export const loginWithEVMWalletAtom = atom(null, async (_get, set) => {
  try {
    turnkeyClient.updateState({ isLoggingIn: true });
    set(turnkeyStateAtom, (prev) => ({ ...prev, isLoggingIn: true }));

    const result = await loginWithEVMWallet();

    if (result.success && result.subOrgId) {
      await turnkeyClient.loadUserData(result.subOrgId);
      const newState = turnkeyClient.getState();
      set(turnkeyStateAtom, newState);
      return true;
    }

    turnkeyClient.updateState({ isLoggingIn: false });
    set(turnkeyStateAtom, (prev) => ({ ...prev, isLoggingIn: false }));
    return false;
  } catch (error) {
    console.error('EVM wallet login error:', error);
    turnkeyClient.updateState({ isLoggingIn: false });
    set(turnkeyStateAtom, (prev) => ({ ...prev, isLoggingIn: false }));
    return false;
  }
});

export const loginWithSolanaWalletAtom = atom(null, async (_get, set) => {
  try {
    turnkeyClient.updateState({ isLoggingIn: true });
    set(turnkeyStateAtom, (prev) => ({ ...prev, isLoggingIn: true }));

    const result = await loginWithSolanaWallet();

    if (result.success && result.subOrgId) {
      await turnkeyClient.loadUserData(result.subOrgId);
      const newState = turnkeyClient.getState();
      set(turnkeyStateAtom, newState);
      return true;
    }

    turnkeyClient.updateState({ isLoggingIn: false });
    set(turnkeyStateAtom, (prev) => ({ ...prev, isLoggingIn: false }));
    return false;
  } catch (error) {
    console.error('Solana wallet login error:', error);
    turnkeyClient.updateState({ isLoggingIn: false });
    set(turnkeyStateAtom, (prev) => ({ ...prev, isLoggingIn: false }));
    return false;
  }
});

// Initialize atom - syncs turnkeyClient state with Jotai
export const initializeTurnkeyAtom = atom(null, async (_get, set) => {
  // Subscribe to turnkeyClient state changes
  const subscription = turnkeyClient.subscribe((newState) => {
    set(turnkeyStateAtom, newState);
  });

  // Initialize on mount
  if (typeof window !== 'undefined') {
    await turnkeyClient.initialize();
    const initialState = turnkeyClient.getState();
    set(turnkeyStateAtom, initialState);
  }

  // Return cleanup function
  return () => {
    subscription.unsubscribe();
  };
});
