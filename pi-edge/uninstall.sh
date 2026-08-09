#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/wisdo-edge
SERVICE_USER=wisdo-edge
sudo systemctl disable --now wisdo-edge 2>/dev/null || true
sudo rm -f /etc/systemd/system/wisdo-edge.service
sudo systemctl daemon-reload
printf 'Service removed. Runtime data remains at %s. After backing up the device token, remove that directory and user manually if desired:\n' "$ROOT"
printf '  sudo rm -rf -- %s\n  sudo userdel %s\n' "$ROOT" "$SERVICE_USER"
