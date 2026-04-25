# Lighter deposits — frontend integration

This backend exposes **`POST /lighter/deposit`**, which relays a **USDC EIP-2612 permit** and a **Lighter L1 deposit** on **Ethereum mainnet** using a server-side fee payer. The user’s L1 address comes from the JWT (`evm_address`); the user only signs the permit in the browser.

For Lighter **market data** (metadata, funding, mark), see [LIGHTER_FE_INTEGRATION.md](./LIGHTER_FE_INTEGRATION.md) and [FE_INTEGRATION.md](./FE_INTEGRATION.md).

---

## What this endpoint does (and does not)

| Topic | Behavior |
|--------|-----------|
| **Chain** | **Ethereum mainnet only** for this route (USDC + Lighter bridge contract on L1). |
| **User identity** | `owner` / `_to` for deposit is **`claims.evm_address`** from the JWT — not a field in the JSON body. |
| **Spend approval** | **EIP-2612 `permit`** on mainnet USDC for the Lighter deposit contract as `spender`. If allowance is already sufficient, the server **skips** sending a permit tx. |
| **Who pays gas** | Server **fee payer** (`evm_fee_payer_private_key`) submits `permit` (if needed) + `deposit` txs. |
| **CCTP / other EVM chains** | **Not** implemented here — use [Lighter’s docs](https://apidocs.lighter.xyz/docs/deposits-transfers-and-withdrawals) for Arbitrum/Base/etc. |

Implementation reference: `crates/lighter/src/services/deposit.rs`, `crates/server/src/features/lighter/controller.rs`.

---

## HTTP API

### `POST /lighter/deposit`

- **Full path:** `{API_ORIGIN}/lighter/deposit`
- **Auth:** required — `Authorization: Bearer <jwt>` (same global `require_post_auth` as other POST routes).
- **Content-Type:** `application/json`

#### Request body (`LighterDepositRequest`)

| Field | Type | Required | Notes |
|--------|------|----------|--------|
| `amount` | `string` | yes | USDC in **6-decimal base units** (integer as string), e.g. `"1000000"` = 1 USDC. Parsed as `u64` server-side. |
| `permit` | object | yes | EIP-2612 signature over USDC `permit`. |
| `permit.v` | `number` | yes | Recovery id (27 or 28, or 0/1 depending on your signer — normalize to what `ethers`/`viem` expect for the contract). |
| `permit.r` | `number[]` (length 32) | yes | 32 bytes as JSON array of `0..255` (Serde default for `[u8; 32]`). |
| `permit.s` | `number[]` (length 32) | yes | Same as `r`. |
| `permit.deadline` | `number` | yes | Unix timestamp (seconds) — must be in the future when the tx lands. |
| `assetIndex` | `number` | no | Maps to `asset_index`. Default: **3** (USDC per repo constant; Lighter recommends confirming via `/api/v1/assetDetails`). |
| `routeType` | `number` | no | **0** = perp (default), **1** = spot. |

**Serde:** optional fields use Rust `asset_index` / `route_type` in code but JSON can be camelCase if you configure the client to match; the server struct uses `#[serde(default)]` on options with snake_case names **`asset_index`**, **`route_type`** unless you add `rename_all`. In Rust:

```rust
pub struct LighterDepositRequest {
    pub amount: String,
    pub permit: PermitSignature,
    #[serde(default)]
    pub asset_index: Option<u64>,
    #[serde(default)]
    pub route_type: Option<u64>,
}
```

So JSON keys should be **`asset_index`** and **`route_type`** (snake_case) unless the codebase adds `rename_all = "camelCase"` to this struct.

#### Response

- **200:** JSON string — Ethereum tx hash (display form from receipt), e.g. `"0x..."`.
- **4xx/5xx:** standard `AppError` JSON from server (validation, insufficient balance, permit failure, etc.).

#### Example `curl`

```bash
curl -X POST 'https://<host>/lighter/deposit' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "amount": "5000000",
    "permit": {
      "v": 28,
      "r": [/* 32 bytes */],
      "s": [/* 32 bytes */],
      "deadline": 1893456000
    },
    "asset_index": 3,
    "route_type": 0
  }'
```

---

## Constants the FE must align with

From `crates/lighter/src/lib.rs` (verify after upgrades):

| Constant | Value | Meaning |
|----------|--------|--------|
| `LIGHTER_DEPOSIT_CONTRACT_ADDRESS` | `0x3B4D794a66304F130a4Db8F2551B0070dfCf5ca7` | USDC `permit` **spender**; deposit contract `to`. |
| `LIGHTER_USDC_ASSET_INDEX` | `3` | Default `_assetIndex` (USDC); confirm via Lighter asset API when in doubt. |
| `LIGHTER_ROUTE_TYPE_PERP` | `0` | Default perp margin route. |
| `LIGHTER_ROUTE_TYPE_SPOT` | `1` | Spot route. |

Mainnet USDC (for typed data / token contract) used by the server: **`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`** (`Chain::ETHEREUM` in `perp_core`).

---

## Validation rules (server-side)

From `deposit_to_lighter`:

- `amount` parses to `u64`; must be **`>= 1_000_000`** (≥ **1 USDC**).
- User must have **≥ `amount`** mainnet USDC balance (checked on `claims.evm_address`).
- Permit must authorize **`amount`** to **`LIGHTER_DEPOSIT_CONTRACT_ADDRESS`** for that owner.

---

## Recommended FE flow

1. **Login** — obtain JWT; read `evm_address` from token payload (or your user session).
2. **Network** — switch wallet to **Ethereum mainnet** (`chainId` 1).
3. **Balance** — read native-chain USDC balance for `evm_address` (same address that will be permit `owner`).
4. **Amount** — convert user input to 6-decimal integer string for `amount`.
5. **Permit typed data** — build EIP-712 (or legacy `eth_signTypedData_v4`) for **USDC `permit`** with:
   - `owner` = `evm_address`
   - `spender` = `0x3B4D794a66304F130a4Db8F2551B0070dfCf5ca7`
   - `value` = same integer as `amount`
   - `nonce` = current USDC `nonces(owner)` on-chain
   - `deadline` = chosen future time
6. **Sign** — user signs in wallet; split signature into `v`, `r`, `s` (`r`/`s` as 32-byte arrays for JSON).
7. **POST** `/lighter/deposit` with `amount`, `permit`, and optional `asset_index` / `route_type`.
8. **Show tx hash** — poll Etherscan / wait for receipt if needed.

**Important:** The wallet that signs the permit must be **`evm_address`** in the JWT. If the user connects a different address, either update session/JWT or block the action.

---

## `401 Unauthorized` on this POST

Same as other POST routes behind `require_post_auth`:

- Missing `Authorization` header
- Not exactly `Bearer <token>`
- Invalid or expired JWT

---

## Official Lighter docs (beyond this route)

For **asset index updates**, **withdrawals**, **CCTP**, and L2 account APIs, still use Lighter’s official documentation:

- [Deposits, transfers and withdrawals](https://apidocs.lighter.xyz/docs/deposits-transfers-and-withdrawals)
- [apidocs.lighter.xyz](https://apidocs.lighter.xyz/)

---

## Related docs in this repo

- [LIGHTER_FE_INTEGRATION.md](./LIGHTER_FE_INTEGRATION.md) — metadata, WS, aggregated feed, hedge notes
- [FE_INTEGRATION.md](./FE_INTEGRATION.md) — full API map
