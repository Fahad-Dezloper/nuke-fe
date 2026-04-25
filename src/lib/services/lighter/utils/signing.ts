/**
 * Lighter L2 signing abstraction.
 *
 * Official Lighter signing uses a native library (lighter-go) or WASM port; the browser
 * cannot use the Python `ctypes` signer. Implement `LighterTxSigner` with your WASM/native
 * bridge, then pass it to `LighterService`.
 */

import { ErrorCode, createError } from '@/lib/errors';
import type {
  LighterCancelOrderSignParams,
  LighterCreateOrderSignParams,
  LighterUpdateLeverageSignParams,
  LighterUpdateMarginSignParams,
  SignedL2Tx,
} from '../types';

export interface LighterTxSigner {
  signCreateOrder(params: LighterCreateOrderSignParams): Promise<SignedL2Tx>;
  signCancelOrder(params: LighterCancelOrderSignParams): Promise<SignedL2Tx>;
  signUpdateLeverage(params: LighterUpdateLeverageSignParams): Promise<SignedL2Tx>;
  signUpdateMargin(params: LighterUpdateMarginSignParams): Promise<SignedL2Tx>;

  /**
   * Auth token for gated REST / WebSocket private channels.
   * Format: `{expiry}:{account_index}:{api_key_index}:{random}` (see apidocs.lighter.xyz).
   */
  createAuthToken(deadlineSeconds: number, apiKeyIndex: number): Promise<string>;
}

function notConfigured(): never {
  throw createError(ErrorCode.LIGHTER_SIGNING_NOT_CONFIGURED, {
    hint: 'Inject a WASM/native-backed LighterTxSigner before calling trading methods.',
  });
}

/** Default signer — throws until a real implementation is provided. */
export class StubLighterTxSigner implements LighterTxSigner {
  signCreateOrder(_params: LighterCreateOrderSignParams): Promise<SignedL2Tx> {
    return Promise.reject(notConfigured());
  }

  signCancelOrder(_params: LighterCancelOrderSignParams): Promise<SignedL2Tx> {
    return Promise.reject(notConfigured());
  }

  signUpdateLeverage(_params: LighterUpdateLeverageSignParams): Promise<SignedL2Tx> {
    return Promise.reject(notConfigured());
  }

  signUpdateMargin(_params: LighterUpdateMarginSignParams): Promise<SignedL2Tx> {
    return Promise.reject(notConfigured());
  }

  createAuthToken(_deadlineSeconds: number, _apiKeyIndex: number): Promise<string> {
    return Promise.reject(notConfigured());
  }
}
