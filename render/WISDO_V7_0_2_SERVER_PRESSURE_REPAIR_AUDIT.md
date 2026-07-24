# WISDO v7.0.2 Server Pressure Repair Audit

## Scope

This build is a stability and throughput repair applied on top of the complete v7.0.1 unified remodel. It addresses the Render failures supplied from the live service without discarding the remodel, the 77-command Discord registry, private operator desks, Culture Lanes, Reporter accounts, or WISDO presence greetings.

## Production symptoms audited

The supplied logs showed five separate failure chains:

1. `Invalid API key` from `Mt4SyncService.validateApiKey` while other Reporter accounts continued to sync.
2. `/mt4-sync` requests holding near Render's 30-second boundary when snapshots contained 39–101 open trades.
3. Repeated `Recovered signed MT4 pairing code after server restart` messages for the same code and user.
4. Discord/WebSocket transport failures: `socket hang up`, aborted requests, TLS disconnects, and `Cannot read properties of null (reading 'setHeader')` inside `ws`.
5. Progressive website/server slowdown as Reporter terminals continued polling and command history continued growing.

These symptoms were related but not identical. The release repairs each path independently.

## Root causes and repairs

### 1. Reporter key rotation and stale terminals

**Cause:** Some terminals were sending an older MT4 API key while Render expected only the current key. Restart recovery also depended too closely on a rotating credential.

**Repair:**

- `MT4_SYNC_API_KEY` remains the current authority.
- `MT4_SYNC_PREVIOUS_API_KEYS` accepts a temporary comma-separated rotation window.
- `MT4_PAIRING_SIGNING_SECRET` is now a separate stable signing authority.
- A valid, known, unexpired signed pairing code can authenticate an older Reporter when `MT4_ALLOW_PAIRING_CODE_AUTH=true`.
- Pairing authentication is also used by command poll and completion routes, not only snapshot ingestion.
- Invalid credentials are returned as authentication rejections and logged as warnings instead of generating repeated application-error stack traces.

The endpoint is not anonymous: pairing fallback still requires a valid signature, a known pairing record, and its configured expiry.

### 2. Large snapshots blocking the HTTP response

**Cause:** A snapshot with 101 trades could create and persist signal cells, copier commands, Discord updates, and legacy relay work one item at a time before responding.

**Repair:**

- Signal records are persisted in one batch.
- Signal-grid cells are persisted in one batch.
- Copier commands for all matched routes are queued in one command-state mutation.
- Legacy close relay supports batch persistence.
- Noncritical Discord presentation runs in a bounded background queue.
- Copier opens have higher priority than presentation; copier closes have the highest priority.
- The Reporter heartbeat no longer waits for Coach, Academy, Discord presentation, or other secondary work.

### 3. Repeated pairing recovery

**Cause:** Concurrent snapshots could all miss the in-memory record after restart and independently recover and save the same signed pairing code.

**Repair:**

- Pairing recovery is cached by code.
- Concurrent recovery uses a single-flight promise per code.
- Only the first recovery performs the durable write and warning log.
- Later requests reuse the recovered result until cache expiry.

### 4. PostgreSQL pressure that increased over time

**Cause:** Read-only operations used the command-store mutation path. Even a terminal polling when no command existed could write PostgreSQL. Completed and expired command history was not compacted, so every later operation handled an increasingly large state object.

**Repair:**

- Empty command polls are read-only.
- Command status and queue-status reads are read-only.
- Active pending/delivered commands are always preserved.
- Completed, failed, expired, and cancelled history is automatically bounded by `WISDO_MT4_COMMAND_HISTORY_LIMIT`.
- Audit history and indexes are rebuilt during compaction.
- Large command batches use one persistence transaction rather than one write per trade.

### 5. Discord and WebSocket transport instability

**Cause:** Remote TLS/socket interruptions were logged as fatal application errors, and a race in the installed `ws` package could call `setHeader` after its request object had already been cleared.

**Repair:**

- Node is pinned to the supported 22.x line (`22.22.0` in Render).
- `discord.js` and `ws` are pinned through the lockfile.
- A postinstall guard patches the null-handshake race after every clean install.
- Transient Discord transport failures are classified as warnings.
- Shard disconnect/reconnect behavior remains active rather than crashing the process.
- Slow slash commands still use the v7.0.1 automatic defer/edit guard.

Transient upstream network interruptions can still occur, but they no longer need to crash or silently wedge the application.

## Server-pressure controls

The web server now includes:

- gzip compression for eligible responses;
- a configurable JSON-body limit, default `4mb`, instead of unconditional `200mb` parsing;
- raw-body retention only for webhook routes that need signature verification;
- request IDs on responses through `X-Wisdo-Request-Id`;
- slow-request logging through `WISDO_SLOW_REQUEST_MS`;
- in-flight and maximum in-flight request counters;
- recent slow-request samples;
- event-loop lag measurement;
- command-store and signal-worker pressure metrics;
- database health and process-memory data through `/health/performance`.

`/health/performance` returns a non-healthy status when runtime pressure crosses its safeguards, making the slowdown observable before the member interface becomes unusable.

## Remodel retained

The release still includes the requested unified remodel:

- 77 unique Discord slash commands with automatic registration;
- command acknowledgment protection;
- private desk creation, diagnostics, category sharding, role assignment, archiving, and restoration;
- one authoritative `/mt4-sync` route, with the old remodel route disabled by default;
- remodeled member workspaces;
- first visit, first login of the day, new session, and return-after-away greetings;
- persistent WISDO presence orb across authenticated `/app/*` pages.

## Verification performed

The exact clean release was installed from `https://registry.npmjs.org/` using its committed lockfile.

- Build audit: **passed**
- JavaScript files audited: **106**
- Required production assets checked: **14**
- Automated tests: **96 passed / 0 failed**
- Large command batch test: **101 commands / one persistence mutation**
- Signal-grid batch test: **101 cells / one repository update**
- Idle command-poll test: **zero writes**
- Concurrent pairing recovery test: **one durable write**
- Internal OpenAI package-registry URLs: **0**
- Real `.env`, private keys, Git history, logs, runtime state, and `node_modules`: excluded from the deployment archive

This verifies the packaged code and clean-install process locally. It does not claim that Render, Discord, PostgreSQL, or every connected MT4 terminal has been production-tested after deployment.
