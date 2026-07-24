from __future__ import annotations
import os
import platform
import time
from pathlib import Path

STARTED_AT = time.time()

def _temperature() -> float | None:
    path = Path("/sys/class/thermal/thermal_zone0/temp")
    try:
        return round(float(path.read_text().strip()) / 1000.0, 1)
    except (OSError, ValueError):
        return None

def health() -> dict[str, object]:
    return {
        "ok": True,
        "hostname": platform.node(),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "pid": os.getpid(),
        "uptime_seconds": round(time.time() - STARTED_AT, 1),
        "temperature_c": _temperature(),
    }
