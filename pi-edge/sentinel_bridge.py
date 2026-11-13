from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ALLOWED_TYPES = {'motion', 'person', 'vehicle', 'animal', 'package', 'sound', 'tamper', 'unknown'}


def _mapping(raw):
    if not raw.strip():
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError('WISDO_SENTINEL_CAMERA_MAP must be a JSON object.')
    output = {}
    for entity, config in parsed.items():
        if not isinstance(entity, str) or not entity.startswith('binary_sensor.'):
            raise ValueError('Sentinel sources must be Home Assistant binary_sensor entity IDs.')
        if not isinstance(config, dict):
            raise ValueError('Each mapped source must have a camera and eventType.')
        camera = str(config.get('camera', ''))
        event_type = str(config.get('eventType', ''))
        if not camera.startswith('camera.') or not all(ch.isalnum() or ch in '._-' for ch in camera):
            raise ValueError('Sentinel camera must be an exact camera.<name> entity ID.')
        if event_type not in ALLOWED_TYPES:
            raise ValueError('Sentinel eventType must be explicitly configured from the supported set.')
        output[entity] = {'camera': camera, 'eventType': event_type}
    if len(output) > 128:
        raise ValueError('At most 128 camera-event sources can be mapped per edge.')
    return output


class SentinelBridge:
    """Real Home Assistant binary-sensor transitions to approved WISDO cameras.

    Only mapped state changes are forwarded. No image/face recognition, automatic
    siren activation, access token upload, or unverified event synthesis occurs.
    """

    def __init__(self, cloud_base_url, device_id, token_file, session=None, environ=None):
        env = environ if environ is not None else os.environ
        self.cloud = str(cloud_base_url or '').rstrip('/')
        self.device_id = str(device_id or '')
        self.token_file = Path(token_file)
        self.ha = str(env.get('WISDO_HOME_ASSISTANT_URL', '')).rstrip('/')
        self.ha_token = str(env.get('WISDO_HOME_ASSISTANT_TOKEN', ''))
        self.mapping = _mapping(str(env.get('WISDO_SENTINEL_CAMERA_MAP', '')))
        self.interval = min(120.0, max(2.0, float(env.get('WISDO_SENTINEL_POLL_SECONDS', '5'))))
        self.session = session or requests.Session()
        self.stop_event = threading.Event()
        self.thread = None
        self.last_seen = {}
        self.pending = {}
        self.last_error = ''

    @property
    def enabled(self):
        return bool(self.cloud and self.device_id and self.token_file.is_file()
                    and self.ha and self.ha_token and self.mapping)

    def start(self):
        if not self.enabled or (self.thread and self.thread.is_alive()):
            return False
        self.thread = threading.Thread(target=self._run, name='wisdo-sentinel', daemon=True)
        self.thread.start()
        return True

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=5)

    def headers(self):
        return {'Authorization': 'Bearer ' + self.token_file.read_text(encoding='utf-8').strip(),
                'X-Wisdo-Device-Id': self.device_id, 'Content-Type': 'application/json'}

    def ha_headers(self):
        return {'Authorization': 'Bearer ' + self.ha_token, 'Accept': 'application/json'}

    def poll_once(self):
        response = self.session.get(self.ha + '/api/states', headers=self.ha_headers(), timeout=8)
        response.raise_for_status()
        entities = response.json()
        if not isinstance(entities, list):
            raise ValueError('Home Assistant /api/states response is not a list.')
        for entity in entities:
            if not isinstance(entity, dict):
                continue
            entity_id = entity.get('entity_id', '')
            config = self.mapping.get(entity_id)
            if not config:
                continue
            state = str(entity.get('state', '')).lower()
            changed = str(entity.get('last_changed', ''))
            current = (state, changed)
            previous = self.last_seen.get(entity_id)
            self.last_seen[entity_id] = current
            if previous is None or previous == current or state != 'on':
                continue
            # The source timestamp comes from HA, not the WISDO server clock.
            try:
                timestamp = datetime.fromisoformat(changed.replace('Z', '+00:00'))
                if timestamp.tzinfo is None:
                    raise ValueError('Event timestamp must include timezone.')
                occurred_at = timestamp.astimezone(timezone.utc).isoformat()
            except (ValueError, TypeError):
                continue
            digest = hashlib.sha256((self.device_id + '|' + entity_id + '|' + changed).encode('utf-8')).hexdigest()
            if len(self.pending) >= 200 and digest not in self.pending:
                raise RuntimeError('Sentinel pending-event queue full; refusing to silently drop detections.')
            self.pending[digest] = {
                'componentId': 'ha:' + self.device_id + ':' + config['camera'],
                'sourceEventId': digest,
                'eventType': config['eventType'],
                'occurredAt': occurred_at,
                'details': {'source': 'home_assistant_state_change', 'model': 'configured_binary_sensor'}
            }
        delivered = 0
        for digest, payload in list(self.pending.items()):
            response = self.session.post(self.cloud + '/api/os/v1/sentinel/events',
                                         headers=self.headers(), json=payload, timeout=10)
            response.raise_for_status()
            confirmed = response.json()
            if not confirmed.get('ok') or (not confirmed.get('recorded') and not confirmed.get('duplicate')):
                raise RuntimeError('WISDO did not acknowledge durable event persistence.')
            del self.pending[digest]
            delivered += 1
        return delivered

    def _run(self):
        while not self.stop_event.is_set():
            try:
                self.poll_once()
                self.last_error = ''
            except Exception as exc:
                self.last_error = str(exc)[:300]
                print('WISDO Sentinel bridge:', self.last_error)
            self.stop_event.wait(self.interval)
