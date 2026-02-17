/**
 * Auth Module Types
 *
 * Shared type definitions for the JWT authentication layer.
 */

// ─── API Types ─────────────────────────────────────────────────────────────────

export interface LoginRequest {
  suborgId: string;
  message: string;
  signature: string;
}

export interface LoginResponse {
  token: string;
  evmAddress: string;
  solanaAddress: string;
  expiresAtUnix: number;
}

// ─── Token State ───────────────────────────────────────────────────────────────

export interface AuthToken {
  jwt: string;
  expiresAtUnix: number;
}

// ─── Auth State ────────────────────────────────────────────────────────────────

export interface AuthState {
  /** Current JWT token (null if not authenticated) */
  token: AuthToken | null;
  /** Whether a login request is in-flight */
  isAuthenticating: boolean;
  /** Last authentication error */
  error: string | null;
}

// ─── Storage Keys ──────────────────────────────────────────────────────────────

export const AUTH_STORAGE_KEYS = {
  TOKEN: 'nuke_auth_token',
  EXPIRY: 'nuke_auth_expiry',
} as const;

/**
 * Buffer (in seconds) subtracted from the actual expiry to trigger
 * proactive re-authentication before the token expires mid-request.
 */
export const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
