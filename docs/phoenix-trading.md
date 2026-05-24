# Phoenix trading (Rise + Turnkey + optional Flight)

This app uses [`@ellipsis-labs/rise`](https://docs.phoenix.trade/sdk/rise) (`createPhoenixClient`) for Solana-signed Phoenix instructions. **Flight is beta** in Rise docs; keep `NEXT_PUBLIC_PHOENIX_FLIGHT_ENABLED` off until you have completed internal QA.

## Environment

See [`.env.example`](.env.example) in the repo root. Required for live trading:

- `NEXT_PUBLIC_PHOENIX_TRADING_ENABLED=true`
- `NEXT_PUBLIC_SOLANA_RPC_URL` — reliable mainnet RPC
- **Invite (optional, off by default)**: set `NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE=true` plus `NEXT_PUBLIC_PHOENIX_INVITE_CODE` or `NEXT_PUBLIC_PHOENIX_REFERRAL_CODE` when ready
- **Flight builder (optional, off by default)**: `NEXT_PUBLIC_PHOENIX_FLIGHT_ENABLED=true` + builder authority from Phoenix Builder Dashboard

Symbols passed to Rise are **short tickers** (e.g. `MON`, `SOL`); the FE strips `-PERP` suffixes where needed.

## Add margin (UI)

When the user clicks **Add margin** on a Phoenix leg (`useFundExchange` → `PhoenixDepositHandler`):

1. Validates Solana USDC balance (amount + ~0.2 USDC gas buffer).
2. **Onboard (minimal)** — `registerTrader` on-chain if snapshot missing; HTTP invite skipped unless `NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE=true`.
3. **Deposit** — Rise `buildDepositIxs` for the USD amount (e.g. $5), Turnkey-sign, submit to Solana.
4. Refreshes exchange balances (`fetchFreeCollateralUsd`).

Minimum direct deposit: **$1** (`SOLANA_DIRECT_MIN_DEPOSIT_MICROS`). No bridge.

## Backend / hedge-intent contract

The client executor recognizes:

- `DEPOSIT_TO_PHOENIX` — same `DepositActionParams` shape as other deposit actions; deposits `amount_usd` (6dp USDC) from the user’s Solana USDC balance via Rise `buildDepositIxs`, Turnkey-signed. If Rise free collateral already covers `existing_margin_usd + amount_usd`, the FE reports success without a second deposit (common when margin was added via Add margin).
- `OPEN_HEDGE_POSITION` / `CLOSE_POSITION` with `exchange: "phoenix"` (lowercase).

**Preferred**: backend sends Phoenix `funding` in the **same hourly rate units** as Hyperliquid/Pacifica so APR math is identical. If not, set `NEXT_PUBLIC_PHOENIX_FUNDING_HOURLY_DIVISOR` as a temporary FE scale fix until the BE is aligned.

## Leverage

Phoenix legs register with **cross** margin (`MarginType.Cross`). Per-market leverage updates are **not** wired through Rise in this build; the executor skips bulk leverage updates for Phoenix while still opening with the requested notional sizing.

## QA matrix (Flight + hedges)

1. **Flight off vs on** — place a small market order; with Flight on, wrapped instructions should target the Flight program (verify in logs / explorer).
2. **Builder fees** — confirm fee accrual in the Phoenix Builder Dashboard (may lag).
3. **Cross-venue hedges** — Phoenix + Pacifica / HL / Lighter: deposit, open, partial failure, safety close.
4. **Symbols** — each asset you list that trades on Phoenix resolves via `toPhoenixSymbol`.
5. **Funding column** — Phoenix APR matches Phoenix UI after BE hourly normalization (or divisor env).

## Troubleshooting

- **Invite / 404 on snapshot** — user not activated; check invite/referral env and Phoenix access policy.
- **Transaction simulation failures** — RPC quality, missing USDC/ATA, or account not registered; read Solana error in toast.
- **Turnkey** — session must be active; signing uses the same Turnkey Solana path as Pacifica relay flows.
