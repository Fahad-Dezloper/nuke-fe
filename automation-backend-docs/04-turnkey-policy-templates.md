# Turnkey Policy Templates (Automation)

Reference: Turnkey policy language `https://docs.turnkey.com/concepts/policies/language.md`

This doc contains **templates**. You must fill in:

- `<DA_USER_ID>`
- `<SUBORG_ID>` (when you create the policy via API)
- `<EVM_SIGN_WITH_ADDRESS>` / `<SOL_SIGN_WITH_ADDRESS>`
- Hyperliquid EIP-712 domain values (chain id + verifying contract)

## Important limitations (read this first)

### Policy can strongly restrict EVM transactions + EIP-712

Turnkey exposes:

- `eth.tx.*` for **EVM transaction signing**
- `eth.eip_712.*` for **EIP-712 signing**
- `activity.params.encoding` so you can enforce EIP-712-only.

This enables good constraints for Hyperliquid.

### Policy is typically coarse for “raw signed API messages”

If an exchange uses “sign arbitrary bytes to authenticate HTTP calls” (Pacifica/Backpack style), Turnkey cannot usually parse that message into high-level “open vs close” semantics. You can still restrict:

- which key signs (`wallet_account.address`)
- allowed encodings/hash functions (`activity.params.*`)

But you should enforce “open/close only” in your backend and (ideally) via exchange-side permissioning.

## Naming conventions

- Prefer multiple small policies rather than one huge condition. The policy engine does not short-circuit; a clause error can make the whole policy error.

## Template: Allow DA to sign Hyperliquid EIP-712 only (domain allowlist)

Use `signRawPayload` with `PAYLOAD_ENCODING_EIP712` and `HASH_FUNCTION_NOT_APPLICABLE` or `NO_OP` depending on Turnkey client behavior; enforce encoding in policy.

```json
{
  "policyName": "Automation: allow HL EIP-712 signing (domain allowlist)",
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<DA_USER_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && activity.params.encoding == 'PAYLOAD_ENCODING_EIP712' && eth.eip_712.domain.chain_id == <HL_CHAIN_ID_UINT> && eth.eip_712.domain.verifying_contract == '<HL_VERIFYING_CONTRACT_LOWERCASE>'"
}
```

Notes:

- All hex strings must be lowercase (Turnkey doc note).
- If HL uses multiple verifying contracts across environments, allowlist via `in [...]`.

## Template: Restrict HL to specific primary types

You must inspect what your HL typed-data uses for `primary_type`. Then:

```json
{
  "policyName": "Automation: restrict HL EIP-712 primary types",
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<DA_USER_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && activity.params.encoding == 'PAYLOAD_ENCODING_EIP712' && eth.eip_712.primary_type in ['<TYPE_1>', '<TYPE_2>']"
}
```

## Template: Deny non-EIP712 raw payload signing for DA

This is a defense-in-depth deny that prevents DA from signing arbitrary bytes unless explicitly allowed elsewhere.

```json
{
  "policyName": "Automation: deny non-EIP712 raw payload signing",
  "effect": "EFFECT_DENY",
  "consensus": "approvers.any(user, user.id == '<DA_USER_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && activity.params.encoding != 'PAYLOAD_ENCODING_EIP712'"
}
```

If you need Pacifica raw-message signing, do **not** enable this deny globally, or scope it (see below).

## Template: Allow Pacifica raw message signing (coarse)

If Pacifica requires signing a canonical UTF-8 string, allow only that encoding and only with the user’s Solana address:

```json
{
  "policyName": "Automation: allow Pacifica API message signing (utf8, specific Solana address)",
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<DA_USER_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && activity.params.encoding == 'PAYLOAD_ENCODING_TEXT_UTF8' && wallet_account.address == '<SOL_SIGN_WITH_ADDRESS>'"
}
```

You may also constrain `activity.params.hash_function` (many Solana message signatures should use `HASH_FUNCTION_NOT_APPLICABLE`).

## Template: Allow Solana *transaction* signing (if you later move Pacifica to on-chain tx)

If Pacifica automation ever becomes “sign Solana transactions”, you can use `ACTIVITY_TYPE_SIGN_TRANSACTION_V2` and restrict `solana.tx.program_keys` allowlists, plus deny address table lookups.

```json
{
  "policyName": "Automation: allow Solana tx signing for allowlisted programs (no ALTs)",
  "effect": "EFFECT_ALLOW",
  "consensus": "approvers.any(user, user.id == '<DA_USER_ID>')",
  "condition": "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2' && activity.params.type == 'TRANSACTION_TYPE_SOLANA' && solana.tx.address_table_lookups.count() == 0 && solana.tx.program_keys.all(p, p in ['<PROGRAM_ID_1>', '<PROGRAM_ID_2>'])"
}
```

## Recommended policy strategy for v1

### For Hyperliquid

- Allow: EIP-712 signing for HL domain + types.
- Deny: everything else.

### For Pacifica

- Allow: raw UTF-8 signing only for the one Solana wallet address.
- Enforce “open/close only” in backend executor (and exchange-side permissions if supported).

## Debugging policies

When a signing activity is denied, use `getPolicyEvaluations` to see which policy blocked it:

`https://docs.turnkey.com/api-reference/queries/get-policy-evaluations`

