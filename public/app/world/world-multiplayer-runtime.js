import * as THREE from 'three';

const INSTANCE = 'central';
const REMOTE_LERP = 0.22;
const remotePlayers = new Map();
let eventSource = null;
let selfId = null;
let activeScene = new URLSearchParams(location.search).get('scene') || null;
let connected = false;
let poseSending = false;
let pendingPose = null;
let lastPulseId = null;
let destroyed = false;

function installHud() {
  if (document.getElementById('wisdoMultiplayer')) return document.getElementById('wisdoMultiplayer');
  const style = document.createElement('style');
  style.textContent = `
    #wisdoMultiplayer{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(96px,calc(env(safe-area-inset-bottom) + 84px));z-index:70;min-width:208px;padding:11px 12px;border:1px solid rgba(112,231,245,.28);border-radius:13px;background:rgba(4,13,22,.82);box-shadow:0 14px 36px rgba(0,0,0,.38);backdrop-filter:blur(14px);font-family:Inter,system-ui,sans-serif;color:#eefcff;pointer-events:auto}
    #wisdoMultiplayer .wm-head{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    #wisdoMultiplayer .wm-dot{width:8px;height:8px;border-radius:999px;background:#6d7c86;box-shadow:0 0 0 3px rgba(109,124,134,.12)}
    #wisdoMultiplayer[data-state="online"] .wm-dot{background:#63f2bd;box-shadow:0 0 14px rgba(99,242,189,.8)}
    #wisdoMultiplayer[data-state="reconnecting"] .wm-dot{background:#ffd479;box-shadow:0 0 14px rgba(255,212,121,.7)}
    #wisdoMultiplayer .wm-status{display:block;margin-top:6px;color:#9eb9c8;font-size:11px;line-height:1.35}
    #wisdoMultiplayer .wm-event{display:block;min-height:15px;margin-top:4px;color:#70e7f5;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px}
    #wisdoMultiplayer button{margin-top:8px;width:100%;border:1px solid rgba(112,231,245,.3);border-radius:9px;background:rgba(112,231,245,.09);color:#eaffff;padding:7px 9px;font-size:10px;font-weight:800;letter-spacing:.1em;cursor:pointer}
    #wisdoMultiplayer button:disabled{opacity:.42;cursor:not-allowed}
    @media(max-width:760px){#wisdoMultiplayer{left:12px;right:auto;bottom:164px;min-width:176px;padding:9px 10px}#wisdoMultiplayer .wm-status{font-size:10px}}
  `;
  document.head.appendChild(style);
  const hud = document.createElement('aside');
  hud.id = 'wisdoMultiplayer';
  hud.dataset.state = 'offline';
  hud.innerHTML = `<div class="wm-head"><i class="wm-dot"></i><span>MULTIPLAYER</span><strong id="wisdoMultiplayerCount">—</strong></div><small class="wm-status" id="wisdoMultiplayerStatus">Central sync standing by</small><small class="wm-event" id="wisdoMultiplayerEvent"></small><button id="wisdoMultiplayerPulse" type="button" disabled>SYNC PULSE</button>`;
  document.body.appendChild(hud);
  hud.querySelector('#wisdoMultiplayerPulse')?.addEventListener('click', sendPulse);
  return hud;
}

const hud = installHud();
const countEl = hud.querySelector('#wisdoMultiplayerCount');
const statusEl = hud.querySelector('#wisdoMultiplayerStatus');
const eventEl = hud.querySelector('#wisdoMultiplayerEvent');
const pulseButton = hud.querySelector('#wisdoMultiplayerPulse');

function setStatus(state, message, count = null) {
  hud.dataset.state = state;
  statusEl.textContent = message;
  if (count !== null) countEl.textContent = `${count} ONLINE`;
  pulseButton.disabled = state !== 'online';
}

function cleanLabel(value) {
  return String(value || 'Operator').replace(/[<>]/g, '').slice(0, 36);
}

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(2,10,18,.82)';
  ctx.roundRect?.(8, 18, 496, 92, 26);
  ctx.fill?.();
  ctx.font = '700 38px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eaffff';
  ctx.fillText(cleanLabel(text), 256, 64, 450);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.2, .55, 1);
  sprite.position.set(0, 2.75, 0);
  sprite.userData.wisdoDisposableTexture = texture;
  return sprite;
}

