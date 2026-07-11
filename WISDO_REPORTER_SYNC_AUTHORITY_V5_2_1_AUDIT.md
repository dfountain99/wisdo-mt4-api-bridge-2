# WISDO Reporter Sync Authority V5.2.1 — Audit

## Failure reproduced

The web application queued `SYNC_ACCOUNT`, but Reporter v1.55 did not route that command and returned `Unsupported command for reporter execution: SYNC_ACCOUNT`. The HTTP 200 in the log only confirmed that the failure result reached WISDO.

## Repair

- Reporter upgraded to v1.56.
- `SYNC_ACCOUNT`, `ACCOUNT_SYNC`, `REFRESH_ACCOUNT`, `REQUEST_SNAPSHOT`, and `SYNC_NOW` now invoke an immediate `/mt4-sync` snapshot.
- The command succeeds only when the snapshot endpoint returns HTTP 2xx.
- Failure details are returned through `/mt4-command-complete`.
- Snapshots include `reporterVersion` and `reporterCapabilities` for compatibility diagnostics.
- All v1.55 follower-ticket close-authority behavior remains active.

## Validation

- JavaScript build check passed.
- 12 automated tests passed, 0 failed.
- Structural Reporter assertions confirm v1.56, sync routing, immediate snapshot, capability metadata, exact-ticket close authority, and no false-success close.

## Required MT4 step

Compile the v1.56 MQ4 in MetaEditor and replace the Reporter on every connected terminal. A Render deployment cannot replace an EX4 already loaded in MT4.
