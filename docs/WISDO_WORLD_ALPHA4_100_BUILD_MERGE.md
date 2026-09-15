# WISDO World Alpha 4 — Next 100 Build Merge

Date: 2026-09-15

## Purpose

This document defines the next 100 production build units for WISDO World as **one universe program**, not 100 disconnected prototypes. It is intentionally honest about status: a build unit can be wired in this PR, backed by an existing foundation, gated on infrastructure/assets, or scheduled as a future build.

Status vocabulary:

- **WIRED THIS PR** — code path is integrated in this merge.
- **FOUNDATION EXISTS** — production code already exists and this program reuses it.
- **ACTIVATION GATE** — code/foundation exists but requires explicit deployment/configuration or real assets before production activation.
- **FUTURE BUILD** — intentionally not claimed as implemented yet.

The non-negotiable authority rule across all 100 units is:

```text
WORLD PRESENTATION / PRESENCE / SOCIAL / VISUALIZATION
                     |
                     X  no broker authority
                     |
WISDO CORE -> authorization -> command bus -> Reporter/MT4 -> receipt
```

## Workstream 1 — Authority, identity, and instance architecture (Builds 001–010)

001. **One World identity contract** — FOUNDATION EXISTS. Reuse authenticated WISDO member identity; never create a second World login.
002. **Canonical scene resolver** — WIRED THIS PR. Central, Smart Home, and destination interiors resolve into stable World/instance IDs.
003. **Private Smart Home instance IDs** — WIRED THIS PR. `user.<userId>.home` is owner-bound and private by default.
004. **Shared WISDO Central instance** — WIRED THIS PR. `wisdo.central.1` is the first stable shared public-member instance.
005. **Destination instance namespace** — WIRED THIS PR. Trading Tower and future destinations use `wisdo.<destination>.1` without route forks.
006. **Instance capacity metadata** — WIRED THIS PR. Instance definitions expose explicit capacity and shared/private behavior.
007. **Scope derivation from instance** — WIRED THIS PR. Realtime ticket scopes are server-derived rather than browser-authored.
008. **Financial authority isolation** — FOUNDATION EXISTS + WIRED THIS PR. Realtime routes receive no MT4 command service or broker credentials.
009. **One World event semantic authority** — FOUNDATION EXISTS. Existing `WorldEventEngineService` remains authoritative for confirmed signal semantics.
010. **Kernel architecture diagnostics** — WIRED THIS PR. Kernel health exposes Alpha 4 World/realtime/durable-event architecture.

## Workstream 2 — Realtime tickets, transport, and gateway (Builds 011–020)

011. **Authenticated realtime config endpoint** — WIRED THIS PR. Core tells clients whether distributed gateway or safe fallback is active.
012. **Short-lived signed World ticket endpoint** — WIRED THIS PR. Browser never receives the ticket signing secret.
013. **Instance-bound realtime tickets** — WIRED THIS PR. User, World, instance and scopes are signed together.
014. **Dedicated gateway discovery** — WIRED THIS PR via `WISDO_WORLD_REALTIME_PUBLIC_URL`.
015. **Restricted gateway CORS** — WIRED THIS PR. Only explicitly configured WISDO origins are permitted.
016. **Shared + private topic subscription** — WIRED THIS PR. One stream receives instance, account-owner and user topics.
017. **Initial roster on stream connect** — WIRED THIS PR. Client does not need to wait for every participant to move before seeing occupancy.
018. **Per-connection event de-duplication** — WIRED THIS PR. Multi-topic fan-out is deduped without suppressing a second tab/device.
019. **Reconnect with exponential jitter** — WIRED THIS PR in the shared browser realtime client.
020. **Future WebSocket/WebTransport movement path** — FUTURE BUILD. Reuse the same tickets/instances/Redis presence; do not replace the model.

## Workstream 3 — Presence and multiplayer Operators (Builds 021–030)

021. **Redis TTL presence model** — FOUNDATION EXISTS. Presence is ephemeral, not a 10–20Hz PostgreSQL write stream.
022. **Same-process Central fallback** — FOUNDATION EXISTS + preserved. World still works before distributed infrastructure is activated.
023. **Distributed presence heartbeat** — WIRED THIS PR. Shared client posts current scene/position/rotation/state to gateway.
024. **Server-owned public display identity** — WIRED THIS PR. Display name/title come from the signed ticket metadata, not arbitrary client fields.
025. **Shared realtime browser adapter** — WIRED THIS PR. No second networking stack for multiplayer.
026. **Remote Operator interpolation** — FOUNDATION EXISTS + merged onto new adapter.
027. **Scene-aware multiplayer switching** — WIRED THIS PR. Leaving Central clears/remaps presence instead of carrying stale users into Home.
028. **Multiplayer diagnostics contract** — WIRED THIS PR. Debug mode can inspect connected/status/online/mode/scene/remote count.
029. **Party/friend co-location resolver** — FUTURE BUILD. Party should preferentially resolve to same instance without touching financial permissions.
030. **High-concurrency interest management** — FUTURE BUILD. Distance/zone subscriptions replace broad instance state when population justifies it.

