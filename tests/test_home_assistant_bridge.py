import importlib.util
import os
import tempfile
import unittest
import sys
import types
from pathlib import Path

try:
    import requests  # noqa: F401
except ModuleNotFoundError:
    sys.modules['requests'] = types.SimpleNamespace(Session=lambda: object())

MODULE_PATH = Path(__file__).resolve().parents[1] / 'pi-edge' / 'home_assistant_bridge.py'
SPEC = importlib.util.spec_from_file_location('wisdo_home_assistant_bridge', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
HomeAssistantBridge = MODULE.HomeAssistantBridge


class HomeAssistantBridgeTests(unittest.TestCase):
    def setUp(self):
        self.old_url = os.environ.get('WISDO_HOME_ASSISTANT_URL')
        self.old_token = os.environ.get('WISDO_HOME_ASSISTANT_TOKEN')
        self.old_okam_camera = os.environ.get('WISDO_HA_OKAM_CAMERA_ENTITY_ID')
        self.old_okam_motion = os.environ.get('WISDO_HA_OKAM_MOTION_ENTITY_ID')
        os.environ['WISDO_HOME_ASSISTANT_URL'] = 'http://ha.local:8123'
        os.environ['WISDO_HOME_ASSISTANT_TOKEN'] = 'local-test-token'
        os.environ['WISDO_HA_OKAM_CAMERA_ENTITY_ID'] = 'camera.back_garden'
        os.environ['WISDO_HA_OKAM_MOTION_ENTITY_ID'] = 'binary_sensor.back_garden_motion'
        self.tmp = tempfile.TemporaryDirectory()
        self.token = Path(self.tmp.name) / 'device-token'
        self.token.write_text('wisdo-device-token', encoding='utf-8')
        self.bridge = HomeAssistantBridge('https://wisdo.example', 'pi-test', self.token)

    def tearDown(self):
        self.tmp.cleanup()
        if self.old_url is None:
            os.environ.pop('WISDO_HOME_ASSISTANT_URL', None)
        else:
            os.environ['WISDO_HOME_ASSISTANT_URL'] = self.old_url
        if self.old_token is None:
            os.environ.pop('WISDO_HOME_ASSISTANT_TOKEN', None)
        else:
            os.environ['WISDO_HOME_ASSISTANT_TOKEN'] = self.old_token
        for key, value in [('WISDO_HA_OKAM_CAMERA_ENTITY_ID', self.old_okam_camera),
                           ('WISDO_HA_OKAM_MOTION_ENTITY_ID', self.old_okam_motion)]:
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def test_discovers_light_as_capability_scoped_component(self):
        payload = self.bridge.component_payload({
            'entity_id': 'light.living_room',
            'state': 'on',
            'attributes': {'friendly_name': 'Living Room', 'brightness': 128},
        })
        self.assertEqual(payload['componentType'], 'light')
        self.assertEqual(payload['approvalStatus'], 'pending')
        self.assertEqual(payload['adapterId'], 'home-assistant')
        self.assertTrue(payload['componentId'].startswith('ha:pi-test:light.living_room'))
        self.assertIn('turn_on', payload['capabilities']['actions'])
        self.assertIn('set_brightness', payload['capabilities']['actions'])
        self.assertIn('living room lights', payload['aliases'])
        self.assertTrue(payload['metadata']['local_only'])
        self.assertTrue(payload['metadata']['matter_thread_via_home_assistant'])

    def test_security_and_sensor_domains_are_normalized(self):
        lock = self.bridge.component_payload({
            'entity_id': 'lock.front_door',
            'state': 'locked',
            'attributes': {'friendly_name': 'Front Door'},
        })
        smoke = self.bridge.component_payload({
            'entity_id': 'binary_sensor.hall_smoke',
            'state': 'off',
            'attributes': {'friendly_name': 'Hall Smoke', 'device_class': 'smoke'},
        })
        self.assertIn('unlock', lock['capabilities']['actions'])
        self.assertEqual(smoke['capabilities']['actions'], [])
        self.assertTrue(smoke['capabilities']['readOnly'])

    def test_shared_okam_camera_exposes_only_safe_state_not_remote_controls(self):
        camera = self.bridge.component_payload({
            'entity_id': 'camera.back_garden', 'state': 'idle',
            'attributes': {'friendly_name': 'Back garden',
                           'entity_picture': '/api/camera_proxy/secret-token',
                           'access_token': 'never-upload'},
        })
        self.assertEqual(camera['capabilities']['actions'], [])
        self.assertTrue(camera['capabilities']['readOnly'])
        self.assertEqual(camera['metadata']['camera_vendor'], 'o-kam-pro')
        self.assertFalse(camera['metadata']['cloud_stream_enabled'])
        self.assertNotIn('entity_picture', camera['state']['attributes'])
        self.assertNotIn('access_token', camera['state']['attributes'])
        self.assertEqual(camera['status'], 'online')

        unavailable = self.bridge.component_payload({
            'entity_id': 'camera.back_garden', 'state': 'unknown', 'attributes': {},
        })
        self.assertEqual(unavailable['status'], 'unavailable')

    def test_okam_motion_event_is_read_only_and_nonfabricated(self):
        sensor = self.bridge.component_payload({
            'entity_id': 'binary_sensor.back_garden_motion', 'state': 'on',
            'attributes': {'device_class': 'motion'},
        })
        self.assertEqual(sensor['state']['state'], 'on')
        self.assertEqual(sensor['metadata']['camera_event_source'], 'home-assistant-entity')
        self.assertEqual(sensor['capabilities']['actions'], [])
        self.assertTrue(sensor['capabilities']['readOnly'])

    def test_service_mapping_covers_climate_cover_media_and_vacuum(self):
        self.assertEqual(
            self.bridge._service_call('climate', 'set_temperature', {'temperature': 72}),
            ('set_temperature', {'temperature': 72.0}),
        )
        self.assertEqual(
            self.bridge._service_call('cover', 'set_position', {'position': 40}),
            ('set_cover_position', {'position': 40}),
        )
        self.assertEqual(
            self.bridge._service_call('media_player', 'set_volume', {'volume_pct': 25}),
            ('volume_set', {'volume_level': 0.25}),
        )
        self.assertEqual(
            self.bridge._service_call('vacuum', 'dock', {}),
            ('return_to_base', {}),
        )
        self.assertEqual(
            self.bridge._service_call('climate', 'set_fan_mode', {'fan_mode': 'auto'}),
            ('set_fan_mode', {'fan_mode': 'auto'}),
        )


if __name__ == '__main__':
    unittest.main()
