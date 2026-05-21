# Pacifica End-to-End Flow (This Codebase)

This document explains how Pacifica is integrated in this repo from start to finish:

- access setup (referral via Nuke BE + Pacifica claim; builder via Pacifica approvals API)
- signing format and signature generation
- leverage updates
- opening/closing positions
- request precision rules (tick/lot rounding)
- where each step is orchestrated
- how to port signing to native Solana `web3.js`/wallet signing (no Turnkey)

---

## 1) High-level architecture

Pacifica logic is split across 3 layers:

1. **Core request types + low-level API wrappers**
   - `src/dex/pacifica/types.ts`
   - `src/dex/pacifica/client.ts`
   - `src/dex/pacifica/tpsl-manager.ts`
   - `src/dex/pacifica/utils/*`

2. **Main application service (the real integration used by trading flows)**
   - `src/lib/services/pacifica/pacifica.service.ts`
   - `src/lib/services/pacifica/types.ts`
   - `src/lib/services/pacifica/utils/signing.ts`
   - `src/lib/services/pacifica/utils/turnkey-signing.ts`

3. **Orchestration and strategy flows**
   - `src/lib/hedge-intent/action-executor.ts`
   - `src/lib/arbitrage/adapters/pacifica-adapter.ts`
   - `src/lib/trading/close-position.ts`
   - `src/lib/api/services/positions.service.ts` (for position lookup before close)

---

## 2) Base API + shared constants

- Pacifica API base URL: `https://api.pacifica.fi/api/v1`
  - Defined in `src/dex/pacifica/constants.ts`
- Key trading constants in `src/constants.ts`:
  - `EXPIRY_WINDOW = 300000`
  - `BUILDER_CODE = 'NUKETRADE'`
  - `BUILDER_MAX_FEE_RATE = '0.1'`

In practice, `PacificaService` uses a local service-level expiry window of `30000` ms (`this.expiryWindow`) for most signed trade requests.

---

## 3) The signing model used by Pacifica

## 3.1 Canonical message format

For most signed operations in this repo, the message being signed is:

```json
{
  "timestamp": <number>,
  "type": "<operation_type>",
  "expiry_window": <number, optional>,
  "data": {
    ...operationData
  }
}
```

Then:

1. Recursively sort all JSON keys alphabetically at all nesting levels.
2. Serialize as compact JSON (`JSON.stringify`, no extra spaces).
3. UTF-8 encode to bytes.
4. Ed25519-sign the bytes.
5. Base58-encode the 64-byte signature.

This is implemented in:

- `src/lib/services/pacifica/utils/signing.ts`
- `src/lib/services/pacifica/utils/turnkey-signing.ts`

## 3.2 Important detail: signed payload vs submitted payload

- **Signed message** contains `type`, `timestamp`, optional `expiry_window`, and `data: {...}`.
- **Final HTTP POST body** is flattened:
  - `account`, `signature`, `timestamp`, `expiry_window`
  - plus all operation fields directly (not wrapped in `data`).

This flattening is done throughout `PacificaService` before calling `submitToPacifica(...)`.

---

## 4) Access bootstrap before Pacifica trading

The hedging executor ensures referral + builder prerequisites before deposits/opening positions:

- File: `src/lib/hedge-intent/action-executor.ts`
- Method: `ensurePacificaAccess(...)`

Sequence:

1. **Referral (points, best-effort):** `GET /user/claim-status/pacifica/{userId}`. If that request **errors**, skip Pacifica claim entirely. If `is_claimed` is false, try `POST /referral/user/code/claim` + Nuke record — **any failure is non-fatal** (console only; deposit/open continues).
2. **Builder (orders, required):** If cache miss, `GET /account/builder_codes/approvals?account=<solanaAddress>`. If `NUKETRADE` is already in the list, cache and **do not** call approve. If missing, `POST /account/builder_codes/approve` (failure blocks trading).

### 4.1 Referral claim flow

In `PacificaService.claimReferralCode(...)`:

- Check: `checkReferralClaimedOnBackend(userId)` → Nuke claim-status only.
- Claim: signed `claim_referral_code` → `POST /referral/user/code/claim` with `code: REFERRAL_CODE` (`NUKETRADE`).
- Record: `POST /user/claim/pacifica` on success or Pacifica “already claimed” (DB constraint).

### 4.2 Builder code approval flow

In `PacificaService.approveBuilderCode(...)`:

- Operation type: `approve_builder_code`
- Operation data:
  - `builder_code: NUKETRADE`
  - `max_fee_rate: 0.1`
