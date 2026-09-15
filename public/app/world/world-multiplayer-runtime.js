import * as THREE from 'three';
import { createWorldRealtimeClient } from './world-realtime-client.js';

const REMOTE_LERP = 0.22;
const remotePlayers = new Map();
let selfId = null;
let activeScene = new URLSearchParams(location.search).get('scene') || 'home';
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
    #wisdoMultiplayer[data-state="reconnecting"],#wisdoMultiplayer[data-state="connecting"] .wm-dot{background:#ffd479;box-shadow:0 0 14px rgba(255,212,121,.7)}
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
  hud.innerHTML = `<div class="wm-head"><i class="wm-dot"></i><span>WORLD LINK</span><strong id="wisdoMultiplayerCount">—</strong></div><small class="wm-status" id="wisdoMultiplayerStatus">Realtime standing by</small><small class="wm-event" id="wisdoMultiplayerEvent"></small><button id="wisdoMultiplayerPulse" type="button" disabled>SYNC PULSE</button>`;
  document.body.appendChild(hud);
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
  pulseButton.disabled = !(state === 'online' && activeScene === 'central');
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
  ctx.roundRect?.(8, 18, 496, 92, 26); ctx.fill?.();
  ctx.font = '700 38px Inter, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#eaffff';
  ctx.fillText(cleanLabel(text), 256, 64, 450);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material); sprite.scale.set(2.2, .55, 1); sprite.position.set(0, 2.75, 0); sprite.userData.wisdoDisposableTexture = texture;
  return sprite;
}

function createRemoteOperator(player) {
  const root = new THREE.Group(); root.name = `WisdoRemoteOperator:${player.id}`;
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
  root.add(makeLabel(player.displayName || 'Operator'));
  root.position.set(Number(player.x || 0), Number(player.y || 0), Number(player.z || 0)); root.rotation.y = Number(player.yaw || 0);
  root.userData.targetPosition = root.position.clone(); root.userData.targetYaw = root.rotation.y; root.userData.state = player.state || 'IDLE';
  return root;
}

function disposeRemote(root) {
  root?.removeFromParent?.();
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) { material.map?.dispose?.(); material.dispose?.(); }
    }
    node.userData?.wisdoDisposableTexture?.dispose?.();
  });
}

function removeRemote(id) {
  const record = remotePlayers.get(id); if (!record) return; disposeRemote(record.root); remotePlayers.delete(id);
}

function presenceToPlayer(row = {}) {
  const position = row.position || {};
  const rotation = row.rotation || {};
  return {
    id: String(row.userId || row.id || ''),
    displayName: row.displayName || 'Operator',
    title: row.title || 'Operator',
    x: Number(position.x ?? row.x ?? 0), y: Number(position.y ?? row.y ?? 0), z: Number(position.z ?? row.z ?? 0),
    yaw: Number(rotation.y ?? row.yaw ?? 0),
    state: String(row.locomotionState || row.state || 'IDLE').toUpperCase(),
    updatedAt: row.updatedAt,
  };
}

function upsertRemote(row) {
  const player = presenceToPlayer(row);
  if (!player.id || String(player.id) === String(selfId)) return;
  const id = player.id;
  let record = remotePlayers.get(id);
  if (!record) { record = { player: { ...player }, root: createRemoteOperator(player) }; remotePlayers.set(id, record); }
  else record.player = { ...record.player, ...player };
  record.root.userData.targetPosition.set(player.x, player.y, player.z);
  record.root.userData.targetYaw = player.yaw;
  record.root.userData.state = player.state || record.root.userData.state || 'IDLE';
  const scene = globalThis.WisdoWorldScene; if (scene && record.root.parent !== scene) scene.add(record.root);
}

function applyRoster(roster = []) {
  const seen = new Set();
  for (const row of roster) {
    const id = String(row.userId || row.id || '');
    if (!id || id === String(selfId)) continue;
    seen.add(id); upsertRemote(row);
  }
  for (const id of [...remotePlayers.keys()]) if (!seen.has(id)) removeRemote(id);
  countEl.textContent = `${roster.length} ONLINE`;
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
    record.root.position.lerp(record.root.userData.targetPosition, REMOTE_LERP);
    record.root.rotation.y = angleLerp(record.root.rotation.y, Number(record.root.userData.targetYaw || 0), REMOTE_LERP);
  }
}

