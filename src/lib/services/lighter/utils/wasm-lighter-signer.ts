/**
 * LighterTxSigner backed by `lighter-sdk-client` WASM (same signing surface as lighter-go).
 */

import { ErrorCode, createError, toAppError } from '@/lib/errors';
import {
  LIGHTER_CHAIN_ID_MAINNET,
  LIGHTER_HTTP_MAINNET,
  LIGHTER_WASM_EXEC_PATH_DEFAULT,
  LIGHTER_WASM_PATH_DEFAULT,
} from '../constants';
import type {
  LighterCancelOrderSignParams,
  LighterCreateOrderSignParams,
  LighterUpdateLeverageSignParams,
  LighterUpdateMarginSignParams,
  SignedL2Tx,
} from '../types';
import { getLighterL2Credentials, type LighterL2Credentials } from '../lighter-credentials';
import type { LighterTxSigner } from './signing';

function toInt(n: bigint | number, field: string): number {
  if (typeof n === 'number') {
    if (!Number.isFinite(n) || !Number.isSafeInteger(n)) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { field, reason: 'unsafe_number' });
    }
    return n;
  }
  if (!Number.isSafeInteger(Number(n))) {
    throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { field, reason: 'bigint_too_large' });
  }
  return Number(n);
}

function parseTxType(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { reason: 'missing_tx_type', raw });
}

/** Default matches lighter-go: nonce `-1` lets the signer fetch next nonce over HTTP. */
function resolveNonce(params: { nonce?: number }): number {
  return params.nonce !== undefined && params.nonce !== null ? params.nonce : -1;
}

export interface WasmLighterSignerConfig {
  wasmPath?: string;
  wasmExecPath?: string;
  chainId?: number;
  baseUrl?: string;
}

export class WasmLighterTxSigner implements LighterTxSigner {
  private wasmSigner: InstanceType<(typeof import('lighter-sdk-client'))['WasmSigner']> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly wasmConfig: WasmLighterSignerConfig = {}) {}

  private getCreds(): LighterL2Credentials {
    const c = getLighterL2Credentials();
    if (!c?.privateKey) {
      throw createError(ErrorCode.LIGHTER_CREDENTIALS_MISSING);
    }
    return c;
  }

  private async ensureWasmLoaded(): Promise<
    InstanceType<(typeof import('lighter-sdk-client'))['WasmSigner']>
  > {
    if (this.wasmSigner) return this.wasmSigner;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const { WasmSigner } = await import('lighter-sdk-client');
          const wasmPath =
            this.wasmConfig.wasmPath ??
            process.env.NEXT_PUBLIC_LIGHTER_WASM_PATH ??
            LIGHTER_WASM_PATH_DEFAULT;
          const wasmExecPath =
            this.wasmConfig.wasmExecPath ??
            process.env.NEXT_PUBLIC_LIGHTER_WASM_EXEC_PATH ??
            LIGHTER_WASM_EXEC_PATH_DEFAULT;

          const signer = new WasmSigner({
            url: this.wasmConfig.baseUrl ?? LIGHTER_HTTP_MAINNET,
            chainId: this.wasmConfig.chainId ?? LIGHTER_CHAIN_ID_MAINNET,
            wasmPath,
            wasmExecPath,
          });
          await signer.initialize();
          const creds = this.getCreds();
          signer.setAccount(creds.privateKey, creds.apiKeyIndex, creds.accountIndex);
          const check = signer.checkClient();
          if (check?.error) {
            throw createError(ErrorCode.LIGHTER_CREDENTIALS_MISSING, { checkError: check.error });
          }
          this.wasmSigner = signer;
        } catch (e) {
          throw toAppError(e, ErrorCode.LIGHTER_WASM_INIT_FAILED);
        }
      })();
    }
    await this.initPromise;
    if (!this.wasmSigner) {
      throw createError(ErrorCode.LIGHTER_WASM_INIT_FAILED);
    }
    return this.wasmSigner;
  }

  private async signerFor(apiKeyOverride?: number) {
    const wasm = await this.ensureWasmLoaded();
    const creds = this.getCreds();
    const apiKey = apiKeyOverride ?? creds.apiKeyIndex;
    wasm.setAccount(creds.privateKey, apiKey, creds.accountIndex);
    return wasm;
  }

  async signCreateOrder(params: LighterCreateOrderSignParams): Promise<SignedL2Tx> {
    const wasm = await this.signerFor(params.apiKeyIndex);
    const res = wasm.signCreateOrder(
      params.marketIndex,
      toInt(params.clientOrderIndex, 'clientOrderIndex'),
      toInt(params.baseAmount, 'baseAmount'),
      toInt(params.price, 'price'),
      params.isAsk ? 1 : 0,
      params.orderType,
      params.timeInForce,
      params.reduceOnly ? 1 : 0,
      params.triggerPrice !== undefined ? toInt(params.triggerPrice, 'triggerPrice') : 0,
      toInt(params.orderExpiry, 'orderExpiry'),
      resolveNonce(params)
    );

    if (res.error) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { signerError: res.error });
    }
    if (!res.txInfo) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { reason: 'empty_tx_info' });
    }
    return { txType: parseTxType(res.txType), txInfo: res.txInfo };
  }

  async signCancelOrder(params: LighterCancelOrderSignParams): Promise<SignedL2Tx> {
    const wasm = await this.signerFor(params.apiKeyIndex);

    const res = wasm.signCancelOrder(params.marketIndex, params.orderIndex, resolveNonce(params));
    if (res.error) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { signerError: res.error });
    }
    if (!res.txInfo) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { reason: 'empty_tx_info' });
    }
    return { txType: parseTxType(res.txType), txInfo: res.txInfo };
  }

  async signUpdateLeverage(params: LighterUpdateLeverageSignParams): Promise<SignedL2Tx> {
    const wasm = await this.signerFor(params.apiKeyIndex);

    const res = wasm.signUpdateLeverage(
      params.marketIndex,
      params.initialMarginFraction,
      params.marginMode,
      resolveNonce(params)
    );
    if (res.error) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { signerError: res.error });
    }
    if (!res.txInfo) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { reason: 'empty_tx_info' });
    }
    return { txType: parseTxType(res.txType), txInfo: res.txInfo };
  }

  async signUpdateMargin(params: LighterUpdateMarginSignParams): Promise<SignedL2Tx> {
    const wasm = await this.signerFor(params.apiKeyIndex);

    const res = wasm.signUpdateMargin(
      params.marketIndex,
      toInt(params.usdcAmount, 'usdcAmount'),
      params.direction,
      resolveNonce(params)
    );
    if (res.error) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { signerError: res.error });
    }
    if (!res.txInfo) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { reason: 'empty_tx_info' });
    }
    return { txType: parseTxType(res.txType), txInfo: res.txInfo };
  }

  async createAuthToken(deadlineSeconds: number, apiKeyIndex: number): Promise<string> {
    const wasm = await this.signerFor(apiKeyIndex);
    const res = wasm.createAuthToken(deadlineSeconds);
    if (res.error || !res.authToken) {
      throw createError(ErrorCode.LIGHTER_SUBMIT_TX_FAILED, { signerError: res.error });
    }
    return res.authToken;
  }
}
