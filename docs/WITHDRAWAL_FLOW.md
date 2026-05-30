# Withdrawal flow (FE)

End-to-end goal: **USDC in the user’s Solana wallet** (Turnkey Solana address).

Client-orchestrated — same model as **`useFundExchange`** (deposits). No `withdraw-intents` saga.

## Per venue

| Venue | Path | Implementation |
|-------|------|----------------|
| **Hyperliquid** | **Perps USDC → Solana** via Relay (chain `1337` → `792703809`, ~seconds) | `getRelayQuoteV2` + `executeRelayBridgeQuote` |
| **Pacifica** | **Solana** direct (`POST /api/v1/account/withdraw`) | `PacificaService.requestWithdrawal` |
| **Phoenix** | **Solana** direct (Rise `buildWithdrawIxs`) | `PhoenixService.withdrawUsdc` |
| **Lighter** | L2 → Ethereum → Solana | **Not implemented** |

## Hyperliquid (Relay)

Matches [Relay UI](https://relay.link): sell USDC on Hyperliquid, receive USDC on Solana.

1. `POST https://api.relay.link/quote/v2` with:
   - `originChainId`: **1337** (Hyperliquid perps)
   - `destinationChainId`: **792703809** (Solana)
   - `user`: user’s **EVM** address (HL account)
   - `recipient`: Turnkey **Solana** address
   - `originCurrency`: `0x00000000000000000000000000000000` (perps USDC, **8** decimals)
   - `destinationCurrency`: Solana USDC mint
2. Execute quote `steps` (HL authorize signatures, permits, etc.) via `relay-bridge-executor.ts`
3. `pollBridgeStatus` until success

No `withdraw3` to Arbitrum and no Arbitrum→Solana second hop.

References: [Relay quote v2](https://docs.relay.link/references/api/get-quote-v2), [step execution](https://docs.relay.link/references/api/api_core_concepts/step-execution).

## Resume

`localStorage` key `nuke_withdraw_resume` — in-flight Relay `requestId` for HL withdraw.

## UI

Wallet menu → **Withdraw** → `WithdrawModal` → `useWithdrawal`.
