import { LighterAdapter } from '@/lib/arbitrage/adapters/lighter-adapter';
import { LighterHttpClient } from './lighter-http.client';
import { LighterService } from './lighter.service';
import { createLighterTxSigner } from './tx-signer-factory';

let http: LighterHttpClient | null = null;
let service: LighterService | null = null;
let adapter: LighterAdapter | null = null;

function ensureLighterHedgeStack(): void {
  if (!http) {
    http = new LighterHttpClient();
    service = new LighterService(http, createLighterTxSigner());
    adapter = new LighterAdapter(service);
  }
}

/** Same `LighterService` instance used by `getSharedLighterAdapter` (one WASM load per session). */
export function getSharedLighterService(): LighterService {
  ensureLighterHedgeStack();
  return service!;
}

export function getSharedLighterAdapter(): LighterAdapter {
  ensureLighterHedgeStack();
  return adapter!;
}
