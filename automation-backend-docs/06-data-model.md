# Data Model

This is a suggested relational schema (Postgres). Use Prisma/Drizzle.

## Tables

### `users`

You likely already have this in your existing backend. For a standalone service, keep minimal:

- `id` (uuid)
- `created_at`

### `turnkey_suborgs`

- `user_id` (fk users.id, unique)
- `suborg_id` (string, unique)
- `created_at`

### `automation_profiles`

One row per user.

- `user_id` (fk, unique)
- `enabled` (bool)
- `venues` (jsonb) — `{ hyperliquid: true, pacifica: true }`
- `limits` (jsonb)
- `strategy` (jsonb)
- `kill_switch_reason` (text, nullable)
- `updated_at`

### `turnkey_delegated_access`

Stores the DA user identity + policy ids installed in the suborg.

- `user_id` (fk, unique)
- `delegated_user_id` (string)
- `policy_ids` (text[]) or (jsonb)
- `last_provisioned_at`
- `revoked_at` (nullable)

Important:

- Do not store any Turnkey private keys in DB. Store key material in secrets management / KMS.

### `automation_runs`

Each evaluation pass.

- `id` (uuid)
- `started_at`
- `finished_at`
- `status` (`ok` | `error`)
- `error` (text)

### `automation_actions`

Queue + audit log of individual actions (open/close/rebalance).

- `id` (uuid)
- `user_id`
- `kind` (`open` | `close` | `rebalance`)
- `venue_leg_a` / `venue_leg_b`
- `asset` (e.g. BTC)
- `notional_usd` (numeric/string)
- `state` (`queued` | `executing` | `succeeded` | `failed` | `cancelled`)
- `idempotency_key` (string, unique)
- `created_at` / `updated_at`

### `turnkey_activities`

Optional: normalize Turnkey activity IDs for audit correlation.

- `id` (uuid)
- `user_id`
- `turnkey_activity_id` (string, unique)
- `type` (string)
- `created_at`
- `metadata` (jsonb)

### `exchange_requests`

Optional: persist exchange request/response for debugging.

- `id` (uuid)
- `automation_action_id` (fk)
- `venue` (string)
- `request` (jsonb)
- `response` (jsonb)
- `created_at`

## Invariants

- If `automation_profiles.enabled = true`, then `turnkey_delegated_access` must exist and not be revoked.
- Any executor must create an `automation_action` row before attempting signing/submission.
- Every signing call should persist the Turnkey `activity.id` (or equivalent) for traceability.

