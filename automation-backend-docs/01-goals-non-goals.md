# Goals / Non-goals

## Goals

### Product

- User clicks **Enable Automation**.
- Backend can **open AND close** hedge positions automatically for the user, **on both venues used in the hedge**.
- Start with **Hyperliquid (EVM EIP-712)** and **Pacifica (Solana signed API messages)**, meaning v1 must support **open + close on Hyperliquid** and **open + close on Pacifica**.
- The backend’s ability to sign is **scoped and auditable** using **Turnkey delegated access + policies**.
- Users can **disable automation** at any time (immediate effect).

### Technical

- Create a per-user **Turnkey Delegated Access user** in the user’s sub-organization.
- Bind a backend-held **Delegated Access API key** to that user.
- Install **Turnkey policies** that only allow intended signing behaviors.
- Implement an automation engine that:
  - watches funding/APR signals
  - decides actions (close / open / rebalance)
  - executes actions with idempotency + safety checks

## Non-goals (v1)

- Supporting every exchange on day 1 (Backpack/Lighter/etc. can follow).
- Fully trustless automation (there is backend signing authority, albeit constrained).
- Fee/billing implementation (premium feature monetization is out-of-scope here).
- A complex strategy optimizer. Start with deterministic triggers.

## Definitions

- **Parent org**: your Turnkey organization (company/team).
- **Sub-org**: per-user Turnkey organization (already used in the frontend).
- **Delegated Access (DA) user**: a user inside the sub-org controlled by your backend.
- **DA API key**: API keypair whose private key is held by your backend and used to sign.