- Signed with `signOrderRequest(...)` and 5s expiry.
- POST endpoint: `/account/builder_codes/approve`.

This approval enables using `builder_code` on order requests.

---

## 5) Leverage flow

Where leverage update is triggered:

- `src/lib/hedge-intent/action-executor.ts` in `executeOpenPosition(...)`.

Detailed sequence:

1. Fetch current leverage from both exchanges in parallel:
   - Hyperliquid + `pacificaService.fetchLeverage(...)`.
2. Decide per exchange whether update is required.
   - For Pacifica, `null` means default leverage, so update still proceeds.
3. If needed, call `pacificaService.updateLeverage(symbol, leverage, wallet, organizationId)`.

`updateLeverage(...)` internals (`pacifica.service.ts`):

- Validate:
  - wallet + organization exist
  - symbol present
  - leverage range `1..20`
- Build operation:
  - `type: "update_leverage"`
  - `data: { symbol: symbol.toUpperCase(), leverage }`
- Sign.
- Submit POST `/account/leverage` with flattened signed body.
- Return standardized `{ success, message, data/error }`.

---

## 6) Open position flow

Opening Pacifica positions in this codebase is usually market-order driven.

Main orchestration:

- `action-executor.ts` -> `executeOpenPosition(...)`
- calls `pacificaAdapter.openPosition(...)`
- adapter calls `pacificaService.createMarketOrder(...)`

## 6.1 Sizing + direction

In `PacificaAdapter.openPosition(...)`:

- Direction mapping:
  - unified `long` -> Pacifica `bid`
  - unified `short` -> Pacifica `ask`
- Requires a price to convert USD notional to asset amount:
  - `amount = (margin * leverage) / price`
- Builds market order request:
  - symbol, amount, side
  - `slippage_percent` (default `"0.5"`)
  - `reduce_only: false`
  - `builder_code: NUKETRADE`

## 6.2 Market order create details

In `PacificaService.createMarketOrder(...)`:

1. Validate required fields.
2. Normalize symbol to uppercase.
3. Round amount to `lot_size` with `roundAmount(...)`.
4. Build operation data:
   - `symbol`, `amount`, `side`
   - `slippage_percent`
   - `reduce_only`
   - `builder_code` (default to NUKETRADE)
   - optional `client_order_id`
   - optional nested `take_profit` / `stop_loss` (with prices rounded to `tick_size`)
5. Sign using operation type `create_market_order`.
6. Submit POST `/orders/create_market`.
7. Return standardized response (`success`, optional `order_id`, etc.).

## 6.3 Limit order create details

In `PacificaService.createLimitOrder(...)`:

- Similar pipeline, but:
  - includes `price` + `tif`
  - rounds `price` to tick size and `amount` to lot size
  - operation type `create_order`
  - endpoint `/orders/create`

---

## 7) Close position flow

Close is implemented as an opposite-side **reduce-only market order**.

Main path:

1. `action-executor.ts` finds open positions via `positionsService.getOpenPositionsRaw(...)`.
2. `closePacificaPositionAction(...)` calls shared utility:
   - `src/lib/trading/close-position.ts` -> `closePacificaPosition(...)`
3. `closePacificaPosition(...)` chooses close side:
   - if current side is `Long`, close with `ask`
   - if current side is `Short`, close with `bid`
4. Submit `pacificaService.createMarketOrder(...)` with:
   - same symbol
   - current size
   - opposite side
   - `reduce_only: true`
   - slippage `"3"`
   - builder code

No dedicated `closePosition` endpoint is used. Close = reduce-only order.

---

## 8) Cancel flow

`PacificaService.cancelOrder(...)`:

- Requires symbol and at least one identifier:
  - `order_id` OR `client_order_id`
- Signs operation type `cancel_order`.
- POST endpoint: `/orders/cancel`.
- Returns standardized success/error response.

There is also a lower-level client helper in `src/dex/pacifica/client.ts` for cancel-all:

- `/orders/cancel_all`

---

## 9) TP/SL flow (separate manager)

There is a dedicated TP/SL helper in `src/dex/pacifica/tpsl-manager.ts`:

- `prepareSetPositionTpSl(params)`:
  - validates at least one of TP or SL
  - creates unsigned request body (includes `timestamp`, symbol, side, TP/SL structures)
  - returns `{ type: "set_position_tpsl", request, endpoint }`
- `setPositionTpSl(request)`:
  - POSTs to `/positions/tpsl` and expects caller to provide a signed request.

