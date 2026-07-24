from __future__ import annotations
import subprocess
from .config import Settings

class Speaker:
    def __init__(self, settings: Settings):
        self.settings = settings

    def say(self, text: str) -> bool:
        if not self.settings.enable_tts or not text.strip():
            return False
        try:
            subprocess.Popen([self.settings.tts_command, text], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        except OSError:
            return False
