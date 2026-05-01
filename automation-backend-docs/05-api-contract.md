# API Contract (new automation backend)

All endpoints are scoped to the authenticated app user. Authentication mechanism should match your existing API (JWT).

For the **reference NestJS service** (`nuketrade-automation-service`), auth is implemented as **`X-User-Id`** plus optional **`INTERNAL_API_KEY`**, response wrapping, and idempotency storage—see [`12-nuketrade-automation-service-DOCUMENTATION.md`](./12-nuketrade-automation-service-DOCUMENTATION.md).

## Conventions

- Base path: `/v1`
- All writes are idempotent where possible via `Idempotency-Key` header.
- Responses include `requestId`.

## Automation enable/disable

### `POST /v1/automation/enable`

Enables automation and provisions Turnkey delegated access + policies.

Request body:

```json
{
  "venues": {
    "hyperliquid": true,
    "pacifica": true
  },
  "limits": {
    "maxNotionalUsd": "2000",
    "maxLeverage": 3,
    "maxActionsPerDay": 20
  },
  "strategy": {
    "minAprBps": 200,
    "rebalanceDeltaBps": 50,
    "closeOnFundingFlip": true
  }
}
```

Response:

```json
{
  "requestId": "uuid",
  "enabled": true,
  "turnkey": {
    "subOrgId": "org_...",
    "delegatedUserId": "user_...",
    "policyIds": ["pol_...", "pol_..."]
  }
}
```

### `POST /v1/automation/disable`

Turns off execution immediately (DB kill switch). Optionally also revokes Turnkey policy access (configurable).

Request body:

```json
{
  "revokeTurnkey": true
}
```

Response:

```json
{
  "requestId": "uuid",
  "enabled": false
}
```

### `GET /v1/automation/status`

Response:

```json
{
  "enabled": true,
  "venues": { "hyperliquid": true, "pacifica": true },
  "limits": { "maxNotionalUsd": "2000", "maxLeverage": 3, "maxActionsPerDay": 20 },
  "strategy": { "minAprBps": 200, "rebalanceDeltaBps": 50, "closeOnFundingFlip": true },
  "health": {
    "lastRunAt": "2026-05-01T00:00:00.000Z",
    "lastError": null
  }
}
```

## Execution + audit

### `GET /v1/automation/actions?limit=50`

Returns recent automated actions (open/close/rebalance), including Turnkey activity IDs.

### `POST /v1/automation/actions/:id/cancel`

Optional. Used to request cancellation of a queued action (best-effort).

## Webhooks (optional)

### `POST /v1/webhooks/turnkey`

If you choose to consume Turnkey webhooks for activity completion/audit (optional).

