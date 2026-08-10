from __future__ import annotations

import base64
import hashlib
import json
import os
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
CLOUD = os.getenv('WISDO_CLOUD_BASE_URL', '').rstrip('/')
DEVICE_ID = os.getenv('WISDO_DEVICE_ID', '')
TOKEN_FILE = Path(os.getenv('WISDO_DEVICE_TOKEN_FILE', str(BASE / 'data/device-token')))
MUTE_FILE = Path(os.getenv('WISDO_MUTE_FILE', str(BASE / 'data/muted')))
LED_FILE = Path(os.getenv('WISDO_LED_STATE_FILE', str(BASE / 'data/led-state')))
PLAYED_FILE = Path(os.getenv('WISDO_PLAYED_DELIVERIES_FILE', str(BASE / 'data/played-deliveries')))
AUDIO_OUTPUT = os.getenv('WISDO_AUDIO_OUTPUT', 'default')
WAKE_WORDS = tuple(v.strip().lower() for v in os.getenv(
    'WISDO_WAKE_WORDS', 'hey coach,hey wisdom,hey wisdo').split(',') if v.strip())
MAX_AUDIO_BYTES = int(os.getenv('WISDO_AUDIO_MAX_BYTES', '5242880'))
MAX_PLAYBACK_BYTES = int(os.getenv('WISDO_TTS_MAX_BYTES', '2097152'))
SESSION_IDLE_SECONDS = int(os.getenv('WISDO_SESSION_IDLE_SECONDS', '90'))
SESSION_ID = None
SESSION_TOUCHED = 0.0
LED_STATE = 'idle'
PLAYBACK = None
PLAYBACK_LOCK = threading.Lock()
PLAYBACK_INTERRUPTED = False
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
    index = os.getenv('WISDO_MIC_DEVICE_INDEX', '').strip()
    rate, width, chunk = 16000, 2, 1024
    max_seconds = max_seconds_override or float(os.getenv('WISDO_RECORD_MAX_SECONDS', '20'))
    timeout_seconds = timeout_override or float(os.getenv('WISDO_LISTEN_TIMEOUT_SECONDS', '8'))
    silence_seconds = float(os.getenv('WISDO_VAD_PAUSE_SECONDS', '0.8'))
    threshold = int(os.getenv('WISDO_VAD_ENERGY_THRESHOLD', '300'))
    frames, speech_started, silent_chunks = [], False, 0
    engine = pyaudio.PyAudio()
    stream = engine.open(format=pyaudio.paInt16, channels=1, rate=rate, input=True,
                         input_device_index=int(index) if index else None,
                         frames_per_buffer=chunk)
    started = time.monotonic()
    try:
        while time.monotonic() - started < max_seconds:
            if cancel_event and cancel_event.is_set():
                raise InterruptedError('Recording cancelled.')
            if muted():
                raise InterruptedError('Recording cancelled by physical mute.')
            data = stream.read(chunk, exception_on_overflow=False)
            frames.append(data)
            samples = struct.unpack(f'<{len(data)//2}h', data)
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
        stream.stop_stream(); stream.close(); engine.terminate()
    audio = sr.AudioData(b''.join(frames), rate, width)
    wav = audio.get_wav_data(convert_rate=rate, convert_width=width)
    duration_ms = round(len(audio.frame_data) * 1000 / (rate * width))
    return recognizer, audio, wav, duration_ms


def local_wake_detect(recognizer, audio):
    try:
        phrase = recognizer.recognize_sphinx(
            audio, keyword_entries=[(word, 1.0) for word in WAKE_WORDS]).lower()
        return any(word in phrase for word in WAKE_WORDS)
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
            result = output.get('result') or output
            SESSION_ID = result.get('sessionId') or SESSION_ID
            SESSION_TOUCHED = time.monotonic()
            return result, output.get('speechError')
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(min(4, 0.5 * (2 ** attempt)))
    raise last_error


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
    subprocess.run(['espeak-ng', str(text)[:500]], check=False, timeout=20)


def play_delivery(delivery):
    global PLAYBACK, PLAYBACK_INTERRUPTED
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
        command = ['aplay', '-q', '-D', AUDIO_OUTPUT, str(path)] if suffix == '.wav' else [
            'ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', str(path)]
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


def console_utterance(text):
    # Console mode is diagnostic only; physical mode always sends recorded audio for server STT.
    response = requests.post(f'{CLOUD}/api/voice/v1/conversation', headers=headers(),
                             json={'text': text, 'sessionId': SESSION_ID, 'includeAudio': False},
                             timeout=60)
    response.raise_for_status()
    return response.json()


def main():
    global SESSION_ID
    set_led('muted' if muted() else 'idle')
    heartbeat(False)
    print('Wisdo Edge local-wake/server-STT gateway ready.')
    console = os.getenv('WISDO_CONSOLE_MODE', 'false').lower() == 'true'
    while True:
        try:
            if SESSION_ID and time.monotonic() - SESSION_TOUCHED > SESSION_IDLE_SECONDS:
                SESSION_ID = None
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
            result, speech_error = upload_utterance(wav, duration_ms)
            print('Coach>', result.get('text', ''))
            if speech_error and result.get('text'):
                local_speak(result['text'])
            delivery = poll_delivery(5000)
            if delivery:
                try: play_delivery(delivery)
                except Exception as exc:
                    delivery_receipt(delivery['deliveryId'], 'FAILED', exc)
        except (KeyboardInterrupt, EOFError):
            break
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
