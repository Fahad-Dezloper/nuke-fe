/**
 * In-memory Lighter L2 credentials (API private key + indices).
 *
 * For development you can set `NEXT_PUBLIC_LIGHTER_L2_PRIVATE_KEY`,
 * `NEXT_PUBLIC_LIGHTER_ACCOUNT_INDEX`, `NEXT_PUBLIC_LIGHTER_API_KEY_INDEX`.
 * For production, call `setLighterL2Credentials` after the user completes
 * Lighter API key onboarding (never commit private keys).
 */

export interface LighterL2Credentials {
  /** Hex-encoded Lighter API private key (from official keygen flow). */
  privateKey: string;
  apiKeyIndex: number;
  accountIndex: number;
}

let runtimeCredentials: LighterL2Credentials | null = null;

export function setLighterL2Credentials(credentials: LighterL2Credentials | null): void {
  runtimeCredentials = credentials;
}

export function getLighterL2Credentials(): LighterL2Credentials | null {
  if (runtimeCredentials) return runtimeCredentials;

  if (typeof process === 'undefined') return null;

  const pk = process.env.NEXT_PUBLIC_LIGHTER_L2_PRIVATE_KEY?.trim();
  if (!pk) return null;

  const accountRaw = process.env.NEXT_PUBLIC_LIGHTER_ACCOUNT_INDEX ?? '0';
  const apiKeyRaw = process.env.NEXT_PUBLIC_LIGHTER_API_KEY_INDEX ?? '0';
  const accountIndex = Number.parseInt(accountRaw, 10);
  const apiKeyIndex = Number.parseInt(apiKeyRaw, 10);
  if (!Number.isFinite(accountIndex) || !Number.isFinite(apiKeyIndex)) return null;

  return { privateKey: pk, accountIndex, apiKeyIndex };
}
