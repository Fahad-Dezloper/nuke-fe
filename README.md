# Nuke

**Nuke** is a **funding rate arbitrage** stack: a trading terminal and automation surface for running **delta-neutral** strategies across perpetual venues, capturing spread between funding, fees, and execution—without directional exposure to the underlying.

**Live app:** [https://nuketrade.xyz](https://nuketrade.xyz)

This repository is the **Nuke frontend** (`nuke-fe`): a Next.js application that connects wallets, shows cross-venue spreads and positions, opens and closes hedged legs, and (optionally) coordinates with backend automation services.

---

## What Nuke does

- **Funding arbitrage** — Surfaces opportunities where long and short perpetual legs on different venues net a positive carry (funding, APR views, execution constraints).
- **Delta-neutral execution** — Opens and closes **paired** positions (e.g. long on one venue, short on another) with shared margin and leverage intent so exposure stays hedged.
- **Custody & signing** — Uses **[Turnkey](https://www.turnkey.com/)** for embedded wallets and policy-bound signing across EVM (e.g. Hyperliquid) and Solana (e.g. Pacifica) flows.
- **Automation (optional)** — An automation engine where user delegates the opening and closing of position to Nuke, and Nuke finds best asset-pairs across exchanges to farm better APRs 24/7.

---

## Product surface (in this app)

| Area | Purpose |
|------|--------|
| **Funding Arbitrage** | Main dashboard: market overview, charts, position controls, hedged open/close, positions table. |
| **Automation** | Configure rules and limits; optional integration with Rust + Nest automation backends;
| **Portfolio** | Aggregated view of balances and positions relevant to the product. |

Supported / integrated venues in the codebase include **Hyperliquid**, **Pacifica**, and related bridge / deposit paths; other venues may appear in the UI as the roadmap expands.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | **Next.js 16** (App Router) |
| UI | **React 19**, **Tailwind CSS v4** |
| State | **Jotai**, **TanStack React Query** |
| Wallets / auth | **Turnkey** (browser SDK, EVM + Solana) |
| Types | **TypeScript 5** |

---

## Getting started (developers)

### Prerequisites

- **Node.js 18+**
- **pnpm** (recommended) or npm

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Configure variables for your deployment (API base URLs, Turnkey org context, automation endpoints, etc.). Use your team’s internal checklist or `.env` template—**do not commit secrets**.

Typical categories of configuration:

- Main **backend API** (positions, APR, hedge intents).
- **Turnkey** (organization / sub-org, origins).
- Optional **automation** (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTOMATION_API_URL`, auth tokens or header mode).

### Production build

```bash
pnpm build
pnpm start
```

### Other scripts

```bash
pnpm lint
# Lighter WASM sync (when working on Lighter integration)
pnpm run lighter:wasm
```

---

## Repository layout (overview)

```
src/
├── app/                 # Routes: home, automation, portfolio, API routes
├── components/          # UI primitives + feature modules (trading, layout, automation)
├── hooks/               # React hooks (positions, close, debounce, etc.)
├── lib/                 # API client, venue services (HL, Pacifica, …), hedge-intent engine, stores
├── dex/                 # Venue-specific helpers (e.g. Hyperliquid, Pacifica constants)
└── types/               # Shared TypeScript types
```

---

## Security and compliance

- Treat all **private keys and API secrets** as production credentials; keep them out of git and client bundles where possible.
- Review **Turnkey policies** and **venue limits** before enabling automation or delegated signing for end users.

---

## License

**Private** — All rights reserved unless otherwise agreed.

---

## Links

- **Production:** [https://nuketrade.xyz](https://nuketrade.xyz)
