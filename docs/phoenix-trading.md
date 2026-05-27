# Phoenix trading (Rise + Turnkey + optional Flight)

This app uses [`@ellipsis-labs/rise`](https://docs.phoenix.trade/sdk/rise) (`createPhoenixClient`) for Solana-signed Phoenix instructions. **Flight is beta** in Rise docs; keep `NEXT_PUBLIC_PHOENIX_FLIGHT_ENABLED` off until you have completed internal QA.

## Environment

Required for live trading:

- `NEXT_PUBLIC_PHOENIX_TRADING_ENABLED=true`
- `NEXT_PUBLIC_SOLANA_RPC_URL` — reliable mainnet RPC

**Private beta onboarding (required for new wallets):**

Phoenix is in private beta. New Turnkey wallets must be activated via HTTP **before** deposit:

1. `POST /v1/invite/activate` (access / invite code), or
2. `POST /v1/invite/activate-with-referral` (referral code)

The FE runs this in `ensureActivatedAndRegistered` before `buildDepositIxs`. Without it, deposit fails with:

`Trader not found for provided authority and trader_pda_index`

Configure **one** of:

- `NEXT_PUBLIC_PHOENIX_REFERRAL_CODE` — Nuke builder referral from Phoenix (preferred for integrators)
- `NEXT_PUBLIC_PHOENIX_INVITE_CODE` — Phoenix access / allowlist code
- User’s Nuke access code (sessionStorage fallback) — only works if it matches a Phoenix invite code

Set `NEXT_PUBLIC_PHOENIX_REQUIRE_INVITE=false` only if Phoenix opens public self-registration (no invite needed).

**Sponsored SOL fee payer (recommended for new Turnkey wallets):**

- `NEXT_PUBLIC_PHOENIX_FEE_PAYER_ADDRESS` — public key of the sponsor wallet (tx `payerKey`)
- `PHOENIX_FEE_PAYER_PRIVATE_KEY` — server-only; JSON byte array or base58 secret (used by `/api/phoenix/co-sign`)

When configured, Phoenix deposit/onboarding txs are co-signed by the server fee payer. Users only need **USDC** on Solana (no SOL for rent/fees). The client signs as authority via Turnkey, the API adds the fee payer signature, and the client broadcasts.

**Flight builder (optional, separate from user onboarding):**

- `NEXT_PUBLIC_PHOENIX_FLIGHT_ENABLED=true` + `NEXT_PUBLIC_PHOENIX_FLIGHT_BUILDER_AUTHORITY`
- Flight routes **orders** and collects builder fees; it does **not** register end-user traders.
- Register the builder wallet in the [Flight dashboard](https://docs.phoenix.trade/phoenix/flight.md) (on-chain `registerBuilder` + builder trader account).

Symbols passed to Rise are **short tickers** (e.g. `MON`, `SOL`); the FE strips `-PERP` suffixes where needed.

## Add margin (UI)

When the user clicks **Add margin** on a Phoenix leg (`useFundExchange` → `PhoenixDepositHandler`):

1. Validates Solana USDC balance (amount + ~0.2 USDC gas buffer).
2. **Onboard** — `activateInvite` / `activateInviteWithReferral` for new authorities, then `registerTrader` fallback; fails fast if trader PDA still missing.
3. **Deposit** — Rise `buildDepositIxs` for the USD amount (e.g. $5), Turnkey-sign, submit to Solana.
4. Refreshes exchange balances (`fetchFreeCollateralUsd`).

Minimum direct deposit: **$1** (`SOLANA_DIRECT_MIN_DEPOSIT_MICROS`). No bridge.

## Backend / hedge-intent contract

The client executor recognizes:

- `DEPOSIT_TO_PHOENIX` — same `DepositActionParams` shape as other deposit actions; deposits `amount_usd` (6dp USDC) from the user’s Solana USDC balance via Rise `buildDepositIxs`, Turnkey-signed. If Rise free collateral already covers `existing_margin_usd + amount_usd`, the FE reports success without a second deposit (common when margin was added via Add margin).
- `OPEN_HEDGE_POSITION` / `CLOSE_POSITION` with `exchange: "phoenix"` (lowercase).

**Preferred**: backend sends Phoenix `funding` in the **same hourly rate units** as Hyperliquid/Pacifica so APR math is identical. If not, set `NEXT_PUBLIC_PHOENIX_FUNDING_HOURLY_DIVISOR` as a temporary FE scale fix until the BE is aligned.

## Leverage & margin mode (hedges)

- Traders register on the **cross** subaccount (`subaccount_index = 0`); USDC deposits land there.
- **Hedge opens** use Phoenix `POST /v1/ix/place-isolated-market-order` with `transferAmount` (USDC micros) = leg margin, `skipTransferToParent: true`, and shared `hedgeBaseSize` for notional.
- **Hedge closes** use reduce-only market orders on the isolated subaccount when one exists (Rise `buildPlaceMarketOrder` with resolved `traderSubaccountIndex`).
- **Mirrored TP/SL** (same Pacifica mark bands as HL/Pacifica) attach on isolated open via `tpSl` on `POST /v1/ix/place-isolated-market-order`.
- Disable isolated hedges: `NEXT_PUBLIC_HEDGE_ISOLATED_MARGIN=false` (legacy cross open on subaccount 0).

## QA matrix (Flight + hedges)

1. **Flight off vs on** — place a small market order; with Flight on, wrapped instructions should target the Flight program (verify in logs / explorer).
2. **Builder fees** — confirm fee accrual in the Phoenix Builder Dashboard (may lag).
3. **Cross-venue hedges** — Phoenix + Pacifica / HL / Lighter: deposit, open, partial failure, safety close.
4. **Symbols** — each asset you list that trades on Phoenix resolves via `toPhoenixSymbol`.
5. **Funding column** — Phoenix APR matches Phoenix UI after BE hourly normalization (or divisor env).

## Troubleshooting

- **`Trader not found for provided authority and trader_pda_index`** — wallet not activated for Phoenix private beta. Set `NEXT_PUBLIC_PHOENIX_REFERRAL_CODE` or `NEXT_PUBLIC_PHOENIX_INVITE_CODE`, or ensure the user’s Nuke access code is a valid Phoenix invite. Confirm `GET /trader/{authority}/state` returns a trader after onboarding.
- **`Attempt to debit an account but found no record of a prior credit`** — wallet has no USDC SPL token account or zero USDC. Fund the Turnkey Solana wallet with USDC (and ~0.005 SOL for fees) before Add margin. The FE now prepends a USDC ATA create instruction automatically.
- **Invite / 404 on snapshot** — user not activated; check invite/referral env and Phoenix access policy.
- **Transaction simulation failures** — RPC quality, missing USDC/ATA, or account not registered; read Solana error in toast.
- **Turnkey** — session must be active; signing uses the same Turnkey Solana path as Pacifica relay flows.