## Workstream 4 — Signals, events, and market reactions (Builds 031–040)

031. **Durable PostgreSQL World event outbox** — FOUNDATION EXISTS.
032. **Independent World event worker** — FOUNDATION EXISTS.
033. **Confirmed Event Engine -> durable outbox bridge** — WIRED THIS PR, opt-in.
034. **Account-owner signal topic** — WIRED THIS PR. Owner gets private event detail on account topic.
035. **PUBLIC_WORLD projection** — WIRED THIS PR. Public signals can reach Central only through a sanitized projection.
036. **No public lot/account/magic leakage** — WIRED THIS PR in public projection.
037. **One event ID across representations** — FOUNDATION EXISTS + preserved by durable bridge.
038. **Signal Burst consumer** — FOUNDATION EXISTS. Browser World game runtime already reacts to `bot.signal.created`.
039. **Billboard live-event consumer** — FOUNDATION EXISTS; full distributed fan-out ACTIVATION GATE after gateway deployment.
040. **Reporter online/offline durable publisher** — FUTURE BUILD. Must attach only at confirmed Reporter heartbeat authority, not inferred client state.

## Workstream 5 — Operator identity and digital human (Builds 041–050)

041. **One OperatorProfile / AvatarDefinition** — FOUNDATION EXISTS.
042. **Authored production humanoid loader** — FOUNDATION EXISTS; production art quality remains dependent on approved rigged assets.
043. **Canonical humanoid skeleton contract** — FOUNDATION EXISTS / ASSET GATE.
044. **Default high-quality WISDO Operator** — ACTIVATION GATE on approved production humanoid asset quality.
045. **Central/Home same avatar identity** — FOUNDATION EXISTS; continue eliminating primitive-scene fallback differences.
046. **Smart Mirror persistence** — FOUNDATION EXISTS.
047. **Wardrobe as entitlement-backed customization** — FOUNDATION EXISTS; richer modular art catalog FUTURE BUILD.
048. **Foot/ground contact quality pass** — FUTURE BUILD / ART+ANIMATION GATE.
049. **Look/attention/hand interaction targets** — FUTURE BUILD, reuse same Operator runtime.
050. **Remote Operator LOD + production avatar replication** — FUTURE BUILD after default asset is performance-qualified.

## Workstream 6 — Smart Home, property, and personal operating space (Builds 051–060)

051. **Persistent starter residence** — FOUNDATION EXISTS.
052. **Private Home instance mapping** — WIRED THIS PR.
053. **Home privacy separate from financial visibility** — FOUNDATION EXISTS.
054. **Account-aware Trading Room** — FOUNDATION EXISTS.
055. **Reporter Room real telemetry** — FOUNDATION EXISTS.
056. **Performance Room account-scoped history** — FOUNDATION EXISTS; continue QA against multi-account switching.
057. **Account Vault stale-control invalidation** — FOUNDATION EXISTS.
058. **World property object persistence** — FUTURE BUILD. Persist supported objects/config, not physics every frame.
059. **Invited-home multiplayer authorization** — FUTURE BUILD. Requires explicit invitation and privacy enforcement.
060. **Additional property classes** — FUTURE BUILD only after starter residence reaches visual/functional production quality.

## Workstream 7 — Command Center and Campaign Core (Builds 061–070)

061. **Command authority remains Core-only** — FOUNDATION EXISTS and enforced by this architecture.
062. **Explicit command scope** — FOUNDATION EXISTS.
063. **Server-measured destructive confirmation** — FOUNDATION EXISTS / ongoing security QA.
064. **Command receipts as visual truth** — FOUNDATION EXISTS.
065. **Campaign Core live digital twin** — FOUNDATION EXISTS.
066. **PriceSpaceMapper** — FOUNDATION EXISTS.
067. **Preview-first Trail/Break-even/Lock Profit** — FOUNDATION EXISTS where backend supports operation.
068. **Reporter capability gating** — FOUNDATION EXISTS; unsupported Reporter commands must stay disabled.
069. **Campaign replay in Performance** — FOUNDATION EXISTS / data-completeness dependent.
070. **Shared Command observation without shared authority** — FUTURE BUILD. Visitors may observe permitted data; only authorized owner can execute.

