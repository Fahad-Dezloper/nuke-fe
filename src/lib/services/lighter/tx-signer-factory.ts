import { getLighterL2Credentials } from './lighter-credentials';
import type { LighterTxSigner } from './utils/signing';
import { StubLighterTxSigner } from './utils/signing';
import { WasmLighterTxSigner } from './utils/wasm-lighter-signer';

export function createLighterTxSigner(): LighterTxSigner {
  return getLighterL2Credentials() ? new WasmLighterTxSigner() : new StubLighterTxSigner();
}
