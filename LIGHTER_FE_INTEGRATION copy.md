# Lighter — FE integration guide

> **See first:** [FE_INTEGRATION.md](./FE_INTEGRATION.md) for the full API map, aggregated routes, hedge/bridge/withdraw, and shared types (`LiveMarketFeedResponse`, `PerpetualExchange`).

This page is **Lighter-only**: how the venue is wired in the backend today, what the FE should add for funding/mark/metadata, and what is **not** supported yet.

---

## Summary: what Lighter does in this repo (today)

| Area | Status |
|------|--------|
| **Live funding + mark** (public WS → DB + in-memory feed) | Implemented |
| **Perp metadata** (REST) | `GET /lighter/perp-metadata` exists on backend; **nuke-fe may skip it** and use aggregated feed + direct Lighter reads instead (see below) |
| **Aggregated live market feed** | `lighter` field on each symbol row |
| **Charts / 7d APR** | Platform key `"lighter"` when DB has rows |
| **Hedge intents** (bridge / deposit / `OPEN_HEDGE_POSITION`) | `Lighter` is in `HEDGEABLE` with `chain()` = Ethereum, `deposit_action` = `DEPOSIT_TO_LIGHTER`, `bridge_action` = `BRIDGE_SOL_TO_ETH` — see hedge services for full behaviour |
| **User positions** (merged open/closed) | **Not** integrated — only HL + Pacifica |
| **Balance prefetch** (`check_leg_balances`) | **Partial** — on-chain ETH mainnet USDC is checked; Lighter **margin** API is not wired yet (margin treated as `0` in code) |
| **Deposit** | **`POST /lighter/deposit`** — USDC permit + L1 deposit relay (see [LIGHTER_DEPOSIT_FE_INTEGRATION.md](./LIGHTER_DEPOSIT_FE_INTEGRATION.md)) |
| **Withdraw** | **No** Lighter-specific withdraw route in this repo |

So on the FE you can treat Lighter as a **fourth market data source** (funding, mark, max leverage, metadata) and use **`POST /lighter/deposit`** for Ethereum mainnet USDC deposits into Lighter via JWT `evm_address`.

---

## Backend architecture (where Lighter lives)

### Crate: `crates/lighter`

- **HTTP base**: `https://mainnet.zklighter.elliot.ai`
- **WS base**: `wss://mainnet.zklighter.elliot.ai/stream?readonly=true`
- **Market discovery**: `GET {LIGHTER_HTTP_URL}/api/v1/orderBookDetails?filter=perp`
  - Response: `order_book_details[]` with `symbol`, `market_id`, `market_type`, `status`, sizing, `min_initial_margin_fraction`, etc.
  - Only entries with `market_type == "perp"` and `status == "active"` become perp markets.
- **Funding feed**: subscribes per market to  
  `{"type":"subscribe","channel":"market_stats/{market_index}"}`  
  Parses `update/market_stats` / `subscribed/market_stats` payloads; uses `current_funding_rate` or `funding_rate` (percentage strings → **decimal** rate internally).

### Executor: `bin/executor`

On startup the executor:

1. Builds `lighter_leverage: HashMap<symbol, max_leverage>` from `LighterExchange::fetch_active_perp_markets()`.
2. Spawns `lighter::start_lighter_funding_feed(db, feed_tx)` alongside HL / Pacifica / Backpack.
3. `feed_manager` merges updates into `LiveMarketFeedResponse` and sets `lighter.max_leverage` from that map.

### Server: `crates/server`

- Router nests **`/lighter`**:
  - `GET /lighter/perp-metadata`
  - `POST /lighter/deposit` (auth required — see [LIGHTER_DEPOSIT_FE_INTEGRATION.md](./LIGHTER_DEPOSIT_FE_INTEGRATION.md))

---

## Core enum: `PerpetualExchange::Lighter`

Defined in `crates/core/src/exchange/types.rs`.