## Workstream 8 — World Director, social civilization, and navigation (Builds 071–080)

071. **World Director lifecycle** — FOUNDATION EXISTS.
072. **Ambient population distinct from real users** — FOUNDATION EXISTS.
073. **No fake online users** — FOUNDATION EXISTS policy; realtime roster now comes from real presence.
074. **WISDO Atlas scene/instance awareness** — FUTURE BUILD.
075. **Friends and block graph** — FOUNDATION EXISTS in broader identity/social system; World spatial enforcement FUTURE BUILD.
076. **Party service and same-instance join** — FUTURE BUILD.
077. **Home invitation workflow** — FUTURE BUILD.
078. **Text/social event channel** — FUTURE BUILD. This becomes distributed SYNC PULSE/social interaction transport.
079. **Spatial voice session authorization** — FUTURE BUILD; TURN config exists but voice infra remains separate.
080. **Transport/elevator instance handoff** — FOUNDATION EXISTS visually; distributed instance transfer FUTURE BUILD.

## Workstream 9 — Performance, mobile, streaming, assets, and audio (Builds 081–090)

081. **AUTO/LOW/MEDIUM/HIGH quality system** — FOUNDATION EXISTS.
082. **Mobile touch movement/camera** — FOUNDATION EXISTS.
083. **World re-entry cleanup** — FOUNDATION EXISTS / continuous QA.
084. **Remote avatar update throttling** — WIRED THIS PR through heartbeat transport; higher-frequency protocol FUTURE BUILD.
085. **3D asset CDN/object-storage boundary** — FUTURE BUILD / DEPLOYMENT GATE.
086. **Chunk/zone streaming** — FOUNDATION EXISTS conceptually; full asset streaming FUTURE BUILD.
087. **Market chart LOD** — FOUNDATION EXISTS.
088. **Spatial audio zones** — FOUNDATION EXISTS conceptually; deeper production mix FUTURE BUILD.
089. **NPC/ambient reduction before local-player degradation** — FOUNDATION EXISTS policy.
090. **Performance budgets in distributed multiplayer** — FUTURE BUILD with load tests for 10/25/50/64 users per Central instance.

## Workstream 10 — Security, QA, observability, deployment, and launch gates (Builds 091–100)

091. **Separate session/ticket/service secrets** — FOUNDATION EXISTS + documented.
092. **No client broker credentials** — FOUNDATION EXISTS and regression-tested.
093. **Gateway readiness/health** — FOUNDATION EXISTS.
094. **World Alpha 4 contract tests** — WIRED THIS PR.
095. **Normal WISDO Launch Gates remain merge authority** — FOUNDATION EXISTS.
096. **Redis + worker + gateway staging deployment** — ACTIVATION GATE; requires explicit infrastructure provisioning.
097. **Two-real-user Central acceptance test** — ACTIVATION GATE after staging distributed services exist.
098. **Same server-authoritative Signal seen by both users** — ACTIVATION GATE after durable-event bridge is enabled in staging.
099. **Load/failure/reconnect testing** — FUTURE BUILD after staging distributed mode is live.
100. **Production distributed-mode activation** — ACTIVATION GATE only after 096–099 pass; same-process fallback remains available during rollout.

## What this PR means

This merge does **not** pretend that all 100 future units are visually or operationally complete. It turns the first large dependency chain into one coherent production architecture and records the remaining gates so future work cannot accidentally fork identity, realtime, trading authority, events, or property systems.

The immediate post-merge activation sequence is:

```text
MERGE CODE
   |
   v
PROVISION REDIS / REALTIME / WORKER IN STAGING
   |
   v
SET SEPARATE SECRETS + PUBLIC GATEWAY URL + ALLOWED ORIGINS
   |
   v
ENABLE WISDO_WORLD_EVENTS_ENABLED IN STAGING
   |
   v
TWO REAL USERS ENTER WISDO CENTRAL
   |
   v
VERIFY SAME PRESENCE ROSTER + SAME CONFIRMED SIGNAL EVENT
   |
   v
FAILURE / RECONNECT / MOBILE TEST
   |
   v
CONTROLLED PRODUCTION ACTIVATION
```

Production must never be declared distributed-multiplayer-ready merely because the code is merged. Deployment, real-user acceptance and failure testing are separate gates.
