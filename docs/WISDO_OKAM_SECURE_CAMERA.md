# O-KAM Pro shared camera → WISDO cloud (secure commissioning)

## Current connection truth

The **Back garden** sharing QR belongs to the O-KAM Pro mobile app. It is not
an RTSP URL, cloud streaming token, camera password, or proof that WISDO can
reach the camera. Never paste the QR/VUID or camera credentials into GitHub,
WISDO web forms, a Discord command, or Render configuration.

WISDO has an existing local Home Assistant bridge (`pi-edge/home_assistant_bridge.py`)
that registers camera and sensor entities through an enrolled WISDO edge device.
This release adds an explicit O-KAM mapping and a truthful onboarding panel.
It **does not** deploy a camera, upload video, expose an RTSP port, or claim
that live view, cloud snapshots, or motion-event delivery are working.

## Trust boundaries

```
O-KAM Pro account (one shared camera)
    ↕ owner-approved app / integration authentication
Home Assistant on Raspberry Pi 4, 64-bit
    ↕ localhost / LAN access token
WISDO enrolled edge bridge (outbound HTTPS only)
    ↕ authenticated component registration; safe state only
WISDO cloud: device approval → owned Home → automation policy
```

- O-KAM account credentials remain in the locally installed camera integration.
- The Home Assistant token remains in `pi-edge/.env` on the edge host.
- WISDO's cloud receives a stable camera entity name, safe state, source ID,
  vendor marker, and approval status, not camera frames, local URLs, tokens,
  RTSP addresses, or O-KAM account identifiers.
- Any member must own the WISDO Home and bind the authenticated Home Assistant
  source before the component can be approved.
- Shared O-KAM cameras are read-only in WISDO. A generic camera power/privacy
  action requires elevated server-side confirmation.
- Do **not** port-forward Home Assistant, the camera, or a native bridge port
  to the public internet. Don't run an unreviewed native bridge with trading
  permissions or credentials on the WISDO cloud host.

## Step-by-step commissioning

1. Accept the QR invitation using a **dedicated O-KAM Pro account**, if you
   have the camera owner's permission. Confirm that the account has working
   live view of exactly this one camera. Ask the owner to renew the QR if it
   has expired, or to grant configuration permission if required.
2. Bring Home Assistant online on a Raspberry Pi 4 running a 64-bit build.
   The third-party [O-KAM Native Bridge](https://github.com/oleandor/okam-ha-native)
   reports support for owner or shared O-KAM accounts and Home Assistant on
   aarch64. **Review its source and security policy before installing.** It is
   not an official O-KAM or Home Assistant integration.
3. Follow that project's Home Assistant instructions locally. Put the O-KAM
   account password and its independently generated bridge API token into
   the local integration settings, not WISDO's cloud. Confirm the actual
   camera entity ID under Home Assistant → Developer tools → States.
4. Configure the existing WISDO edge at `pi-edge/.env`:

   ```dotenv
   WISDO_HOME_ASSISTANT_URL=http://homeassistant.local:8123
   WISDO_HOME_ASSISTANT_TOKEN=<local Home Assistant long-lived token>
   WISDO_HA_OKAM_CAMERA_ENTITY_ID=camera.back_garden
   # Optional: only if Home Assistant really exposes this event entity
   WISDO_HA_OKAM_MOTION_ENTITY_ID=
   ```

   The entity ID is an **example**. Use the exact Home Assistant ID and keep
   the local `.env` out of version control.
5. Re-run the existing edge enrollment process and start `wisdo_edge.py`.
   The bridge will discover the configured Home Assistant entities, then
   register their normalized state through WISDO's authenticated device API.
6. In WISDO → **Smart Home Trust Center** create/select an owned Home, bind the
   enrolled Home Assistant source, review the discovered camera, and approve
   it. The O-KAM panel distinguishes pending/approved/unavailable camera state.
7. Test camera-online status in WISDO. A successful *state sync* is **not** a
   video stream. To use motion as an automation trigger, verify an actual
   `binary_sensor` or other supported event entity is present and working in
   Home Assistant; a live camera entity alone does not provide motion events.

## Cloud media and automation phases (not yet commissioned)

- **Phase 1 (implemented in this change):** authorized camera/sensor discovery,
  read-only shared-camera metadata, ownership approvals, truthful readiness UI,
  camera privacy-risk hardening.
- **Phase 2:** decide whether to offer remote video at all. If approved,
  implement an explicit, user-initiated, owner-scoped, short-lived snapshot
  relay over the outbound edge channel. Use strict byte/rate limits and avoid
  persistent media storage by default. Do not transmit raw O-KAM credentials.
- **Phase 3:** if motion events are available, map them into event-driven
  automations with deduplication, a minimum debounce period, quiet hours,
  opt-in notification targets, and no trading execution authority.

## Validation

```bash
python3 -m unittest discover -s tests -p test_home_assistant_bridge.py
node --test tests/wisdoSmartHomeV20.test.js tests/wisdoSmartHomeV21.test.js
node scripts/checkBuild.js
```

Hardware, O-KAM account access, actual camera/entity discovery, and Render
deployment require operator commissioning. A green test run alone does not
prove camera connectivity.
