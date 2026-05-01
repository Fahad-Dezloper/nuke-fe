# Architecture

## High-level components

### 1) Automation API (REST)

Responsibilities:

- Turn automation on/off per user.
- Store user automation preferences (limits, allowed venues, etc.).
- Expose status + recent automated actions.

### 2) Turnkey Admin Service (provisioning)

Runs with **parent-org** Turnkey server credentials.

Responsibilities:

- Lookup the user sub-org.
- Add or update the Delegated Access user in the sub-org.
- Create/update policies in the sub-org.
- Remove DA user from root quorum after setup (recommended).

### 3) Turnkey Delegated Signer Service (runtime signing)

Runs with **DA API key** credentials (server-side).

Responsibilities:

- Sign Hyperliquid EIP-712 typed data via `signRawPayload` with `PAYLOAD_ENCODING_EIP712`.
- Sign Pacifica API auth messages via `signRawPayload` with `PAYLOAD_ENCODING_TEXT_UTF8` (or hex if you canonicalize bytes as hex).
- Return signatures to the executor.

Important:

- This service must never have parent-org admin credentials.
- It only needs DA keys + subOrgId context.

### 4) Strategy Engine + Job Runner

Responsibilities:

- Periodically evaluate opportunities for each enabled user.
- Decide: do nothing / close / open / rebalance.
- Emit execution intents with idempotency keys.

### 5) Exchange Executors

Per exchange, implement:

- Build canonical request payload.
- Request signature from Delegated Signer.
- Submit to exchange API.
- Persist results + reconcile state.

## Data flow: Enable Automation

1. User clicks **Enable Automation** in frontend.
2. Frontend calls backend `POST /v1/automation/enable`.
3. Backend:
   - verifies user identity (your existing auth/JWT)
   - obtains user `subOrgId`
   - creates DA user (or ensures it exists) in sub-org with your DA API public key
   - creates policies bound to the DA user ID
   - (recommended) updates root quorum to remove DA user from root quorum
4. Backend stores:
   - DA `turnkeyDelegatedUserId`
   - `policyIds`
   - user wallets (EVM + Solana addresses)
   - automation preferences
5. Respond `enabled=true`.

## Data flow: Automated execution (HL example)

1. Job runner decides action: close/open on Hyperliquid.
2. Executor builds HL EIP-712 typed data.
3. Executor calls Delegated Signer:
   - `signRawPayload` encoding = `PAYLOAD_ENCODING_EIP712`
4. Turnkey policy engine evaluates:
   - initiator must satisfy `consensus` (DA user)
   - payload must satisfy `condition` (domain allowlist, etc.)
5. Executor submits signed payload to Hyperliquid API.
6. Persist result + activity IDs for audit.

## Trust boundaries

- **Turnkey policies** are the enforcement boundary for what the DA key can do.
- **Backend guardrails** are still required (rate limits, caps, idempotency, emergency stop).
- For **raw-message** APIs (e.g., Solana-signed HTTP), policies may be coarse; lean on:
  - exchange-side scoped keys/permissions (if available)
  - strict backend validation of what is signed and submitted

