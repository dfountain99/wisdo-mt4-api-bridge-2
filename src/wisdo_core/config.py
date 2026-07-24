from __future__ import annotations
import os
from dataclasses import dataclass


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("WISDO_HOST", "0.0.0.0")
    port: int = int(os.getenv("WISDO_PORT", "8787"))
    db_path: str = os.getenv("WISDO_DB_PATH", "./wisdo.db")
    display_name: str = os.getenv("WISDO_DISPLAY_NAME", "Member")
    user_id: str = os.getenv("WISDO_USER_ID", "local-user")
    cloud_url: str = os.getenv("WISDO_CLOUD_URL", "").rstrip("/")
    device_token: str = os.getenv("WISDO_DEVICE_TOKEN", "")
    tts_command: str = os.getenv("WISDO_TTS_COMMAND", "espeak")
    enable_tts: bool = _bool("WISDO_ENABLE_TTS", True)
    request_timeout_seconds: float = float(os.getenv("WISDO_REQUEST_TIMEOUT_SECONDS", "8"))