- **String id** (`Display` / DB-style): `"lighter"`
- **Serde JSON** (default enum): `"Lighter"` (PascalCase), same as other exchanges.
- **`chain()`**: **`Some(Chain::ETHEREUM)`** — L1 for this venue’s deposit/bridge mapping in core.
- **`bridge_action()`**: **`Some("BRIDGE_SOL_TO_ETH")`** — hedge state machine uses this as the **`action`** string on `GET /hedge-intents/:id/next-action` when a Lighter leg needs a bridge (see `crates/server/src/services/hedge.rs` → `bridge_action_for`: `origin_chain_id` is **Solana**, destination is the leg’s chain, i.e. **Ethereum** for Lighter).
- **`deposit_action()`**: **`Some("DEPOSIT_TO_LIGHTER")`** — same `action` field for the deposit step after bridge.
- **`address_type()`**: **`Evm`** — `resolve_address` uses **`evm_address`** for Lighter legs.
- **`HEDGEABLE`**: includes **`Lighter`** alongside `Hyperliquid`, `Pacifica`, `Backpack`.

### FE naming vs backend `action` strings

The API returns the **exact** strings from `PerpetualExchange` (`BRIDGE_SOL_TO_ETH`, `DEPOSIT_TO_LIGHTER`, …). Your app may use **local aliases** (e.g. `BRIDGE_BASE_TO_LIGHTER` in `types.ts`) as long as the **executor** maps them to the same funded outcome and reports **`POST /hedge-intents/:id/action-result`** in the shape the backend expects. If your bridge path is **Base → Ethereum** (or any non–Solana-origin flow), confirm it still satisfies the hedge leg’s funding assumptions or align the backend `bridge_action` / params with product.

Implications for FE:

- You **can** send `Lighter` in `POST /hedge-intents` `exchanges` when the product supports that leg; wire **`action`** from `next-action` to your bridge/deposit handlers (see [LIGHTER_DEPOSIT_FE_INTEGRATION.md](./LIGHTER_DEPOSIT_FE_INTEGRATION.md) for `POST /lighter/deposit`).
- Lighter **margin prefetch** in this backend may still treat L2 margin as **0** in some paths; nuke-fe can supplement with **`fetchLighterAvailableUsd`** (L2) when keys/account exist — same “partial” story as the summary table.

---

## Symbol alignment (`TOKEN_LIST`)

Lighter WS parsing **drops** any symbol not in `perp_core::token_list::TOKEN_LIST` (see `crates/core/src/token_list.rs`).

- Lighter perp symbols are expected to match those bare names (e.g. `BTC`, `SOL`, `TAO`), not `BTC_USDC` style.
- If Lighter returns a symbol not in `TOKEN_LIST`, you will **not** see it in `/aggregated/live/market-feed` for that venue.

The executor logs a warning if some `TOKEN_LIST` symbols are missing from Lighter’s order book response.

---

## HTTP APIs for the FE

### 1) Perp metadata (Lighter-specific)

**`GET /lighter/perp-metadata`**

- **Auth**: not required (same pattern as other public metadata routes).
- **Response**: `MarketInfo[]` from `perp_core`:

```json
[
  {
    "symbol": "BTC",
    "max_leverage": 50,
    "tick_size": 0.1,
    "min_order_size": 0.0002,
    "size_decimals": 5,
    "is_active": true,
    "exchange_id": 1
  }
]
```

- **`exchange_id`**: Lighter **`market_index`** — use this if you later subscribe to Lighter directly from the browser or map UI rows to Lighter’s `market_stats/{index}` channel.

Compare with Hyperliquid/Pacifica metadata routes; Lighter only exposes **perp** list here (no spot split in this codebase).

### 2) Deposit (Lighter-specific)

**`POST /lighter/deposit`**

- **Auth:** JWT required (`Authorization: Bearer <token>`).
- **Body:** `amount` (string, 6-decimal USDC units), `permit` (EIP-2612 `v` / `r` / `s` / `deadline`), optional `asset_index` / `route_type`.
- **User:** `evm_address` from JWT (not in body).

