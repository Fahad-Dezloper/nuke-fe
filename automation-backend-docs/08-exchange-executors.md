# Exchange Executors (Hyperliquid + Pacifica)

This doc describes how the backend should execute **open + close** per venue (Hyperliquid **and** Pacifica), and where Turnkey signing fits. This is required for hedging: automation is only viable if the backend can both **enter** and **exit** on each venue it may choose as a hedge leg.

## Hyperliquid executor (EVM EIP-712)

### Required operations (v1)

- **Open position** (place/open leg)
- **Close position** (exit leg)

### What gets signed

- EIP-712 typed data for HL “exchange action” (open/close/update leverage/etc.)

### How to sign (backend)

- Use Turnkey `signRawPayload` with:
  - `encoding = PAYLOAD_ENCODING_EIP712`
  - `hashFunction` per Turnkey guidance (often `HASH_FUNCTION_NOT_APPLICABLE` for EIP-712)
- Policies should restrict `eth.eip_712.domain.*` + `primary_type`.

### What to submit

- Submit signed payload to HL endpoint (typically `/exchange`) along with `action`, `nonce`, and signature components.

### Critical safety checks

- Enforce notional/leverage caps before signing.
- Prefer close/reduce-only safety first.

## Pacifica executor (Solana-signed HTTP API messages)

### Required operations (v1)

- **Open position** (place/open leg)
- **Close position** (exit leg)

### What gets signed

- A canonical string (often compact JSON) that Pacifica expects.

### How to sign (backend)

- Use Turnkey `signRawPayload` with:
  - `encoding = PAYLOAD_ENCODING_TEXT_UTF8` (if you sign utf8 text)
  - `hashFunction = HASH_FUNCTION_NOT_APPLICABLE` (typical for ed25519 signing of raw bytes)

### What policy can enforce

- Enforce which Solana key signs: `wallet_account.address`
- Enforce encoding/hash function via `activity.params.*`

### What policy cannot reliably enforce

- “Only open/close” semantics inside an arbitrary signed message, unless Pacifica provides a structured typed payload that Turnkey can parse (unlikely).

### Safety model recommendation

- Enforce “open/close only” in backend executor (strict allowlist of endpoints + message schemas).
- If Pacifica supports scoped permissions (trade-only/no-withdraw), configure them.

## Atomicity across exchanges (hedge)

Opening/closing a hedge across two venues cannot be truly atomic. Implement:

- Ordered execution (close first leg? open first leg?) chosen per risk model.
- Partial failure handling:
  - if one leg succeeds and the other fails, attempt compensating action, or alert user.
- Persist intermediate state and reconcile.

