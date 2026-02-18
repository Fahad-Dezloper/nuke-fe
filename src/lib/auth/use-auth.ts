/**
 * useAuth Hook
 *
 * Provides reactive auth state and actions to React components.
 * Auto-login is handled by the AuthProvider — this hook
 * exposes the resulting state and manual controls.
 */

'use client';

import { useAtomValue, useSetAtom } from 'jotai';
import {
  isAuthenticatedAtom,
  isAuthenticatingAtom,
  authErrorAtom,
  loginAtom,
  logoutAuthAtom,
} from './store';

export function useAuth() {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const isAuthenticating = useAtomValue(isAuthenticatingAtom);
  const error = useAtomValue(authErrorAtom);
  const login = useSetAtom(loginAtom);
  const logout = useSetAtom(logoutAuthAtom);

  return {
    isAuthenticated,
    isAuthenticating,
    error,
    login,
    logout,
  };
}
