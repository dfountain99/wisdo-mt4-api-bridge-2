# WISDO HoloMode — PRISM Voice + Trading + Home + 3D (v1)

## What actually works in this change

- **Authenticated browser route:** `/app/holomode`, linked from the WISDO workspace.
- **PRISM 3D:** dependency-free WebGL procedural robot with animated idle, speech, wave, and celebration states. Pointer/touch dragging rotates the character. No pre-rendered 2D video.
- **Voice:** tap-to-talk browser SpeechRecognition where supported, browser text-to-speech where available, and always-on-screen typed-command fallback. These browser APIs may use the platform's cloud transcription service. There is no background always-listening service.
- **Trading:** live account lookup via the existing authenticated `GET /api/v2/accounts`, including fresh Reporter-state verification (five-minute window). Stale balances are not presented as live. Trading **execution stays in the existing WISDO Command Center**.
- **Smart home:** Home Assistant REST API integration limited to an explicitly configured device allowlist of `light.*` and `switch.*`. Reads show sanitized state; changes require signed-in owner identity, same-origin request header, and a fresh visible confirmation dialog.
- **Unsupported/not claimed:** no physical holographic output, mobile ARKit/ARCore, persistent cross-device PRISM sessions, unapproved camera access, Google/Nest or Alarm.com connectivity, wake-word standby, autonomous trading, or alarm/lock control.

## Launch

1. Keep the existing production database, accounts and command queues unchanged. Review this PR; do not merge until CI and local validation pass.
2. Run `npm ci && npm run check && npm run start:web` in a development checkout (Node 22).
3. Sign into WISDO using an existing authenticated member account.
4. Open `/app/holomode` or click **PRISM HoloMode** in the workspace navigation.
5. Try `How are my accounts?` and `Wave`. The microphone requires a compatible browser and user permission; the typed-command box works without it.
6. Optionally connect Home Assistant with the settings below. Do not assume deployed Render can access a private LAN address; use a secure authenticated network route or deploy an approved local relay.

## Environment (private server settings only)

```dotenv
# Required to enable HOME functionality. Prefer exact user ID over role flags.
WISDO_HOLO_OWNER_USER_ID=<your existing signed-in WISDO user ID>
# Home Assistant address reachable *from the WISDO backend*, not just the browser.
WISDO_HOME_ASSISTANT_URL=https://home-assistant.example.net
# Home Assistant bearer credential -- store only in Render secrets / .env, never in browser or Git.
WISDO_HOME_ASSISTANT_TOKEN=<server-side secret>
# Explicit allowlist. All locks, alarms and cameras are rejected.
WISDO_HOLO_ALLOWED_ENTITIES=light.living_room,light.bedroom,switch.lamp
```

The home API is disabled unless **all four** settings are available, the user identity matches, and at least one valid light/switch entity is allowed. If owner identity is absent, no WISDO member gains access by default. Use HTTPS when crossing the public internet. If you do not have a reachable Home Assistant server, omit all four variables and retain trading + 3D mode.

## Browser URLs

| Path | Auth required | Behavior |
|---|---|---|
| `GET /app/holomode` | Yes | PRISM UI |
| `GET /api/holomode/bootstrap` | Yes | Capability information; never returns home token |
| `GET /api/holomode/home/entities` | Owner | Fetch sanitized allowlisted HA devices |
| `POST /api/holomode/home/action` | Owner + same-origin + confirmation | Forward on/off to approved HA entity only |
| `GET /api/v2/accounts` | Yes | Existing authoritative trading accounts API |

The POST requires `X-Wisdo-HoloMode: confirmed`, `Origin` matching the current host, and `confirmed: true` in the JSON body. The UI never claims a physical state change merely because HA accepted a command; re-read the state to verify.

## Why we did not add automated broker execution

The v7.1 live WISDO trade execution carries account ownership, risk gates, and confirmation logic. HoloMode must **not** build a second broker command path. For v1, every dangerous trade request is directed to the existing authorized Command Center instead.

## Tests and quality gate

Run `npm run check`. The `tests/holoModeRoutes.test.js` suite covers:
- allowed entity normalization and rejection of locks/alarms;
- redaction of HA device attributes;
- explicit home action confirmation;
- same-origin request checking;
- strict owner isolation and refusal of anonymous access.

Also manually verify browser WebGL rendering, microphone permission, mobile layout, voice-synthesis availability, and a live Home Assistant installation (when configured). Passing unit tests is not proof of deployed hardware connectivity.

## Next development slices

1. Pair the WISDO Core Alpha Raspberry Pi as a properly authenticated edge gateway (mTLS / signed device sessions); avoid exposing port 8787 publicly.
2. Implement state subscription, retries, device provisioning and event deduplication, then Sentinel camera access via supported protocols and owner consent.
3. Export a commissioned/approved rigged PRISM model (GLB) to replace the low-poly procedural prototype.
4. Build mobile AR (Unity AR Foundation) and holographic-display-specific clients from a versioned cross-client event contract.
5. Test 24/7 kiosk reliability, unattended upgrades/rollback, audit logs and commercial installation procedures.

**Operational status:** This PR introduces working source code and tests. It does **not** certify deployment, live account pairing, Home Assistant connection, Raspberry Pi installation or holographic hardware.

## Where this release appears on the current website

- Workspace sidebar: **NEW · PRISM HoloMode**.
- Dashboard and Command Center announcement: **Explore NEW PRISM HoloMode**.
- Direct path once merged and live: `/app/holomode`.
- Search terms in your browser: `PRISM HoloMode`, `3D PRISM`, `Voice + Trading + Home`.

Existing AETHER, Robot Studio, and other v7.1 functions are not replaced.
