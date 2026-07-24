#!/usr/bin/env bash
set -euo pipefail
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip espeak alsa-utils git curl
printf '\nFirst boot packages installed. Reboot recommended.\n'
