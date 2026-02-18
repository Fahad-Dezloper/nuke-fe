/**
 * Auth Service
 *
 * Production-grade JWT authentication service.
 * Handles login (message signing → JWT), token persistence,
 * expiry management, and automatic re-authentication.
 *
 * This module is React-agnostic — it can be used from hooks, atoms,
 * service workers, or plain utility functions.
 */

import { TURNKEY_API_BASE_URL } from '@/lib/turnkey/constants';
import type { LoginRequest, LoginResponse, AuthToken } from './types';
import { AUTH_STORAGE_KEYS, TOKEN_EXPIRY_BUFFER_SECONDS } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── In-flight login deduplication ─────────────────────────────────────────────
// Prevents concurrent login attempts from racing with each other.
let loginPromise: Promise<LoginResponse> | null = null;

// ─── Token Storage ─────────────────────────────────────────────────────────────

function persistToken(token: AuthToken): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, token.jwt);
    localStorage.setItem(AUTH_STORAGE_KEYS.EXPIRY, String(token.expiresAtUnix));
  } catch {
    // SSR or storage quota — token lives in memory only
    console.warn('[Auth] localStorage unavailable, token not persisted');
  }
}

function loadToken(): AuthToken | null {
  try {
    const jwt = localStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
    const expiry = localStorage.getItem(AUTH_STORAGE_KEYS.EXPIRY);
    if (!jwt || !expiry) return null;
    return { jwt, expiresAtUnix: Number(expiry) };
  } catch {
    return null;
  }
}

function clearPersistedToken(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.EXPIRY);
  } catch {
    // ignore
  }
}

// ─── Token Validity ────────────────────────────────────────────────────────────

export function isTokenValid(token: AuthToken | null): boolean {
  if (!token) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds < token.expiresAtUnix - TOKEN_EXPIRY_BUFFER_SECONDS;
}

// ─── Signing Helper ────────────────────────────────────────────────────────────

/**
 * Sign an arbitrary string message with the user's EVM wallet via Turnkey.
 * Uses `TurnkeySigner.signMessage()` from `@turnkey/ethers`.
 */
async function signMessageWithEVM(
  message: string,
  evmAddress: string,
  organizationId: string
): Promise<string> {
  const { Turnkey } = await import('@turnkey/sdk-browser');
  const { TurnkeySigner } = await import('@turnkey/ethers');

  const turnkey = new Turnkey({
    apiBaseUrl: TURNKEY_API_BASE_URL,
    defaultOrganizationId: organizationId,
  });

  const indexedDbClient = await turnkey.indexedDbClient();
  await indexedDbClient.init();

  const signer = new TurnkeySigner({
    client: indexedDbClient,
    organizationId,
    signWith: evmAddress,
  });

  return signer.signMessage(message);
}

// ─── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate with the backend.
 *
 * 1. Build a deterministic login message.
 * 2. Sign it with the user's EVM wallet via Turnkey.
 * 3. POST signature to `/auth/login`.
 * 4. Persist the returned JWT.
 *
 * Concurrent calls are deduplicated — only one network roundtrip fires.
 */
export async function login(
  suborgId: string,
  evmAddress: string,
  organizationId: string
): Promise<LoginResponse> {
  // Deduplicate concurrent calls
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      // Build a human-readable, timestamped message
      const timestamp = Date.now();
      const message = `Sign in to Nuke\nAddress: ${evmAddress}\nTimestamp: ${timestamp}`;

      // Sign with Turnkey EVM signer
      const signature = await signMessageWithEVM(message, evmAddress, organizationId);

      // POST to backend
      const body: LoginRequest = { suborgId, message, signature };

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(errData.message || `Login failed (${res.status})`);
      }

      const data: LoginResponse = await res.json();

      // Persist token
      const authToken: AuthToken = {
        jwt: data.token,
        expiresAtUnix: data.expiresAtUnix,
      };
      persistToken(authToken);

      return data;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

// ─── Token Access ──────────────────────────────────────────────────────────────

// In-memory token cache (faster than localStorage reads on every request)
let memoryToken: AuthToken | null = null;

/**
 * Returns the current valid JWT, or null if not authenticated / expired.
 */
export function getToken(): AuthToken | null {
  // Check memory first
  if (memoryToken && isTokenValid(memoryToken)) return memoryToken;

  // Fallback to localStorage
  const stored = loadToken();
  if (stored && isTokenValid(stored)) {
    memoryToken = stored;
    return stored;
  }

  // Token expired or missing
  memoryToken = null;
  return null;
}

/**
 * Returns the raw JWT string for use in Authorization headers.
 * Returns null if not authenticated.
 */
export function getJWT(): string | null {
  return getToken()?.jwt ?? null;
}

/**
 * Sets the token (used by the store after login).
 */
export function setToken(token: AuthToken): void {
  memoryToken = token;
  persistToken(token);
}

/**
 * Clear all auth state — used on logout or 401.
 */
export function clearAuth(): void {
  memoryToken = null;
  clearPersistedToken();
}

/**
 * Returns true if the user has a valid (non-expired) JWT.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
