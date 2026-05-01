# Local Dev + Deploy

## Local dev

### Requirements

- Node 20+
- Postgres 15+

### Environment variables

#### Core

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`

#### Auth (pick one)

- If this service is standalone: `JWT_PUBLIC_KEY` or `JWT_SECRET` (depends on your auth approach)
- If behind an API gateway: `INTERNAL_API_KEY` for service-to-service auth

#### Turnkey (parent org admin)

- `TURNKEY_API_BASE_URL=https://api.turnkey.com`
- `TURNKEY_PARENT_ORG_ID`
- `TURNKEY_PARENT_API_PUBLIC_KEY`
- `TURNKEY_PARENT_API_PRIVATE_KEY`

#### Turnkey (Delegated Access keypair)

- `TURNKEY_DA_API_PUBLIC_KEY`
- `TURNKEY_DA_API_PRIVATE_KEY`

#### Exchanges

- Hyperliquid base URL / environment
- Pacifica base URL / environment

## Deploy

### Minimal deploy footprint

- 1 web service (API)
- 1 worker (job runner) — can be same container with separate entrypoint
- Postgres

### Secrets

- All Turnkey private keys must be injected as runtime secrets.

### Rollout safety

- Start with all users disabled by default.
- Add an allowlist of internal test users.

