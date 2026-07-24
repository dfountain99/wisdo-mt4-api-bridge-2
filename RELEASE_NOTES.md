# WISDO Unified Ecosystem v1.0 Foundation

This release introduces a single PostgreSQL-backed command path across Render, Raspberry Pi, Windows, and registered trading bots.

Implemented:
- secure Pi and Windows device enrollment with hashed tokens
- PostgreSQL device registry, bot registry, command queue, leases, results, and audit
- Pi voice transcript to command creation and spoken result retrieval
- Windows terminal discovery, bot registration, command leasing, and durable local Reporter inbox
- target resolution by bot name or alias
- duplicate-safe command IDs, bounded attempts, expiration, and SKIP LOCKED leasing
- health endpoint at `/health/command-bus`

Execution boundary:
- v1.0 proves the complete secure transport and acknowledgement path.
- the included Windows agent writes approved commands to its durable local Reporter inbox.
- a Reporter/EA adapter must consume that inbox before the result represents confirmed MT4 execution.
- do not treat `completed` as broker execution confirmation until that adapter is installed.
