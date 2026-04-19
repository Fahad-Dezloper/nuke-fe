# Frontend integration — API reference

Single entry point for integrating the **funding-arb** backend from a web or mobile client. All paths are relative to your API base (e.g. `https://api.example.com`).

---

## 1. Server layout

| Prefix | Purpose |
|--------|---------|
| `/` | Health: `GET /` |
| `/auth` | Login / JWT |
| `/user` | User profile |
| `/hyperliquid` | Hyperliquid metadata, positions, deposit helper |
| `/pacifica` | Pacifica metadata, positions, deposit helper |
| `/lighter` | Lighter perp metadata only |
| `/aggregated` | Cross-venue positions (HL + Pacifica), charts, live feed, APR |
| `/bridge` | Solana-origin relay quotes + permit execution |
| `/hedge-intents` | Create hedge, next action, action results |
| `/withdraw-intents` | Withdrawal intents (auth required on this nest) |

CORS: configure `CORS_ALLOWED_ORIGINS` on the server; defaults include `http://localhost:3000` and production domains.

---

## 2. Live market feed (all venues)

**`GET /aggregated/live/market-feed`**

Returns rows filtered to the backend **`TOKEN_LIST`** (`crates/core/src/token_list.rs`). Each row includes optional per-venue snapshots:

```json
{
  "symbol": "BTC",
  "hyperliquid": { "mark_px": 95000.0, "funding": 0.0001, "max_leverage": 50 },
  "pacifica": { "mark_px": 94990.0, "funding": 0.00012, "max_leverage": 20 },
  "backpack": null,
  "lighter": { "mark_px": 95005.0, "funding": 0.000011, "max_leverage": 50 }
}
```

- **`MarketFeedValueStruct`**: `mark_px`, `funding`, `max_leverage` — each can be `null` inside the object, or the whole venue key can be `null` if no data yet.
- **Platform keys in DB / charts**: lowercase strings `hyperliquid`, `pacifica`, `backpack`, `lighter` (see §5).

**FE types (TypeScript sketch)**

```ts
type MarketFeedValue = {
  mark_px: number | null;
  funding: number | null;
  max_leverage: number | null;
};

type LiveMarketFeedRow = {
  symbol: string;
  hyperliquid: MarketFeedValue | null;
  pacifica: MarketFeedValue | null;
  backpack: MarketFeedValue | null;
  lighter: MarketFeedValue | null;
};
```

---

## 3. Aggregated routes

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/aggregated/open-positions/{user_evm_address}/{user_solana_address}` | No | Merges **Hyperliquid + Pacifica** only |
| GET | `/aggregated/closed-positions/{user_evm_address}/{user_solana_address}` | No | Same |
| GET | `/aggregated/chart/{symbol}?timeframe=...` | No | `timeframe` validated; body is `Record<platform, FundingRate[]>` |
| GET | `/aggregated/live/market-feed` | No | §2 |
| GET | `/aggregated/average/apr` | No | `SevenDayApr`: per-symbol maps + spread pairs |

---

## 4. Per-venue HTTP (metadata & single-venue positions)

### Hyperliquid — `/hyperliquid`

| Method | Path |
|--------|------|
| GET | `/hyperliquid/spot-metadata` |
| GET | `/hyperliquid/perp-metadata` |
| GET | `/hyperliquid/open-positions/{user_evm_address}` |
| POST | `/hyperliquid/deposit` |

### Pacifica — `/pacifica`

| Method | Path |
|--------|------|
| GET | `/pacifica/perp-metadata` |
| GET | `/pacifica/open-positions/{user_solana_address}` |
| POST | `/pacifica/deposit` |

### Lighter — `/lighter`

| Method | Path |
|--------|------|
| GET | `/lighter/perp-metadata` |

Returns `MarketInfo[]` with `exchange_id` set to Lighter’s **`market_index`**. Lighter is **market-data only** in this backend (not a hedge leg); details: [LIGHTER_FE_INTEGRATION.md](./LIGHTER_FE_INTEGRATION.md).

---

## 5. `PerpetualExchange` (JSON bodies)

Used in hedge create payloads, withdrawal intents, etc.

- **Serde default**: PascalCase enum names in JSON: `"Hyperliquid"`, `"Pacifica"`, `"Backpack"`, `"Lighter"`.
- **Stored / leg strings** (DB, some responses): lowercase via `Display`: `hyperliquid`, `pacifica`, `backpack`, `lighter`.

**Hedge legs (`HEDGEABLE`)**: `Hyperliquid`, `Pacifica`, `Backpack` only — **`Lighter` is not supported** for automated bridge/deposit in the hedge state machine.

---

## 6. Bridge (Solana → destination)

**`POST /bridge/quote`** — requires auth; validates **Solana USDC** balance for `amount`.

- Origin is fixed to **Solana**; body includes `destinationChainId`, `amount` (string, raw units where applicable), `tradeType`, `recipient`.

**`POST /bridge/execute/permits`** — execute relay permit flow.

Hedge next-actions that bridge use the same Solana-origin model (see hedge service / `BRIDGE_SOL_TO_ARB`).

---

## 7. Hedge intents — `/hedge-intents`

| Method | Path | Notes |
|--------|------|--------|
| POST | `/hedge-intents` | Body: `asset`, `exchanges: [PerpetualExchange, PerpetualExchange]` (two distinct venues from `HEDGEABLE`), `margin_usd`, `leverage` |
| GET | `/hedge-intents/{id}` | Intent + legs |
| GET | `/hedge-intents/{id}/next-action` | State machine output |
| POST | `/hedge-intents/{id}/action-result` | Client reports bridge/deposit/open results |
| GET | `/hedge-intents/user/{user_id}` | List intents |

Deposit action strings you may see: `DEPOSIT_TO_HYPERLIQUID`, `DEPOSIT_TO_PACIFICA`, `DEPOSIT_TO_BACKPACK` (when Backpack is a leg).

---

## 8. Withdraw intents — `/withdraw-intents`

Mounted with **auth middleware** on the nest. Typical paths:

| Method | Path |
|--------|------|
| POST | `/withdraw-intents/create-intent` |
| POST | `/withdraw-intents/transaction` |
| POST | `/withdraw-intents/bridge` |
| GET | `/withdraw-intents/{id}` |
| GET | `/withdraw-intents/{id}/next-action` |
| POST | `/withdraw-intents/{id}/action-result` |
| GET | `/withdraw-intents/user/{user_id}` |

Implementation details evolve with `CreateWithdrawalIntentRequest` (e.g. Solana-only destination) — read `crates/server/src/features/withdraw/controller.rs` for the current contract.

---

## 9. Topic-specific docs

| Doc | Content |
|-----|---------|
| [LIGHTER_FE_INTEGRATION.md](./LIGHTER_FE_INTEGRATION.md) | Lighter-only: metadata, feed, `TOKEN_LIST`, limitations |

If you add **Backpack** server routes (e.g. `/backpack/deposit`) in your branch, document them in a small `BACKPACK_DEPOSIT_FE.md` or extend this file under a **Backpack** section.

---

## 10. Quick FE checklist

- [ ] Types for `LiveMarketFeedRow` include `backpack` and `lighter`.
- [ ] Chart/APR UI accepts platform keys: `hyperliquid`, `pacifica`, `backpack`, `lighter`.
- [ ] Hedge exchange picker only offers `HEDGEABLE` venues (no Lighter until backend supports it).
- [ ] Bridge flows use **Solana** wallet + USDC for quotes.
- [ ] Withdraw flows match current `withdraw` controller validation.