Full contract: [LIGHTER_DEPOSIT_FE_INTEGRATION.md](./LIGHTER_DEPOSIT_FE_INTEGRATION.md).

### 3) Aggregated live market feed (includes Lighter)

**`GET /aggregated/live/market-feed`**

Each row (after `TOKEN_LIST` filter) includes:

```json
{
  "symbol": "BTC",
  "hyperliquid": { "mark_px": null, "funding": null, "max_leverage": null },
  "pacifica": { ... },
  "backpack": { ... },
  "lighter": {
    "mark_px": 95000.5,
    "funding": 0.000012,
    "max_leverage": 50
  }
}
```

Notes:

- Any venue key may be `null` if no update yet for that symbol.
- **Funding** for Lighter is stored **as a decimal rate** in the feed snapshot (the backend converts Lighter’s percentage string to a rate; executor also rounds funding to 12 decimal places in the feed manager).

### 4) Charts and 7d APR

- **`GET /aggregated/chart/{symbol}?timeframe=...`**  
  Grouped by `platform` string. Expect **`"lighter"`** as a key when historical funding rows exist in Postgres (written by the generic WS funding writer with `platform = "lighter"`).

- **`GET /aggregated/average/apr`**  
  Same: `seven_day_avg_apr` and spread pairs may include **`lighter`**.

### 5) Merged positions (no Lighter)

**`GET /aggregated/open-positions/...`** and **`.../closed-positions/...`** still only merge **Hyperliquid + Pacifica**. There is **no** `lighter` field on those DTOs.

---

## FE implementation checklist

### Types

Extend your `LiveMarketFeedRow` (or equivalent) with:

```ts
lighter?: {
  mark_px: number | null;
  funding: number | null;
  max_leverage: number | null;
} | null;
```

For metadata:

```ts
type MarketInfo = {
  symbol: string;
  max_leverage: number;
  tick_size: number;
  min_order_size: number;
  size_decimals: number;
  is_active: boolean;
  exchange_id: number | null; // Lighter market_index when present
};
```

### Data fetching

1. **`GET /lighter/perp-metadata`** (backend) — **optional**. Use it if you want a single `MarketInfo[]` from Nuketrade. **nuke-fe today** often skips this route and instead uses **`GET /aggregated/live/market-feed`** (embedded `lighter`: mark, funding, max leverage) plus **direct Lighter HTTP** (e.g. `lighter-reads` / `InfoClient`-style calls) for sizing, ticks, or `market_index` — avoid duplicating the same data three ways unless you need redundancy.
2. Poll or stream **`GET /aggregated/live/market-feed`**; read **`lighter`** on each symbol row (this matches nuke-fe `market-feed.service.ts` patterns).
3. For historical views, handle **`lighter`** in chart/APR maps the same way you handle `hyperliquid` / `pacifica` / `backpack` (nuke-fe: `chart.service`, `apr.service`, funding chart components).

### Hedge / balances / deposits

- **Hedge**: `Lighter` is hedgeable in `PerpetualExchange`; validate end-to-end behaviour (bridge + deposit actions) in your environment before exposing in production UI.
- **“Existing margin” for Lighter**: margin balance query may still return **0** until L2 account mapping is wired; on-chain ETH USDC is used where implemented.
- **Deposit**: use **`POST /lighter/deposit`** per [LIGHTER_DEPOSIT_FE_INTEGRATION.md](./LIGHTER_DEPOSIT_FE_INTEGRATION.md).
- **User Lighter positions**: not exposed by this backend; integrate Lighter’s own APIs or your indexer if you need them.

---

## nuke-fe alignment (reference snapshot)

This section records how **nuke-fe** (reference app) lines up with this doc and the backend — useful when the copy doc and production FE diverge.

