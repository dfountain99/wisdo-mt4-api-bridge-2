from __future__ import annotations

import base64
import hashlib
import json
import os
import platform
import shutil
import shlex
import socket
import subprocess
import struct
import threading
import time
import uuid
from collections import deque
from pathlib import Path

import requests
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / '.env')
IS_WINDOWS = platform.system().lower() == 'windows'


def local_data_path(name):
    """Use repo-local state on Windows and service state under /opt on Linux."""
    default_root = BASE / 'data' if IS_WINDOWS else Path('/opt/wisdo-edge/data')
    return str(default_root / name)


def configured_path(variable, fallback):
    value = os.getenv(variable, '').strip()
    return Path(value) if value else Path(fallback)


CLOUD = os.getenv('WISDO_CLOUD_BASE_URL', '').rstrip('/')
DEVICE_ID = os.getenv('WISDO_DEVICE_ID', '')
TOKEN_FILE = configured_path('WISDO_DEVICE_TOKEN_FILE', local_data_path('device-token'))
MUTE_FILE = configured_path('WISDO_MUTE_FILE', local_data_path('muted'))
LED_FILE = configured_path('WISDO_LED_STATE_FILE', local_data_path('led-state'))
PLAYED_FILE = configured_path('WISDO_PLAYED_DELIVERIES_FILE', local_data_path('played-deliveries'))
AUDIO_OUTPUT = os.getenv('WISDO_AUDIO_OUTPUT', 'default')
WAKE_WORDS = tuple(v.strip().lower() for v in os.getenv(
    'WISDO_WAKE_WORDS', 'hey coach,hey wisdom,hey wisdo').split(',') if v.strip())
MAX_AUDIO_BYTES = int(os.getenv('WISDO_AUDIO_MAX_BYTES', '5242880'))
MAX_PLAYBACK_BYTES = int(os.getenv('WISDO_TTS_MAX_BYTES', '2097152'))
SESSION_IDLE_SECONDS = int(os.getenv('WISDO_SESSION_IDLE_SECONDS', '90'))
WAKE_SENSITIVITY = float(os.getenv('WISDO_WAKE_SENSITIVITY', '1e-20'))
WAKE_COOLDOWN_SECONDS = float(os.getenv('WISDO_WAKE_COOLDOWN_SECONDS', '2.5'))
POST_PLAYBACK_GUARD_SECONDS = float(os.getenv('WISDO_POST_PLAYBACK_GUARD_SECONDS', '1.5'))
SESSION_ID = None
SESSION_TOUCHED = 0.0
WAKE_BLOCKED_UNTIL = 0.0
LED_STATE = 'idle'
PLAYBACK = None
PLAYBACK_LOCK = threading.Lock()
PLAYBACK_INTERRUPTED = False
PRESENCE_LAST = False
PRESENCE_CHECKED_AT = 0.0
HOME_ASSISTANT_SYNCED_AT = 0.0
HOME_ASSISTANT_CONFIG_FILE = configured_path('WISDO_HOME_ASSISTANT_CONFIG_FILE', local_data_path('home-assistant.json'))
def load_seen_deliveries():
    try: return deque((line.strip() for line in PLAYED_FILE.read_text(encoding='utf-8').splitlines() if line.strip()), maxlen=256)
    except OSError: return deque(maxlen=256)


SEEN_DELIVERIES = load_seen_deliveries()


def remember_delivery(delivery_id):
    if delivery_id not in SEEN_DELIVERIES: SEEN_DELIVERIES.append(delivery_id)
    PLAYED_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = PLAYED_FILE.with_suffix('.tmp')
    temporary.write_text('\n'.join(SEEN_DELIVERIES) + '\n', encoding='utf-8')
    temporary.chmod(0o600)
    temporary.replace(PLAYED_FILE)


def headers():
    return {'Authorization': f'Bearer {TOKEN_FILE.read_text(encoding="utf-8").strip()}',
            'X-Wisdo-Device-Id': DEVICE_ID, 'Content-Type': 'application/json',
            'Accept': 'application/json'}


