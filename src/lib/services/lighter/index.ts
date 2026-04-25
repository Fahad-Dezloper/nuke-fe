export * from './constants';
export * from './types';
export * from './utils/tx-constants';
export * from './lighter-reads';
export { LighterHttpClient, type LighterHttpClientOptions } from './lighter-http.client';
export { LighterService, type LighterSendTxOptions } from './lighter.service';
export { StubLighterTxSigner, type LighterTxSigner } from './utils/signing';
export { WasmLighterTxSigner, type WasmLighterSignerConfig } from './utils/wasm-lighter-signer';
export {
  setLighterL2Credentials,
  getLighterL2Credentials,
  type LighterL2Credentials,
} from './lighter-credentials';
export {
  finalizeLighterL2KeysAfterDeposit,
  tryApplyStoredLighterCredentials,
  LIGHTER_FUNDING_API_KEY_INDEX,
} from './lighter-onboarding';
export { createLighterTxSigner } from './tx-signer-factory';
export { getSharedLighterAdapter, getSharedLighterService } from './lighter-shared-adapter';

import { LighterHttpClient } from './lighter-http.client';
import { LighterService } from './lighter.service';
import { createLighterTxSigner } from './tx-signer-factory';

/** Shared HTTP client for public Lighter reads. */
export const lighterHttpClient = new LighterHttpClient();

/** Default service: uses WASM signer when `getLighterL2Credentials()` is set, else stub. */
export const lighterService = new LighterService(lighterHttpClient, createLighterTxSigner());
