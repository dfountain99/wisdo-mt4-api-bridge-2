# Deployment order

1. Render: set `WISDO_DEVICE_ENROLLMENT_CODE` and `WISDO_DEVICE_OWNER_USER_ID`, deploy `render/`, run `npm run migrate:postgres`.
2. Windows: copy `desktop-agent/`, edit `.env`, run installer, run enrollment once.
3. Pi: copy `pi-edge/`, run `sudo ./install.sh`, edit `/opt/wisdo-edge/.env`, run enrollment once.
4. Verify `/health/command-bus`, then issue a voice command.

Never paste device tokens into chat or Git.
