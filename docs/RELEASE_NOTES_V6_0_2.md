# WISDO v6.0.2 — Visible Control Surfaces + Fast Close

## Why this release exists

Manual deployment testing found four product gaps after v6.0.1:

1. Bulk closes appeared to process too slowly and account/lane closes were not fanned out together.
2. Culture Lane controls existed in APIs but were difficult to discover in the website.
3. Smart Symbol Routing did not provide a practical click-to-allow workflow tied to live copier rules.
4. Harvest, Genome, Timeline, Trade Passport, Lane DNA, Intelligence, and Compound Tracker lacked obvious dedicated pages.

## Fast close changes

- Account bulk close now queues one priority-5000 atomic basket-sweep command before slower audit persistence.
- Culture Lane Close All fans one priority-10000 command to every lane account with `Promise.allSettled`, instead of waiting account-by-account.
- Harvest close execution uses the same parallel lane fanout.
- Lead-to-follower copied closes are queued in parallel across routes.
- Close commands use a two-minute expiry so stale emergency actions cannot execute much later.
- Reporter v1.57 snapshots all matching MT4 tickets, then executes one immediate terminal basket sweep.

MT4 still performs individual broker `OrderClose` operations internally; one terminal cannot transmit multiple broker closes at the identical CPU instant. The speed improvement is that WISDO sends one account sweep command and the Reporter closes the captured basket in one tight event rather than waiting for separate website commands.

## New visible website pages

- `/app/culture-lanes` — Culture Lane Vault, account health, and parallel Close Entire Lane.
- `/app/symbol-routing` — leader-history symbol highlights and follower compatibility.
- `/app/harvest` — Harvest policy, evaluation, execution, and cycle history.
- `/app/lane-audit` — Genome versions, Timeline events, and Trade Passports.
- `/app/lane-intelligence` — Lane DNA and Culture Intelligence.
- `/app/compound-tracker` — persistent close intelligence and growth gauges.

The Command Center now links directly to all six surfaces. Desktop navigation scrolls, and mobile receives a page selector because the desktop sidebar is hidden on smaller screens.

## Click-to-allow Smart Symbol Routing

- WISDO automatically derives the leader symbol list from actual stored leader trade history.
- Green symbol buttons are allowed; grey buttons are blocked.
- Allow All and Block All update the whole visible history set.
- Optional follower aliases can be entered beside each leader symbol.
- Saving updates both the durable Culture Lane Symbol Policy and the active Copier Engine route.
- The live relay receives `allowedSymbols`, `blockedSymbols`, `allowOnlyHighlighted`, and symbol mappings.
- Block All remains restrictive even with an empty allowlist.
- Opening filters never prevent authoritative closes of existing mirrored trades.

## Migration behavior

Existing Copier Engine rules are automatically backfilled into visible Culture Lanes. Users do not need to delete and recreate their existing routes.

## Validation

- Production build checker passes.
- 41 automated tests pass.
- Tests cover visible pages, parallel lane close, automatic lane backfill, saved symbol enforcement, and live relay synchronization.
- Reporter v1.57 source/package structural validation passes.
