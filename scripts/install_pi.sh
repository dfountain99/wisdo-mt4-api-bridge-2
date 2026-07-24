#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run with sudo."; exit 1; fi
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR=/opt/wisdo-core
DATA_DIR=/var/lib/wisdo-core
mkdir -p "$INSTALL_DIR" "$DATA_DIR"
rsync -a --delete --exclude .git --exclude .venv --exclude .env "$SOURCE_DIR/" "$INSTALL_DIR/"
python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install -e "$INSTALL_DIR"
[[ -f "$INSTALL_DIR/.env" ]] || cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
cp "$INSTALL_DIR/systemd/wisdo-core.service" /etc/systemd/system/wisdo-core.service
systemctl daemon-reload
systemctl enable --now wisdo-core
systemctl --no-pager status wisdo-core || true