def validate_configuration():
    missing = []
    if not CLOUD: missing.append('WISDO_CLOUD_BASE_URL')
    if not DEVICE_ID: missing.append('WISDO_DEVICE_ID')
    if not TOKEN_FILE.is_file() or not TOKEN_FILE.read_text(encoding='utf-8').strip():
        missing.append(f'device token ({TOKEN_FILE})')
    if missing:
        raise RuntimeError('Missing WISDO configuration: ' + ', '.join(missing))


def muted():
    return MUTE_FILE.exists()


def set_led(state):
    global LED_STATE
    if state == LED_STATE:
        return
    LED_STATE = state
    LED_FILE.parent.mkdir(parents=True, exist_ok=True)
    LED_FILE.write_text(state, encoding='utf-8')
    command = os.getenv('WISDO_LED_COMMAND', '').strip()
    if command:
        subprocess.run([part.replace('{state}', state) for part in command.split()],
                       check=False, timeout=3)


def heartbeat(listening=False):
    payload = {'muted': muted(), 'listening': listening, 'ledState': LED_STATE}
    response = requests.post(f'{CLOUD}/api/voice/v1/devices/heartbeat', headers=headers(),
                             json=payload, timeout=10)
    if response.status_code == 404:
        response = requests.post(f'{CLOUD}/api/voice/v1/devices/register', headers=headers(),
                                 json={'roomId': os.getenv('WISDO_ROOM_ID', 'office'),
                                       'permissions': {'conversation': True, 'trading': True},
                                       **payload}, timeout=10)
    response.raise_for_status()


def microphone_audio(cancel_event=None, max_seconds_override=None, timeout_override=None):
    import speech_recognition as sr
    import pyaudio

    recognizer = sr.Recognizer()
    index_text = os.getenv('WISDO_MIC_DEVICE_INDEX', '').strip()
    engine = pyaudio.PyAudio()
    device_index = int(index_text) if index_text else None
    try:
        device = engine.get_device_info_by_index(device_index) if device_index is not None else engine.get_default_input_device_info()
        if device_index is None:
            device_index = int(device.get('index'))
        native_rate = max(8000, int(float(device.get('defaultSampleRate') or 16000)))
        max_channels = max(1, int(device.get('maxInputChannels') or 1))
        rate = int(os.getenv('WISDO_MIC_SAMPLE_RATE') or native_rate)
        channels = int(os.getenv('WISDO_MIC_CHANNELS') or min(2, max_channels))
        channels = max(1, min(channels, max_channels))
        channel_select = max(0, min(channels - 1, int(os.getenv('WISDO_MIC_CHANNEL_SELECT', '0'))))
        requested_format = os.getenv('WISDO_MIC_SAMPLE_FORMAT', 'AUTO').strip().upper()
        stt_rate = int(os.getenv('WISDO_STT_SAMPLE_RATE', '16000'))
        s32_shift = max(0, min(24, int(os.getenv('WISDO_MIC_S32_SHIFT', '12'))))
        chunk = max(256, int(os.getenv('WISDO_MIC_CHUNK', '1024')))

        candidates = []
        if requested_format in ('AUTO', ''):
            candidates = [(pyaudio.paInt16, 2, 'h'), (pyaudio.paInt32, 4, 'i')]
        elif requested_format in ('S32_LE', 'INT32', 'PAINT32'):
            candidates = [(pyaudio.paInt32, 4, 'i')]
        else:
            candidates = [(pyaudio.paInt16, 2, 'h')]

        stream = None
        source_width = None
        unpack_code = None
        open_errors = []
        for pa_format, width, code in candidates:
            try:
                stream = engine.open(
                    format=pa_format,
                    channels=channels,
                    rate=rate,
                    input=True,
                    input_device_index=device_index,
                    frames_per_buffer=chunk,
                )
                source_width, unpack_code = width, code
                break
            except OSError as exc:
                open_errors.append(str(exc))

        if stream is None:
            raise OSError(
                f'Unable to open microphone index {device_index} at {rate} Hz / {channels} channel(s). '
                f'Tried {requested_format or "AUTO"}: {"; ".join(open_errors)[:400]}'
            )

        max_seconds = max_seconds_override or float(os.getenv('WISDO_RECORD_MAX_SECONDS', '20'))
        timeout_seconds = timeout_override or float(os.getenv('WISDO_LISTEN_TIMEOUT_SECONDS', '8'))
        silence_seconds = float(os.getenv('WISDO_VAD_PAUSE_SECONDS', '0.8'))
        threshold = int(os.getenv('WISDO_VAD_ENERGY_THRESHOLD', '300'))
        frames, speech_started, silent_chunks = [], False, 0
        started = time.monotonic()
        try:
            while time.monotonic() - started < max_seconds:
                if cancel_event and cancel_event.is_set():
                    raise InterruptedError('Recording cancelled.')
                if muted():
                    raise InterruptedError('Recording cancelled by physical mute.')
                data = stream.read(chunk, exception_on_overflow=False)
                raw_samples = struct.unpack(f'<{len(data)//source_width}{unpack_code}', data)
                selected = raw_samples[channel_select::channels]
                if source_width == 4:
                    samples = [max(-32768, min(32767, int(value) >> s32_shift)) for value in selected]
                else:
                    samples = list(selected)
                if not samples:
                    continue
                mono16 = struct.pack(f'<{len(samples)}h', *samples)
                frames.append(mono16)
                rms = int((sum(sample * sample for sample in samples) / max(1, len(samples))) ** 0.5)
                if rms >= threshold:
                    speech_started, silent_chunks = True, 0
                elif speech_started:
                    silent_chunks += 1
                    if silent_chunks * chunk / rate >= silence_seconds:
                        break
                elif time.monotonic() - started >= timeout_seconds:
                    raise TimeoutError('No speech was detected before the listening timeout.')
        finally:
            stream.stop_stream(); stream.close()

        audio = sr.AudioData(b''.join(frames), rate, 2)
        wav = audio.get_wav_data(convert_rate=stt_rate, convert_width=2)
        duration_ms = round(len(audio.frame_data) * 1000 / (rate * 2))
        return recognizer, audio, wav, duration_ms
    finally:
        engine.terminate()

