# WISDO v7.0.8 Database-First OOM Repair Audit

## Incident

Production repeatedly exhausted the Node/V8 heap despite command limits, poll coalescing, and section-level JSON persistence. The remaining architectural problem was that high-frequency trading operations still reconstructed or updated large JSON-shaped namespaces in process memory.

## Root cause

PostgreSQL existed, but portions of the trading system used it as a document store. A Reporter heartbeat could indirectly participate in loading, copying, merging, or serializing a much larger state object than the account being updated.

## Database-first architecture

v7.0.8 introduces dedicated indexed tables:

- `wisdo_mt4_pairings`
- `wisdo_mt4_accounts`
- `wisdo_mt4_active_accounts`
- `wisdo_mt4_signal_tracking`
- `wisdo_mt4_snapshot_history`
- `wisdo_mt4_commands`
- `wisdo_mt4_command_audit`
- `wisdo_trade_signals`

Reporter heartbeats now use one narrow account-context query and one PostgreSQL transaction. They do not load or save the complete MT4 namespace.

## MT4 snapshot transaction

One transaction can update:

1. the pairing record;
2. the account connection/settings/latest snapshot;
3. the selected active account when none exists;
4. ticket-stable signal tracking;
5. one compact history row when the configured history interval is due.

The transaction never touches `wisdo_state_sections`.

## Commands

The MT4 command queue is relational and indexed by user, account, state, priority, creation time, and expiry. Active dedupe keys prevent duplicate copy instructions from producing unbounded rows. Close, emergency, protection, and profit-lock commands retain priority authority.

## Signals

Trade signals are stored by signal ID with a unique leader-account/source-ticket constraint. Signal list APIs query bounded rows rather than reconstructing a shared signal object.

## Compatibility data

Account shares, access requests, broker-link requests, legacy copier routes, trade links, and copy links stay in a small PostgreSQL compatibility namespace. This prevents the database conversion from deleting existing linked-account and Culture Lane metadata while keeping that data outside the Reporter hot path.

## Culture Lane durability

Culture Lane definitions and relay rules remain PostgreSQL-backed and restore on boot. This release does not move lane configuration back to local files or Render's temporary filesystem.

## Validation

- 119 JavaScript files passed the build audit.
- 127 automated tests passed.
- A 64 MB V8 pressure run processed 5,000 Reporter heartbeats with 100 open trades each.
- Pressure run produced 5,000 narrow commit calls.
- Full MT4 namespace reads: 0.
- Full MT4 namespace writes: 0.
- Final V8 heap used: approximately 4.87 MB.
- Fresh package-lock generation succeeded.

## Limitations and production confirmation

The relational stores and transaction boundaries were unit-tested with controlled PostgreSQL pool doubles. This environment did not connect to the user's live Render PostgreSQL database. Render must run the included migration and production behavior must be confirmed from live logs and database table counts after deployment.
