/**
 * Lighter L2 API key onboarding (WASM keygen + L1 Turnkey `changePubKey`), persisted in localStorage.
 *
 * An L2 account is **not** created by this file: Lighter associates your EVM wallet with an
 * `account_index` when your first deposit settles (L1/L2 pipeline). Until then,
 * `getAccountInfo(by: l1_address)` returns no accounts — so we either register keys **early**
 * if an account already exists, or **after** a successful deposit we poll until it appears.
 */

import { getAddress } from 'viem';
import { ExchangeClient, InfoClient, WasmSigner } from 'lighter-sdk-client';
import { signMessageWithEVM } from '@/lib/auth/auth.service';
import { ErrorCode, createError, toAppError } from '@/lib/errors';
import {
  LIGHTER_CHAIN_ID_MAINNET,
  LIGHTER_HTTP_MAINNET,
  LIGHTER_WASM_EXEC_PATH_DEFAULT,
  LIGHTER_WASM_PATH_DEFAULT,
} from './constants';
import { getLighterL2Credentials, setLighterL2Credentials, type LighterL2Credentials } from './lighter-credentials';
import { LighterHttpClient } from './lighter-http.client';

/** Lighter reserves low API key indices for web/mobile; app keys should use a higher index (see Lighter API key docs). */
export const LIGHTER_FUNDING_API_KEY_INDEX = 4;

const DEFAULT_ACCOUNT_WAIT_MS = 120_000;
const ACCOUNT_POLL_INTERVAL_MS = 3_000;

const STORAGE_PREFIX = 'nuke_lighter_l2_v1:';

interface PersistedLighterL2V1 {
  v: 1;
  privateKey: string;
  apiKeyIndex: number;
  accountIndex: number;
}

function storageKey(evmChecksummed: string): string {
  return `${STORAGE_PREFIX}${getAddress(evmChecksummed as `0x${string}`).toLowerCase()}`;
}

function hasEnvLighterPrivateKey(): boolean {
  return Boolean(
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LIGHTER_L2_PRIVATE_KEY?.trim()
  );
}

function readPersisted(evmChecksummed: string): PersistedLighterL2V1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(evmChecksummed));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedLighterL2V1>;
    if (
      parsed?.v !== 1 ||
      typeof parsed.privateKey !== 'string' ||
      typeof parsed.apiKeyIndex !== 'number' ||
      typeof parsed.accountIndex !== 'number'
    ) {
      return null;
    }
    return {
      v: 1,
      privateKey: parsed.privateKey,
      apiKeyIndex: parsed.apiKeyIndex,
      accountIndex: parsed.accountIndex,
    };
  } catch {
    return null;
  }
}

function writePersisted(evmChecksummed: string, payload: PersistedLighterL2V1): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(evmChecksummed), JSON.stringify(payload));
  } catch {
    console.warn('[Lighter] Could not persist L2 credentials to localStorage');
  }
}

async function createInitializedWasmSigner(): Promise<InstanceType<typeof WasmSigner>> {
  const wasmPath =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LIGHTER_WASM_PATH
      ? process.env.NEXT_PUBLIC_LIGHTER_WASM_PATH
      : LIGHTER_WASM_PATH_DEFAULT;
  const wasmExecPath =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LIGHTER_WASM_EXEC_PATH
      ? process.env.NEXT_PUBLIC_LIGHTER_WASM_EXEC_PATH
      : LIGHTER_WASM_EXEC_PATH_DEFAULT;

  const signer = new WasmSigner({
    url: LIGHTER_HTTP_MAINNET,
    chainId: LIGHTER_CHAIN_ID_MAINNET,
    wasmPath,
    wasmExecPath,
  });
  await signer.initialize();
  return signer;
}

async function resolveMasterAccountIndex(evmChecksummed: string): Promise<number | null> {
  const info = new InfoClient({ baseURL: LIGHTER_HTTP_MAINNET });
  const accountRes = await info.getAccountInfo({ by: 'l1_address', value: evmChecksummed });
  const accounts = accountRes.accounts ?? [];
  if (accounts.length === 0) return null;
  const sorted = [...accounts].sort((a, b) => a.account_index - b.account_index);
  return sorted[0].account_index;
}

async function waitForMasterAccountIndex(
  evmChecksummed: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<number> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_ACCOUNT_WAIT_MS;
  const intervalMs = options.intervalMs ?? ACCOUNT_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const idx = await resolveMasterAccountIndex(evmChecksummed);
    if (idx !== null) return idx;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw createError(ErrorCode.LIGHTER_HTTP_ERROR, {
    reason: 'lighter_account_timeout',
    detail:
      'Your deposit was sent, but Lighter has not linked an account to this wallet yet. Wait a few minutes and use Add margin again, or check your deposit on Lighter.',
  });
}