def local_wake_detect(recognizer, audio):
    global WAKE_BLOCKED_UNTIL
    if time.monotonic() < WAKE_BLOCKED_UNTIL:
        return False
    try:
        phrase = recognizer.recognize_sphinx(
            audio, keyword_entries=[(word, WAKE_SENSITIVITY) for word in WAKE_WORDS]).lower()
        matched = any(word in phrase for word in WAKE_WORDS)
        if matched:
            WAKE_BLOCKED_UNTIL = time.monotonic() + WAKE_COOLDOWN_SECONDS
        return matched
    except Exception:
        return False


def upload_utterance(wav, duration_ms):
    global SESSION_ID, SESSION_TOUCHED
    if len(wav) > MAX_AUDIO_BYTES:
        raise ValueError('Recorded utterance exceeded the configured audio limit.')
    key = str(uuid.uuid4())
    payload = {'audioBase64': base64.b64encode(wav).decode('ascii'),
               'contentType': 'audio/wav', 'durationMs': duration_ms,
               'idempotencyKey': key, 'sessionId': SESSION_ID,
               'roomId': os.getenv('WISDO_ROOM_ID', 'office')}
    last_error = None
    for attempt in range(int(os.getenv('WISDO_UPLOAD_RETRIES', '3'))):
        try:
            response = requests.post(f'{CLOUD}/api/voice/v1/utterances', headers=headers(),
                                     json=payload, timeout=75)
            response.raise_for_status()
            output = response.json()
            # Render releases have returned both {result: conversation} and
            # {result: {result: conversation}}. Unwrap either shape safely.
            result = output
            for _ in range(3):
                nested = result.get('result') if isinstance(result, dict) else None
                if not isinstance(nested, dict):
                    break
                result = nested
            SESSION_ID = result.get('sessionId') or SESSION_ID
            SESSION_TOUCHED = time.monotonic()
            speech_error = find_response_value(output, 'speechError')
            delivery_id = find_response_value(output, 'deliveryId')
            return result, speech_error, clean_transcript(output), delivery_id
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(min(4, 0.5 * (2 ** attempt)))
    raise last_error


