# Packages + Scaffold Plan (TypeScript backend)

This is a pragmatic scaffold for a new repo `nuke-automation-backend`.

## Runtime choices

- **Framework**:
  - **NestJS (recommended default for this product)**: best fit as you add more exchanges, admin endpoints, webhooks, auth guards, and operational tooling.
  - **Fastify (alternative)**: best if you want the smallest possible service and fastest bootstrap.
- **DB**: Postgres + Prisma or Drizzle. Recommend **Prisma** for v1 velocity.
- **Jobs**:
  - **BullMQ + Redis** (pairs well with Nest via `@nestjs/bullmq`) if you already run Redis.
  - **pg-boss** if you want Postgres-only background jobs (no Redis dependency).

### Recommended default stack (what we suggest you build)

- **NestJS + Prisma + Postgres**
- **Jobs**: BullMQ + Redis *if Redis is available*, otherwise **pg-boss**
- **Validation**: `zod` *or* Nest `class-validator` + `class-transformer` (pick one and standardize)
- **Turnkey**: `@turnkey/sdk-server`

## Dependencies (recommended)

### Core (NestJS track — default)

- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-fastify` (or `platform-express` if you prefer Express)
- `@nestjs/config`
- `@nestjs/swagger` (OpenAPI)
- `@nestjs/terminus` (health checks)
- `zod` (if you want Zod DTO validation) *or* `class-validator` + `class-transformer`

### Jobs (pick one)

- **BullMQ track**: `@nestjs/bullmq`, `bullmq`, `ioredis`
- **Postgres-only track**: `pg-boss`

### Core (Fastify track — alternative)

- `fastify`
- `@fastify/cors`
- `@fastify/swagger` + `@fastify/swagger-ui` (optional but useful)
- `zod` (request validation)
- `pino` (logging) + `pino-pretty` (dev)
- `dotenv`

### Turnkey

- `@turnkey/sdk-server`

### Crypto / encoding

- `bs58` (Solana signature encoding)
- `ethers` (EVM signature formatting, EIP-712 helpers if needed)

### Persistence

- `prisma` + `@prisma/client`
- `pg`

### Tooling

- `typescript`
- `tsx` (dev runner)
- `eslint` + `typescript-eslint`
- `prettier`

## Repo structure

### NestJS layout (recommended)

```
src/
  main.ts
  app.module.ts
  health/
    health.module.ts
    health.controller.ts
  config/
    env.validation.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
  turnkey/
    turnkey.module.ts
    parent-admin.client.ts
    delegated-signer.client.ts
    provision.service.ts
    policies.service.ts
  automation/
    automation.module.ts
    automation.controller.ts
    automation.service.ts
    engine.service.ts
    executor.service.ts
  exchanges/
    hyperliquid/
      hyperliquid.module.ts
      hyperliquid.executor.ts
      hyperliquid.client.ts
      typed-data.ts
    pacifica/
      pacifica.module.ts
      pacifica.executor.ts
      pacifica.client.ts
      signing-message.ts
  jobs/
    jobs.module.ts
    automation.worker.ts
  audit/
    audit.module.ts
    audit.service.ts
```

### Fastify layout (alternative)

```
src/
  app.ts
  server.ts
  config/
    env.ts
  db/
    prisma.ts
  turnkey/
    parent-admin.client.ts
    delegated-signer.client.ts
    provision.ts
    policies.ts
  automation/
    api.routes.ts
    service.ts
    engine.ts
    executor.ts
  exchanges/
    hyperliquid/
      typedData.ts
      executor.ts
      client.ts
    pacifica/
      signingMessage.ts
      executor.ts
      client.ts
  jobs/
    scheduler.ts
    workers.ts
  audit/
    store.ts
```

## Implementation order (fastest path)

1) Skeleton server + `/health`
2) DB schema + migrations
3) Turnkey parent admin client + DA signer client
4) `POST /automation/enable` provisions DA user + policies
5) Hyperliquid executor (close-only first)
6) Job runner that triggers close based on a dummy rule
7) Add open + rebalance rules
8) Add Pacifica executor

