#!/usr/bin/env bash
set -euo pipefail
FILE=/tmp/wisdo-mic-test.wav
echo "Recording for five seconds..."
arecord -d 5 -f cd "$FILE"
echo "Playing recording..."
aplay "$FILE"
