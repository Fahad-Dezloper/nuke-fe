/**
 * Auth helper for the Automation API (Nest).
 *
 * The executor supports two end-user identification modes (see FRONTEND_INTEGRATION.md):
 * - jwt: `Authorization: Bearer <token>`
 * - header: `X-User-Id: <id>` (trusted gateway / local only)
 *
 * This module supports both, configured client-side via env vars.
 */

import { getJWT } from '@/lib/auth/auth.service';

export const AUTOMATION_ACCESS_TOKEN_STORAGE_KEY = 'nuke-automation-access-token';

export type AutomationAuthMode = 'jwt' | 'header';

export function automationAuthDisabled(): boolean {
  const v = process.env.NEXT_PUBLIC_AUTOMATION_DISABLE_AUTH?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function envAutomationToken(): string | null {
  const t =
    process.env.NEXT_PUBLIC_AUTOMATION_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_AUTOMATION_JWT?.trim();
  return t || null;
}

function mainAppJwtFallbackEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_AUTOMATION_USE_MAIN_APP_JWT?.trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

export function getAutomationAuthMode(): AutomationAuthMode {
  const v = process.env.NEXT_PUBLIC_AUTOMATION_AUTH_MODE?.trim().toLowerCase();
  return v === 'header' ? 'header' : 'jwt';
}

export function getAutomationHeaderUserId(): string | null {
  const v =
    process.env.NEXT_PUBLIC_AUTOMATION_X_USER_ID?.trim() ||
    process.env.NEXT_PUBLIC_AUTOMATION_USER_ID?.trim();
  return v || null;
}

export function getStoredAutomationAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(AUTOMATION_ACCESS_TOKEN_STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function setStoredAutomationAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(AUTOMATION_ACCESS_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(AUTOMATION_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Value for `Authorization: Bearer …` on automation routes.
 */
export function getAutomationBearerToken(): string | null {
  const fromEnv = envAutomationToken();
  if (fromEnv) return fromEnv;

  const fromStorage = getStoredAutomationAccessToken();
  if (fromStorage) return fromStorage;

  if (mainAppJwtFallbackEnabled()) {
    return getJWT();
  }

  return null;
}

export function hasAutomationBearerToken(): boolean {
  return Boolean(getAutomationBearerToken());
}

export function getAutomationAuthHeaders(): { headers: Record<string, string>; mode: AutomationAuthMode } {
  if (automationAuthDisabled()) {
    return { mode: 'jwt', headers: {} };
  }

  const mode = getAutomationAuthMode();
  if (mode === 'header') {
    const userId = getAutomationHeaderUserId();
    if (!userId) {
      return { mode, headers: {} };
    }
    return { mode, headers: { 'X-User-Id': userId } };
  }

  const token = getAutomationBearerToken();
  if (!token) return { mode, headers: {} };
  return { mode, headers: { Authorization: `Bearer ${token}` } };
}
