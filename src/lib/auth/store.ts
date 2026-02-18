/**
 * Auth Store
 *
 * Jotai atoms for reactive auth state.
 * The actual logic lives in auth.service.ts — this module
 * exposes it to React components via atoms.
 */

'use client';

import { atom } from 'jotai';
import type { AuthState, AuthToken } from './types';
import {
  login as authLogin,
  getToken,
  setToken,
  clearAuth,
  isTokenValid,
} from './auth.service';
import { trackLogin, trackLogout } from '@/lib/analytics';

// ─── Base Atom ─────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  token: null,
  isAuthenticating: false,
  error: null,
};

export const authStateAtom = atom<AuthState>(initialState);

// ─── Derived Atoms ─────────────────────────────────────────────────────────────

/** Whether the user has a valid JWT */
export const isAuthenticatedAtom = atom((get) => {
  const state = get(authStateAtom);
  return isTokenValid(state.token);
});

/** Whether a login is currently in progress */
export const isAuthenticatingAtom = atom((get) => get(authStateAtom).isAuthenticating);

/** Last auth error message */
export const authErrorAtom = atom((get) => get(authStateAtom).error);

// ─── Action Atoms ──────────────────────────────────────────────────────────────

/**
 * Login action.
 * Signs a message with the EVM wallet and exchanges it for a JWT.
 *
 * @param params.suborgId - Turnkey sub-organization ID
 * @param params.evmAddress - User's EVM wallet address
 * @param params.organizationId - Turnkey organization ID
 */
export const loginAtom = atom(
  null,
  async (
    _get,
    set,
    params: { suborgId: string; evmAddress: string; organizationId: string }
  ) => {
    set(authStateAtom, (prev) => ({
      ...prev,
      isAuthenticating: true,
      error: null,
    }));

    try {
      const response = await authLogin(
        params.suborgId,
        params.evmAddress,
        params.organizationId
      );

      const token: AuthToken = {
        jwt: response.token,
        expiresAtUnix: response.expiresAtUnix,
      };

      set(authStateAtom, {
        token,
        isAuthenticating: false,
        error: null,
      });

      trackLogin('turnkey');
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('[Auth] Login failed:', message);

      set(authStateAtom, (prev) => ({
        ...prev,
        isAuthenticating: false,
        error: message,
      }));

      throw err;
    }
  }
);

/**
 * Logout action.
 * Clears JWT from memory + localStorage.
 */
export const logoutAuthAtom = atom(null, (_get, set) => {
  clearAuth();
  set(authStateAtom, { token: null, isAuthenticating: false, error: null });
  trackLogout();
});

/**
 * Hydrate auth from localStorage on mount.
 * Called once by the AuthProvider.
 */
export const hydrateAuthAtom = atom(null, (_get, set) => {
  const token = getToken();
  if (token && isTokenValid(token)) {
    setToken(token);
    set(authStateAtom, { token, isAuthenticating: false, error: null });
  }
});
