"""Enroll a real WISDO Raspberry Pi/edge with explicit capabilities."""
import json
import os
import secrets
import socket
from pathlib import Path

import requests
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env")
device_id = os.getenv("WISDO_DEVICE_ID") or "pi-" + socket.gethostname()
token_file = Path(os.getenv("WISDO_DEVICE_TOKEN_FILE") or BASE / "data" / "device-token")
token_file.parent.mkdir(parents=True, exist_ok=True)
if not token_file.exists():
    token_file.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    token_file.chmod(0o600)

presence_command=os.getenv('WISDO_PRESENCE_COMMAND','').strip()
home_url = os.getenv("WISDO_HOME_ASSISTANT_URL", "").strip()
home_token = os.getenv("WISDO_HOME_ASSISTANT_TOKEN", "").strip()
home_enabled = bool(home_url and home_token)
presence_command=os.getenv('WISDO_PRESENCE_COMMAND', '').strip()
map_raw = os.getenv("WISDO_SENTINEL_ENTITY_MAP", "{}").strip() or "{}"
mapping = json.loads(map_raw)
if not isinstance(mapping, dict):
    raise ValueError("WISDO_SENTINEL_ENTITY_MAP must be a JSON object.")

capabilities = {
    "wakeWords": ["hey wisdo", "hey coach"],
    "voice": True,
    'presence':bool(presence_command),
    "wake_trading_workstation": bool(os.getenv("WISDO_TRADING_WORKSTATION_MAC", "").strip()),
    "smart_home": home_enabled,
    "home_assistant": home_enabled,
    "matter_thread_via_home_assistant": home_enabled,
    "os_telemetry": True,
    # No camera event authority unless HA is actually configured with mapped sensors.
    "camera_events": home_enabled and bool(mapping),
}
payload = {
    "enrollmentCode": os.environ["WISDO_DEVICE_ENROLLMENT_CODE"],
    "deviceId": device_id,
    "deviceName": os.getenv("WISDO_DEVICE_NAME", "Wisdo Office Pi"),
    "deviceType": "pi-edge",
    "token": token_file.read_text(encoding="utf-8").strip(),
    "capabilities": capabilities,
}
response = requests.post(
    os.environ["WISDO_CLOUD_BASE_URL"].rstrip("/") + "/api/device/v1/enroll",
    json=payload, timeout=15,
)
response.raise_for_status()
result = response.json()
# Never print bearer tokens or enrollment codes.
print(json.dumps({"ok": result.get("ok"), "deviceId": device_id,
                  "capabilities": capabilities}, indent=2))
