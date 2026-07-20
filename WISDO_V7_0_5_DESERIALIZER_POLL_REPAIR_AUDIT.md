# WISDO v7.0.5 Deserializer and MT4 Poll Repair Audit

## Incident

The production process continued to terminate with:

```text
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
node::worker::Message::Deserialize
v8::internal::ValueDeserializer::ReadObject
```

This native stack is produced by V8 while rebuilding objects for `structuredClone`. It is different from the earlier `Runtime_MapGrow` failure. The Render access sample also showed two distinct MT4 poll response sizes: the expected compact response near 411 bytes and repeated responses reported near 223,158 bytes. At the same time, Reporter v1.58 could issue three command polls every second from every chart instance.

## Root causes found

1. `CopyTradingService` loaded and cloned its complete namespace during every copy-command poll.
2. The same command was durably stored under both `copyCommandsByUserId` and `copyCommandsByAccountId`.
3. Copy-command arrays and ticket maps could retain too much offline-follower state.
4. Persistence APIs always returned another `structuredClone`, even when the caller only needed a read-only hot reference.
5. MT4 state and ecosystem repositories made additional full-state copies on hot reads.
6. Command payloads were spread into Reporter responses without a field allowlist or byte ceiling.
7. Multiple Reporter copies attached to charts in one terminal could all poll independently.
8. The service worker cached broad same-origin GET responses, including HTML shell/navigation traffic.

## Repairs

### Canonical copy queue

Copy commands now persist once in `copyCommandQueue`. Legacy user/account indexes are migrated and deleted. Active, per-user, per-account, critical, history, signal, audit, log, and ticket-map limits are enforced.

Duplicate opens use a stable identity derived from follower account, action, leader ticket/copy key, symbol, and side. Critical close/protect commands remain privileged when the normal entry queue is full.

### Clone-free hot paths

Persistence adapters now accept `cloneResult: false` and `cloneInput: false` on controlled internal paths. Reporter polling, MT4 state reads, command queues, and ecosystem caches use authoritative hot references instead of creating a second full object graph.

Durable mutations still receive an isolated working copy before modification. Culture Lane writes remain commit-confirmed through PostgreSQL.

### Compact Reporter transport

`/mt4-command-poll` now:

- always returns `application/json`;
- sets `X-Wisdo-MT4-Route: command-poll-v705`;
- reports exact payload size through `X-Wisdo-Payload-Bytes`;
- allows only required scalar execution fields;
- limits flattened global variables to 64;
- hard-caps command response bodies at 16 KB by default;
- returns `pollAfterMs` when idle;
- coalesces repeated sub-second polls from an older Reporter.

### Reporter v1.59

Reporter v1.59 defaults to one command request every two seconds. A terminal-global lease allows only one chart instance for an account to poll and send snapshots. Other copies show `Standby`. The Reporter follows `pollAfterMs` returned by WISDO.

### Service worker isolation

Only `/js`, `/media`, and `/platforms` static assets are cacheable. Navigations, HTML, `/app`, `/member`, `/admin`, `/api`, `/mt4-sync`, `/mt4-command-poll`, and the service worker itself remain network-owned.

### Performance diagnostics

`/health/performance` now reports:

- primary MT4 command metrics;
- canonical copy-command metrics;
- MT4 poll response count;
- throttled poll count;
- maximum observed poll response bytes;
- configured response byte ceiling;
- heap, RSS, database, event-loop, and background queue pressure.

## Validation

- 114/114 automated tests passed.
- 1,000 simultaneous idle copy polls shared one state load and performed zero mutations.
- 1,000 simultaneous primary MT4 idle polls still share one state load and perform zero writes.
- Legacy duplicate command maps migrate into one bounded queue.
- Duplicate copy opens collapse to one active command.
- Critical close authority remains queueable.
- A 100,000-poll low-heap stress run completed with a 75-command queue and approximately 20.3 MB JavaScript heap usage.
- The clean release runs the WebSocket postinstall repair and build audit.

## Production requirement

Every terminal must replace Reporter v1.58 with the included v1.59 source. Server-side burst coalescing protects WISDO from older copies, but only the new Reporter prevents duplicate chart instances from generating unnecessary requests at the source.