This manager is lower-level and not currently integrated into `PacificaService` in the same way as order/leverage methods.

---

## 10) Precision/rounding and metadata dependency

Pacifica rejects values that are not aligned to symbol increments:

- `amount` must be multiple of `lot_size`
- `price` fields must be multiple of `tick_size`

Implemented in:

- `src/dex/pacifica/utils/rounding.ts`
  - `roundToStep(...)` floors to nearest allowed step
  - `roundAmount(...)`
  - `roundPrice(...)`
- `src/dex/pacifica/utils/get-meta.ts`
  - fetches metadata from backend proxy:
    - `${BACKEND_URL}/pacifica/perp-metadata`
  - caches metadata in-memory for session

Metadata prewarming is triggered by:

- `src/hooks/use-preload-metadata.ts`

---

## 11) Endpoint + operation-type map (quick reference)

- `claim_referral_code` -> `POST /referral/user/code/claim`
- `approve_builder_code` -> `POST /account/builder_codes/approve`
- `update_leverage` -> `POST /account/leverage`
- `create_market_order` -> `POST /orders/create_market`
- `create_order` (limit) -> `POST /orders/create`
- `cancel_order` -> `POST /orders/cancel`
- `set_position_tpsl` -> `POST /positions/tpsl` (via TP/SL manager contract)

Read-only endpoints used by this repo:

- `GET /account/settings?account=<wallet>` (leverage read)
- `GET /account?account=<wallet>` (available margin read)
- `GET /account/builder_codes/approvals?account=<wallet>`

---

## 12) Porting signing from Turnkey to native Solana/web3.js

Your new Telegram bot can keep the same Pacifica payload contract and just replace the signer.

## 12.1 Keep these exact rules

1. Build signing JSON as:
   - `{ timestamp, type, expiry_window?, data }`
2. Recursively sort keys.
3. `JSON.stringify` compact output.
4. UTF-8 encode message bytes.
5. Sign with Ed25519.
6. Base58 encode signature bytes.
7. Submit flattened HTTP body (with `account`, `signature`, `timestamp`, etc.).

If you skip sorting/canonicalization, signatures can fail verification.

## 12.2 Native signing example (private key flow)

```ts
import nacl from 'tweetnacl';
import bs58 from 'bs58';

function sortJsonKeysRecursively(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortJsonKeysRecursively);

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sortJsonKeysRecursively((value as Record<string, unknown>)[key]);
  }
  return out;
}

export function signPacificaMessageWithSecretKey(params: {
  operationType: string;
  operationData: Record<string, unknown>;
  expiryWindow?: number;
  secretKey: Uint8Array; // 64-byte ed25519 secret key
}) {
  const timestamp = Date.now();
  const toSign = {
    timestamp,
    type: params.operationType,
    ...(params.expiryWindow !== undefined ? { expiry_window: params.expiryWindow } : {}),
    data: params.operationData,
  };

  const canonical = JSON.stringify(sortJsonKeysRecursively(toSign));
  const messageBytes = new TextEncoder().encode(canonical);
  const signatureBytes = nacl.sign.detached(messageBytes, params.secretKey);
  const signature = bs58.encode(signatureBytes);

  return { timestamp, signature, canonical };
}
```

## 12.3 Native signing example (wallet adapter signMessage flow)

If your signer is a wallet adapter exposing `signMessage(message: Uint8Array)`, use the same canonical message bytes and then Base58-encode returned signature bytes.

---

## 13) Suggested TG-bot implementation checklist

1. Build a small Pacifica client with:
   - `sign(operationType, operationData, expiryWindow)`
   - `submit(endpoint, body)`
2. Implement these methods first:
   - `updateLeverage`
   - `createMarketOrder`
   - `cancelOrder`
   - `fetchAccountBalance`
3. Add precision safety:
   - load/cached `tick_size` + `lot_size`
   - always round price/amount before signing
4. Implement close helper:
   - fetch position size + side
   - send opposite-side `reduce_only: true` market order
5. Add idempotency:
   - use `client_order_id` for retries
6. Add robust logging:
   - canonical signing message
   - endpoint
   - request body (without secrets)
   - response payload/error code

---

## 14) Practical gotchas from this integration

- Pacifica amount/price precision mismatch can look like generic server failures.
- Use a short `expiry_window` and submit quickly after signing.
- Keep symbol casing consistent (`toUpperCase()` used heavily here).
- Market close is just reduce-only opposite-side market order.
- If you include `builder_code`, ensure builder approval is already complete.