async function registerLighterL2ApiKey(input: {
  evmAddressChecksummed: string;
  organizationId: string;
  accountIndex: number;
}): Promise<void> {
  const { evmAddressChecksummed: addr, organizationId, accountIndex } = input;

  const wasm = await createInitializedWasmSigner();
  const seed =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : `${Date.now()}-${Math.random()}`;

  const keys = wasm.generateAPIKey(seed);
  if (keys.error || !keys.privateKey || !keys.publicKey) {
    throw createError(ErrorCode.LIGHTER_WASM_INIT_FAILED, {
      reason: 'generate_api_key',
      detail: keys.error ?? 'missing keys',
    });
  }

  const apiKeyIndex = LIGHTER_FUNDING_API_KEY_INDEX;
  wasm.setAccount(keys.privateKey, apiKeyIndex, accountIndex);

  const exchange = new ExchangeClient({
    baseURL: LIGHTER_HTTP_MAINNET,
    wasmSigner: wasm,
  });

  const http = new LighterHttpClient();
  let nonce: number;
  try {
    nonce = await http.getNextNonce(accountIndex, apiKeyIndex);
  } catch {
    nonce = 0;
  }

  const pubKeyHex = keys.publicKey.startsWith('0x') ? keys.publicKey : `0x${keys.publicKey}`;

  const l1Message = await exchange.generateChangePubKeyL1SignMessage(
    pubKeyHex,
    nonce,
    accountIndex,
    apiKeyIndex
  );

  let l1Sig: string;
  try {
    l1Sig = await signMessageWithEVM(l1Message, addr, organizationId);
  } catch (e) {
    throw toAppError(e, ErrorCode.LIGHTER_SUBMIT_TX_FAILED);
  }

  try {
    await exchange.changePubKey({
      pubKeyHex,
      nonce,
      l1Sig,
    });
  } catch (e) {
    throw toAppError(e, ErrorCode.LIGHTER_SUBMIT_TX_FAILED);
  }

  const check = wasm.checkClient();
  if (check?.error) {
    throw createError(ErrorCode.LIGHTER_CREDENTIALS_MISSING, { checkError: check.error });
  }

  const creds: LighterL2Credentials = {
    privateKey: keys.privateKey,
    apiKeyIndex,
    accountIndex,
  };
  setLighterL2Credentials(creds);
  writePersisted(addr, {
    v: 1,
    privateKey: creds.privateKey,
    apiKeyIndex: creds.apiKeyIndex,
    accountIndex: creds.accountIndex,
  });
}

/**
 * Apply stored L2 credentials for this EVM address when not using env-based dev keys.
 * @returns true if storage existed and credentials were applied.
 */
export function tryApplyStoredLighterCredentials(evmAddress: string): boolean {
  if (hasEnvLighterPrivateKey()) return false;
  const addr = getAddress(evmAddress as `0x${string}`);
  const stored = readPersisted(addr);
  if (!stored) return false;
  setLighterL2Credentials({
    privateKey: stored.privateKey,
    apiKeyIndex: stored.apiKeyIndex,
    accountIndex: stored.accountIndex,
  });
  return true;
}

function hasUsableLighterCredentials(): boolean {
  return getLighterL2Credentials() !== null;
}

/**
 * After a Lighter deposit, ensure L2 API keys exist: wait until Lighter links an account to this
 * L1 address, then run WASM + `changePubKey`. Idempotent if credentials already exist.
 */
export async function finalizeLighterL2KeysAfterDeposit(input: {
  evmAddress: string;
  organizationId: string;
  /** Max time to wait for Lighter to index the new account after first deposit */
  accountWaitTimeoutMs?: number;
}): Promise<void> {
  const { evmAddress, organizationId, accountWaitTimeoutMs } = input;
  const addr = getAddress(evmAddress as `0x${string}`);

  if (hasEnvLighterPrivateKey() || tryApplyStoredLighterCredentials(addr)) {
    return;
  }
  if (hasUsableLighterCredentials()) {
    return;
  }

  const accountIndex = await waitForMasterAccountIndex(addr, { timeoutMs: accountWaitTimeoutMs });
  await registerLighterL2ApiKey({
    evmAddressChecksummed: addr,
    organizationId,
    accountIndex,
  });
}