def clean_transcript(payload):
    current = payload
    for _ in range(4):
        if not isinstance(current, dict):
            return ''
        transcript = str(current.get('transcript') or '').strip()
        if transcript:
            return transcript
        current = current.get('result')
    return ''


def find_response_value(payload, key):
    current = payload
    for _ in range(4):
        if not isinstance(current, dict):
            return None
        if current.get(key) is not None:
            return current.get(key)
        current = current.get('result')
    return None


def delivery_receipt(delivery_id, status, error=None):
    payload = {'status': status}
    if error:
        payload['errorCode'] = 'local_playback_failed'
        payload['errorMessage'] = str(error)[:240]
    requests.post(f'{CLOUD}/api/voice/v1/deliveries/{delivery_id}/receipt',
                  headers=headers(), json=payload, timeout=10).raise_for_status()


def interrupt_monitor(done, delivery_id):
    global PLAYBACK_INTERRUPTED
    while not done.is_set() and not muted():
        try:
            recognizer, audio, wav, duration_ms = microphone_audio(done, 3, 1)
            phrase = recognizer.recognize_sphinx(audio, keyword_entries=[('coach stop', 1.0), ('emergency stop', 1.0)]).lower()
            if 'coach stop' not in phrase and 'emergency stop' not in phrase:
                continue
            PLAYBACK_INTERRUPTED = True
            if PLAYBACK and PLAYBACK.poll() is None: PLAYBACK.terminate()
            requests.post(f'{CLOUD}/api/voice/v1/playback/interrupt', headers=headers(),
                          json={'reason': phrase}, timeout=10).raise_for_status()
            if 'emergency stop' in phrase:
                upload_utterance(wav, duration_ms)
            return
        except (TimeoutError, OSError, InterruptedError):
            continue
        except Exception:
            return


def local_speak(text):
    """Emergency/offline speech only. Cloud natural voice remains the normal path."""
    message = str(text)[:500]
    if IS_WINDOWS:
        escaped = message.replace("'", "''")
        command = [
            'powershell', '-NoProfile', '-NonInteractive', '-Command',
            "Add-Type -AssemblyName System.Speech; "
            "$v=New-Object System.Speech.Synthesis.SpeechSynthesizer; "
            f"$v.Speak('{escaped}')"
        ]
    else:
        command = ['espeak-ng', message]
    if shutil.which(command[0]):
        subprocess.run(command, check=False, timeout=20)


def playback_command(path, suffix):
    if IS_WINDOWS:
        escaped = str(path).replace("'", "''")
        if suffix == '.wav':
            return ['powershell', '-NoProfile', '-NonInteractive', '-Command',
                    f"(New-Object Media.SoundPlayer '{escaped}').PlaySync()"]
        return ['powershell', '-NoProfile', '-NonInteractive', '-Command',
                "Add-Type -AssemblyName presentationCore; "
                "$p=New-Object system.windows.media.mediaplayer; "
                f"$p.open([uri]'{escaped}'); $p.Play(); "
                "while(-not $p.NaturalDuration.HasTimeSpan){Start-Sleep -Milliseconds 100}; "
                "Start-Sleep -Milliseconds $p.NaturalDuration.TimeSpan.TotalMilliseconds; $p.Close()"]
    return ['aplay', '-q', '-D', AUDIO_OUTPUT, str(path)] if suffix == '.wav' else [
        'ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', str(path)]


