# WISDO v6.0.3 — Unified Multi-Account Culture Lane

## Product layout

- Culture Lane creation and editing now live in `/app/copier-engine`.
- One lane can contain one Culture Lead and multiple receiver accounts.
- Each receiver still receives its own durable execution route behind the shared lane.
- The old Culture Lane page redirects to the combined Dashboard.
- The old Symbol Routing page redirects to Copier Engine.
- The old standalone Harvest page redirects to the combined Dashboard.

## Copier Engine symbol routing

- Selecting a Culture Lead loads every symbol found in that leader's trade history.
- Symbols render as clickable highlights inside the Allowed Symbols section.
- Green means new entries are permitted; grey means new entries are blocked.
- Allow All and Block All update every receiver route in the lane.
- Broker symbol aliases remain available through the advanced mapping editor.
- Close authority is never blocked by symbol permissions or a paused entry route.

## Combined lane Dashboard

- Collective balance and equity across the leader and all receivers.
- Combined floating, closed, and total P/L.
- Combined daily return, drawdown, open trades, execution health, and Harvest count.
- Per-account drill-down while presenting the lane as one portfolio account.
- Portfolio analytics no longer inherit only the currently selected account when a lane is active.

## Working Dashboard Harvest

- Harvest settings and controls are embedded in the Dashboard.
- Save + Arm captures a reference baseline.
- Check Goal evaluates without execution.
- Check Goal + Harvest executes only when the saved goal is reached.
- Harvest Lane Now forces a full-lane parallel sweep.
- Automatic Harvest evaluates after every Reporter snapshot.
- Every account receives a priority-10000 atomic sweep command in parallel.
- A cycle completes only after Reporter snapshots confirm the full lane is flat.
- Harvest Once pauses the lane and its receiver routes after flat confirmation.
- Harvest and Continue resets the baseline for the next cycle.

## Leader-close relay repair

- Explicit leader closed-history events queue deterministic follower close commands.
- A complete Reporter snapshot where a previously open leader ticket disappears also creates close authority.
- Both close paths share deterministic command IDs, preventing duplicate receiver closes.
- Receiver closes bypass paused entry routing and Allowed Symbols restrictions.
- Commands carry the stored follower ticket when available, priority 10000, and a two-minute TTL.

## Telemetry correction

- Culture Lane Vault and Harvest now read the live Reporter snake-case account fields used by the production ledger.
- Floating P/L, closed P/L, and open-trade totals no longer remain at zero because of field-name mismatch.

## Validation

- Production build checker passed.
- 90 JavaScript files validated.
- 14 required production assets validated.
- 45 automated tests passed.
- 0 tests failed.
