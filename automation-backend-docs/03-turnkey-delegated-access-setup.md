# Turnkey Delegated Access Setup (server-side)

This is the canonical Turnkey pattern for “backend can sign for a user, but only within policy constraints”.

References:

- Delegated access doc: `https://docs.turnkey.com/concepts/policies/delegated-access-backend`
- Create users (add DA user to existing sub-org): `https://docs.turnkey.com/api-reference/activities/create-users`
- Create policy / policies: `https://docs.turnkey.com/api-reference/activities/create-policy` and `.../create-policies`
- Update root quorum: `https://docs.turnkey.com/api-reference/activities/update-root-quorum`

## Preconditions

- You already have **one Turnkey sub-organization per end user**.
- You can map your internal user id → Turnkey `subOrgId` (store this in your DB).

## Credential model (recommended)

Maintain two distinct Turnkey server credentials:

1) **Parent-org admin credentials**

- Purpose: create/update users + policies inside sub-orgs.
- Stored: backend secrets.
- Never used for runtime signing.

2) **Delegated Access API keypair**

- Purpose: runtime signing “as the DA user”.
- The DA public key is attached to the DA user in each sub-org.
- The DA private key is stored by your backend.

Important: Use a dedicated keypair for automation. Do not reuse your parent-org admin key.

## Enabling automation for an existing user sub-org

### Step 1 — Add DA user inside the sub-org

Call Turnkey `createUsers` with `organizationId = <subOrgId>` and include one new user:

- `userName`: e.g. `Nuke Automation`
- `apiKeys`: contains the **DA public key** and curve type (default P-256 is typical)

Output:

- `turnkeyDelegatedUserId`

If you want to avoid duplicates, first list users / check tags (implementation choice).

### Step 2 — Create policies bound to DA user

Create at least one **allow** policy with:

- `consensus`: only the DA user id can approve
- `condition`: restrict allowed signing actions (see `04-turnkey-policy-templates.md`)

Note:

- Policies are evaluated for each request.
- Root quorum bypasses policies.
- Implicit deny means “only what you allow can happen”.

### Step 3 (recommended) — Remove DA user from root quorum

Turnkey’s delegated access guide recommends:

- initial creation may place DA as root (or you created it as a root user originally)
- after policies are installed, update root quorum so **only the end-user remains root**

In your case, since sub-orgs already exist, you are likely adding a DA user that is **not** root. If your `createUsers` flow creates a non-root user by default, this step may be unnecessary; but if you choose to grant root temporarily for bootstrapping, you must remove it afterwards.

## Runtime signing pattern

When the automation engine wants to sign:

- Initialize `@turnkey/sdk-server` using the **DA keypair**
- Set `defaultOrganizationId = <subOrgId>`
- Perform signing activities:
  - `signRawPayload` for EIP-712 HL actions
  - `signRawPayload` for Pacifica message signing

If signing fails unexpectedly, fetch policy evaluations for the failed activity:

- `getPolicyEvaluations` doc: `https://docs.turnkey.com/api-reference/queries/get-policy-evaluations`

## Disabling automation

Minimum viable “off switch”:

- set `automation_enabled=false` in your DB and stop executing.

Stronger “cryptographic” off switch:

- update policy to explicitly deny DA signing (or delete allow policy)
- or delete DA user / delete DA API key credential from sub-org

Recommended:

- implement both: DB kill switch (instant) and policy revocation (defense-in-depth).

