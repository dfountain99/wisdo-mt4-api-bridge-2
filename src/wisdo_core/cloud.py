from __future__ import annotations
import json
import urllib.error
import urllib.request
from typing import Any
from .config import Settings

class CloudClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.settings.cloud_url:
            return {"ok": False, "offline": True, "reason": "cloud URL not configured"}
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "User-Agent": "Wisdo-Core-Alpha/0.1"}
        if self.settings.device_token:
            headers["Authorization"] = f"Bearer {self.settings.device_token}"
        request = urllib.request.Request(f"{self.settings.cloud_url}{path}", data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self.settings.request_timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            return {"ok": False, "offline": True, "reason": str(exc)}
