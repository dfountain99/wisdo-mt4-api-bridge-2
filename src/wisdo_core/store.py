from __future__ import annotations
import json
import sqlite3
import threading
from pathlib import Path
from typing import Any

class Store:
    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              event_type TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS account_baselines (
              account_id TEXT PRIMARY KEY,
              baseline_equity REAL NOT NULL,
              highest_milestone INTEGER NOT NULL DEFAULT 0,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value_json TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """)

    def add_event(self, event_type: str, payload: dict[str, Any]) -> int:
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "INSERT INTO events(event_type,payload_json) VALUES(?,?)",
                (event_type, json.dumps(payload, separators=(",", ":"))),
            )
            return int(cur.lastrowid)

    def recent_events(self, limit: int = 50) -> list[dict[str, Any]]:
        limit = max(1, min(limit, 250))
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id,event_type,payload_json,created_at FROM events ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [{"id": r["id"], "event_type": r["event_type"], "payload": json.loads(r["payload_json"]), "created_at": r["created_at"]} for r in rows]

    def evaluate_growth(self, account_id: str, equity: float) -> list[int]:
        if equity <= 0:
            return []
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT baseline_equity,highest_milestone FROM account_baselines WHERE account_id=?", (account_id,)).fetchone()
            if row is None:
                conn.execute("INSERT INTO account_baselines(account_id,baseline_equity) VALUES(?,?)", (account_id, equity))
                return []
            baseline = float(row["baseline_equity"])
            highest = int(row["highest_milestone"])
            growth = ((equity - baseline) / baseline) * 100.0
            reached = max(0, int(growth // 50) * 50)
            milestones = list(range(highest + 50, reached + 1, 50))
            if milestones:
                conn.execute("UPDATE account_baselines SET highest_milestone=?,updated_at=CURRENT_TIMESTAMP WHERE account_id=?", (milestones[-1], account_id))
            return milestones