function flashEvent(text) {
  eventEl.textContent = cleanLabel(text);
  clearTimeout(flashEvent.timer); flashEvent.timer = setTimeout(() => { eventEl.textContent = ''; }, 4200);
}

function handleRealtimeEvent(event = {}) {
  const id = event.eventId || event.id || '';
  if (id && id === lastPulseId) return; if (id) lastPulseId = id;
  const type = String(event.type || '');
  if (type === 'world-pulse') flashEvent(`${event.displayName || 'Operator'}: ${event.label || 'SYNC PULSE'}`);
  else if (type === 'operator-joined') flashEvent(`${event.displayName || 'Operator'} entered`);
  else if (type === 'operator-left') flashEvent('Operator left');
  else if (type === 'bot.signal.created') flashEvent(`${event.symbol || event.envelope?.payload?.symbol || 'MARKET'} SIGNAL`);
  else if (type === 'reporter.offline') flashEvent('REPORTER OFFLINE');
  else if (type === 'reporter.online') flashEvent('REPORTER ONLINE');
}

async function resolveSelf() {
  try {
    const response = await fetch('/api/presence/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    selfId = String(payload?.user?.id || payload?.identity?.userId || payload?.profile?.userId || payload?.userId || '');
  } catch {}
}

const realtime = createWorldRealtimeClient({
  initialScene: activeScene,
  onStatus: (next) => {
    const mode = next.mode === 'external-gateway' ? 'Distributed World gateway' : next.state === 'standby' ? 'Realtime standby' : 'WISDO Core realtime fallback';
    setStatus(next.state === 'online' ? 'online' : next.state === 'reconnecting' || next.state === 'connecting' ? 'reconnecting' : 'offline', mode, Number(next.online || 0));
  },
  onRoster: applyRoster,
  onEvent: handleRealtimeEvent,
});

globalThis.WisdoWorldRealtime = realtime;

async function sendPulse() {
  if (activeScene !== 'central' || realtime.mode !== 'online') return;
  const config = realtime.snapshot?.config;
  if (config?.mode === 'external-gateway') {
    flashEvent('SYNC PULSE moves to the social-event channel in the next transport gate.');
    return;
  }
  pulseButton.disabled = true;
  try {
    const response = await fetch('/api/world/realtime/pulse', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instance: 'central', label: 'SYNC PULSE' }),
    });
    const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  } catch (error) { flashEvent(error.message); }
  setTimeout(() => { pulseButton.disabled = realtime.mode !== 'online'; }, 1300);
}

pulseButton.addEventListener('click', sendPulse);

window.addEventListener('wisdo:world-player-state', (event) => {
  const detail = event.detail || {};
  realtime.updatePlayerState({
    scene: activeScene,
    telemetry: { player: { x: detail.x, y: detail.y, z: detail.z, yaw: detail.yaw, state: detail.state } },
    locomotionState: detail.state,
    rotation: { x: 0, y: Number(detail.yaw || 0), z: 0 },
    velocity: detail.velocity || null,
  });
});

window.addEventListener('wisdo:game-scene', async (event) => {
  activeScene = String(event.detail?.scene || 'central');
  for (const id of [...remotePlayers.keys()]) removeRemote(id);
  await realtime.setScene(activeScene);
});

window.addEventListener('wisdo:world-renderer-ready', () => {
  const scene = globalThis.WisdoWorldScene; if (!scene) return;
  for (const record of remotePlayers.values()) if (record.root.parent !== scene) scene.add(record.root);
});

window.addEventListener('pagehide', () => {
  destroyed = true;
  realtime.stop();
  for (const id of [...remotePlayers.keys()]) removeRemote(id);
}, { once: true });

await resolveSelf();
await realtime.start();
animate();
