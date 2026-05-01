# Nuke Automation Backend (Turnkey Policies) — Docs Pack

This folder is a **build spec** for a new TypeScript backend repo that enables a premium feature: a user clicks **“Enable Automation”**, and the backend can **open AND close** hedge positions automatically on **both legs** (starting with **Hyperliquid + Pacifica**) using **Turnkey server-side delegated access + policies**.

## What this docs pack gives you

- An end-to-end **architecture** and execution flow.
- A concrete **API surface** (REST) for the automation feature.
- A concrete **data model** and background job design.
- Turnkey **delegated-access setup** and **policy templates** aligned with Turnkey’s policy language.
- A pragmatic **security model** (what policy can enforce vs what must be enforced by backend + exchange-side).
- A recommended **package list** and repo scaffolding plan (includes a **NestJS-first** default stack and a lighter Fastify alternative).
- A **reference implementation doc** for the **`nuketrade-automation-service`** repo (what is built vs placeholder): `12-nuketrade-automation-service-DOCUMENTATION.md`.

## Source of truth (Turnkey docs)

- Delegated access (server-side): `https://docs.turnkey.com/concepts/policies/delegated-access-backend`
- Policy overview: `https://docs.turnkey.com/concepts/policies/overview`
- Policy language: `https://docs.turnkey.com/concepts/policies/language.md`
- Sign raw payload: `https://docs.turnkey.com/api-reference/activities/sign-raw-payload`
- Sign transaction: `https://docs.turnkey.com/api-reference/activities/sign-transaction`

## Docs index

- `01-goals-non-goals.md`
- `02-architecture.md`
- `03-turnkey-delegated-access-setup.md`
- `04-turnkey-policy-templates.md`
- `05-api-contract.md`
- `06-data-model.md`
- `07-automation-engine.md`
- `08-exchange-executors.md`
- `09-security-guardrails.md`
- `10-local-dev-deploy.md`
- `11-packages-scaffold.md`
- `12-nuketrade-automation-service-DOCUMENTATION.md`

## How to use this folder

1. Create a new repo (e.g. `nuke-automation-backend`).
2. Follow `11-packages-scaffold.md` to scaffold the project and install dependencies.
3. Implement Turnkey delegated access and policy provisioning from `03-*` + `04-*`.
4. Implement the API from `05-api-contract.md` and persistence from `06-data-model.md`.
5. Implement the job runner and exchange executors from `07-*` + `08-*`.
6. Enforce guardrails from `09-security-guardrails.md` before enabling users.
7. If you are building **`nuketrade-automation-service`**, keep this pack in sync with `12-nuketrade-automation-service-DOCUMENTATION.md` (paths in that file refer to the service repo, not `nuke-fe`).

