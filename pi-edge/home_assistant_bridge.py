from __future__ import annotations

import hashlib
import os
import threading
import time
from pathlib import Path

import requests


DOMAIN_ACTIONS = {
    'light': ['turn_on', 'turn_off', 'set_brightness', 'set_color', 'set_color_temperature'],
    'switch': ['turn_on', 'turn_off'],
    'input_boolean': ['turn_on', 'turn_off'],
    'scene': ['activate'],
    'script': ['activate'],
    'automation': ['activate'],
    'climate': ['turn_on', 'turn_off', 'set_temperature', 'set_hvac_mode', 'set_fan_mode'],
    'fan': ['turn_on', 'turn_off', 'set_percentage'],
    'cover': ['open', 'close', 'stop', 'set_position'],
    'lock': ['lock', 'unlock'],
    'media_player': ['turn_on', 'turn_off', 'play', 'pause', 'stop', 'set_volume', 'next', 'previous'],
    'vacuum': ['start', 'pause', 'stop', 'dock'],
    'humidifier': ['turn_on', 'turn_off', 'set_humidity'],
    'water_heater': ['set_temperature', 'set_operation_mode'],
    'alarm_control_panel': ['arm_away', 'arm_home', 'disarm'],
    'siren': ['turn_on', 'turn_off'],
    'button': ['press'],
    'number': ['set_value'],
    'select': ['select_option'],
    'camera': ['turn_on', 'turn_off'],
    'sensor': [],
    'binary_sensor': [],
    'person': [],
    'device_tracker': [],
    'weather': [],
}

READ_ONLY_DOMAINS = {'sensor', 'binary_sensor', 'person', 'device_tracker', 'weather'}
SAFE_ATTRIBUTE_KEYS = {
    'friendly_name', 'device_class', 'unit_of_measurement', 'battery_level',
    'temperature', 'current_temperature', 'humidity', 'current_humidity',
    'hvac_mode', 'hvac_modes', 'fan_mode', 'fan_modes', 'percentage',
    'volume_level', 'media_title', 'media_artist', 'source', 'source_list',
    'current_position', 'supported_features', 'brightness', 'color_temp_kelvin',
    'rgb_color', 'is_volume_muted',
}


def _clean(value):
    return str(value or '').strip()


def _slug_label(value):
    return _clean(value).replace('_', ' ').replace('-', ' ').strip().lower()


def _aliases(entity_id, domain, attributes):
    suffix = entity_id.split('.', 1)[1] if '.' in entity_id else entity_id
    friendly = _clean(attributes.get('friendly_name'))
    base = _slug_label(friendly or suffix)
    aliases = {base, _slug_label(suffix)}
    device_class = _slug_label(attributes.get('device_class'))
    if domain == 'light':
        aliases.update({f'{base} light', f'{base} lights'})
    elif domain == 'lock':
        aliases.add(f'{base} lock')
    elif domain == 'climate':
        aliases.update({f'{base} thermostat', 'thermostat'})
    elif domain == 'alarm_control_panel':
        aliases.update({'security', 'alarm', 'security system'})
    elif domain == 'cover':
        aliases.update({f'{base} cover'})
        if device_class == 'garage' or 'garage' in base:
            aliases.update({'garage', 'garage door'})
        if device_class in {'blind', 'shade', 'curtain'}:
            aliases.update({f'{base} blinds', f'{base} shades', f'{base} curtains'})
    elif domain == 'media_player':
        aliases.update({f'{base} speaker', f'{base} tv'})
    elif domain == 'fan':
        aliases.add(f'{base} fan')
    elif domain == 'scene':
        aliases.update({f'{base} scene', f'{base} mode'})
    return sorted(alias for alias in aliases if alias)


def _safe_state(entity):
    attrs = entity.get('attributes') if isinstance(entity.get('attributes'), dict) else {}
    safe = {key: attrs[key] for key in SAFE_ATTRIBUTE_KEYS if key in attrs}
    return {'state': _clean(entity.get('state')), 'attributes': safe}


def _component_type(entity_id):
    return entity_id.split('.', 1)[0].strip().lower() if '.' in entity_id else ''