| Doc / backend area | Typical nuke-fe behaviour | Notes |
|--------------------|---------------------------|--------|
| Live funding + mark / aggregated feed | **Yes** — models `lighter` on each row; polling builds dropdowns with Lighter APR / mark / max leverage from feed | Matches backend `GET /aggregated/live/market-feed`. |
| `GET /lighter/perp-metadata` | **Often not called** — no dedicated fetch like some other venues | Leverage / sizing may come from **Lighter public API** reads + feed; calling this Nuketrade route is **optional** redundancy. |
| Charts / 7d APR `"lighter"` | **Yes** | Chart + APR services include `lighter`. |
| `POST /lighter/deposit` | **Yes** — JWT client, USDC permit on Ethereum mainnet, `asset_index` / `route_type` | Aligns with [LIGHTER_DEPOSIT_FE_INTEGRATION.md](./LIGHTER_DEPOSIT_FE_INTEGRATION.md). |
| Add margin (bridge + deposit + L2 keys) | **Yes** — bridge to Ethereum, deposit, `finalizeLighterL2KeysAfterDeposit` when L2 creds missing | Product-specific sequencing beyond this markdown. |
| Hedge bridge + deposit + open + close | **Mostly yes** — maps backend `action` names through executor; Lighter adapter when creds exist | Backend emits **`BRIDGE_SOL_TO_ETH`** / **`DEPOSIT_TO_LIGHTER`**; FE may use different **internal** enum labels — keep `next-action.action` in sync with what you report to `action-result`. |
| Merged positions API | **Backend only** — still HL + Pacifica on merged DTOs | FE may still show Lighter elsewhere (arbitrage / adapters); doc remains accurate for **merged** REST. |
| Lighter withdraw | **No** full L1 withdraw in this backend | UI may list Lighter in withdrawal types; no matching server route here. |
| Balance / margin | **Partial** — backend Lighter margin prefetch may be `0`; nuke-fe may use **L2** `fetchLighterAvailableUsd` when account exists | Matches “partial” story above. |

---

## Reference: external Lighter endpoints used by the backend

These are **not** proxied by this server; documented here so FE engineers can align terminology or debug.

| Purpose | Method | URL (relative to `LIGHTER_HTTP_URL`) |
|--------|--------|----------------------------------------|
| Perp market list | GET | `/api/v1/orderBookDetails?filter=perp` |
| Funding WS (readonly) | WebSocket | `wss://mainnet.zklighter.elliot.ai/stream?readonly=true` |
| Subscribe | send JSON | `{"type":"subscribe","channel":"market_stats/{market_index}"}` |

---

## Files to read in the repo (for deeper changes)

| Path | Role |
|------|------|
| `crates/lighter/src/exchange_impl.rs` | REST fetch, WS subscribe format, message parse, funding % → rate |
| `crates/lighter/src/ws.rs` | TOKEN_LIST filter, feed bootstrap |
| `crates/lighter/src/helpers/markets.rs` | `LighterPerpMarket` derivation from order book detail |
| `crates/server/src/features/lighter/` | HTTP routes + handlers (`perp-metadata`, `deposit`) |
| `crates/lighter/src/services/deposit.rs` | L1 USDC permit + `deposit` relay |
| `crates/server/src/types.rs` | `LiveMarketFeedResponse.lighter` |
| `bin/executor/src/main.rs` | Spawn order + leverage map |
| `bin/executor/src/feed_manager.rs` | Merge `lighter` into snapshot |
| `crates/core/src/exchange/types.rs` | `PerpetualExchange` / `HEDGEABLE` |

---

## Changelog / follow-ups

Possible next steps:

1. Wire **Lighter margin** balance for smarter hedge prefetch (today margin may read as `0`).
2. Extend `MergedPositionResponse` (or add Lighter-specific user endpoints).
3. Optional: **withdraw** route mirroring other venues.

This document reflects **market-data + metadata + L1 deposit** integration; withdraw remains out of scope here.

---

## Related

- [FE_INTEGRATION.md](./FE_INTEGRATION.md) — full FE API map, aggregated routes, hedge/bridge/withdraw, shared types.
