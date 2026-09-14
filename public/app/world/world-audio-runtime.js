import { worldEventBus } from './world-event-bus.js';

const SURFACES = Object.freeze({ home: 'wood', central: 'stone', interior: 'stone', 'trading-tower': 'stone', observatory: 'metal', marketplace: 'stone', 'vps-forge': 'metal', 'war-room': 'metal' });

export function startWorldAudioRuntime() {
  let context = null;
  let master = null;
  let ambience = null;
  let ambienceGain = null;
  let unlocked = false;
  let stopped = false;
  let player = null;
  let lastStep = 0;
  let lastState = 'IDLE';
  const listeners = [];
  const unsubscribers = [];
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options)); };
  const subscribe = (type, handler) => { const off = worldEventBus.on(type, handler); unsubscribers.push(off); };

  function ensureContext() {
    if (stopped || unlocked) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    master = context.createGain(); master.gain.value = .16; master.connect(context.destination);
    ambienceGain = context.createGain(); ambienceGain.gain.value = .035; ambienceGain.connect(master);
    ambience = context.createOscillator(); ambience.type = 'sine'; ambience.frequency.value = 54;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 165; ambience.connect(filter); filter.connect(ambienceGain); ambience.start();
    unlocked = true;
    context.resume?.();
    window.dispatchEvent(new CustomEvent('wisdo:world-audio-ready', { detail: { unlocked: true } }));
  }

  function tone({ frequency = 440, duration = .08, gain = .035, type = 'sine', pan = 0 } = {}) {
    if (!unlocked || !context || context.state === 'suspended') return;
    const oscillator = context.createOscillator(); const amp = context.createGain(); const panner = context.createStereoPanner?.();
    oscillator.type = type; oscillator.frequency.value = frequency; amp.gain.setValueAtTime(0.0001, context.currentTime); amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), context.currentTime + .008); amp.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
    oscillator.connect(amp); if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); amp.connect(panner); panner.connect(master); } else amp.connect(master);
    oscillator.start(); oscillator.stop(context.currentTime + duration + .02); oscillator.addEventListener('ended', () => { oscillator.disconnect(); amp.disconnect(); panner?.disconnect?.(); }, { once: true });
  }

  function currentScene() { return new URL(location.href).searchParams.get('scene') || 'central'; }
  function footstepSurface() { const scene = currentScene(); return SURFACES[scene] || (scene === 'home' ? 'wood' : scene === 'central' ? 'stone' : 'metal'); }
  function footstep() {
    const surface = footstepSurface();
    if (surface === 'wood') tone({ frequency: 118, duration: .075, gain: .024, type: 'triangle' });
    else if (surface === 'metal') tone({ frequency: 184, duration: .055, gain: .021, type: 'square' });
    else tone({ frequency: 92, duration: .065, gain: .025, type: 'triangle' });
  }

  function onPlayer(event) {
    player = event.detail || null;
    if (!unlocked || !player) return;
    const now = performance.now();
    const moving = ['WALK', 'RUN', 'SPRINT'].includes(player.state);
    const cadence = player.state === 'SPRINT' ? 270 : player.state === 'RUN' ? 360 : 520;
    if (moving && now - lastStep > cadence) { lastStep = now; footstep(); }
    if (player.state === 'LAND' && lastState !== 'LAND') tone({ frequency: 76, duration: .12, gain: .036, type: 'triangle' });
    lastState = player.state;
  }

  function onScene() {
    if (!ambienceGain || !context) return;
    const scene = currentScene();
    const indoor = scene !== 'central';
    ambienceGain.gain.setTargetAtTime(indoor ? .018 : .038, context.currentTime, .35);
  }

  function onSignal(event) {
    if (!unlocked) return;
    const signal = event.detail || {};
    const direction = String(signal.direction || '').toUpperCase();
    tone({ frequency: direction === 'SELL' ? 430 : 620, duration: .12, gain: .032, type: 'sine', pan: .18 });
    setTimeout(() => tone({ frequency: direction === 'SELL' ? 320 : 820, duration: .18, gain: .024, type: 'triangle', pan: -.12 }), 95);
  }

  const unlock = () => ensureContext();
  listen(window, 'pointerdown', unlock, { once: true, passive: true });
  listen(window, 'keydown', unlock, { once: true });
  listen(window, 'wisdo:world-player-state', onPlayer);
  listen(window, 'popstate', onScene);
  listen(document, 'visibilitychange', () => { if (!context) return; if (document.hidden) context.suspend?.(); else if (unlocked) context.resume?.(); });
  subscribe('bot.signal.created', onSignal);
  subscribe('world.connection', (event) => { if (event.detail?.state === 'live' && unlocked) tone({ frequency: 520, duration: .05, gain: .01 }); });

  globalThis.WisdoWorldAudio = Object.freeze({
    get unlocked() { return unlocked; },
    get surface() { return footstepSurface(); },
    get scene() { return currentScene(); },
  });

  return Object.freeze({
    stop() {
      if (stopped) return; stopped = true; listeners.splice(0).forEach((off) => off()); unsubscribers.splice(0).forEach((off) => off());
      try { ambience?.stop?.(); } catch {} try { ambience?.disconnect?.(); } catch {} try { ambienceGain?.disconnect?.(); } catch {} try { master?.disconnect?.(); } catch {} try { context?.close?.(); } catch {}
      delete globalThis.WisdoWorldAudio;
    },
  });
}
