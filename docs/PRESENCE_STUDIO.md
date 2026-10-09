# Presence Studio

Open `/app/presence-studio` from Settings, the sidebar, or the home workspace navigation.

## Existing equipment

Connect USB microphones/audio interfaces and webcams to the computer. Pair a Bluetooth headset through operating-system settings. Select exposed audio/video devices in Presence Studio. Device IDs are stored only on that browser, under the signed-in user's ID. Microphone level tests and video motion analysis run locally. Tests stop when the page is hidden; camera frames are never sent to the server.

Browser dictation uses the system-default microphone and the browser's speech service. Its transcript is reviewed before sending to the existing WISDO chat endpoint. This chat surface provides assistance; live trading controls remain in Command Center. Cloud speech uses the existing configured WISDO speech service; failures remain visible. Explicit output selection depends on browser support. iPhone output selection uses its system audio controls.

## Phone and sensor enrollment

Create an individual source for each phone, door or occupancy sensor. The 256-bit secret is shown once and stored as a SHA-256 hash. Revocation immediately prevents new events. Sources are account-scoped and cannot issue commands. Configure the chosen source IDs in presence rules and save.

`POST /api/presence-studio/events/SOURCE_ID`

Headers: `Authorization: Bearer SOURCE_SECRET`, `Content-Type: application/json`.

JSON properties: `state`, `observedAt` (current ISO timestamp), `eventId` (unique ID).

Allowed state sets:

- Phone: `home`, `away`, `unknown`.
- Door: `open`, `closed`, `unknown`.
- Occupancy: `occupied`, `vacant`, `unknown`.

Events older than 90 seconds, invalid states, duplicate IDs, and out-of-order observations are rejected or ignored. Send occupancy updates at least every 30 seconds. After 90 seconds without evidence, occupancy is unknown. A reconnect after a gap starts a new vacancy interval.

On iPhone, configure Shortcuts personal automations with Get Contents of URL. Use an arrival trigger or a supported specific-Bluetooth-connection trigger; use a separate departure trigger. Insert Current Date formatted as ISO 8601 and a generated UUID. This reports the phone, not authenticated human identity. Browser Bluetooth cannot substitute for background iPhone presence.

For Home Assistant, create a source and use the page's YAML generator with an existing person, device_tracker, binary_sensor or sensor entity. The generated package sends state updates and occupancy heartbeats. Store its secret privately. An optional local TTS action provides an always-on greeting when a person/device_tracker transitions from not_home to home. That optional local automation is explicitly independent of WISDO's door-correlation setting; edit its conditions in Home Assistant before enabling it if doorway confirmation or quiet hours are desired.

## Connection health in the live member app

The authenticated `GET /api/presence-studio` snapshot also returns `sourceHealth` for the selected phone, door, and occupancy source. Each entry includes `status`, `state`, `lastSeenAt`, and `ageSeconds` without returning its credential. Source statuses are `not_configured`, `unavailable`, `awaiting_event`, `recent`, `event_old`, or `heartbeat_stale`.

Presence Studio displays this server-observed connection evidence. A phone or door source is **event-driven**: `event_old` after three minutes means the last event is no longer usable for a *new* arrival correlation, not that the phone disconnected. An occupancy source needs fresh updates; after 90 seconds without a valid observation, `heartbeat_stale` means the desk is **unknown**, never automatically vacant.

Use this readout while commissioning a real iPhone Shortcut or Home Assistant automation: create the source, copy its secret to the trusted sender, trigger one real event, confirm that the source changes from `awaiting_event` to `recent`, then inspect the recent notices. No simulated event is shown as proof of a physical arrival, and connection evidence alone never authorizes trading.

## Rules and receipts

WISDO's arrival rule correlates selected phone arrival and door-open events within three minutes, unless the owner explicitly disables door confirmation. Repeated home heartbeats do not produce repeated greetings. Greeting cooldown is five minutes.

Vacancy rules use a selected occupancy source, not absence of webcam motion. Delays are 15–900 seconds. Actions record a notice, request review of trading mode, or record occupancy only. They do not change live trading, close trades, or enable automatic entries. An existing authorized trading strategy continues under its existing rules.

Thirty recent notices are retained. The open Presence Studio page can announce new notices after the user enables audio. Server event receipts are not audio playback receipts. Unattended voice requires an always-on local speaker/controller, such as the generated Home Assistant automation or a separately configured WISDO edge node.

## Deployment

`npm run migrate:postgres` applies `2026-10-07-presence-studio.sql`. Existing Render pre-deploy migration runs it. All settings APIs require login; mutations require the same-origin presence intent header. No migration changes existing account or trading tables.

Validation: `node --test tests/presenceStudio.test.js tests/ambientSettingsPortal.test.js`, plus `node scripts/checkBuild.js`. Hardware behavior must be commissioned on the user's phone, microphone, camera and home controller.
