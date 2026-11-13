import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
import types

# The core Python package has no HTTP dependency; this bridge test injects a fake
# requests client and tests the real protocol through its in-process session.
try:
    import requests  # noqa: F401
except ModuleNotFoundError:
    sys.modules['requests'] = types.SimpleNamespace(Session=lambda: object())

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'pi-edge'))
from home_assistant_bridge import HomeAssistantBridge


class Response:
    def __init__(self, data, status=200):
        self.data = data
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError('HTTP rejected')

    def json(self):
        return self.data


class FakeSession:
    def __init__(self):
        self.entities = []
        self.posts = []
        self.fail_next = False

    def get(self, url, **kwargs):
        if not url.endswith('/api/states'):
            raise AssertionError('Unexpected Home Assistant API')
        return Response(self.entities)

    def post(self, url, **kwargs):
        if not url.endswith('/api/os/v1/sentinel/events'):
            raise AssertionError('Unexpected WISDO destination')
        self.posts.append(kwargs.get('json'))
        if self.fail_next:
            self.fail_next = False
            return Response({}, 503)
        return Response({'ok': True, 'recorded': True})


class FourPillarSentinelTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        token = Path(self.temporary.name) / 'token'
        token.write_text('test-only-token', encoding='utf-8')
        self.token = token
        self.session = FakeSession()
        self.environment = mock.patch.dict(os.environ, {
            'WISDO_HOME_ASSISTANT_URL': 'http://home-assistant.local:8123',
            'WISDO_HOME_ASSISTANT_TOKEN': 'test-only-ha-token',
            'WISDO_SENTINEL_ENTITY_MAP': '{"binary_sensor.backyard_motion":{"camera":"camera.backyard","eventType":"motion"}}',
            'WISDO_SENTINEL_POLL_SECONDS': '15'
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def bridge(self):
        return HomeAssistantBridge('https://wisdo.example', 'pi1', self.token, session=self.session)

    def state(self, state, when):
        return {'entity_id': 'binary_sensor.backyard_motion', 'state': state,
                'last_changed': when, 'attributes': {'device_class': 'motion'}}

    def test_only_real_subsequent_transitions_are_sent(self):
        bridge = self.bridge()
        self.session.entities = [self.state('off', '2026-11-13T14:00:00+00:00')]
        self.assertEqual(bridge.poll_sentinel_events(), 0)
        self.session.entities = [self.state('on', '2026-11-13T14:01:00+00:00')]
        self.assertEqual(bridge.poll_sentinel_events(), 1)
        self.assertEqual(bridge.poll_sentinel_events(), 0)
        self.assertEqual(len(self.session.posts), 1)
        payload = self.session.posts[0]
        self.assertEqual(payload['componentId'], 'ha:pi1:camera.backyard')
        self.assertEqual(payload['eventType'], 'motion')
        self.assertEqual(payload['occurredAt'], '2026-11-13T14:01:00+00:00')
        self.assertNotIn('image', payload)
        self.assertNotIn('face', str(payload).lower())

    def test_failed_post_remains_pending_for_retry(self):
        bridge = self.bridge()
        self.session.entities = [self.state('off', '2026-11-13T14:00:00+00:00')]
        bridge.poll_sentinel_events()
        self.session.entities = [self.state('on', '2026-11-13T14:01:00+00:00')]
        self.session.fail_next = True
        with self.assertRaisesRegex(RuntimeError, 'HTTP rejected'):
            bridge.poll_sentinel_events()
        self.assertEqual(len(bridge.sentinel_pending), 1)
        self.assertEqual(bridge.poll_sentinel_events(), 1)
        self.assertEqual(bridge.sentinel_pending, {})

    def test_implicit_camera_or_category_guesses_are_rejected(self):
        with mock.patch.dict(os.environ, {
            'WISDO_SENTINEL_ENTITY_MAP': '{"binary_sensor.door":"camera.backyard"}'
        }):
            with self.assertRaisesRegex(ValueError, 'camera and eventType'):
                self.bridge()
        with mock.patch.dict(os.environ, {
            'WISDO_SENTINEL_ENTITY_MAP': '{"binary_sensor.door":{"camera":"camera.backyard","eventType":"face_identity"}}'
        }):
            with self.assertRaisesRegex(ValueError, 'Invalid explicitly mapped'):
                self.bridge()

if __name__ == '__main__':
    unittest.main()
