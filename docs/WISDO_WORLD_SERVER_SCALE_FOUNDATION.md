# WISDO World Server Scale Foundation

Date: 2026-09-15

## Purpose

This foundation separates realtime World concerns from WISDO's existing financial command authority without rewriting the current production server.

The current WISDO Core remains authoritative for authentication, account ownership, MT4 command creation, Reporter receipts, payments, entitlements, and durable financial state. The World scale layer adds a Redis-backed realtime fabric, ephemeral presence, a durable PostgreSQL event outbox, a standalone SSE realtime gateway, and a standalone outbox worker.

## Hard authority boundary

```text
WORLD CLIENT
    |
    | presence / World events
    v
WORLD REALTIME GATEWAY
    |
    +--> Redis presence + pub/sub
    |
    +--> PostgreSQL World event outbox

WORLD CLIENT
    |
    | financial command
    v
WISDO CORE COMMAND API
    |
    v
AUTHORIZATION / ACCOUNT OWNERSHIP
    |
    v
COMMAND BUS
    |
    v
REPORTER / MT4
    |
    v
EXECUTION RECEIPT
    |
    v
WORLD REACTS TO CONFIRMED STATE
```

The realtime gateway does **not** contain broker credentials and does **not** execute trades.

## Added modules

- `services/worldRealtimeTicketService.js`
  - HMAC-signed short-lived World tickets.
  - Instance and scope binding.
  - Separate secret from the normal application session secret.

- `services/worldRealtimeFabric.js`
  - Redis Pub/Sub when configured.
  - Ephemeral per-instance presence with TTL.
  - Single-process memory fallback for development and non-critical degraded operation.
  - `WISDO_WORLD_REQUIRE_REDIS=true` can make Redis mandatory for production realtime services.

- `storage/worldEventOutboxRepository.js`
  - Durable PostgreSQL event outbox.
  - Idempotent event IDs.
  - `FOR UPDATE SKIP LOCKED` worker claiming.
  - Lease recovery, retries, and dead-letter state.

- `services/worldEventPublisher.js`
  - Small durable publishing API for WISDO domains.
  - Includes helpers for `position.opened`, `position.closed`, `bot.signal.created`, and Reporter connectivity events.

- `scripts/startWorldRealtimeGateway.js`
  - Standalone realtime HTTP/SSE service.
  - Health/readiness routes.
  - Ticket-scoped instance streams.
  - Presence heartbeat/read/leave endpoints.
  - Internal durable event-ingress endpoint protected by a separate service secret.

- `scripts/startWorldWorker.js`
  - Polls the PostgreSQL outbox.
  - Publishes events to Redis.
  - Retries failures with backoff.
  - Dead-letters repeatedly failing events.

## Why SSE first

The repository already has a production HTTP stack and Redis dependency. The first scale milestone uses SSE for server-to-client World events and ordinary HTTP heartbeats for presence so the foundation can be merged without introducing another networking dependency or changing MT4 infrastructure.

This is not the final high-frequency movement protocol. When real multiplayer movement is activated at scale, a WebSocket/WebTransport gateway can be placed behind the same ticket, presence, instance, event, and Redis abstractions instead of replacing them.

## Environment

Required for production scale services:

```text
DATABASE_URL
WISDO_DB_SSL=true
REDIS_ENABLED=true
REDIS_URL=...
REDIS_PREFIX=wisdo
WISDO_WORLD_REQUIRE_REDIS=true
WISDO_WORLD_REALTIME_TICKET_SECRET=<separate 32+ character secret>
WISDO_WORLD_SERVICE_SECRET=<separate 32+ character service-to-service secret>
```

Optional tuning:

```text
WISDO_WORLD_PRESENCE_TTL_SECONDS=45
WISDO_WORLD_MAX_STREAMS=500
WISDO_WORLD_WORKER_POLL_MS=500
WISDO_WORLD_WORKER_BATCH=25
WISDO_WORLD_WORKER_LEASE_SECONDS=30
WISDO_WORLD_EVENT_MAX_ATTEMPTS=12
```

## Commands

```bash
npm run test:world-scale
npm run start:world-realtime
npm run start:world-worker
```

## Event flow

A financial event should be emitted only from server-authoritative state. Example:

```text
Reporter confirms position
       |
       v
WISDO Core normalizes position.opened
       |
       v
WorldEventPublisher -> PostgreSQL outbox
       |
       v
World worker claims event
       |
       v
Redis World channel
       |
       +--> Signal Burst
       +--> Market billboard
       +--> Companion Dashboard
       +--> Signal Observatory
       +--> Coach context
```

Every representation uses the same event ID.

## Presence flow

```text
short-lived World ticket
       |
       v
POST /v1/world/presence
       |
       +--> Redis TTL presence key
       +--> presence.updated event
       |
       v
GET /v1/world/stream
```

Presence is deliberately ephemeral. PostgreSQL should not receive 10-20 movement writes per second per player.

## Deployment sequence

1. Merge code with `REDIS_ENABLED=false`. Existing WISDO production behavior does not change.
2. Provision Redis/Key Value infrastructure.
3. Set `REDIS_ENABLED=true` and `REDIS_URL` for the new realtime/worker services.
4. Set separate World ticket and service secrets.
5. Launch the World worker.
6. Launch the World realtime gateway.
7. Verify `/health` and `/ready`.
8. Connect a staging World client using short-lived tickets.
9. Prove two users can share one instance and receive the same server event.
10. Only then integrate high-frequency multiplayer movement and social presence into production World clients.

## What this merge intentionally does not do

- It does not move MT4 command authority into the World gateway.
- It does not make Redis financial truth.
- It does not enable production Redis automatically.
- It does not create paid Render resources automatically.
- It does not expose a long-lived client secret.
- It does not publish fake market or user data.
- It does not replace the existing World profile/home persistence model.

## Next integration gates

### Gate A — Core event producers

Wire confirmed WISDO server events into `WorldEventPublisher`, starting with:

- `position.opened`
- `position.closed`
- `bot.signal.created`
- `reporter.online`
- `reporter.offline`

Only confirmed server state should enter the outbox.

### Gate B — Ticket issuance

Expose a same-origin authenticated WISDO Core endpoint that issues a 60-120 second World realtime ticket bound to the member and requested instance. Do not expose `WISDO_WORLD_REALTIME_TICKET_SECRET` to the browser.

### Gate C — Client adapter

Add a World realtime client adapter that:

- obtains a short-lived ticket,
- opens the SSE stream,
- heartbeats presence,
- reconnects with jitter,
- rejects stale sequence/event IDs,
- updates normalized World state rather than directly mutating visual components.

### Gate D — Multiplayer transport

When movement frequency and concurrent users justify it, replace movement HTTP heartbeats with WebSocket/WebTransport while preserving the same authorization ticket, Redis presence keys, instance boundaries, and normalized event fabric.