function createRemoteOperator(player) {
  const root = new THREE.Group();
  root.name = `WisdoRemoteOperator:${player.id}`;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1b252d, roughness: .48, metalness: .22 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x70e7f5, emissive: 0x0b5260, emissiveIntensity: .7, roughness: .24, metalness: .48 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: 0x96654c, roughness: .62, metalness: 0 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.58, .82, .34), bodyMaterial); torso.position.y = 1.3; torso.castShadow = true; root.add(torso);
  const core = new THREE.Mesh(new THREE.BoxGeometry(.18, .07, .04), accentMaterial); core.position.set(0, 1.43, -.2); root.add(core);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.23, 16, 12), skinMaterial); head.position.y = 2.02; head.castShadow = true; root.add(head);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.16, .68, .18), bodyMaterial); arm.position.set(side * .4, 1.28, 0); arm.castShadow = true; root.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.2, .78, .24), bodyMaterial); leg.position.set(side * .16, .45, 0); leg.castShadow = true; root.add(leg);
  }
  root.add(makeLabel(player.displayName || player.cultureId || 'Operator'));
  root.position.set(Number(player.x || 0), Number(player.y || 0), Number(player.z || 0));
  root.rotation.y = Number(player.yaw || 0);
  root.userData.targetPosition = root.position.clone();
  root.userData.targetYaw = root.rotation.y;
  root.userData.state = player.state || 'IDLE';
  return root;
}

function disposeRemote(root) {
  root?.removeFromParent?.();
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        material.map?.dispose?.();
        material.dispose?.();
      }
    }
    node.userData?.wisdoDisposableTexture?.dispose?.();
  });
}

function removeRemote(id) {
  const record = remotePlayers.get(id);
  if (!record) return;
  disposeRemote(record.root);
  remotePlayers.delete(id);
}

function upsertRemote(player) {
  if (!player?.id || String(player.id) === String(selfId)) return;
  const id = String(player.id);
  let record = remotePlayers.get(id);
  if (!record) {
    record = { player: { ...player }, root: createRemoteOperator(player) };
    remotePlayers.set(id, record);
  } else record.player = { ...record.player, ...player };
  record.root.userData.targetPosition.set(Number(player.x || 0), Number(player.y || 0), Number(player.z || 0));
  record.root.userData.targetYaw = Number(player.yaw || 0);
  record.root.userData.state = player.state || record.root.userData.state || 'IDLE';
  const scene = globalThis.WisdoWorldScene;
  if (scene && record.root.parent !== scene) scene.add(record.root);
}

function applySnapshot(snapshot) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const seen = new Set();
  for (const player of players) {
    if (String(player.id) === String(selfId)) continue;
    seen.add(String(player.id));
    upsertRemote(player);
  }
  for (const id of [...remotePlayers.keys()]) if (!seen.has(id)) removeRemote(id);
  setStatus('online', 'WISDO Central shared instance', Number(snapshot?.online ?? players.length));
  if (snapshot?.lastEvent) handleWorldEvent(snapshot.lastEvent);
}

