# Security Guardrails

Automation with backend signing is powerful. This document lists the minimum guardrails to ship safely.

## Turnkey-side (policy) guardrails

### Hyperliquid

- Allow only EIP-712 signing (`activity.params.encoding == 'PAYLOAD_ENCODING_EIP712'`).
- Allow only HL domain (`eth.eip_712.domain.chain_id` + `verifying_contract` allowlist).
- Restrict `primary_type` to only the types you need.
- Prefer separate policies:
  - close-only policy (v1)
  - open policy (later)

### Pacifica

- Allow only specific Solana signer address (`wallet_account.address == ...`).
- Restrict encoding/hash function.

## Backend guardrails

- **Kill switch**
  - per-user disable
  - global disable
- **Caps**
  - max notional, max leverage
- **Idempotency**
  - prevent duplicate opens/closes
- **Churn control**
  - min time between rebalances
  - cool-down after failures
- **Reconciliation**
  - periodic check positions on venues and ensure backend state matches reality
- **Audit**
  - store Turnkey activity ids
  - store exchange request/response (redacted)

## Key management

- DA API private key is a hot secret. Store in:
  - KMS, Vault, or your cloud secret manager (on prod later on)
- Rotate keys periodically.
- Do not store key material in Postgres.

## Observability

- Structured logs with action ids.
- Metrics:
  - actions succeeded/failed
  - signing denied by policy (count + reasons)
- Alerts on:
  - spike in failures
  - repeated rebalances for same user

