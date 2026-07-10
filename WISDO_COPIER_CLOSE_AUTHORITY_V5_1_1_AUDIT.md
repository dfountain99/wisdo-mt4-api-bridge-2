# WISDO Copier Close Authority V5.1.1 — Audit

Date: July 10, 2026

## Reported failure

Follower positions opened from a Culture Lead but remained open after the lead closed.

## Root causes found

1. The production webhook queued `leaderTicket` and sometimes `followerTicket`, while the MT4 Reporter close handler only read `sourceTicket` or `signalId`.
2. The production open path could fall back to a unique command ID, so a later close command could not reproduce the original MT4 comment marker.
3. The legacy copier applied symbol allowlists, route pause, and risk-entry checks to close commands.
4. The server marked a mirrored trade closed when the close was merely queued, before MT4 confirmed execution.
5. The Reporter returned success when no copied position was found.
6. The bundled compiled EX4 was older than the active source and did not contain the close repair.

## Repair

### Stable ticket binding

Each copied open/close command now carries:

- `sourceTicket`
- `leaderTicket`
- `masterTicket`
- route-scoped `copyKey`
- `followerTicket`
- `routeId`
- leader/follower account IDs
- resolved follower symbol

The actual follower ticket returned by MT4 `OrderSend` is stored when command completion arrives. Historical completed open commands are scanned to recover a missing follower ticket before a close is queued.

### Close authority

Existing mirrored positions close even when:

- the Culture Lane is paused;
- the symbol allowlist has changed;
- max-open-trades is reached;
- spread exceeds the opening threshold;
- daily-loss or drawdown gates block new risk;
- trading hours have ended.

Those controls remain active for opens only.

### Reporter v1.55

The Reporter resolves a close in this order:

1. exact `followerTicket` / `copyTicket` / `mirrorTicket`;
2. stable source/leader/master ticket marker;
3. safe legacy recovery only when symbol and side identify exactly one WISDO copied position.

It refuses to guess among multiple positions and returns a failed completion when no position matches.

### State correctness

- Queueing a close sets the mirrored trade to `closing`.
- MT4 success sets it to `closed`.
- MT4 failure restores it to `open` and records the execution error.
- Failed MT4 commands are stored as `failed`, not `completed`.

## Validation

- JavaScript build check: 74 files passed.
- Required production assets: 9 passed.
- Automated tests: 10 passed, 0 failed.
- Concurrent command storage regression: passed.
- Paused-lane close regression: passed.
- Changed-symbol-filter close regression: passed.
- Historical follower-ticket recovery: passed.
- Reporter v1.55 source assertions: passed.
- Follower-ticket completion reconciliation: passed.
- Web-only bridge smoke: passed.
- `/api/public/health`: HTTP 200, version 5.1.1.
- `/app/dashboard`: HTTP 200 under authenticated smoke identity.
- `/app/accounts`: HTTP 200 under authenticated smoke identity.

## Deployment boundary

The server deployment alone cannot update an EA already installed in MT4. Every follower terminal must compile and install `CultureCoin_MT4_Reporter.mq4` v1.55, enable `EnableCopyTrading`, and turn AutoTrading on.

No EX4 compilation was performed in this environment because MetaEditor is required. The old compiled binary is archived under documentation and is not distributed as the active Reporter.
