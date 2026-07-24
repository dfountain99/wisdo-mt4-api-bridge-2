from __future__ import annotations
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from .cloud import CloudClient
from .config import Settings
from .device import health
from .recognition import milestone_message, recognize
from .speech import Speaker
from .store import Store

class App:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.store = Store(settings.db_path)
        self.speaker = Speaker(settings)
        self.cloud = CloudClient(settings)

    def handler(self):
        app = self
        class Handler(BaseHTTPRequestHandler):
            server_version = "WisdoCoreAlpha/0.1"
            def _json(self, status: int, payload: object) -> None:
                body = json.dumps(payload, separators=(",", ":")).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
            def _read_json(self) -> dict:
                length = min(int(self.headers.get("Content-Length", "0") or 0), 65536)
                if length <= 0:
                    return {}
                try:
                    value = json.loads(self.rfile.read(length).decode())
                    return value if isinstance(value, dict) else {}
                except (json.JSONDecodeError, UnicodeDecodeError):
                    return {}
            def log_message(self, fmt: str, *args) -> None:
                print(f"{self.address_string()} - {fmt % args}")
            def do_GET(self) -> None:
                parsed = urlparse(self.path)
                if parsed.path == "/health":
                    self._json(HTTPStatus.OK, health())
                elif parsed.path == "/api/events":
                    query = parse_qs(parsed.query)
                    limit = int(query.get("limit", ["50"])[0])
                    self._json(HTTPStatus.OK, {"ok": True, "events": app.store.recent_events(limit)})
                else:
                    self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
            def do_POST(self) -> None:
                payload = self._read_json()
                if self.path == "/api/presence/recognize":
                    result = recognize(str(payload.get("user_id") or app.settings.user_id), str(payload.get("display_name") or app.settings.display_name))
                    app.store.add_event("recognition", result.to_dict())
                    app.speaker.say(result.message)
                    self._json(HTTPStatus.OK, {"ok": True, **result.to_dict()})
                    return
                if self.path == "/api/accounts/equity":
                    account_id = str(payload.get("account_id") or "").strip()
                    try: equity = float(payload.get("equity"))
                    except (TypeError, ValueError): equity = 0
                    if not account_id or equity <= 0:
                        self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "account_id and positive equity required"})
                        return
                    milestones = app.store.evaluate_growth(account_id, equity)
                    messages = [milestone_message(str(payload.get("display_name") or app.settings.display_name), value) for value in milestones]
                    for value, message in zip(milestones, messages):
                        app.store.add_event("growth_milestone", {"account_id": account_id, "percent": value, "message": message})
                        app.speaker.say(message)
                    self._json(HTTPStatus.OK, {"ok": True, "milestones": milestones, "messages": messages})
                    return
                if self.path == "/api/command":
                    command = str(payload.get("command") or "").strip()
                    if not command:
                        self._json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "command required"})
                        return
                    app.store.add_event("command", {"command": command})
                    result = app.cloud.post("/api/device/command", {"device": "wisdo-core-alpha", "command": command})
                    self._json(HTTPStatus.OK, result)
                    return
                self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
        return Handler

def run(settings: Settings) -> None:
    app = App(settings)
    server = ThreadingHTTPServer((settings.host, settings.port), app.handler())
    print(f"Wisdo Core Alpha listening on http://{settings.host}:{settings.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
