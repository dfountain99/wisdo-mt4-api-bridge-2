# WISDO v6.1.0 Full Queue and Blocking Audit

## Scope

This audit reviewed every production JavaScript file in the repository, including the web portal, MT4 Reporter synchronization, command delivery, copy trading, Culture Lanes, Compound Tracker, Academy, Lane Intelligence, notification delivery, growth funnel, database persistence, service worker, and workspace frontend.

The goal was to identify any promise tail, global mutation queue, serialized state chain, advisory lock, single-flight guard, media request, or synchronous reconciliation step capable of making an unrelated page, account, or Reporter wait.

## Request-blocking queues removed

The following global or cross-account serialization mechanisms were removed:

1. `ecosystemMutationQueue` in `server/majorUpgradeRoutes.js`.
2. `ecosystemStateSaveQueue` in `server/apiServer.js`.
3. `stateChain` in `services/repositories/wisdoPhase1Repository.js`.
4. `stateChain` in `services/notificationDeliveryService.js`.
5. `stateChain` in `services/growthFunnelService.js`.
6. `writeChain` in `services/tradeSignalService.js`.
7. Global MT4 command mutation queues in `services/mt4CommandService.js`.
8. Namespace promise-tail write queues in `services/persistenceAdapter.js`.

These mechanisms previously allowed work for one account, user, or feature to hold unrelated requests behind it.

## Replacement concurrency model

WISDO now uses:

- A process-wide PostgreSQL pool instead of one pool per namespace.
- Hot in-process state with revision-based compare-and-retry updates.
- Full authoritative snapshots for buffered persistence, preventing deleted records from being resurrected by stale deep merges.
- Nonblocking PostgreSQL `pg_try_advisory_xact_lock` only during background persistence flushes.
- Scoped single-flight maps for one user, lane, or namespace rather than global request queues.
- Fixed response budgets for live Reporter reconciliation.
- Background completion for noncritical refresh, Academy, Coach, and analytics work.

The remaining single-flight controls are intentionally scoped and cannot make one user's tab wait behind another user's work.

## API routes made fail-open

The following routes return stored PostgreSQL/hot-cache data within a fixed budget rather than waiting indefinitely for live Reporter reconciliation:

- Accounts and Reporter inclusion.
- Account role and sharing-mode updates.
- Trades.
- Trade statistics.
- Analyzer portfolio.
- Analyzer trends.
- Analyzer heatmap.
- Alerts.
- Compound Tracker reports.
- Community lead discovery.
- Lane Coach history reads.

Explicit write actions still validate and persist their result, but unrelated reads no longer wait for them.

## Reporter and command path

- Reporter heartbeat state is persisted through one short hot-state mutation.
- Signal generation and close relay execute outside the persistence lock.
- Academy, Lane Coach, product-ledger, and route-reconciliation work runs after the Reporter receives its response.
- MT4 commands no longer share one global mutation promise.
- Close All, Harvest, leader-only close, open-copy, close-copy, polling, and completion acknowledgement retain account ownership and idempotency checks.

## Frontend and media audit

- Safe GET retries default to one attempt instead of three sequential attempts.
- The workspace boots from the last browser account snapshot when the live account refresh is temporarily delayed.
- The 4K and secondary motion backgrounds use `preload="none"` and no initial `src`.
- Motion video bytes are downloaded only when the user selects that motion theme.
- The service worker bypasses MP4 and HTTP Range requests.
- Normal mesh-background tabs download zero motion-video bytes.
- Role saves update the visible account locally and do not force a second complete account refresh.

## Database-only state audit

Durable production state remains PostgreSQL-backed. No laptop or runtime JSON fallback was restored.

The previous `feed-posts.json` index was removed. Culture Feed metadata now uses `socialPostsById` in PostgreSQL-backed WISDO state.

The legacy JSON repair utility was moved under `scripts/legacy/` and is not part of startup, build, migration, or runtime execution.

Redis is optional and disabled by default. The system can run with PostgreSQL plus its in-process hot cache.

The Render persistent-disk declaration was removed because runtime state is not stored on disk. Static application assets and temporary generated media are not authoritative state and must not be treated as a database replacement.

## Static scan rules

The automated audit fails the build when production source contains any of these removed queue patterns:

- `ecosystemMutationQueue`
- `ecosystemStateSaveQueue`
- `commandMutationQueues`
- `stateChain = Promise.resolve()`
- `writeChain = Promise.resolve()`
- `runCommandMutation(...)`

It also verifies:

- Motion videos remain lazy.
- Service worker bypasses MP4 ranges.
- Accounts and analytics use bounded synchronization.
- Culture Feed does not use a JSON index.
- Redis is not required by the Render blueprint.
- No Render persistent disk is declared for runtime state.

## Validation result

- Version: 6.1.0
- Production JavaScript files checked: 95
- Required production assets checked: 14
- Automated tests: 69
- Passed: 69
- Failed: 0
- Runtime JSON state fallback: disabled
- PostgreSQL durable state: enabled
- Redis required: no
- Reporter v1.58 compatible: yes
