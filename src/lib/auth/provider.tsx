/**
 * AuthProvider
 *
 * Automatically handles JWT authentication lifecycle:
 *
 * 1. On mount: hydrates token from localStorage.
 * 2. Watches Turnkey login state — when a user logs in (isLoggedIn flips to true),
 *    and there's no valid JWT, triggers background login (sign + POST /auth/login).
 * 3. On Turnkey logout: clears JWT.
 * 4. Proactively re-authenticates before token expiry.
 *
 * This provider should be mounted *inside* TurnkeyProvider so it
 * can read Turnkey state atoms.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { turnkeyStateAtom } from '@/lib/turnkey/store';
import { getEVMAddress } from '@/lib/turnkey/wallet-utils';
import { hydrateAuthAtom, loginAtom, logoutAuthAtom, authStateAtom } from './store';
import { isTokenValid } from './auth.service';
import { getStoredAccessCode } from './access-code';

const MAX_LOGIN_ATTEMPTS = 2;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const turnkeyState = useAtomValue(turnkeyStateAtom);
  const authState = useAtomValue(authStateAtom);
  const hydrate = useSetAtom(hydrateAuthAtom);
  const login = useSetAtom(loginAtom);
  const logoutAuth = useSetAtom(logoutAuthAtom);

  const hasHydrated = useRef(false);
  const loginInFlight = useRef(false);
  const loginAttempts = useRef(0);
  const lastTurnkeySubOrg = useRef<string | null>(null);

  // Step 1: Hydrate from localStorage on mount
  useEffect(() => {
    if (!hasHydrated.current) {
      hydrate();
      hasHydrated.current = true;
    }
  }, [hydrate]);

  // Reset attempt counter when Turnkey identity changes (fresh login)
  useEffect(() => {
    if (
      turnkeyState.turnkeySubOrgId &&
      turnkeyState.turnkeySubOrgId !== lastTurnkeySubOrg.current
    ) {
      lastTurnkeySubOrg.current = turnkeyState.turnkeySubOrgId;
      loginAttempts.current = 0;
    }
  }, [turnkeyState.turnkeySubOrgId]);

  // Step 2: Auto-login when Turnkey session is active but JWT is missing/expired
  useEffect(() => {
    if (!turnkeyState.isLoggedIn) {
      return;
    }

    if (turnkeyState.isLoading || turnkeyState.isLoggingIn) {
      return;
    }

    if (isTokenValid(authState.token)) {
      return;
    }

    if (authState.isAuthenticating || loginInFlight.current) {
      return;
    }

    if (authState.error) {
      // Previous attempt failed — don't auto-retry (costs a Turnkey signature each time)
      return;
    }

    if (loginAttempts.current >= MAX_LOGIN_ATTEMPTS) {
      console.warn(
        `[AuthProvider] Login failed ${MAX_LOGIN_ATTEMPTS} times — giving up to avoid burning Turnkey signatures.`
      );
      return;
    }

    const suborgId = turnkeyState.turnkeySubOrgId;
    const evmAddress = getEVMAddress(turnkeyState.userWallets);

    if (!suborgId || !evmAddress) {
      return;
    }

    loginInFlight.current = true;
    loginAttempts.current += 1;
    const idToken = turnkeyState.googleIdToken ?? undefined;
    const accessCode = getStoredAccessCode() ?? undefined;

    login({ suborgId, evmAddress, organizationId: suborgId, idToken, accessCode })
      .catch((err) => {
        console.error('[AuthProvider] Background login failed:', err);
      })
      .finally(() => {
        loginInFlight.current = false;
      });
  }, [
    turnkeyState.isLoggedIn,
    turnkeyState.isLoading,
    turnkeyState.isLoggingIn,
    turnkeyState.turnkeySubOrgId,
    turnkeyState.userWallets,
    authState.token,
    authState.isAuthenticating,
    authState.error,
    login,
  ]);

  // Step 3: Clear JWT when Turnkey logs out
  useEffect(() => {
    if (!turnkeyState.isLoggedIn && !turnkeyState.isLoading && authState.token) {
      logoutAuth();
    }
  }, [turnkeyState.isLoggedIn, turnkeyState.isLoading, authState.token, logoutAuth]);

  // Step 4: Schedule proactive re-auth before expiry
  useEffect(() => {
    if (!authState.token || !turnkeyState.isLoggedIn) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = authState.token.expiresAtUnix - nowSeconds;

    // Re-auth 60s before expiry (or immediately if almost expired)
    const refreshInMs = Math.max((secondsUntilExpiry - 60) * 1000, 0);

    if (refreshInMs > 24 * 60 * 60 * 1000) {
      // Token is valid for > 24h, skip scheduling
      return;
    }

    const timer = setTimeout(() => {
      const suborgId = turnkeyState.turnkeySubOrgId;
      const evmAddress = getEVMAddress(turnkeyState.userWallets);

      if (suborgId && evmAddress && turnkeyState.isLoggedIn) {
        const idToken = turnkeyState.googleIdToken ?? undefined;
        const refreshAccessCode = getStoredAccessCode() ?? undefined;
        login({
          suborgId,
          evmAddress,
          organizationId: suborgId,
          idToken,
          accessCode: refreshAccessCode,
        }).catch((err) => {
          console.error('[AuthProvider] Token refresh failed:', err);
        });
      }
    }, refreshInMs);

    return () => clearTimeout(timer);
  }, [
    authState.token,
    turnkeyState.isLoggedIn,
    turnkeyState.turnkeySubOrgId,
    turnkeyState.userWallets,
    login,
  ]);

  return <>{children}</>;
}
