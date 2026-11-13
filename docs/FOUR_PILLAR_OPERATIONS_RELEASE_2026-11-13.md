# WISDO Four-Pillar Operational Integration — November 13, 2026

This release integrates **Full WISDO**, **Trading/VPS**, **Autonomous Cloud Operations**, and **Sentinel** with existing PostgreSQL, Discord/member identity, the MT4 Reporter, and enrolled Pi/desktop agents.

## Source of truth

- The canonical HTTP entrypoint is `server/apiServer.js` → `server/kernelRouteRegistry.js` → `server/fourPillarRoutes.js`.
- The canonical operations service is `services/wisdoFourPillarOperations.js`. All application observations are owner-scoped and persisted to PostgreSQL.
- Migration `migrations/2026-11-13-four-pillar-operations.sql` creates real node heartbeat, Sentinel event, and supervised-recovery tables, and is imported into the existing migration script.
- The operations dashboard is at `/app/os`, signed-session protected. The AETHER PRISM stage links to it with **VPS MODE**.

## Actual functionality

1. **Full OS:** The member dashboard aggregates authenticated node metrics, registered MT4 connection freshness, camera detection records, and cross-system advisories. There are no fabricated accounts, balances, camera events, or successful repairs.
2. **Trading / VPS:** The backend reads real MT4 Reporter-derived account status and PostgreSQL command counts. A signed-in member can initiate `prepare_trading_workspace` against an owned, connected Windows VPS agent with this capability. The button reports "queued" until a command receipt is returned by that enrolled agent. It never places orders directly.
3. **Autonomous Cloud:** Windows desktops and VPS agents measure CPU, RAM, disk and terminal process counts. Pi/edge nodes report measured memory/disk health. The backend flags stale nodes. Worker restart requires a registered Windows service whose name begins `WISDO`, explicit opt-in in the agent configuration, a capability-granted device, an exact-target recovery request, and a confirmation phrase. No AI may bypass this.
4. **Sentinel:** An optional Home Assistant bridge maps real `binary_sensor.*` detections to a specified `camera.*`. The server verifies the exact enrolled edge, owner, component approval, and online status before storing a unique event. Recorded camera metadata is strictly limited; raw frames, face identities, and personal descriptors are excluded. Camera events never automatically activate sirens or disarm an alarm.

## Required external configuration

### Windows/VPS agent

- Install a real Windows VPS or Windows desktop with MetaTrader, configure `WISDO_MT4_EXE` to the installed executable, and enroll the device.
- Set `WISDO_NODE_ROLE=vps` only if it is actually running as the VPS host. Re-enroll after updating capabilities.
- Run `desktop-agent/agent.py` continuously as an approved service. Remote desktop display/streaming is not provided by Render or the browser; the agent opens MetaTrader on its actual Windows host.
- For optional worker restarts, configure an actual Windows service with a name starting `WISDO`, plus `WISDO_WORKER_SERVICE_NAME`, `WISDO_ALLOW_WORKER_RESTART=true`, and `WISDO_OPS_OPERATOR=true`. Re-enroll. Keep restart disabled by default.

### Sentinel edge

- Set a real `WISDO_HOME_ASSISTANT_URL` and `WISDO_HOME_ASSISTANT_TOKEN` on the Raspberry Pi or Windows edge; do not store this token in GitHub.
- Set `WISDO_SENTINEL_ENTITY_MAP` to a JSON object of actual Home Assistant binary sensor entity IDs and actual camera entity IDs. Confirm the source is an authorized camera feed.
- Approve the camera and source-to-home binding in WISDO Smart Home Trust Center.
- Re-enroll the Pi after adding the event mapping and restart the Home Assistant bridge. No events are created until a real sensor reports an "on" transition with a `last_changed` timestamp.

### Security

- Replace any enrollment code previously reused from an example file, and rotate it on deployment.
- Keep signed sessions and authentication cookies enabled; member action routes require a same-origin custom intent header and exact confirmation phrase.
- Execute the PostgreSQL migration in a staging database before production. Confirm the migration is idempotent. Never call a pending command a broker order execution.

## Secrets and edge reliability

The Sentinel HA detector relay persists unacknowledged events to a private edge file and retries on reconnect, using stable event IDs and PostgreSQL deduplication. Per-device reads require explicit capabilities (`ops_operator` for fleet/trading/recovery, `camera_events` for Sentinel history). Two tracked device-token files were removed from this feature branch and ignored, but both apparent bearer tokens must be rotated on the actual enrolled devices; Git history and any earlier clones remain exposed until a separate history-remediation procedure is performed.

## Validation & release gate

Run `npm ci`, `npm run check`, `npm run test:security`, and targeted `node --test tests/fourPillarOperations.test.js tests/fourPillarExtended.test.js` on the branch. Validate the Python files with `python -m compileall desktop-agent pi-edge`, then test one real Windows VPS agent and one HA camera detector on staging with private data. Inspect health, simulate disconnect/reconnect, and confirm the operator command remains queued until an agent completion receipt. Release via reviewed pull request and a monitored canary with rollback.

**Not claimed:** creation of an external VPS subscription, real browser-hosted Windows remote desktop, live MT5 execution compatibility, unidentified vendor cameras, automatic facial recognition, autonomous siren use, automatic live trading, or completion of all 500 brainstormed upgrades. Each depends on explicit additional engineering and/or live external services. No unverified capability should be displayed as live.
