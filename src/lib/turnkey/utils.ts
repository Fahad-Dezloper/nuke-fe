/**
 * Turnkey Utilities
 * Helper functions for Turnkey operations
 */

/**
 * Calculate SHA-256 hash of input string
 */
export async function calculateSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if OAuth redirect is in progress
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
 * Extract OAuth parameters from URL hash
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

    return { idToken, provider, flow };
  }

  return { idToken: null, provider: null, flow: null };
}
