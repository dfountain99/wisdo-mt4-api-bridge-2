#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/wisdo-edge
sudo mkdir -p "$ROOT"
sudo cp -a . "$ROOT/"
sudo chown -R "$USER:$USER" "$ROOT"
python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -r "$ROOT/requirements.txt"
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
sudo tee /etc/systemd/system/wisdo-edge.service >/dev/null <<EOF
[Unit]
Description=Wisdo Pi Voice Edge
After=network-online.target sound.target
Wants=network-online.target
[Service]
Type=simple
User=$USER
WorkingDirectory=$ROOT
EnvironmentFile=$ROOT/.env
ExecStart=$ROOT/.venv/bin/python $ROOT/wisdo_edge.py
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable wisdo-edge
printf '\nEdit %s/.env, run enroll.py once, then start wisdo-edge.\n' "$ROOT"
