# WISDO Siri Control — iPhone setup and secure server integration

This is a first-stage, **read-only** iPhone voice integration. It is not an Apple-signed `.shortcut` or an iCloud share link. Apple's Shortcuts app must construct or sign the shortcut on an Apple device. Avoid importing unsigned `.shortcut` files.

## Server installation

1. Add `server/siriControlRoutes.js` to the WISDO repository.
2. In `server/kernelRouteRegistry.js`, add this import:

   ```js
   import { registerSiriControlRoutes } from './siriControlRoutes.js';
   ```

3. After `const worldCommand = registerWorldCommandRoutes(...)`, add:

   ```js
   registerSiriControlRoutes(app, {
     pool: commandBusService.pool,
     worldCommandService: worldCommand.service,
     logger,
   });
   ```

4. Ensure `PUBLIC_BASE_URL` is the HTTPS production origin and the app has working PostgreSQL. The route creates its `wisdo_siri_devices` table on first use. `SESSION_SECRET` must be configured for signed website sessions (as in the existing WISDO app).
5. Run `node --test tests/siriControlRoutes.test.js` and your full existing application checks before merging or deploying. This package was syntax-checked and unit-tested with a stubbed session module; it has not been verified against production PostgreSQL, real MT4, or a physical iPhone.

## Pair your iPhone

1. Visit `https://wisdo-mt4-api-bridge.onrender.com/member/siri-control` on the iPhone (after the feature is deployed) and sign in to WISDO.
2. Tap **Generate 30-day device credentials**.
3. Copy the returned **Device ID** and **Access Token** privately. The token will not be shown a second time. You can pair up to 5 iPhones. Pair again after expiry; revoke unused devices on the website API.

## Make one Apple Shortcut

1. Open the **Shortcuts** app, tap **+**, then name it exactly **WISDO Control**.
2. Add **Dictate Text** and set language as preferred. The user will speak the command after saying the shortcut's name to Siri.
3. Add **URL**, set it to `https://wisdo-mt4-api-bridge.onrender.com/api/siri/v1/command`.
4. Add **Get Contents of URL**; choose `POST`, choose `JSON` as the request body, add one field: key `text`, value = the **Dictated Text** variable from step 2.
5. In **Get Contents of URL**, add these HTTP headers:
   - `Authorization`: `Bearer ` followed immediately by **your personal Access Token** (one space after Bearer).
   - `X-WISDO-Siri-Device`: **your personal Device ID**.
6. Add **Get Dictionary Value**: key `spokenText` from the output of **Get Contents of URL**.
7. Add **Speak Text** with that dictionary value. Optionally, read `openUrl` and add an **If** condition to open it using **Open URLs** if populated (will unlock your phone if required).
8. Test by tapping the shortcut, saying **“check my trading status”**, and checking Siri's response. If no MT4 data is connected, it should say so—not invent a balance.
9. Then say **“Hey Siri, WISDO Control”**. Siri runs the shortcut by name; after it launches Dictate Text you say your request.

**Commands:** “Check my trading status,” “Open PRISM,” “Show my cameras,” “Open my trading dashboard,” “Open WISDO,” or “Help.”

**Safety:** No voice request through this new endpoint places trades, closes positions, changes EA settings, controls security panels, or unlocks doors. Dangerous command text returns a review prompt linking the signed-in dashboard. Existing MT4 commands retain the separate confirmation and broker/Reporter receipt system. Keep the Siri token private: it can reveal account status. Treat it as a password. If lost, revoke the device token from a logged-in WISDO session.

## API contract

- `GET /api/siri/v1/health` — public service capability report (not a readiness proof of external dependencies).
- `GET /member/siri-control` — signed-in pairing user interface.
- `POST /api/siri/v1/pair` — signed-in session + same-origin JSON; issues an independent 30-day token.
- `GET /api/siri/v1/devices` — list this user’s paired devices (never returns tokens).
- `DELETE /api/siri/v1/devices/:deviceId` — revoke a device, bound to the signed-in owner.
- `POST /api/siri/v1/command` — separate Siri bearer token + `X-WISDO-Siri-Device`; returns `{ok,kind,spokenText,openUrl,executed:false}`.

The Siri credentials are independent from desktop, MT4, Pi, and website session credentials. This is intentionally not a generic authenticated proxy to `/api/world/intent` because conversational trade and home actions must remain behind stronger authorization and confirmation flows.