function angleLerp(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function animate() {
  if (destroyed) return;
  requestAnimationFrame(animate);
  const scene = globalThis.WisdoWorldScene;
  for (const record of remotePlayers.values()) {
    if (scene && record.root.parent !== scene) scene.add(record.root);
    const target = record.root.userData.targetPosition;
    record.root.position.lerp(target, REMOTE_LERP);
    record.root.rotation.y = angleLerp(record.root.rotation.y, Number(record.root.userData.targetYaw || 0), REMOTE_LERP);
  }
}

function handleWorldEvent(event) {
  if (!event?.id || event.id === lastPulseId) return;
  lastPulseId = event.id;
  if (event.type === 'world-pulse') eventEl.textContent = `${cleanLabel(event.displayName || 'Operator')}: ${cleanLabel(event.label || 'SYNC PULSE')}`;
  else if (event.type === 'operator-joined') eventEl.textContent = `${cleanLabel(event.displayName || 'Operator')} entered Central`;
  else if (event.type === 'operator-left') eventEl.textContent = 'Operator left Central';
  else return;
  clearTimeout(handleWorldEvent.timer);
  handleWorldEvent.timer = setTimeout(() => { eventEl.textContent = ''; }, 4200);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

async function flushPose() {
  if (poseSending || !pendingPose || !connected || !selfId) return;
  poseSending = true;
  while (pendingPose && connected && selfId) {
    const pose = pendingPose; pendingPose = null;
    try { await postJson('/api/world/realtime/state', { instance: INSTANCE, ...pose }); }
    catch (error) { console.warn('WISDO multiplayer movement sync degraded', error); break; }
  }
  poseSending = false;
}

function queuePose(detail = {}) {
  if (!connected || activeScene !== INSTANCE) return;
  pendingPose = {
    x: Number(detail.x || 0), y: Number(detail.y || 0), z: Number(detail.z || 0),
    yaw: Number(detail.yaw || 0), state: String(detail.state || 'IDLE'),
  };
  flushPose();
}

async function sendPulse() {
  if (!connected) return;
  pulseButton.disabled = true;
  try { await postJson('/api/world/realtime/pulse', { instance: INSTANCE, label: 'SYNC PULSE' }); }
  catch (error) { eventEl.textContent = error.message; }
  setTimeout(() => { pulseButton.disabled = !connected; }, 1300);
}

function disconnect() {
  connected = false;
  selfId = null;
  pendingPose = null;
  eventSource?.close?.();
  eventSource = null;
  for (const id of [...remotePlayers.keys()]) removeRemote(id);
  countEl.textContent = '—';
  pulseButton.disabled = true;
}

async function connect() {
  if (destroyed || activeScene !== INSTANCE || eventSource) return;
  setStatus('reconnecting', 'Authorizing WISDO Central…');
  try {
    const auth = await fetch('/api/presence/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!auth.ok) {
      setStatus('offline', auth.status === 401 ? 'Sign in to join multiplayer' : 'Presence service unavailable');
      return;
    }
  } catch {
    setStatus('offline', 'Network unavailable');
    return;
  }

  const source = new EventSource(`/api/world/realtime/stream?instance=${encodeURIComponent(INSTANCE)}`);
  eventSource = source;
  source.addEventListener('hello', (message) => {
    const payload = JSON.parse(message.data || '{}');
    selfId = String(payload.selfId || '');
    connected = Boolean(selfId);
    setStatus('online', 'WISDO Central shared instance');
  });
  source.addEventListener('snapshot', (message) => {
    try { applySnapshot(JSON.parse(message.data || '{}')); } catch (error) { console.warn('WISDO multiplayer snapshot ignored', error); }
  });
  source.addEventListener('player-state', (message) => {
    try { const payload = JSON.parse(message.data || '{}'); upsertRemote(payload.player); } catch (error) { console.warn('WISDO remote operator update ignored', error); }
  });
  source.addEventListener('world-event', (message) => {
    try { handleWorldEvent(JSON.parse(message.data || '{}')); } catch {}
  });
  source.onerror = () => {
    connected = false;
    pulseButton.disabled = true;
    setStatus('reconnecting', 'Realtime link reconnecting…');
  };
}

function setScene(scene) {
  activeScene = String(scene || '');
  if (activeScene === INSTANCE) connect();
  else {
    disconnect();
    setStatus('offline', 'Multiplayer is live in WISDO Central');
  }
}

window.addEventListener('wisdo:world-player-state', (event) => queuePose(event.detail));
window.addEventListener('wisdo:game-scene', (event) => setScene(event.detail?.scene));
window.addEventListener('wisdo:world-renderer-ready', () => {
  const scene = globalThis.WisdoWorldScene;
  if (!scene) return;
  for (const record of remotePlayers.values()) if (record.root.parent !== scene) scene.add(record.root);
});
window.addEventListener('pagehide', () => { destroyed = true; disconnect(); }, { once: true });

animate();
if (activeScene === INSTANCE) connect();
else setStatus('offline', 'Multiplayer is live in WISDO Central');
