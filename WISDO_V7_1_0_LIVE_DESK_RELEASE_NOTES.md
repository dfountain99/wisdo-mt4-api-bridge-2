# WISDO v7.1.0 — Live Desk

## Release purpose

WISDO Live Desk adds authenticated browser screen broadcasting to the existing Culture Lane OS member portal. A trader can share an MT4/MT5 terminal window, chart workspace, WISDO dashboard, or browser tab from the website and view that broadcast from another browser, including a phone or tablet.

This is a real WebRTC screen-sharing path. Render handles WISDO identity, room policy, signaling, account telemetry, viewer controls, chat, and audit metadata. Screen/audio media is not proxied through the Node/Render server after WebRTC negotiation.

## Member experience

- New **Wisdo Live Desk** entry in the authenticated `/app` portal.
- Start a browser screen/window/tab share with the native browser capture chooser.
- Optional microphone commentary mixed into the broadcast.
- Live preview with a visible LIVE state, watermark, selected account overlay, viewer count, connection status, and transport state.
- Share link and private-room code where applicable.
- Panic Stop immediately ends the WISDO session and local capture tracks.
- Viewer management supports remove and block.
- Live chat is scoped to the broadcast session.
- Public discovery page at `/live` shows only sessions permitted to appear there.

## Visibility modes

1. **Private — My Devices**: only the logged-in owner can join from another browser/device.
2. **Private Room**: requires the room code. The server stores only a SHA-256 digest of that code.
3. **Selected Members**: only explicitly listed Culture Coin member IDs can join.
4. **Members Only**: requires an authenticated active Culture Coin member.
5. **Public**: discoverable and watchable according to the session policy.
6. **Unlisted**: watchable by link but omitted from the public directory.

## Viewer features

- Responsive video for phone, tablet, and desktop.
- Fullscreen and Picture-in-Picture where the browser supports it.
- Mute and Return Live controls.
- WebRTC connection state, resolution, bitrate, and RTT/network telemetry.
- Sanitized account overlay can show balance, equity, floating P/L, daily closed P/L, drawdown, margin level, trade counts, symbols, and bot/logic status without exposing broker credentials or Reporter secrets.

## Security and privacy

- Existing WISDO login/account authorization remains authoritative for the host.
- A broadcast cannot use an account the logged-in owner is not authorized to view.
- Viewer bearer tokens are random, hashed server-side, and sent by request header rather than query string.
- Private-room codes are hashed rather than stored in plaintext.
- Signaling payloads are type allow-listed and size bounded.
- Participant queues, chat history, and viewer capacity are bounded.
- Logout terminates the user's active broadcasts.
- Session pages use no-store/no-referrer/frame-denial and browser capture permission policy headers.
- WISDO does **not** record or persist screen media in this release.
- Session audit metadata records lifecycle/control events, not the captured screen contents.
- Live Desk does not bypass the MT4 command bus, account permissions, confirmation rules, or Reporter receipts.
- `WISDO_VOICE_EXECUTION_MODE` remains `DEMO_ONLY` in the canonical Render configuration.

## WebRTC networking

Default configuration uses public STUN to establish direct peer-to-peer connections. Direct/STUN can work on many networks, but reliable phone-on-cellular, hotel Wi-Fi, enterprise Wi-Fi, and restrictive NAT/firewall combinations require a TURN relay.

Configure production TURN using:

- `WISDO_WEBRTC_TURN_URLS`
- `WISDO_WEBRTC_TURN_SHARED_SECRET`
- `WISDO_WEBRTC_TURN_TTL_SECONDS`

WISDO generates short-lived TURN credentials from the shared secret; the shared secret itself is never sent to browsers.

## Capacity boundary

v7.1.0 intentionally caps direct Live Desk viewer fan-out. Default `WISDO_LIVE_DESK_MAX_VIEWERS=8`, with a hard service bound of 32. With peer-to-peer WebRTC, the broadcaster uploads a media stream to each viewer, so available uplink and device performance set the real capacity.

For large public audiences, WISDO should add an SFU/managed media tier in a later release rather than pretending peer-to-peer broadcasting has unlimited scale.

## Deployment checklist

1. Run `npm ci` from a normal npm registry/environment.
2. Run `npm run check`.
3. Run `npm run audit:runtime`, `npm run audit:commands`, `npm run audit:stubs`, and `npm run audit:secrets`.
4. Run `node --test tests/live-desk.test.js`.
5. Keep `WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY`.
6. Keep `SQUARE_ENVIRONMENT=sandbox` until payment acceptance testing is completed separately.
7. Set production TURN URLs/shared secret before relying on cross-network mobile viewing.
8. Deploy the existing Render service manually; do not create a second WISDO service.
9. Verify host capture on HTTPS, same-account private-device viewing, private-room denial/success, member authorization, remove/block, Panic Stop, logout termination, phone fullscreen/PiP, and an actual cellular-network viewing test.
