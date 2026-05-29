/**
 * Access code storage for beta gate + backend login / Phoenix invite.
 *
 * - sessionStorage: survives Google OAuth redirect in the same tab
 * - localStorage: remembers validation on this device (logout does not clear it)
 */

const ACCESS_CODE_KEY = 'nuke_access_code';
const ACCESS_GRANTED_AT_KEY = 'nuke_access_granted_at';

/** Keys restored after Turnkey `logout()` (it calls `localStorage.clear()`). */
export const ACCESS_CODE_LOCAL_STORAGE_KEYS = [
  ACCESS_CODE_KEY,
  ACCESS_GRANTED_AT_KEY,
] as const;

/** How long a validated access code is remembered on this browser (90 days). */
const DEVICE_GRANT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Snapshot before `localStorage.clear()` so logout does not drop the beta gate grant. */
export function snapshotAccessCodeGrant(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;

  const snap: Record<string, string> = {};
  for (const key of ACCESS_CODE_LOCAL_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) snap[key] = value;
  }
  return Object.keys(snap).length > 0 ? snap : null;
}

export function restoreAccessCodeGrant(snapshot: Record<string, string> | null): void {
  if (!snapshot || typeof window === 'undefined') return;

  try {
    for (const [key, value] of Object.entries(snapshot)) {
      localStorage.setItem(key, value);
    }
  } catch {
    /* noop */
  }
}

function clearDeviceAccessGrant(): void {
  try {
    sessionStorage.removeItem(ACCESS_CODE_KEY);
    localStorage.removeItem(ACCESS_CODE_KEY);
    localStorage.removeItem(ACCESS_GRANTED_AT_KEY);
  } catch {
    /* noop */
  }
}

/**
 * True if this browser already passed access-code validation (e.g. after logout reconnect).
 */
export function hasDeviceAccessGrant(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const grantedAt = localStorage.getItem(ACCESS_GRANTED_AT_KEY);
    if (!grantedAt) return false;

    const ts = Number(grantedAt);
    if (!Number.isFinite(ts) || Date.now() - ts > DEVICE_GRANT_TTL_MS) {
      clearDeviceAccessGrant();
      return false;
    }

    return Boolean(localStorage.getItem(ACCESS_CODE_KEY)?.trim());
  } catch {
    return false;
  }
}

/** Persist code after successful validation (device + session for OAuth). */
export function markAccessCodeGranted(code: string): void {
  const trimmed = code.trim();
  if (!trimmed) return;

  try {
    sessionStorage.setItem(ACCESS_CODE_KEY, trimmed);
    localStorage.setItem(ACCESS_CODE_KEY, trimmed);
    localStorage.setItem(ACCESS_GRANTED_AT_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}

/** @deprecated Prefer {@link markAccessCodeGranted}. */
export function storeAccessCode(code: string): void {
  markAccessCodeGranted(code);
}

export function getStoredAccessCode(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return (
      sessionStorage.getItem(ACCESS_CODE_KEY)?.trim() ||
      localStorage.getItem(ACCESS_CODE_KEY)?.trim() ||
      null
    );
  } catch {
    return null;
  }
}

/** Clears device + session grant (not called on wallet logout). */
export function clearStoredAccessCode(): void {
  clearDeviceAccessGrant();
}
