# Automation Engine

## Loop model (v1)

Run every N minutes (e.g. 1–5 min):

For each user where `automation_profiles.enabled = true`:

1) Load current positions on each enabled venue (HL + Pacifica).
2) Load current funding rates / APR inputs for candidate assets.
3) Compute current effective APR for the user’s existing hedge.
4) Decide action:
   - **Emergency close** if funding flips past threshold or risk constraints violated.
   - **Close** if APR falls below `minAprBps`.
   - **Rebalance** if a better pair exists (by `rebalanceDeltaBps`).
   - Otherwise do nothing.
5) Emit an `automation_action` with an idempotency key:
   - `userId + kind + asset + venues + timeBucket`

## Minimum executor capability (required for hedging)

For any pair of venues the strategy engine may choose as hedge legs, the backend must support:

- **Open on venue A + open on venue B**
- **Close on venue A + close on venue B**

If a venue only supports “open” but not “close” (or vice versa), it must not be eligible for automation.

## Separation of concerns

- **Decision**: pure function from state → intent. No side effects.
- **Execution**: converts intent → signed request(s) → exchange submission(s).

## Idempotency + retries

- Action execution must be idempotent across retries.
- Keep a finite state machine per action (queued/executing/succeeded/failed).
- Apply exponential backoff on transient errors.

## Rate limits + churn control

Add guardrails to avoid “thrash”:

- minimum time between rebalances
- max actions per day
- cool-down after errors

## Notifications (optional)

Emit events for:

- automation enabled/disabled
- opened position
- closed position
- rebalance performed
- error requiring user attention

