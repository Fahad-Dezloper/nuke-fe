# Lighter — FE integration guide

> **See first:** [FE_INTEGRATION.md](./FE_INTEGRATION.md) for the full API map, aggregated routes, hedge/bridge/withdraw, and shared types (`LiveMarketFeedResponse`, `PerpetualExchange`).

This page is **Lighter-only**: how the venue is wired in the backend today, what the FE should add for funding/mark/metadata, and what is **not** supported yet.

---

## Summary: what Lighter does in this repo (today)

| Area | Status |
|------|--------|
| **Live funding + mark** (public WS → DB + in-memory feed) | Implemented |
| **Perp metadata** (REST) | `GET /lighter/perp-metadata` |
| **Aggregated live market feed** | `lighter` field on each symbol row |
| **Charts / 7d APR** | Platform key `"lighter"` when DB has rows |
| **Hedge intents** (bridge / deposit / `OPEN_HEDGE_POSITION`) | **Not** in `HEDGEABLE` — Lighter is **not** a hedge leg in the state machine |
| **User positions** (merged open/closed) | **Not** integrated — only HL + Pacifica |
| **Balance prefetch** (`check_leg_balances`) | **Not** implemented — `"lighter"` falls through to zero balances |
| **Deposit / withdraw** | **No** Lighter-specific server routes |

So on the FE you can treat Lighter as a **fourth market data source** (funding, mark, max leverage, metadata) and optionally show **Lighter-specific UI** that does **not** rely on this backend for trading or user balances.

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

- Router nests **`/lighter`** → single route today:
  - `GET /lighter/perp-metadata`

---

## Core enum: `PerpetualExchange::Lighter`

Defined in `crates/core/src/exchange/types.rs`.

- **String id** (`Display` / DB-style): `"lighter"`
- **Serde JSON** (default enum): `"Lighter"` (PascalCase), same as other exchanges.
- **`chain()`**: `None` (no `Chain` mapping in this codebase).
- **`bridge_action()` / `deposit_action()`**: `None` — hedge funding flow does not know how to auto-bridge or auto-deposit to Lighter.
- **`address_type()`**: **`Evm`** (same family as Hyperliquid for `resolve_address`).
- **`HEDGEABLE`**: **does not include Lighter** — only `Hyperliquid`, `Pacifica`, `Backpack`.

Implications for FE:

- Do **not** send `Lighter` in `POST /hedge-intents` `exchanges` if you expect the backend hedge machine to fund that leg; it is not supported end-to-end here.
- You *can* still show Lighter in **market comparison** UIs using aggregated feed + metadata.

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

### 2) Aggregated live market feed (includes Lighter)

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

### 3) Charts and 7d APR

- **`GET /aggregated/chart/{symbol}?timeframe=...`**  
  Grouped by `platform` string. Expect **`"lighter"`** as a key when historical funding rows exist in Postgres (written by the generic WS funding writer with `platform = "lighter"`).

- **`GET /aggregated/average/apr`**  
  Same: `seven_day_avg_apr` and spread pairs may include **`lighter`**.

### 4) Merged positions (no Lighter)

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

1. On app load (or venue toggle), call **`GET /lighter/perp-metadata`** to populate leverage tables, tick sizes, and optional `exchange_id` for advanced UX.
2. Poll or stream **`GET /aggregated/live/market-feed`** as you already do; read **`lighter`** for each symbol.
3. For historical views, handle **`lighter`** in chart/APR maps the same way you handle `hyperliquid` / `pacifica` / `backpack`.

### Hedge / balances / deposits

- **Hedge**: until backend adds Lighter to `HEDGEABLE` and implements bridge/deposit/balance for it, **do not** offer “open hedge with Lighter leg” against this API—or gate it behind a feature flag and custom flow.
- **“Existing margin” for Lighter**: `check_leg_balances` does not implement `"lighter"`; the hedge helper would see **0** for that leg. Fixing that requires backend work (Lighter account API + auth).
- **User Lighter positions**: not exposed by this backend; integrate Lighter’s own APIs or your indexer if you need them.

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
| `crates/server/src/features/lighter/` | HTTP route + handler |
| `crates/server/src/types.rs` | `LiveMarketFeedResponse.lighter` |
| `bin/executor/src/main.rs` | Spawn order + leverage map |
| `bin/executor/src/feed_manager.rs` | Merge `lighter` into snapshot |
| `crates/core/src/exchange/types.rs` | `PerpetualExchange` / `HEDGEABLE` |

---

## Changelog suggestions (when backend adds full Lighter support)

When you extend the product to **hedge on Lighter**, you will likely need:

1. Add `Lighter` to `PerpetualExchange::HEDGEABLE` (and implement `bridge_action` / `deposit_action` / `chain()` as appropriate).
2. Implement `check_leg_balances` for `"lighter"` (or route via EVM Lighter account).
3. Extend `MergedPositionResponse` (or add Lighter-specific user endpoints).
4. Optional: deposit/withdraw routes mirroring other venues.

Until then, this document reflects **market-data + metadata only** integration.

---

## Related

- [FE_INTEGRATION.md](./FE_INTEGRATION.md) — full FE API map, aggregated routes, hedge/bridge/withdraw, shared types.
