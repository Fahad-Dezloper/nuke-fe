# NukeTrade Automation Service — Technical Documentation

> **Context:** This file is a **mirror / reference** of `DOCUMENTATION.md` from the **`nuketrade-automation-service`** repository. All paths (`src/...`, `prisma/...`, `scripts/...`) are relative to **that service repo**, not to `nuke-fe`.
>
> The **product and policy build spec** for automation lives in this same folder: [`README.md`](./README.md).

This document describes the **nuketrade-automation-service** codebase: architecture, configuration, APIs, data model, Turnkey integration, Docker, and the boundary between **implemented** behavior and **placeholder** work.

The original product and policy specifications live under [`automation-backend-docs/`](./README.md). This file focuses on **what the service repository actually does today**.

---

## Table of contents

1. [Purpose](#1-purpose)
2. [High-level architecture](#2-high-level-architecture)
3. [Technology stack](#3-technology-stack)
4. [Repository layout](#4-repository-layout)
5. [Environment variables](#5-environment-variables)
6. [Running locally](#6-running-locally)
7. [Database and Prisma](#7-database-and-prisma)
8. [Authentication](#8-authentication)
9. [HTTP API](#9-http-api)
10. [Turnkey integration](#10-turnkey-integration)
11. [Automation engine and execution](#11-automation-engine-and-execution)
12. [Exchange executors (Hyperliquid and Pacifica)](#12-exchange-executors-hyperliquid-and-pacifica)
13. [Webhooks](#13-webhooks)
14. [Health and observability](#14-health-and-observability)
15. [Testing](#15-testing)
16. [Security notes](#16-security-notes)
17. [Implemented vs remaining](#17-implemented-vs-remaining)

---

## 1. Purpose

The service supports a **premium automation** flow:

- A user enables automation; the backend provisions **Turnkey delegated access** (DA user + policies) in the user’s **sub-organization**.
- A **background loop** evaluates strategy inputs and may queue **open / close / rebalance** actions.
- **Executors** build payloads, request **Turnkey `signRawPayload`**, and call exchange HTTP APIs—starting with **Hyperliquid (EIP-712)** and **Pacifica (UTF-8 signed messages)** as sketched in the docs pack.

Signing authority is meant to be **limited by Turnkey policies** plus **application-level** caps and kill switches.

---

## 2. High-level architecture

| Component | Role |
|-----------|------|
| **REST API** (`/v1/...`) | Enable/disable automation, status, action history, cancel queued actions. |
| **Turnkey parent client** | Parent-org API keys: provision DA user, create/delete policies in **each user’s sub-org**. Never used for routine signing. |
| **Turnkey DA client** | DA API keys: **`signRawPayload`** at runtime with `organizationId = subOrgId`. |
| **Prisma + PostgreSQL** | Users, sub-org mapping, profiles, delegated access metadata, actions, audit-adjacent tables. |
| **Automation engine** | Periodic job: loads enabled profiles, applies coarse guardrails, may enqueue and run actions. |
| **Executors** | Hyperliquid and Pacifica: build payload → sign → POST exchange. |

Data flow **enable automation**:

1. Client calls `POST /v1/automation/enable` with venues, limits, strategy, wallets, optional `subOrgId`.
2. Service ensures `User` + `TurnkeySuborg`, optionally deletes **previous** Turnkey policies, calls Turnkey `createUsers` (if needed) and `createPolicies`, persists `AutomationProfile` and `TurnkeyDelegatedAccess`.

Data flow **automated trade (simplified)**:

1. Engine creates or reuses an `AutomationAction` with an idempotency key.
2. `AutomationExecutionService` loads profile, sub-org, delegated access; for each enabled venue it calls the corresponding executor.
3. Executor calls **`signRawPayload`**, submits to the exchange, persists `ExchangeRequest` (and may persist `TurnkeyActivity` when Turnkey returns an activity id).

---

## 3. Technology stack

- **Runtime**: Node.js 22 (Dockerfile); local dev typically Node 20+.
- **Framework**: NestJS 11, Express platform.
- **Config**: `@nestjs/config` with **class-validator** validation on boot (`src/config/env.validation.ts`).
- **API docs**: Swagger UI at **`/docs`** (OpenAPI generated from decorators).
- **Persistence**: PostgreSQL 15+ / 16, **Prisma** 6 (`prisma` is a **runtime** dependency for `migrate deploy` in containers).
- **Turnkey**: `@turnkey/sdk-server` **^4.12.2** (`Turnkey` class, `apiClient()`).
- **Scheduling**: `@nestjs/schedule` + `SchedulerRegistry` (dynamic interval).
- **Health**: `@nestjs/terminus` + custom Prisma ping indicator.
- **Crypto / encoding**: `ethers` (HL signature formatting), `bs58` (Pacifica placeholder encoding).

---

## 4. Repository layout

*(Paths below are relative to **nuketrade-automation-service**.)*

```
src/
  app.module.ts          # Root module: Config, Prisma, Turnkey, Health, Automation, Jobs; webhook controller
  main.ts                # Bootstrap: global prefix v1, validation pipe, Swagger
  config/                # configuration factory + env validation
  common/                # Auth guard, current-user decorator, request-id interceptor
  prisma/                # PrismaService, global PrismaModule
  turnkey/               # Parent service, DA signer, provision orchestration, policy template builder
  automation/            # Controller, DTOs, service, engine, execution service
  exchanges/
    hyperliquid/         # Typed-data builder, HTTP client, executor
    pacifica/            # Message builder, HTTP client, executor
  jobs/                  # Scheduler registration (automation engine interval)
  health/                # /health Terminus check
  webhooks/              # Turnkey webhook stub
prisma/
  schema.prisma
  migrations/            # SQL migrations (e.g. initial schema)
scripts/
  docker-entrypoint.sh   # migrate deploy + node dist/main.js
  generate-turnkey-da-keys.ts
docs/automation-backend-docs/   # Optional copy of build spec; may also live only in nuke-fe
Dockerfile
docker-compose.yml
.env.example
DOCUMENTATION.md         # Canonical copy in service repo (this content)
```

---

## 5. Environment variables

Validated at application startup (see `src/config/env.validation.ts`). **`DATABASE_URL` is required**; other variables are optional unless you use the corresponding features.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. |
| `NODE_ENV` | No | `development` \| `production` \| `test`. |
| `PORT` | No | HTTP port (default **3000**). |
| `TURNKEY_API_BASE_URL` | No | Default `https://api.turnkey.com`. |
| `TURNKEY_PARENT_ORG_ID` | For provisioning | Parent Turnkey organization id. |
| `TURNKEY_PARENT_API_PUBLIC_KEY` | For provisioning | Parent org API **public** key (hex as used by Turnkey). |
| `TURNKEY_PARENT_API_PRIVATE_KEY` | For provisioning | Parent org API **private** key (secret). |
| `TURNKEY_DA_API_PUBLIC_KEY` | For provisioning + signing | DA P-256 **compressed** public key, 66 hex chars (`02`/`03` + 32-byte x). |
| `TURNKEY_DA_API_PRIVATE_KEY` | For signing | DA private scalar, 64 hex chars (32 bytes). **Generate locally** — see `scripts/generate-turnkey-da-keys.ts` and `npm run generate:turnkey-da-keys`. |
| `HL_EIP712_CHAIN_ID` | No | String integer for EIP-712 `domain.chainId` in policies and HL typed data (default `42161`). |
| `HL_EIP712_VERIFYING_CONTRACT` | No | Lowercase `0x` address for EIP-712 `domain.verifyingContract` (must match real HL setup for production). |
| `HYPERLIQUID_API_BASE_URL` | No | Default `https://api.hyperliquid.xyz`. |
| `PACIFICA_API_BASE_URL` | No | Default `https://api.pacifica.fi`. |
| `INTERNAL_API_KEY` | No | If set, requests must send this value via `X-Internal-Api-Key` or `Authorization: Bearer …`. |
| `AUTOMATION_GLOBAL_DISABLED` | No | If `true`, engine skips cycles; enable endpoint rejects new enables. |
| `AUTOMATION_ENGINE_INTERVAL_SEC` | No | Seconds between automation engine runs (minimum enforced in scheduler: **10**). Default **120**. |

**Not in `.env.example` but read by code:**

| Variable | Description |
|----------|-------------|
| `AUTOMATION_MOCK_APR_BPS` | **Engine only.** Simulated “effective APR” in basis points. Default behavior uses `minAprBps + 1` so the engine stays idle until real feeds exist. Set **below** `minAprBps` to force the stub close path for testing. |

Copy `.env.example` to `.env` and fill in secrets. Never commit `.env`.

---

## 6. Running locally

### 6.1 Prerequisites

- Node.js **20+** (22 in Docker).
- **PostgreSQL** (local or Docker).
- Turnkey **parent** and **DA** credentials when exercising provisioning and signing.

### 6.2 NPM

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and Turnkey vars as needed

npm install
npx prisma migrate deploy   # or prisma migrate dev during development
npm run start:dev
```

- API base: `http://localhost:3000/v1`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health` (no `/v1` prefix)

### 6.3 Docker Compose

`docker-compose.yml` defines:

- **`postgres`**: `postgres:16-alpine`, user/password/db `nuketrade` / `nuketrade` / `automation`, port **5432**.
- **`app`**: builds the **Dockerfile**, sets `DATABASE_URL` to `postgresql://nuketrade:nuketrade@postgres:5432/automation`, exposes **3000**.

Compose substitutes `${VAR}` from a **`.env`** file in the project root for Turnkey and other keys. The **app container** does not read host `DATABASE_URL` from `.env` for DB—it uses the hardcoded service URL to reach `postgres`.

```bash
docker compose up --build
# or
npm run docker:up
```

Entrypoint (`scripts/docker-entrypoint.sh`): `npx prisma migrate deploy` then `node dist/main.js`.

### 6.4 Generating DA API keys

```bash
npm run generate:turnkey-da-keys
```

Paste output into `.env` as `TURNKEY_DA_API_PUBLIC_KEY` and `TURNKEY_DA_API_PRIVATE_KEY`. This is a **local** P-256 pair; Turnkey does not issue the private key.

---

## 7. Database and Prisma

### 7.1 Models (summary)

| Model | Purpose |
|-------|---------|
| `User` | End-user id (UUID string; often your auth subject). |
| `TurnkeySuborg` | One-to-one: `userId` → Turnkey `suborgId`. |
| `AutomationProfile` | `enabled`, `venues`, `limits`, `strategy`, wallet addresses for signing, `lastRunAt` / `lastError`. |
| `TurnkeyDelegatedAccess` | `delegatedUserId`, `policyIds[]`, `lastProvisionedAt`, `revokedAt`. |
| `AutomationRun` | One row per engine cycle attempt (status, error, timestamps). |
| `AutomationAction` | Queued/executed action: kind, venues, asset, notional, state machine, idempotency key. |
| `TurnkeyActivity` | Optional correlation to Turnkey activity ids after signing. |
| `ExchangeRequest` | Request/response JSON per venue for an action. |
| `IdempotencyEntry` | Cached JSON body for `Idempotency-Key` on enable/disable. |

See `prisma/schema.prisma` in the service repo for columns and relations.

### 7.2 Migrations

- Initial migration under `prisma/migrations/`.
- **Production / Docker**: `prisma migrate deploy` (automatic in container entrypoint).
- **Local dev**: `npx prisma migrate dev` when you change the schema.

---

## 8. Authentication

All automation routes use **`AppAuthGuard`** (`src/common/guards/app-auth.guard.ts`).

1. **`X-User-Id`** (required): treated as the authenticated application user id. **There is no JWT validation in this service**; your gateway or BFF should set this after your real auth.
2. **`INTERNAL_API_KEY`** (optional): if `INTERNAL_API_KEY` is non-empty in config, every request must also present:
   - Header **`X-Internal-Api-Key: <key>`**, or
   - **`Authorization: Bearer <key>`**

This is a simple service-to-service shared secret, **not** related to Turnkey.

---

## 9. HTTP API

Global prefix: **`/v1`** for automation and webhooks. **Exception**: **`GET /health`** is mounted **without** the prefix (see `main.ts`).

Successful JSON responses are wrapped by **`RequestIdInterceptor`**: responses include a generated **`requestId`** (UUID) in addition to handler payload (arrays may appear under a `data` field when the interceptor wraps non-object bodies).

### 9.1 Automation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/automation/enable` | Provision Turnkey DA + policies; persist profile. |
| `POST` | `/v1/automation/disable` | DB kill switch; optional Turnkey policy deletion. |
| `GET` | `/v1/automation/status` | Profile + health fields. |
| `GET` | `/v1/automation/actions?limit=` | Recent actions (default limit 50, max 100). |
| `POST` | `/v1/automation/actions/:id/cancel` | Best-effort cancel if state is `queued`. |

**Headers:**

- `X-User-Id`: required.
- `X-Internal-Api-Key` or `Bearer`: required when `INTERNAL_API_KEY` is set.
- `Idempotency-Key`: optional on enable/disable; repeats return cached response from `IdempotencyEntry`.

#### `POST /v1/automation/enable`

Body (`EnableAutomationDto`):

- **`subOrgId`** (optional): if the user has no `TurnkeySuborg` row yet, this links the Turnkey sub-organization once.
- **`venues`**: `{ hyperliquid: boolean, pacifica: boolean }` — at least one must be true.
- **`limits`**: `{ maxNotionalUsd: string, maxLeverage: number (1–125), maxActionsPerDay: number }`
- **`strategy`**: `{ minAprBps, rebalanceDeltaBps, closeOnFundingFlip }`
- **`wallets`**: `{ evm: string, solana: string }` — addresses used for **`signWith`** and policy conditions.

**Behavior notes:**

- Requires parent Turnkey credentials + DA credentials.
- If prior `TurnkeyDelegatedAccess` had non-revoked `policyIds`, those policies are **deleted in Turnkey** before creating new ones.
- Delegated user name in Turnkey: **`Nuke Automation (Delegated)`** (constant in `src/turnkey/constants.ts`).

Response shape (plus `requestId`): `enabled`, `turnkey: { subOrgId, delegatedUserId, policyIds }`.

#### `POST /v1/automation/disable`

Body: `{ revokeTurnkey: boolean }`.

- Sets profile `enabled` to false (upserts profile if missing).
- If `revokeTurnkey` is true and policies exist: **`deletePolicy`** for each id in Turnkey, clears `policyIds`, sets `revokedAt`.

#### `GET /v1/automation/status`

Returns `enabled`, `venues`, `limits`, `strategy`, `health: { lastRunAt, lastError }`. If no profile exists, returns a default disabled-shaped object.

### 9.2 Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/webhooks/turnkey` | Stub: echoes receipt; **no** signature verification. |

### 9.3 Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Terminus health; **database** check runs `SELECT 1` via Prisma. |

---

## 10. Turnkey integration

### 10.1 Credential separation

| Credential | Used for |
|------------|----------|
| **Parent org** (`TURNKEY_PARENT_*`) | `getUsers`, `createUsers`, `createPolicies`, `deletePolicy` against **sub-org** `organizationId`. |
| **DA** (`TURNKEY_DA_*`) | `signRawPayload` with **`organizationId` = user `subOrgId`**. |

Never use parent keys for routine signing; never store private keys in the database (only in secrets / env / KMS).

### 10.2 Provisioning (`TurnkeyProvisionService`)

1. Resolve or create delegated user: **`getUsers`** by sub-org, match `userName`; else **`createUsers`** with DA **public** key and `API_KEY_CURVE_P256`.
2. **`createPolicies`**: batch from `policy-templates.ts`:
   - **Hyperliquid allow**: `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2`, `PAYLOAD_ENCODING_EIP712`, domain chain id + verifying contract + `wallet_account.address` = EVM signer.
   - **Pacifica allow**: `PAYLOAD_ENCODING_TEXT_UTF8` + Solana address.
   - **Deny** non–EIP-712 raw payload for the DA user **only when Pacifica is disabled** (so UTF-8 signing for Pacifica is not blocked).

Policy `consensus` is always of the form:  
`approvers.any(user, user.id == '<delegatedUserId>')`.

### 10.3 Signing (`TurnkeyDelegatedSignerService`)

- Builds `Turnkey` with **DA** keys; each call passes explicit **`organizationId: subOrgId`**.
- **`signRawPayload`**: `signWith` is the user’s **EVM** or **Solana** address from the profile, matching policy constraints.

Official Turnkey references (from docs pack): [Delegated access (backend)](https://docs.turnkey.com/concepts/policies/delegated-access-backend), [Policy language](https://docs.turnkey.com/concepts/policies/language.md), [sign raw payload](https://docs.turnkey.com/api-reference/activities/sign-raw-payload).

---

## 11. Automation engine and execution

### 11.1 Scheduler (`AutomationScheduler`)

- On module init, registers a **`setInterval`** whose period is **`max(AUTOMATION_ENGINE_INTERVAL_SEC, 10)`** seconds.
- Each tick calls **`AutomationEngine.runCycle()`** (errors logged).

### 11.2 Engine (`AutomationEngine`)

- If **`AUTOMATION_GLOBAL_DISABLED`**: logs and returns.
- Creates an **`AutomationRun`** row; loads all **`AutomationProfile`** with `enabled: true`.
- Per user (`evaluateUser`):
  - Enforces **max actions per day** (`limits.maxActionsPerDay`, UTC day window; counts `queued`, `executing`, `succeeded`).
  - Compares **mock APR** to **`minAprBps`**:
    - `mockApr = parseInt(process.env.AUTOMATION_MOCK_APR_BPS ?? `${minApr + 1}`, 10)`
    - If `mockApr >= minApr`, **no action** (default idle).
  - Otherwise may create a **`close`** action (BTC, HL + Pacifica legs) with a time-bucketed idempotency key and invoke execution.

### 11.3 Execution (`AutomationExecutionService`)

- Loads action, profile, sub-org, delegated access; verifies automation is active.
- For each enabled venue with a wallet address:
  - **Hyperliquid**: `HyperliquidExecutor.executeSignedOrder`
  - **Pacifica**: `PacificaExecutor.executeSignedRequest`
- Updates action state: `queued` → `executing` → `succeeded` or `failed`.

**Note:** There is no full **two-leg hedge atomicity** or compensating trade logic yet—see [§17](#17-implemented-vs-remaining).

---

## 12. Exchange executors (Hyperliquid and Pacifica)

Both are **scaffolding**; you must align with official exchange documentation before production.

### 12.1 Hyperliquid

- **Typed data**: `hyperliquid-typed-data.ts` builds JSON for EIP-712 with domain from env and a custom **`HyperliquidAutomation`** message type wrapping a JSON string payload.
- **Signing**: `PAYLOAD_ENCODING_EIP712`, `HASH_FUNCTION_NOT_APPLICABLE`.
- **Submission**: `POST {baseUrl}/exchange` with `action`, `nonce`, `signature` (ethers `Signature` serialization).
- **Gap**: Real Hyperliquid **types**, **nonces**, and **action** shapes must match their live API; policies may need **`eth.eip_712.primary_type`** constraints.

### 12.2 Pacifica

- **Message**: compact JSON via `pacifica-message.ts`.
- **Signing**: `PAYLOAD_ENCODING_TEXT_UTF8`.
- **Submission**: `POST {baseUrl}/v1/automation/trade` with custom headers (`x-automation-signature`, timestamp, address). Signature bytes are derived from Turnkey **`r`/`s`** and **base58**-encoded—**verify against Pacifica’s real spec**.
- **Gap**: Endpoints, headers, and ed25519/signature encoding are placeholders.

---

## 13. Webhooks

`POST /v1/webhooks/turnkey` accepts any JSON and returns `{ received: true, echo: body }`. There is **no** HMAC or Turnkey webhook verification and **no** persistence.

---

## 14. Health and observability

- **`GET /health`**: Terminus + Prisma ping; fails if DB unreachable.
- **Logging**: Nest default logger on engine errors and exchange warnings.
- **Metrics / tracing**: not implemented (see docs pack guardrails for recommendations).

---

## 15. Testing

| Command | Scope |
|---------|-------|
| `npm test` | Unit tests (`src/**/*.spec.ts`). |
| `npm run test:e2e` | Loads `test/setup-e2e.ts` (sets `DATABASE_URL`), mocks Prisma + scheduler, hits **`GET /health`**. |

---

## 16. Security notes

- Treat **Turnkey parent** and **DA private keys** as **high-value secrets**; rotate on compromise; prefer KMS/Vault in production.
- **`X-User-Id`** must be **trusted**—only your authenticated backend should set it, or users can impersonate each other.
- **`INTERNAL_API_KEY`** is optional defense-in-depth for private deployments.
- **Policies** narrow what the DA key can do; **backend** must still enforce notional/leverage and business rules (many are not fully wired—see below).
- **Webhook** endpoint is **not** authenticated in code—do not expose it publicly without adding verification.

---

## 17. Implemented vs remaining

### Implemented in this repo

- NestJS service with config validation, Swagger, global validation pipe.
- Prisma schema + migrations + Docker multi-stage image + Compose with Postgres.
- Turnkey: DA user provisioning, policy create/revoke, DA `signRawPayload`.
- REST contract for automation + idempotency storage for enable/disable.
- Engine loop with global disable, per-day action cap, mock APR gate, stub close intent.
- Executor skeletons for HL (EIP-712 + `/exchange`) and Pacifica (UTF-8 + placeholder HTTP).
- DA key generation script, health check, e2e smoke for health.

### Remaining for a production-ready product (high level)

- **Auth**: Real JWT/OIDC (or strict gateway) instead of raw `X-User-Id`.
- **Hyperliquid & Pacifica**: Exact payloads, auth, error handling, retries, idempotency with exchange semantics.
- **Strategy**: Live funding/APR/position inputs; rebalance and emergency close; churn limits and cooldowns from the docs pack.
- **Hedge**: Ordered leg execution, partial failure handling, reconciliation alerts.
- **Turnkey**: `updateRootQuorum` if your bootstrap ever makes DA root; `getPolicyEvaluations` on denials; optional webhook verification and audit pipeline.
- **Observability**: Metrics, structured logs, alerts.
- **Tests**: Integration tests with mocked or sandbox exchanges.

---

## Document history

- **2026-05-01**: Initial `DOCUMENTATION.md` generated to describe the **nuketrade-automation-service** repository. Product source of truth remains [`automation-backend-docs/README.md`](./README.md) in **nuke-fe** (this folder).
- **2026-05-01**: Copy mirrored here as `12-nuketrade-automation-service-DOCUMENTATION.md` for cross-repo reference.
