# WISDO v7.0.3 Release Notes

WISDO v7.0.3 is a heap-safety and MT4 command-poll release. It keeps the complete v7 remodel, 77-command Discord system, desk recovery, website greetings, copier batching, key rotation, and transport repairs from v7.0.2.

## Added

- Compact schema-v2 MT4 command persistence.
- Single-flight cold loading for concurrent Reporter polls.
- One-read multi-identity command lookup.
- Compact command queue metrics for `/health/performance`.
- V8 heap and RSS pressure telemetry.
- Configurable pre-OOM request shedding for noncritical reads.
- Reporter delivery-identity cache and rate-limited heartbeat scheduling.
- Four heap/poll regression tests.

## Changed

- Command history and audit defaults reduced to 250.
- PostgreSQL pool default for the Render blueprint reduced to two connections.
- Signal workers reduced to two and the bounded queue reduced to 200.
- Signal and MT4 historical retention defaults in the Render blueprint reduced.
- Redis heartbeat no longer blocks `/mt4-command-poll` or completion responses.
- Native `structuredClone` replaces JSON stringify/parse on hot persistence paths.

## Preserved

- Pending and delivered commands are never removed by history compaction.
- Emergency and close commands retain top queue priority.
- PostgreSQL remains durable production truth.
- Redis remains optional.
- Reporter authentication, known pairing, API-key rotation, and stale-key recovery remain enforced.

## Verification

- 107 JavaScript files audited.
- 100/100 tests passed.
- 1,000 simultaneous idle poll pressure test passed with one state read and zero writes.
