# WISDO Four-Pillar Operational Integration — 2026-11-13

## Purpose

This change connects four existing WISDO domains through authenticated, durable interfaces:

1. **Full OS integration:** one signed-member read-only dashboard at `/app/os`; the authenticated device API mirrors its verified data.
2. **Trading supercomputer / VPS:** truth-graded MT4 Reporter freshness from the real `wisdo_mt4_accounts` table; authenticated Windows-agent CPU, RAM, disk and installed-terminal counts; per-account command status aggregation.
3. **Autonomous cloud / supervised recovery:** authenticated agent fleet, stale-node advisories, durable two-step recovery requests, and existing command-bus receipts. No implicit execution.
4. **Sentinel home security:** approved Home Assistant camera bindings, explicitly classified binary-sensor transitions, idempotent PostgreSQL events, and a member-readable event feed. No surveillance video upload.

This is **implemented code** for these capabilities, not a claim that 500 future upgrades, external Windows VPS provisioning, live video AI, or unattended trading have been completed.

## Verified entry points

| HTTP route | Authentication | Meaning |
|---|---|---|
| `GET /app/os` | signed member cookie | Responsive read-only WISDO control center |
| `GET /api/member/os/v1/overview` | signed member cookie | Real four-pillar data belonging to signed-in member |
| `GET /api/member/os/v1/trading` | signed member cookie | Existing MT4 account observation times and command counts |
| `GET /api/member/os/v1/sentinel/events` | signed member cookie | Persisted approved-source detection events |
| `GET /api/os/v1/overview` | enrolled device Bearer token | Device-scoped four-pillar observations |
| `POST /api/os/v1/nodes/heartbeat` | device + `os_telemetry` | Persist actual host observations |
| `GET /api/os/v1/nodes` | enrolled device | List same-owner nodes and freshness |
| `GET /api/os/v1/trading/accounts` | enrolled device | Verified owner-scoped MT4 observations |
| `POST /api/os/v1/sentinel/events` | device + `camera_events` | Persist a camera event only for that device's approved camera |
| `GET /api/os/v1/sentinel/events` | enrolled device | Owner-scoped event history |
| `POST /api/os/v1/recoveries/request` | device + `ops_operator` | Request exact target Windows worker recovery |
| `POST /api/os/v1/recoveries/:id/approve` | same device and exact confirmation | Queue one existing WISDO command |
| `GET /api/os/v1/recoveries` | enrolled device | Recovery requests and actual agent-command receipt status |
| `GET /health/four-pillars` | public health, no member data | PostgreSQL connectivity only |

All authenticated event and recovery operations use the existing WISDO enrolled-device authentication boundary, not public access tokens or browser localStorage. An event must be from the exact enrolled source device of an **approved** component. Submitted source event IDs are unique per member, camera and source ID. Duplication is acknowledged without a second event.

## Migration and release

1. Keep production on `main`; review the feature branch and PR before merging. The production Render service has auto-deploy on `main`.
2. Make a PostgreSQL backup, then run the **existing** `npm run migrate:postgres` on an isolated staging database. The script now includes `migrations/2026-11-13-four-pillar-operations.sql`. Run it twice to verify idempotency.
3. Validate `GET /health/four-pillars` against staging.
4. Run `node --test tests/fourPillarOperations.test.js` and `python -m unittest discover -s tests -p 'test_four_pillar_sentinel.py' -v`.
5. Sign in using a real WISDO member account, open `/app/os`, and verify only that member's observed account data appears. Missing data must remain empty/unavailable.
6. Re-enroll devices after explicitly configuring capabilities; enrollment never magically provisions a Windows VPS or grants camera access.
7. Confirm one real Pi camera event and one Windows heartbeat in staging. Approve a worker restart only for an allowlisted non-agent Windows service; verify the command receipt and service status.
8. Promote only after staging contracts, OAuth, Reporter, migration and browser checks pass, with a rollback checkpoint.

### Windows desktop or VPS agent

The existing `desktop-agent/agent.py` now posts a device-authenticated heartbeat with current CPU, memory, disk usage and actual MetaTrader process count. Configure `WISDO_NODE_ROLE=vps` **only on a real Windows VPS**; otherwise use `desktop`. The VPS is not created by WISDO.

For optional worker restart, explicitly configure `WISDO_OPS_OPERATOR=true` on the authorized operator device and `WISDO_ALLOW_WORKER_RESTART=true` with a real `WISDO_WORKER_SERVICE_NAME` beginning with `WISDO`. The worker must be a separate Windows service from the desktop agent; set `WISDO_AGENT_SERVICE_NAME` to protect its actual installed name. Re-enroll to update capabilities.

Recovery is **two-phase**: POST a request specifying `targetDeviceId`; the API returns a time-limited exact confirmation phrase. POST that phrase back to the approval route using the same enrolled device within two minutes. A successful POST means **queued**, not restarted. Only the real agent receipt and service-manager status establish completion.

### Pi and Sentinel Home Assistant bridge

Keep Home Assistant credentials on the Raspberry Pi; they are never uploaded to the WISDO OS endpoint. Configure **explicit** source camera and category mappings in the edge `.env`:

```dotenv
WISDO_SENTINEL_ENTITY_MAP={"binary_sensor.backyard_motion":{"camera":"camera.backyard","eventType":"motion"}}
WISDO_SENTINEL_POLL_SECONDS=15
```

Re-enroll the Pi with `camera_events` enabled by its configured Home Assistant integration. Discover/approve `camera.backyard` under the same WISDO home and source binding using the existing Smart Home Trust Center. WISDO will accept an event only when this exact camera is approved, online, and owned by the enrolled sender.

The bridge establishes an initial sensor-state baseline; only later real transitions to `on` create events. Failed event receipts remain queued in the bridge memory for retry. Cloud PostgreSQL protects against duplicate event IDs. The mapping category is supplied by the source configuration: WISDO does **not** infer a person's identity from motion, a camera image, or a sensor name. No siren is triggered automatically.

## Truth and safety boundaries

- MT4 last-sync freshness is not a broker order receipt, and an HTTP-accepted command is never displayed as executed.
- Host CPU/memory/disk values come from an authenticated edge agent, not independent cloud-provider attestation. No fabricated resource metrics are used.
- A missing camera or an unapproved sensor remains unavailable rather than being represented as connected.
- Recovery requires a live target that actually advertises the allowed capability. Arbitrary shell commands, restarts of MetaTrader, and restarts of the agent itself are **not** exposed.
- Sentinel detection persistence has no direct link to siren activation. Video AI, face recognition, camera streaming, and provider-specific controls are **not built** by this change.
- Windows VPS provisioning, VPS billing, full MT5 execution, autonomous production deployment, and hundreds of remaining backlog items require separate implementation and verified provider accounts.

## Security review before release

The repository has historically contained paths named `desktop-agent/data/device-token` and `pi-edge/data/device-token`. Verify whether those tracked files contain live credentials. If so, treat them as exposed, rotate the affected device tokens using the WISDO enrollment process, and remove the sensitive files from Git tracking/history using a deliberate migration that preserves locally installed device credentials. Removing them from Git alone will not invalidate an exposed token.

Do not paste device tokens, enrollment codes, trading passwords, or Home Assistant bearer tokens into GitHub issues, action logs, documentation, or the WISDO browser frontend.

## Rollback

Keep this feature branch separate. On staging failures, return to the previous commit/deployment and leave the three additive tables intact for forensics. No external broker trades or siren actions are issued by the new read models. Database rollback should be a planned migration, not `DROP TABLE` in a live environment.
