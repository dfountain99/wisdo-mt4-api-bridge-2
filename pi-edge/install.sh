#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/wisdo-edge
SERVICE_USER=wisdo-edge

sudo apt-get update
sudo apt-get install -y alsa-utils ffmpeg espeak-ng libportaudio2 portaudio19-dev python3-dev python3-venv
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  sudo useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin --groups audio "$SERVICE_USER"
fi
sudo usermod -a -G audio "$SERVICE_USER"

# Preserve enrolled identity/config across upgrades. Never let a source overlay
# change ownership of runtime data or the bearer token.
sudo install -d -o root -g "$SERVICE_USER" -m 0750 "$ROOT"
sudo install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$ROOT/data"
if [ -f "$ROOT/.env" ]; then sudo cp -p "$ROOT/.env" /tmp/wisdo-edge.env.upgrade; fi
if [ -f "$ROOT/data/device-token" ]; then sudo cp -p "$ROOT/data/device-token" /tmp/wisdo-edge.device-token.upgrade; fi

sudo cp -a ./. "$ROOT/"
# Source is root-owned/readable by the service; mutable runtime data remains
# owned by the service user.
sudo find "$ROOT" -mindepth 1 -maxdepth 1 ! -name data ! -name .env -exec chown -R root:"$SERVICE_USER" {} +
sudo chmod -R o-rwx "$ROOT"
sudo install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$ROOT/data"

if [ -f /tmp/wisdo-edge.env.upgrade ]; then
  sudo cp -p /tmp/wisdo-edge.env.upgrade "$ROOT/.env"
  sudo rm -f /tmp/wisdo-edge.env.upgrade
elif [ ! -f "$ROOT/.env" ]; then
  sudo cp "$ROOT/.env.example" "$ROOT/.env"
fi
if [ -f /tmp/wisdo-edge.device-token.upgrade ]; then
  sudo cp -p /tmp/wisdo-edge.device-token.upgrade "$ROOT/data/device-token"
  sudo rm -f /tmp/wisdo-edge.device-token.upgrade
fi
sudo chown root:"$SERVICE_USER" "$ROOT/.env"
sudo chmod 0640 "$ROOT/.env"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$ROOT/data"
sudo chmod 0750 "$ROOT/data"
if [ -f "$ROOT/data/device-token" ]; then sudo chmod 0600 "$ROOT/data/device-token"; fi

if [ ! -x "$ROOT/.venv/bin/python" ]; then sudo python3 -m venv "$ROOT/.venv"; fi
sudo "$ROOT/.venv/bin/pip" install --requirement "$ROOT/requirements.txt"

sudo tee /etc/systemd/system/wisdo-edge.service >/dev/null <<EOF
[Unit]
Description=Wisdo Pi Voice Edge
After=network-online.target sound.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
SupplementaryGroups=audio
WorkingDirectory=$ROOT
EnvironmentFile=$ROOT/.env
ExecStart=$ROOT/.venv/bin/python $ROOT/wisdo_edge.py
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$ROOT/data
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable wisdo-edge
printf '\nWisdo Edge upgraded. Existing .env and device-token were preserved when present.\n'
printf 'Verify configuration, then run: sudo systemctl restart wisdo-edge\n'
