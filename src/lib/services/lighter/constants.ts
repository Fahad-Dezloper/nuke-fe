/**
 * Lighter public HTTP / WS bases (see LIGHTER_FE_INTEGRATION.md, apidocs.lighter.xyz).
 * Trading uses L2 API keys + `sendTx`; reads use REST below.
 */

export const LIGHTER_HTTP_MAINNET = 'https://mainnet.zklighter.elliot.ai';

/** WS read-only stream (market stats, etc.) */
export const LIGHTER_WS_MAINNET_READONLY = 'wss://mainnet.zklighter.elliot.ai/stream?readonly=true';

/** Used by official SDKs to pick signing domain / chain id hints */
export const LIGHTER_CHAIN_ID_MAINNET = 304;
export const LIGHTER_CHAIN_ID_TESTNET = 300;

export const LIGHTER_API_PREFIX = '/api/v1';

/**
 * Static assets under `public/wasm/` — matches `lighter-sdk-client` WasmSigner defaults
 * (`/wasm/lighter-signer.wasm`, `/wasm/lighter-wasm-exec.js`) and their README.
 * Override with `NEXT_PUBLIC_LIGHTER_WASM_PATH` / `NEXT_PUBLIC_LIGHTER_WASM_EXEC_PATH` if needed.
 */
export const LIGHTER_WASM_PATH_DEFAULT = '/wasm/lighter-signer.wasm';
export const LIGHTER_WASM_EXEC_PATH_DEFAULT = '/wasm/lighter-wasm-exec.js';
