/**
 * Access Code Storage
 *
 * Persists the validated access code in sessionStorage so it survives
 * the Google OAuth redirect and can be sent with the backend login request.
 */

const ACCESS_CODE_KEY = 'nuke_access_code';

export function storeAccessCode(code: string): void {
  try { sessionStorage.setItem(ACCESS_CODE_KEY, code); } catch { /* noop */ }
}

export function getStoredAccessCode(): string | null {
  try { return sessionStorage.getItem(ACCESS_CODE_KEY); } catch { return null; }
}

export function clearStoredAccessCode(): void {
  try { sessionStorage.removeItem(ACCESS_CODE_KEY); } catch { /* noop */ }
}
