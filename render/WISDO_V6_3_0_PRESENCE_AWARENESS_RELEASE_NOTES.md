# WISDO Culture Lane OS v6.3.0 — Presence Awareness

## Website-wide awareness
- Adds a Presence Awareness item to the member navigation.
- Adds a live Wisdo Presence orb to every authenticated portal page.
- Displays the member Culture ID, active mode, device type, selected account, and contextual greeting.
- Provides one-click access to Presence Center, Focus Mode, and the remembered workspace.

## Persistent member context
- Remembers the last `/app/...` workspace visited.
- Remembers the selected `accountId` context.
- Stores desktop/mobile device classification and a friendly device label.
- Stores timezone, browser locale, online/away status, last-seen time, and recent awareness transitions.
- Keeps a bounded 50-event awareness history per member.

## New APIs
- `POST /api/presence/heartbeat`
- `POST /api/presence/status`
- Enhanced `GET /api/presence/me` with greeting, resume path, and recent awareness context.

## Safety and privacy
- Awareness data is scoped to the authenticated member.
- Only member application routes are recorded as resumable workspaces.
- Awareness history is bounded to prevent unbounded database growth.
- No microphone, camera, precise location, or biometric capture is introduced.

## Verification
- Full automated suite: 74 passed, 0 failed.
