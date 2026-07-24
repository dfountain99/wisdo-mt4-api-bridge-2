# WISDO v7.0.6 Release Notes

## Fixed

- Eliminated false 100-open/100-close replay after Reporter time-format changes or server restarts.
- Migrated legacy trade tracking to broker-ticket-stable identities.
- Removed repeated full-ledger scans during large snapshot reconciliation.
- Prevented timed-out background work from silently exceeding configured concurrency.
- Removed unnecessary full-state clone during buffered authoritative persistence saves.
- Coalesced Wisdo memory and product updates to one latest snapshot per account.
- Bounded product trade records, telemetry, alerts, live event keys, and relay diagnostics.
- Updated live UI and connection instructions to Reporter v1.59.
- Updated public runtime version reporting to 7.0.6.

## Preserved

- Durable Culture Lanes and restored relay routes after redeploy.
- Personalized website entrance recognition and persistent floating-P/L HUD.
- Unique 50% growth milestone celebrations.
- 77 Discord slash commands and private desk workflows.
- Priority close and emergency copier commands.

## Validation

- 112 JavaScript files audited.
- 120/120 tests passed.
- 1,000 repeated 200-trade reconciliations passed under a 64 MB V8 heap.