def play_delivery(delivery):
    global PLAYBACK, PLAYBACK_INTERRUPTED, WAKE_BLOCKED_UNTIL
    delivery_id = delivery['deliveryId']
    uuid.UUID(str(delivery_id))
    if delivery_id in SEEN_DELIVERIES:
        delivery_receipt(delivery_id, 'PLAYED')
        return
    raw = base64.b64decode(delivery.get('audioBase64', ''), validate=True)
    if not raw or len(raw) > MAX_PLAYBACK_BYTES:
        raise ValueError('Speech delivery failed local size validation.')
    if hashlib.sha256(raw).hexdigest() != delivery.get('sha256'):
        raise ValueError('Speech delivery checksum mismatch.')
    content_type = delivery.get('contentType', '')
    if content_type not in ('audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'):
        raise ValueError('Speech delivery content type is not supported.')
    delivery_receipt(delivery_id, 'DELIVERED')
    suffix = '.wav' if 'wav' in content_type else '.mp3'
    path = BASE / 'data' / f'playback-{delivery_id}{suffix}'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    try:
        set_led('speaking')
        delivery_receipt(delivery_id, 'PLAYING')
        command = playback_command(path, suffix)
        with PLAYBACK_LOCK:
            PLAYBACK_INTERRUPTED = False
            PLAYBACK = subprocess.Popen(command)
            done = threading.Event()
            monitor = threading.Thread(target=interrupt_monitor, args=(done, delivery_id), daemon=True)
            monitor.start()
            while PLAYBACK.poll() is None:
                if muted():
                    PLAYBACK.terminate()
                    PLAYBACK_INTERRUPTED = True
                    delivery_receipt(delivery_id, 'CANCELLED', 'Playback interrupted by physical mute.')
                    break
                time.sleep(0.1)
            done.set()
            if PLAYBACK_INTERRUPTED:
                PLAYBACK = None
                return
            if PLAYBACK.returncode:
                raise RuntimeError(f'Audio player exited with status {PLAYBACK.returncode}.')
            PLAYBACK = None
        WAKE_BLOCKED_UNTIL = time.monotonic() + POST_PLAYBACK_GUARD_SECONDS
        remember_delivery(delivery_id)
        delivery_receipt(delivery_id, 'PLAYED')
    finally:
        PLAYBACK = None
        path.unlink(missing_ok=True)
        set_led('muted' if muted() else 'idle')


def poll_delivery(wait_ms=15000):
    response = requests.get(f'{CLOUD}/api/voice/v1/deliveries/next', headers=headers(),
                            params={'waitMs': wait_ms}, timeout=(wait_ms / 1000) + 10)
    if response.status_code == 204:
        return None
    response.raise_for_status()
    body = response.json()
    return body.get('delivery') or body


def read_presence():
    command = os.getenv('WISDO_PRESENCE_COMMAND', '').strip()
    if not command:
        return None
    completed = subprocess.run(shlex.split(command), check=False, capture_output=True, text=True, timeout=4)
    if completed.returncode != 0:
        raise RuntimeError(f'Presence sensor command exited {completed.returncode}: {(completed.stderr or "").strip()[:180]}')
    value = (completed.stdout or '').strip().lower()
    if value in ('1','true','present','occupied','home','yes','on'):
        return True
    if value in ('0','false','absent','away','empty','no','off'):
        return False
    raise RuntimeError(f'Presence sensor returned unsupported value: {value[:80]}')

def poll_presence():
    global PRESENCE_LAST, PRESENCE_CHECKED_AT
    interval = max(1.0, float(os.getenv('WISDO_PRESENCE_POLL_SECONDS', '2')))
    now = time.monotonic()
    if now - PRESENCE_CHECKED_AT < interval:
        return
    PRESENCE_CHECKED_AT = now
    current = read_presence()
    if current is None:
        return
    arrived = current and not PRESENCE_LAST
    departed = (not current) and PRESENCE_LAST
    PRESENCE_LAST = current
    if not arrived and not departed:
        return
    room = os.getenv('WISDO_PRESENCE_ROOM_ID', os.getenv('WISDO_ROOM_ID', 'trading-room')).strip() or 'trading-room'
    event = 'arrive' if arrived else 'depart'
    response = requests.post(f'{CLOUD}/api/device/v1/presence/{event}', headers=headers(), json={'roomId':room}, timeout=12)
    if response.status_code not in (202, 409):
        response.raise_for_status()
    body = response.json()
    print(f'Wisdo presence {event}:', json.dumps(body, separators=(',',':')))

def home_assistant_config():
    url = os.getenv('WISDO_HOME_ASSISTANT_URL', '').strip().rstrip('/')
    token = os.getenv('WISDO_HOME_ASSISTANT_TOKEN', '').strip()
    if url and token:
        return {'url': url, 'token': token}
    try:
        value = json.loads(HOME_ASSISTANT_CONFIG_FILE.read_text(encoding='utf-8'))
        url = str(value.get('url') or '').strip().rstrip('/')
        token = str(value.get('token') or '').strip()
        return {'url': url, 'token': token} if url and token else None
    except (OSError, ValueError, TypeError):
        return None

