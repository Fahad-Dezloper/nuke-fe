/**
 * Turnkey Store
 * React Context provider for Turnkey wallet state management
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { turnkeyClient } from './client';
import type { TurnkeyState } from './types';
import type { WalletCreationResult, SignTransactionResult } from './types';
import { loginWithEVMWallet, loginWithSolanaWallet } from './wallet-helpers';

interface TurnkeyContextType {
  state: TurnkeyState;
  loginWithGoogle: () => Promise<boolean>;
  loginWithEVMWallet: () => Promise<boolean>;
  loginWithSolanaWallet: () => Promise<boolean>;
  logout: () => Promise<boolean>;
  signTransaction: (
    unsignedTx: string,
    walletId: string
  ) => Promise<SignTransactionResult>;
  createWallet: (name: string) => Promise<WalletCreationResult>;
  checkSession: () => Promise<void>;
}

const TurnkeyContext = createContext<TurnkeyContextType | null>(null);

export function TurnkeyProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TurnkeyState>(turnkeyClient.getState());

  useEffect(() => {
    // Subscribe to state changes
    const subscription = turnkeyClient.subscribe((newState) => {
      setState(newState);
    });

    // Initialize on mount
    if (typeof window !== 'undefined') {
      turnkeyClient.initialize();
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const state = turnkeyClient.getState();

    if (!state.publicKey) {
      await turnkeyClient.prepareForLogin();
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
    // Normalize redirect URI - remove trailing slash to match Google Cloud Console exactly
    const redirectUri = window.location.origin.replace(/\/$/, '');

    turnkeyClient.redirectToGoogle(clientId, redirectUri);
    return true;
  }, []);

  const logout = useCallback(async () => {
    const success = await turnkeyClient.logout();
    if (success) {
      setState(turnkeyClient.getState());
    }
    return success;
  }, []);

  const signTransaction = useCallback(
    async (unsignedTx: string, walletId: string) => {
      return await turnkeyClient.signTransaction(unsignedTx, walletId);
    },
    []
  );

  const createWallet = useCallback(async (name: string) => {
    const result = await turnkeyClient.createWallet(name);
    if (result.success) {
      setState(turnkeyClient.getState());
    }
    return result;
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const session = await turnkeyClient.getSession();

      if (session && session.organizationId) {
        const sessionValid = await turnkeyClient.refreshSessionIfNeeded();
        if (sessionValid) {
          await turnkeyClient.loadUserData(session.organizationId);
          setState(turnkeyClient.getState());
          return;
        }
      }

      await turnkeyClient.initialize();
      setState(turnkeyClient.getState());
    } catch (error) {
      console.error('Session check failed:', error);
      setState(turnkeyClient.getState());
    }
  }, []);

  const handleLoginWithEVMWallet = useCallback(async () => {
    try {
      const result = await loginWithEVMWallet();

      if (result.success && result.subOrgId) {
        await turnkeyClient.loadUserData(result.subOrgId);
        setState(turnkeyClient.getState());
        return true;
      }
      return false;
    } catch (error) {
      console.error('EVM wallet login error:', error);
      return false;
    }
  }, []);

  const handleLoginWithSolanaWallet = useCallback(async () => {
    try {
      const result = await loginWithSolanaWallet();

      if (result.success && result.subOrgId) {
        await turnkeyClient.loadUserData(result.subOrgId);
        setState(turnkeyClient.getState());
        return true;
      }
      return false;
    } catch (error) {
      console.error('Solana wallet login error:', error);
      return false;
    }
  }, []);

  return (
    <TurnkeyContext.Provider
      value={{
        state,
        loginWithGoogle,
        loginWithEVMWallet: handleLoginWithEVMWallet,
        loginWithSolanaWallet: handleLoginWithSolanaWallet,
        logout,
        signTransaction,
        createWallet,
        checkSession,
      }}>
      {children}
    </TurnkeyContext.Provider>
  );
}

export function useTurnkey() {
  const context = useContext(TurnkeyContext);
  if (!context) {
    throw new Error('useTurnkey must be used within TurnkeyProvider');
  }
  return context;
}