class HomeAssistantBridge:
    """Local-only Home Assistant bridge.

    Home Assistant owns device credentials and Matter/Thread/Zigbee/Z-Wave/vendor
    integrations. WISDO only receives normalized component metadata and sends
    capability-scoped service calls through this edge process.
    """

    def __init__(self, cloud_base_url, device_id, token_file, session=None):
        self.cloud = _clean(cloud_base_url).rstrip('/')
        self.device_id = _clean(device_id)
        self.token_file = Path(token_file)
        self.ha = _clean(os.getenv('WISDO_HOME_ASSISTANT_URL')).rstrip('/')
        self.ha_token = _clean(os.getenv('WISDO_HOME_ASSISTANT_TOKEN'))
        self.home_id = _clean(os.getenv('WISDO_HOME_ID'))
        self.source_instance_id = hashlib.sha256(self.ha.encode('utf-8')).hexdigest()[:24] if self.ha else ''
        self.sync_seconds = max(15.0, float(os.getenv('WISDO_HA_SYNC_SECONDS', '60')))
        self.poll_seconds = max(0.5, float(os.getenv('WISDO_HA_CONTROL_POLL_SECONDS', '1.5')))
        self.timeout = max(2.0, float(os.getenv('WISDO_HA_HTTP_TIMEOUT_SECONDS', '8')))
        self.session = session or requests.Session()
        self.stop_event = threading.Event()
        self.thread = None
        self.last_sync_at = 0.0
        self.last_error = ''
        self.registered = 0

    @property
    def enabled(self):
        return bool(self.cloud and self.device_id and self.ha and self.ha_token and self.token_file.is_file())

    def wisdo_headers(self):
        token = self.token_file.read_text(encoding='utf-8').strip()
        return {
            'Authorization': f'Bearer {token}',
            'X-Wisdo-Device-Id': self.device_id,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def ha_headers(self):
        return {
            'Authorization': f'Bearer {self.ha_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def start(self):
        if not self.enabled or (self.thread and self.thread.is_alive()):
            return False
        self.thread = threading.Thread(target=self._run, name='wisdo-home-assistant', daemon=True)
        self.thread.start()
        return True

    def stop(self):
        self.stop_event.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3)

    def _run(self):
        while not self.stop_event.is_set():
            try:
                now = time.monotonic()
                if now - self.last_sync_at >= self.sync_seconds:
                    self.sync_components()
                    self.last_sync_at = now
                self.poll_executions()
                self.last_error = ''
            except Exception as exc:
                self.last_error = str(exc)[:300]
                print('WISDO Home Assistant bridge:', self.last_error)
            self.stop_event.wait(self.poll_seconds)

    def discover(self):
        response = self.session.get(f'{self.ha}/api/states', headers=self.ha_headers(), timeout=self.timeout)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, list) else []

    def component_payload(self, entity):
        entity_id = _clean(entity.get('entity_id'))
        domain = _component_type(entity_id)
        if not entity_id or domain not in DOMAIN_ACTIONS:
            return None
        attrs = entity.get('attributes') if isinstance(entity.get('attributes'), dict) else {}
        friendly = _clean(attrs.get('friendly_name')) or _slug_label(entity_id.split('.', 1)[-1]).title()
        device_class = _clean(attrs.get('device_class')).lower()
        entity_state = _clean(entity.get('state')).lower()
        return {
            'componentId': f'ha:{self.device_id}:{entity_id}',
            'componentType': domain,
            'name': friendly,
            'aliases': _aliases(entity_id, domain, attrs),
            'capabilities': {
                'actions': DOMAIN_ACTIONS[domain],
                'readOnly': domain in READ_ONLY_DOMAINS,
                'provider': 'home_assistant',
            },
            'approvalStatus': 'pending',
            'requiresApproval': True,
            'homeId': self.home_id or None,
            'adapterId': 'home-assistant',
            'protocols': ['home-assistant'],
            'ownershipVerified': False,
            'state': _safe_state(entity),
            'status': 'unavailable' if entity_state == 'unavailable' else 'online',
            'metadata': {
                'provider': 'home_assistant',
                'entity_id': entity_id,
                'source_instance_id': self.source_instance_id,
                'domain': domain,
                'device_class': device_class,
                'local_only': True,
                'matter_thread_via_home_assistant': True,
            },
        }

    def sync_components(self):
        count = 0
        for entity in self.discover():
            payload = self.component_payload(entity)
            if not payload:
                continue
            response = self.session.post(
                f'{self.cloud}/api/control/v1/components/register',
                headers=self.wisdo_headers(), json=payload, timeout=self.timeout,
            )
            response.raise_for_status()
            count += 1
        self.registered = count
        return count

    def poll_executions(self):
        response = self.session.post(
            f'{self.cloud}/api/control/v1/executions/lease',
            headers=self.wisdo_headers(), json={'limit': 12}, timeout=self.timeout,
        )
        response.raise_for_status()
        executions = response.json().get('executions', [])
        for execution in executions:
            self._complete_execution(execution)
        return len(executions)

    def _complete_execution(self, execution):
        execution_id = _clean(execution.get('execution_id'))
        try:
            result = self.execute(execution)
            status, error = 'completed', ''
        except Exception as exc:
            result, status, error = {}, 'failed', str(exc)[:500]
        response = self.session.post(
            f'{self.cloud}/api/control/v1/executions/{execution_id}/complete',
            headers=self.wisdo_headers(),
            json={'status': status, 'result': result, 'error': error},
            timeout=self.timeout,
        )
        response.raise_for_status()

    def execute(self, execution):
        component_id = _clean(execution.get('component_id'))
        if not component_id.startswith('ha:'):
            raise RuntimeError('Execution is not owned by the Home Assistant bridge.')
        metadata = execution.get('component_metadata') if isinstance(execution.get('component_metadata'), dict) else {}
        entity_id = _clean(metadata.get('entity_id'))
        if not entity_id:
            parts = component_id.split(':', 2)
            entity_id = parts[2] if len(parts) == 3 else component_id[3:]
        domain = _component_type(entity_id)
        action = _clean(execution.get('action')).lower()
        parameters = execution.get('parameters') if isinstance(execution.get('parameters'), dict) else {}
        if domain not in DOMAIN_ACTIONS or action not in DOMAIN_ACTIONS[domain]:
            raise RuntimeError(f'Unsupported Home Assistant action {action} for {domain}.')

        service, data = self._service_call(domain, action, parameters)
        data = {'entity_id': entity_id, **data}
        response = self.session.post(
            f'{self.ha}/api/services/{domain}/{service}',
            headers=self.ha_headers(), json=data, timeout=self.timeout,
        )
        response.raise_for_status()
        return {'provider': 'home_assistant', 'entity_id': entity_id, 'domain': domain, 'service': service}

    def _service_call(self, domain, action, p):
        if action in {'turn_on', 'turn_off'}:
            return action, {}
        if action == 'activate':
            return ('trigger' if domain == 'automation' else 'turn_on'), {}
        if domain == 'light' and action == 'set_brightness':
            return 'turn_on', {'brightness_pct': max(0, min(100, int(float(p.get('brightness_pct', 0)))))}
        if domain == 'light' and action == 'set_color':
            return 'turn_on', {'color_name': _clean(p.get('color_name'))}
        if domain == 'light' and action == 'set_color_temperature':
            return 'turn_on', {'color_temp_kelvin': int(float(p.get('kelvin', p.get('color_temp_kelvin', 3000))))}
        if domain == 'climate' and action == 'set_temperature':
            return 'set_temperature', {'temperature': float(p['temperature'])}
        if domain == 'climate' and action == 'set_hvac_mode':
            return 'set_hvac_mode', {'hvac_mode': _clean(p['hvac_mode'])}
        if domain == 'climate' and action == 'set_fan_mode':
            return 'set_fan_mode', {'fan_mode': _clean(p['fan_mode'])}
        if domain == 'fan' and action == 'set_percentage':
            return 'set_percentage', {'percentage': max(0, min(100, int(float(p['percentage']))))}
        if domain == 'cover':
            services = {'open': 'open_cover', 'close': 'close_cover', 'stop': 'stop_cover', 'set_position': 'set_cover_position'}
            data = {'position': max(0, min(100, int(float(p['position']))))} if action == 'set_position' else {}
            return services[action], data
        if domain == 'lock' and action in {'lock', 'unlock'}:
            return action, {}
        if domain == 'media_player':
            services = {'play': 'media_play', 'pause': 'media_pause', 'stop': 'media_stop',
                        'next': 'media_next_track', 'previous': 'media_previous_track'}
            if action == 'set_volume':
                return 'volume_set', {'volume_level': max(0.0, min(1.0, float(p.get('volume_pct', 0)) / 100.0))}
            if action in services:
                return services[action], {}
        if domain == 'vacuum':
            return {'start': 'start', 'pause': 'pause', 'stop': 'stop', 'dock': 'return_to_base'}[action], {}
        if domain == 'humidifier' and action == 'set_humidity':
            return 'set_humidity', {'humidity': max(0, min(100, int(float(p['humidity']))))}
        if domain == 'water_heater' and action == 'set_temperature':
            return 'set_temperature', {'temperature': float(p['temperature'])}
        if domain == 'water_heater' and action == 'set_operation_mode':
            return 'set_operation_mode', {'operation_mode': _clean(p['operation_mode'])}
        if domain == 'alarm_control_panel':
            services = {'arm_away': 'alarm_arm_away', 'arm_home': 'alarm_arm_home', 'disarm': 'alarm_disarm'}
            data = {}
            code = _clean(os.getenv('WISDO_HA_ALARM_CODE'))
            if code:
                data['code'] = code
            return services[action], data
        if domain == 'siren' and action in {'turn_on', 'turn_off'}:
            return action, {}
        if domain == 'button' and action == 'press':
            return 'press', {}
        if domain == 'number' and action == 'set_value':
            return 'set_value', {'value': float(p['value'])}
        if domain == 'select' and action == 'select_option':
            return 'select_option', {'option': _clean(p['option'])}
        if domain == 'camera' and action in {'turn_on', 'turn_off'}:
            return action, {}
        raise RuntimeError(f'No service mapping for {domain}.{action}.')
