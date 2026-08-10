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
sudo install -d -o root -g "$SERVICE_USER" -m 0750 "$ROOT"
sudo cp -a ./. "$ROOT/"
sudo chown -R root:"$SERVICE_USER" "$ROOT"
sudo chmod -R o-rwx "$ROOT"
sudo install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0750 "$ROOT/data"
if [ ! -x "$ROOT/.venv/bin/python" ]; then sudo python3 -m venv "$ROOT/.venv"; fi
sudo "$ROOT/.venv/bin/pip" install --requirement "$ROOT/requirements.txt"
if [ ! -f "$ROOT/.env" ]; then sudo cp "$ROOT/.env.example" "$ROOT/.env"; fi
sudo chown root:"$SERVICE_USER" "$ROOT/.env"
sudo chmod 0640 "$ROOT/.env"
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
printf '\nEdit %s/.env, enroll with sudo -u %s %s/.venv/bin/python %s/enroll.py, remove the enrollment code, then start wisdo-edge.\n' "$ROOT" "$SERVICE_USER" "$ROOT" "$ROOT"