def save_home_assistant_config(value):
    url = str(value.get('url') or '').strip().rstrip('/')
    token = str(value.get('token') or '').strip()
    if not (url.startswith('http://') or url.startswith('https://')) or not token:
        raise ValueError('Home Assistant URL/token are invalid.')
    response = requests.get(url + '/api/', headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'}, timeout=10)
    response.raise_for_status()
    HOME_ASSISTANT_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = HOME_ASSISTANT_CONFIG_FILE.with_suffix('.tmp')
    temporary.write_text(json.dumps({'url':url,'token':token}), encoding='utf-8')
    temporary.chmod(0o600)
    temporary.replace(HOME_ASSISTANT_CONFIG_FILE)
    return {'url':url,'verified':True}

def ha_headers(config):
    return {'Authorization':f'Bearer {config["token"]}','Content-Type':'application/json'}

HA_ACTIONS = {
    'light':['turn_on','turn_off','toggle','set_brightness','set_color_temp','set_rgb_color'],
    'switch':['turn_on','turn_off','toggle'],
    'scene':['activate'],
    'climate':['set_temperature','set_hvac_mode'],
    'lock':['lock','unlock'],
    'cover':['open_cover','close_cover','stop_cover'],
    'media_player':['turn_on','turn_off','volume_set','media_play_pause'],
    'fan':['turn_on','turn_off','set_percentage'],
}

def home_assistant_service(action, domain):
    if action == 'activate' and domain == 'scene': return 'turn_on', {}
    if action == 'set_brightness': return 'turn_on', {}
    if action == 'set_color_temp': return 'turn_on', {}
    if action == 'set_rgb_color': return 'turn_on', {}
    return action, {}

def sync_home_assistant_components(force=False):
    global HOME_ASSISTANT_SYNCED_AT
    config = home_assistant_config()
    if not config: return 0
    interval = max(15.0, float(os.getenv('WISDO_HOME_ASSISTANT_SYNC_SECONDS', '60')))
    now = time.monotonic()
    if not force and now - HOME_ASSISTANT_SYNCED_AT < interval: return 0
    response = requests.get(config['url'] + '/api/states', headers=ha_headers(config), timeout=15)
    response.raise_for_status()
    count = 0
    for entity in response.json()[:1000]:
        entity_id = str(entity.get('entity_id') or '')
        domain = entity_id.split('.',1)[0] if '.' in entity_id else ''
        actions = HA_ACTIONS.get(domain)
        if not actions: continue
        attributes = entity.get('attributes') if isinstance(entity.get('attributes'), dict) else {}
        payload = {
            'componentId': f'ha:{DEVICE_ID}:{entity_id}',
            'componentType': domain,
            'name': str(attributes.get('friendly_name') or entity_id)[:180],
            'aliases': [entity_id, str(attributes.get('friendly_name') or '').lower()],
            'capabilities': {'actions': actions, 'provider':'home_assistant'},
            'state': {'state':entity.get('state'),'brightness':attributes.get('brightness'),'temperature':attributes.get('temperature'),'hvac_mode':entity.get('state') if domain=='climate' else None},
            'metadata': {'provider':'home_assistant','entity_id':entity_id,'domain':domain,'room':str(attributes.get('area_name') or attributes.get('room') or '').strip().lower()},
        }
        registered = requests.post(f'{CLOUD}/api/control/v1/components/register', headers=headers(), json=payload, timeout=10)
        registered.raise_for_status(); count += 1
        if count >= 300: break
    HOME_ASSISTANT_SYNCED_AT = now
    return count

def execute_home_assistant(execution):
    config = home_assistant_config()
    if not config: raise RuntimeError('Home Assistant is not configured on this edge device.')
    metadata = execution.get('metadata') if isinstance(execution.get('metadata'), dict) else {}
    entity_id = str(metadata.get('entity_id') or '')
    domain = str(metadata.get('domain') or execution.get('component_type') or '')
    action = str(execution.get('action') or '')
    if not entity_id or action not in HA_ACTIONS.get(domain, []):
        raise RuntimeError('Execution does not match a discovered Home Assistant entity capability.')
    service, _ = home_assistant_service(action, domain)
    parameters = execution.get('parameters') if isinstance(execution.get('parameters'), dict) else {}
    data = {'entity_id': entity_id}
    if action == 'set_brightness': data['brightness_pct'] = max(1, min(100, int(parameters.get('brightness_pct', 50))))
    elif action == 'set_color_temp': data['color_temp_kelvin'] = int(parameters.get('color_temp_kelvin', parameters.get('kelvin', 3000)))
    elif action == 'set_rgb_color':
        rgb = parameters.get('rgb_color', [255,255,255]); data['rgb_color'] = [max(0,min(255,int(x))) for x in list(rgb)[:3]]
    elif action == 'set_temperature': data['temperature'] = float(parameters.get('temperature'))
    elif action == 'set_hvac_mode': data['hvac_mode'] = str(parameters.get('hvac_mode') or 'auto')
    elif action == 'volume_set': data['volume_level'] = max(0.0,min(1.0,float(parameters.get('volume_level',.5))))
    elif action == 'set_percentage': data['percentage'] = max(0,min(100,int(parameters.get('percentage',50))))
    response = requests.post(f'{config["url"]}/api/services/{domain}/{service}', headers=ha_headers(config), json=data, timeout=12)
    response.raise_for_status()
    state_response = requests.get(f'{config["url"]}/api/states/{entity_id}', headers=ha_headers(config), timeout=10)
    state_response.raise_for_status()
    state = state_response.json()
    return {'entityId':entity_id,'domain':domain,'action':action,'state':state.get('state'),'attributes':state.get('attributes',{})}

def poll_home_assistant_executions():
    if not home_assistant_config(): return
    response = requests.post(f'{CLOUD}/api/control/v1/executions/lease', headers=headers(), json={'limit':12}, timeout=10)
    response.raise_for_status()
    for execution in response.json().get('executions', []):
        try:
            result = execute_home_assistant(execution)
            payload = {'status':'completed','result':result,'message':'Home Assistant verified the requested device state.'}
        except Exception as exc:
            payload = {'status':'failed','result':{},'error':str(exc)[:500]}
        requests.post(f'{CLOUD}/api/control/v1/executions/{execution["execution_id"]}/complete', headers=headers(), json=payload, timeout=10).raise_for_status()

def configure_home_assistant(secret_id):
    response = requests.get(f'{CLOUD}/api/agent/v1/secrets/{secret_id}', headers=headers(), timeout=12)
    response.raise_for_status()
    secret = response.json().get('secret', {})
    if secret.get('name') != 'home_assistant' or not isinstance(secret.get('value'), dict):
        raise RuntimeError('One-time Home Assistant configuration secret is invalid.')
    result = save_home_assistant_config(secret['value'])
    sync_home_assistant_components(True)
    return result

def wake_trading_workstation():
    raw = os.getenv('WISDO_TRADING_WORKSTATION_MAC', '').replace(':','').replace('-','').strip()
    if len(raw) != 12 or any(ch not in '0123456789abcdefABCDEF' for ch in raw):
        raise RuntimeError('WISDO_TRADING_WORKSTATION_MAC is not configured with a valid 12-hex-digit MAC address.')
    mac = bytes.fromhex(raw)
    packet = b'\xff' * 6 + mac * 16
    broadcast = os.getenv('WISDO_WOL_BROADCAST', '255.255.255.255').strip() or '255.255.255.255'
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sent = sock.sendto(packet, (broadcast, 9))
        if sent != len(packet):
            raise RuntimeError('Wake-on-LAN packet was not fully transmitted.')
    finally:
        sock.close()
    return {'macSuffix': raw[-4:].upper(), 'broadcast': broadcast, 'bytes': len(packet)}

def poll_device_commands():
    response = requests.post(f'{CLOUD}/api/agent/v1/commands/lease', headers=headers(), json={'limit': 4}, timeout=10)
    response.raise_for_status()
    for command in response.json().get('commands', []):
        intent = str(command.get('intent') or '').lower()
        status, result, message = 'rejected', {}, f'Intent {intent} is not supported by this Pi edge device.'
        if intent == 'wake_trading_workstation':
            try:
                result = wake_trading_workstation()
                status, message = 'completed', 'Wake-on-LAN packet verified and sent to the configured trading workstation.'
            except Exception as exc:
                status, message = 'failed', str(exc)
        elif intent == 'configure_home_assistant':
            try:
                result = configure_home_assistant(str((command.get('parameters') or {}).get('secretId') or ''))
                status, message = 'completed', 'Home Assistant connection verified, stored locally, and entities synchronized.'
            except Exception as exc:
                status, message = 'failed', str(exc)
        requests.post(
            f'{CLOUD}/api/agent/v1/commands/{command["command_id"]}/complete',
            headers=headers(), json={'status':status,'result':result,'message':message}, timeout=10
        ).raise_for_status()

def console_utterance(text):
    # Console mode is diagnostic only; physical mode always sends recorded audio for server STT.
    response = requests.post(f'{CLOUD}/api/voice/v1/conversation', headers=headers(),
                             json={'text': text, 'sessionId': SESSION_ID, 'includeAudio': False},
                             timeout=60)
    response.raise_for_status()
    return response.json()


def main():
    global SESSION_ID
    validate_configuration()
    set_led('muted' if muted() else 'idle')
    heartbeat(False)
    print(f'Wisdo Edge ready on {platform.system()} ({DEVICE_ID}).')
    print('Say "Hey Coach" once, then speak naturally. Press Ctrl+C to stop.')
    console = os.getenv('WISDO_CONSOLE_MODE', 'false').lower() == 'true'
    while True:
        try:
            if SESSION_ID and time.monotonic() - SESSION_TOUCHED > SESSION_IDLE_SECONDS:
                SESSION_ID = None
            poll_presence()
            # Presence can enqueue a Wake-on-LAN command for this Pi; lease it
            # immediately before entering the microphone wait.
            poll_device_commands()
            sync_home_assistant_components()
            poll_home_assistant_executions()
            if muted():
                set_led('muted'); heartbeat(False); time.sleep(0.5); continue
            delivery = poll_delivery(0)
            if delivery:
                try: play_delivery(delivery)
                except Exception as exc:
                    delivery_receipt(delivery['deliveryId'], 'FAILED', exc)
                continue
            set_led('listening'); heartbeat(True)
            if console:
                text = input('You> ').strip()
                if text:
                    result = console_utterance(text)
                    print('Coach>', result.get('text', ''))
                continue
            recognizer, audio, wav, duration_ms = microphone_audio()
            if SESSION_ID is None and not local_wake_detect(recognizer, audio):
                continue
            set_led('processing'); heartbeat(False)
            result, speech_error, transcript, delivery_id = upload_utterance(wav, duration_ms)
            if transcript:
                print('Heard>', transcript)
            reply = str(result.get('text') or result.get('responseText') or '').strip()
            if reply:
                print('Coach>', reply)
            else:
                print('Coach response unavailable. State:', result.get('state', 'unknown'))
            delivery = poll_delivery(10000)
            if delivery:
                try: play_delivery(delivery)
                except Exception as exc:
                    delivery_receipt(delivery['deliveryId'], 'FAILED', exc)
                    if reply: local_speak(reply)
            elif reply:
                reason = speech_error.get('code') if isinstance(speech_error, dict) else 'delivery_missing'
                print('Cloud voice unavailable; using Windows voice fallback:', reason)
                local_speak(reply)
        except (KeyboardInterrupt, EOFError):
            break
        except TimeoutError:
            # Normal silence is not a device fault and should not flood the console.
            set_led('idle')
            continue
        except Exception as exc:
            set_led('error')
            print('Wisdo edge error:', str(exc)[:240])
            if isinstance(exc, (requests.RequestException, ConnectionError)):
                local_speak('Coach is temporarily offline. No trading changes were made.')
            time.sleep(1)
        finally:
            try: heartbeat(False)
            except Exception: pass
            if LED_STATE not in ('speaking', 'muted'): set_led('idle')


if __name__ == '__main__':
    main()
