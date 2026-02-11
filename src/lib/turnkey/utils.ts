/**
 * Calculates the SHA-256 hash of a given input string.
 * Uses the Web Crypto API for secure hashing.
 *
 * @param input - The string to hash
 * @returns A hexadecimal string representation of the SHA-256 hash
 *
 * @example
 * ```typescript
 * const hash = await calculateSha256('hello world');
 * console.log(hash); // 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
 * ```
 */
export async function calculateSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if an OAuth redirect is currently in progress by examining the URL hash parameters.
 * Looks for 'id_token' and 'state' parameters in the URL hash, and verifies that
 * the state contains 'provider=google' and 'flow=redirect'.
 *
 * @returns True if an OAuth redirect is in progress, false otherwise
 *
 * @example
 * ```typescript
 * if (isOAuthRedirectInProgress()) {
 *   // Handle OAuth redirect
 * }
 * ```
 */
export function isOAuthRedirectInProgress(): boolean {
  if (typeof window === 'undefined') return false;

  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const idToken = hashParams.get('id_token');
  const state = hashParams.get('state');

  if (idToken && state) {
    const stateParams = new URLSearchParams(state);
    const provider = stateParams.get('provider');
    const flow = stateParams.get('flow');

    return provider === 'google' && flow === 'redirect';
  }

  return false;
}

/**
 * Extracts OAuth parameters from the URL hash.
 * Parses the URL hash to extract 'id_token', 'provider', and 'flow' parameters
 * from the OAuth redirect response.
 *
 * @returns An object containing the extracted OAuth parameters:
 *   - idToken: The OAuth ID token, or null if not present
 *   - provider: The OAuth provider name, or null if not present
 *   - flow: The OAuth flow type, or null if not present
 *
 * @example
 * ```typescript
 * const { idToken, provider, flow } = extractOAuthParams();
 * if (idToken && provider === 'google') {
 *   // Process Google OAuth login
 * }
 * ```
 */
export function extractOAuthParams(): {
  idToken: string | null;
  provider: string | null;
  flow: string | null;
} {
  if (typeof window === 'undefined') {
    return { idToken: null, provider: null, flow: null };
  }

  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const idToken = hashParams.get('id_token');
  const state = hashParams.get('state');

  if (idToken && state) {
    const stateParams = new URLSearchParams(state);
    const provider = stateParams.get('provider');
    const flow = stateParams.get('flow');

    // Validate CSRF token
    const csrfToken = stateParams.get('csrf');
    if (csrfToken) {
      try {
        const storedCsrf = sessionStorage.getItem('oauth_csrf_token');
        if (storedCsrf && storedCsrf !== csrfToken) {
          console.error('[OAuth] CSRF token mismatch — possible CSRF attack');
          return { idToken: null, provider: null, flow: null };
        }
        // Clean up after validation
        sessionStorage.removeItem('oauth_csrf_token');
      } catch { /* sessionStorage not available */ }
    }

    return { idToken, provider, flow };
  }

  return { idToken: null, provider: null, flow: null };
}
