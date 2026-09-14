import { WORLD_BUILD, WORLD_BUILD_ID } from './world-build.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)); }
  catch { return `$${Number(value || 0).toFixed(2)}`; }
};

function addDisposable(list, item) { if (item) list.push(item); return item; }
function glowMaterial(THREE, color, opacity = .9) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
}

function screenTexture(THREE, title, lines = [], { accent = '#70e8ff', gold = '#e0bb68', width = 1024, height = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, 'rgba(2,7,16,.98)');
  g.addColorStop(.55, 'rgba(7,18,38,.96)');
  g.addColorStop(1, 'rgba(4,8,20,.98)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent; ctx.lineWidth = 8; ctx.shadowColor = accent; ctx.shadowBlur = 28;
  ctx.strokeRect(18, 18, width - 36, height - 36); ctx.shadowBlur = 0;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7fbff'; ctx.font = '900 62px Inter,system-ui,sans-serif'; ctx.fillText(String(title).toUpperCase(), 54, 90);
  ctx.fillStyle = accent; ctx.font = '750 30px Inter,system-ui,sans-serif';
  lines.slice(0, 6).forEach((line, index) => {
    ctx.fillStyle = index === lines.length - 1 ? gold : index % 2 ? '#e8f6ff' : accent;
    ctx.fillText(String(line), 58, 165 + index * 52);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, texture, ctx };
}

function makeStorefront(THREE, root, disposables, { id, name, subtitle, position, accent = 0x70e8ff, warm = false }) {
  const group = new THREE.Group(); group.name = id; group.position.set(...position); root.add(group);
  const frame = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x0d1320, roughness: .31, metalness: .8 }));
  const glass = addDisposable(disposables, new THREE.MeshPhysicalMaterial({ color: warm ? 0x6b4526 : 0x153f58, roughness: .12, metalness: .18, transparent: true, opacity: .82, clearcoat: 1, emissive: warm ? 0x321501 : 0x021823, emissiveIntensity: warm ? .7 : .45 }));
  const accentMat = addDisposable(disposables, glowMaterial(THREE, accent, .9));
  const facade = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(9.6, 4.8, .32)), glass); facade.position.y = 2.45; group.add(facade);
  const canopy = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(10.4, .34, 2.1)), frame); canopy.position.set(0, 4.75, -1.0); group.add(canopy);
  for (const x of [-4.65, 4.65]) { const edge = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.16, 4.9, .18)), accentMat); edge.position.set(x, 2.45, -.2); group.add(edge); }
  const door = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(2.1, 3.35, .16)), frame); door.position.set(0, 1.72, -.3); group.add(door);
  const signData = screenTexture(THREE, name, [subtitle, 'WISDO WORLD'], { accent: `#${accent.toString(16).padStart(6, '0')}`, gold: warm ? '#f0bb68' : '#e0bb68', width: 1024, height: 320 });
  addDisposable(disposables, signData.texture);
  const sign = new THREE.Mesh(addDisposable(disposables, new THREE.PlaneGeometry(8.4, 2.55)), addDisposable(disposables, new THREE.MeshBasicMaterial({ map: signData.texture, toneMapped: false })));
  sign.name = `${id}-Sign`; sign.position.set(0, 6.05, -.44); group.add(sign);
  const floorGlow = new THREE.Mesh(addDisposable(disposables, new THREE.PlaneGeometry(9.5, 2.1)), addDisposable(disposables, new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .12, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(0, .055, -1.5); group.add(floorGlow);
  group.userData.worldObject = { id, type: 'business', displayName: name, interactionRadius: 3.5, prompt: 'ENTER', action: 'waypoint', permissions: 'member', cooldown: 300 };
  return group;
}

function createPalm(THREE, root, disposables, index, x, z, scale = 1) {
  const palm = new THREE.Group(); palm.name = `WisdoPalm-${index}`; palm.position.set(x, 0, z); palm.scale.setScalar(scale); root.add(palm);
  const trunkMat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x5c4b3c, roughness: .95, metalness: 0 }));
  const leafMat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x173e37, roughness: .8, metalness: .06, side: THREE.DoubleSide, emissive: 0x04100d, emissiveIntensity: .25 }));
  const trunk = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.22, .38, 5.6, 10)), trunkMat); trunk.position.y = 2.8; trunk.rotation.z = (index % 3 - 1) * .035; palm.add(trunk);
  const fronds = new THREE.Group(); fronds.position.y = 5.55; palm.add(fronds);
  for (let i = 0; i < 10; i += 1) {
    const blade = new THREE.Mesh(addDisposable(disposables, new THREE.PlaneGeometry(3.4, .46, 3, 1)), leafMat);
    blade.geometry.translate(1.55, 0, 0); blade.rotation.y = i / 10 * TAU; blade.rotation.z = -.22 - (i % 3) * .06; blade.rotation.x = (i % 2 ? .12 : -.12); fronds.add(blade);
  }
  return { palm, fronds, phase: index * .52 };
}

function createNpc(THREE, root, disposables, index, route, accent = 0x70e8ff) {
  const npc = new THREE.Group(); npc.name = `WisdoNPC-${index}`; root.add(npc);
  const cloth = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0x151925 : 0x0d1118, roughness: .54, metalness: .25 }));
  const skin = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: [0x6c4637, 0x8b5e49, 0xa87959, 0x5d3d31][index % 4], roughness: .78 }));
  const light = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .8, roughness: .22, metalness: .45 }));
  const torso = new THREE.Mesh(addDisposable(disposables, new THREE.CapsuleGeometry(.22, .54, 4, 8)), cloth); torso.position.y = 1.23; torso.scale.z = .68; npc.add(torso);
  const head = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.16, 12, 9)), skin); head.position.y = 1.89; head.scale.set(.92, 1.1, .92); npc.add(head);
  const badge = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(.12, .035, .025)), light); badge.position.set(0, 1.35, -.2); npc.add(badge);
  const limbs = {};
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .28, 1.45, 0); const upper = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.055, .068, .52, 8)), cloth); upper.position.y = -.26; arm.add(upper); npc.add(arm);
    const leg = new THREE.Group(); leg.position.set(side * .11, .82, 0); const lower = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.065, .083, .72, 8)), cloth); lower.position.y = -.36; leg.add(lower); npc.add(leg);
    limbs[side < 0 ? 'la' : 'ra'] = arm; limbs[side < 0 ? 'll' : 'rl'] = leg;
  }
  npc.position.set(route[0][0], 0, route[0][1]);
  npc.userData.worldObject = { id: `npc-${index}`, type: 'npc', displayName: index % 3 === 0 ? 'WISDO Student' : 'WISDO Trader', prompt: 'TALK', interactionRadius: 2.2 };
  return { npc, limbs, route, segment: 0, t: (index * .19) % 1, speed: .34 + (index % 4) * .05, phase: index * .7 };
}

function createCoach(THREE, root, disposables) {
  const group = new THREE.Group(); group.name = 'WisdoCoachHologram'; group.position.set(29, 0, -15); root.add(group);
  const holo = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x65e8ff, emissive: 0x1596bc, emissiveIntensity: 2.1, transparent: true, opacity: .66, roughness: .18, metalness: .2, depthWrite: false }));
  const torso = new THREE.Mesh(addDisposable(disposables, new THREE.CapsuleGeometry(.28, .65, 5, 10)), holo); torso.position.y = 1.35; torso.scale.z = .72; group.add(torso);
  const head = new THREE.Mesh(addDisposable(disposables, new THREE.SphereGeometry(.2, 16, 12)), holo); head.position.y = 2.12; head.scale.set(.92, 1.08, .92); group.add(head);
  for (const side of [-1, 1]) { const arm = new THREE.Mesh(addDisposable(disposables, new THREE.CylinderGeometry(.06, .075, .68, 8)), holo); arm.position.set(side * .38, 1.38, 0); arm.rotation.z = side * .12; group.add(arm); }
  const ring = new THREE.Mesh(addDisposable(disposables, new THREE.TorusGeometry(1.05, .035, 8, 48)), addDisposable(disposables, glowMaterial(THREE, 0x70e8ff, .75))); ring.rotation.x = Math.PI / 2; ring.position.y = .08; group.add(ring);
  const labelData = screenTexture(THREE, 'WISDO COACH', ['MARKETS · DISCIPLINE · GROWTH', 'ASK COACH'], { accent: '#70e8ff', width: 900, height: 280 }); addDisposable(disposables, labelData.texture);
  const label = new THREE.Sprite(addDisposable(disposables, new THREE.SpriteMaterial({ map: labelData.texture, transparent: true, depthWrite: false, toneMapped: false }))); label.position.set(0, 3.25, 0); label.scale.set(5.4, 1.7, 1); group.add(label);
  group.userData.worldObject = { id: 'wisdo-coach', type: 'coach', displayName: 'WISDO Coach', prompt: 'TALK', interactionRadius: 3, action: 'coach' };
  return { group, ring, material: holo };
}

function createLiveTradeHologram(THREE, root, disposables) {
  const display = screenTexture(THREE, 'LIVE TRADES', ['NO LIVE ACCOUNT', 'CONNECT REPORTER TO ACTIVATE'], { accent: '#70e8ff', width: 1024, height: 620 });
  addDisposable(disposables, display.texture);
  const material = addDisposable(disposables, new THREE.SpriteMaterial({ map: display.texture, transparent: true, opacity: .9, depthWrite: false, toneMapped: false }));
  const sprite = new THREE.Sprite(material); sprite.name = 'WisdoLiveTradeHologram'; sprite.position.set(6, 5.8, 18); sprite.scale.set(9.2, 5.6, 1); root.add(sprite);
  let signature = '';
  function update(snapshot) {
    const live = snapshot?.homeRuntime?.live || snapshot?.worldData || {};
    const financial = live.financial;
    const positions = Array.isArray(live.positions) ? live.positions : [];
    const currency = financial?.currency || 'USD';
    const rows = positions.slice(0, 4).map((position) => {
      const pl = Number(position.floatingPL || 0);
      return `${String(position.symbol || 'TRADE').padEnd(8, ' ')} ${String(position.direction || '').toUpperCase().padEnd(4, ' ')} ${money(pl, currency)}`;
    });
    if (!financial) rows.push('NO LIVE ACCOUNT', 'CONNECT REPORTER TO ACTIVATE');
    else if (!rows.length) rows.push('ACCOUNT ONLINE', 'NO OPEN POSITIONS', `EQUITY ${money(financial.equity, currency)}`);
    const nextSignature = JSON.stringify(rows);
    if (nextSignature === signature) return;
    signature = nextSignature;
    const replacement = screenTexture(THREE, 'LIVE TRADES', rows, { accent: '#70e8ff', width: 1024, height: 620 });
    const old = material.map; material.map = replacement.texture; material.needsUpdate = true; old?.dispose?.();
  }
  return { sprite, update };
}

function ensureHud() {
  const stage = document.getElementById('worldStage');
  if (!stage) return null;
  let hud = document.getElementById('wisdoFinancialHud');
  if (!hud) {
    hud = document.createElement('aside'); hud.id = 'wisdoFinancialHud'; hud.className = 'wisdo-financial-hud';
    hud.innerHTML = `<div class="wf-brand"><b>WISDO</b><small>TRADE SMARTER. LIVE BIGGER.</small></div><div class="wf-mode" id="wfMode">NO LIVE ACCOUNT</div><div class="wf-grid"><div><span>BALANCE</span><strong id="wfBalance">—</strong></div><div><span>EQUITY</span><strong id="wfEquity">—</strong></div><div><span>OPEN TRADES</span><strong id="wfTrades">0</strong></div><div><span>FLOATING P/L</span><strong id="wfFloating">—</strong></div><div class="wf-wide"><span>PROTECTED POSITIONS</span><strong id="wfProtected">—</strong></div></div><small class="wf-safe">READ-ONLY WORLD VIEW · EXECUTION STAYS IN WISDO COMMAND</small>`;
    stage.appendChild(hud);
  }
  let ribbon = document.getElementById('wisdoActivityRibbon');
  if (!ribbon) {
    ribbon = document.createElement('nav'); ribbon.id = 'wisdoActivityRibbon'; ribbon.className = 'wisdo-activity-ribbon'; ribbon.setAttribute('aria-label', 'WISDO city activities');
    const rows = [
      ['DRIVE', 'drive', null], ['COFFEE', 'coffee', { id: 'wisdo-brew', name: 'WISDO Brew', x: -23, z: 31 }], ['GYM', 'gym', { id: 'wisdo-gym', name: 'WISDO Gym', x: -93, z: 30 }], ['ARCADE', 'arcade', { id: 'wisdo-arcade', name: 'WISDO Arcade', x: -23, z: 55 }], ['CHILL', 'chill', { id: 'wisdo-chill', name: 'WISDO Chill Plaza', x: 26, z: 37 }], ['EXPLORE', 'explore', { id: 'wisdo-central', name: 'WISDO Central', x: 38, z: -1 }],
    ];
    for (const [label, key, waypoint] of rows) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.activity = key; button.textContent = label;
      button.addEventListener('click', () => {
        if (!waypoint) { window.dispatchEvent(new CustomEvent('wisdo:world-toast', { detail: { message: 'Drive framework is staged for the next vehicle pass.' } })); return; }
        window.dispatchEvent(new CustomEvent('wisdo:set-waypoint', { detail: waypoint }));
      });
      ribbon.appendChild(button);
    }
    stage.appendChild(ribbon);
  }
  let build = document.getElementById('wisdoLiveBuildBadge');
  if (!build) { build = document.createElement('div'); build.id = 'wisdoLiveBuildBadge'; build.className = 'wisdo-build-badge'; build.textContent = `WORLD ${WORLD_BUILD.worldVersion} · ${WORLD_BUILD_ID}`; stage.appendChild(build); }
  return { hud, ribbon, build };
}

function installHudStyles() {
  if (document.getElementById('wisdoArcadePlazaStyles')) return;
  const style = document.createElement('style'); style.id = 'wisdoArcadePlazaStyles'; style.textContent = `
    .wisdo-financial-hud{position:absolute;z-index:27;left:18px;bottom:32px;width:230px;padding:13px 14px;border:1px solid rgba(112,232,255,.2);border-left-color:rgba(224,187,104,.42);border-radius:16px;background:linear-gradient(150deg,rgba(3,9,20,.88),rgba(2,7,15,.72));backdrop-filter:blur(15px);box-shadow:0 18px 50px rgba(0,0,0,.45),0 0 30px rgba(67,187,255,.07);font:600 10px/1.3 Inter,system-ui,sans-serif;color:#eaf8ff;pointer-events:none}.wf-brand{display:flex;flex-direction:column;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:8px}.wf-brand b{font-size:15px;letter-spacing:.16em}.wf-brand small{font-size:7px;color:#7edfff;letter-spacing:.1em}.wf-mode{margin:8px 0;color:#e5c16f;font-size:8px;letter-spacing:.1em}.wf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wf-grid div{padding:7px 8px;border:1px solid rgba(112,232,255,.09);border-radius:9px;background:rgba(12,24,42,.36)}.wf-grid span{display:block;color:#8faabe;font-size:7px;letter-spacing:.08em}.wf-grid strong{display:block;margin-top:3px;font-size:12px;color:#f4fbff}.wf-grid .wf-wide{grid-column:1/-1}.wf-safe{display:block;margin-top:9px;color:#71899a;font-size:6px;letter-spacing:.07em}
    .wisdo-activity-ribbon{position:absolute;right:17px;top:52%;transform:translateY(-50%);z-index:28;display:flex;flex-direction:column;gap:6px;padding:7px;border:1px solid rgba(112,232,255,.15);border-radius:14px;background:rgba(3,9,20,.74);backdrop-filter:blur(14px);box-shadow:0 16px 40px rgba(0,0,0,.4)}.wisdo-activity-ribbon button{min-width:78px;padding:9px 10px;border:1px solid rgba(112,232,255,.12);border-radius:9px;background:rgba(9,22,40,.66);color:#dff8ff;font:800 8px/1 Inter,system-ui,sans-serif;letter-spacing:.09em;cursor:pointer}.wisdo-activity-ribbon button:hover{border-color:rgba(224,187,104,.5);color:#f3d083;box-shadow:0 0 18px rgba(224,187,104,.08)}
    .wisdo-build-badge{position:absolute;right:18px;bottom:18px;z-index:26;padding:6px 8px;border:1px solid rgba(112,232,255,.12);border-radius:8px;background:rgba(2,7,15,.68);color:#7894a5;font:700 6px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;pointer-events:none}
    @media(max-width:700px){.wisdo-financial-hud{left:10px;top:210px;bottom:auto;width:158px;padding:9px 10px;border-radius:12px}.wf-brand b{font-size:11px}.wf-brand small,.wf-safe{display:none}.wf-grid{gap:5px}.wf-grid div{padding:5px 6px}.wf-grid strong{font-size:9px}.wf-mode{font-size:6px;margin:5px 0}.wisdo-activity-ribbon{right:8px;top:auto;bottom:152px;transform:none;display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:5px}.wisdo-activity-ribbon button{min-width:52px;padding:8px 6px;font-size:6px}.wisdo-build-badge{right:8px;bottom:126px;font-size:5px;max-width:150px}.wisdo-production-map{top:70px!important}}
  `; document.head.appendChild(style);
}

function updateHud(snapshot) {
  const live = snapshot?.homeRuntime?.live || snapshot?.worldData || {};
  const financial = live.financial;
  const positions = Array.isArray(live.positions) ? live.positions : [];
  const currency = financial?.currency || 'USD';
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('wfMode', financial ? 'LIVE ACCOUNT · REPORTER AUTHORIZED' : 'NO LIVE ACCOUNT');
  set('wfBalance', financial ? money(financial.balance, currency) : '—');
  set('wfEquity', financial ? money(financial.equity, currency) : '—');
  set('wfTrades', String(positions.length));
  set('wfFloating', financial ? money(financial.floatingPL, currency) : '—');
  const protectedCount = positions.filter((position) => Boolean(position.stopLoss || position.sl || position.protected)).length;
  set('wfProtected', financial ? `${protectedCount} / ${positions.length}` : '—');
  const floating = document.getElementById('wfFloating'); if (floating && financial) { const pl = Number(financial.floatingPL || 0); floating.style.color = pl > 0 ? '#66f3ae' : pl < 0 ? '#ff7f87' : '#f4fbff'; }
}

async function fetchJson(url) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `HTTP ${response.status}`), { status: response.status });
  return body;
}

export function installArcadeCityVerticalSlice({ THREE, scene, quality = 'medium', debug = false } = {}) {
  if (!THREE || !scene) throw new TypeError('WISDO Arcade Plaza requires the active scene.');
  const root = new THREE.Group(); root.name = 'WISDOArcadeWorldVerticalSlice'; scene.add(root);
  const disposables = [];
  installHudStyles(); const ui = ensureHud();
  const registry = { landmarks: {}, businesses: {}, activities: {}, npcGroups: {}, vehicles: {}, signs: {}, interactables: {} };

  const brew = makeStorefront(THREE, root, disposables, { id: 'WisdoBrew', name: 'WISDO BREW', subtitle: 'COFFEE · COMMUNITY · MARKETS', position: [-23, 0, 30], accent: 0xe6a552, warm: true });
  const arcade = makeStorefront(THREE, root, disposables, { id: 'WisdoArcade', name: 'WISDO ARCADE', subtitle: 'PLAY · LEARN · COMPETE', position: [-23, 0, 54], accent: 0x8c66ff });
  const gym = makeStorefront(THREE, root, disposables, { id: 'WisdoGym', name: 'WISDO GYM', subtitle: 'DISCIPLINE · STRENGTH · FOCUS', position: [-93, 0, 29], accent: 0x67f6b2 });
  registry.businesses.brew = brew; registry.businesses.arcade = arcade; registry.businesses.gym = gym;
  registry.interactables.brew = brew; registry.interactables.arcade = arcade; registry.interactables.gym = gym;

  const chill = new THREE.Group(); chill.name = 'WisdoChillPlaza'; chill.position.set(26, 0, 37); root.add(chill);
  const chillMat = addDisposable(disposables, new THREE.MeshStandardMaterial({ color: 0x101822, roughness: .58, metalness: .42 }));
  for (const [x, z, r] of [[-3, 0, 0], [3, 1, .2], [0, 4, -.15]]) { const bench = new THREE.Mesh(addDisposable(disposables, new THREE.BoxGeometry(3.8, .32, .85)), chillMat); bench.position.set(x, .6, z); bench.rotation.y = r; chill.add(bench); }
  registry.activities.chill = chill;

  const palms = []; const palmPositions = [[22,24],[30,25],[22,49],[32,47],[-31,22],[-31,43],[-82,18],[-82,44],[42,18],[51,22],[46,-17],[28,-23]];
  palmPositions.slice(0, quality === 'low' ? 7 : palmPositions.length).forEach(([x,z], index) => palms.push(createPalm(THREE, root, disposables, index, x, z, .9 + (index % 3) * .08)));

  const routes = [
    [[-12,18],[12,18],[14,40],[-8,42]], [[-36,18],[-10,18],[-10,48],[-36,48]], [[20,-18],[20,18],[48,18],[48,-12]], [[-72,5],[-44,5],[-44,42],[-72,42]], [[8,31],[29,31],[29,53],[8,53]], [[-8,-22],[12,-22],[12,5],[-8,5]],
  ];
  const npcs = routes.slice(0, quality === 'low' ? 3 : quality === 'medium' ? 5 : 6).map((route, index) => createNpc(THREE, root, disposables, index, route, index % 2 ? 0xe0bb68 : 0x70e8ff));
  npcs.forEach((npc, index) => { registry.npcGroups[`npc${index}`] = npc.npc; });

  const coach = createCoach(THREE, root, disposables); registry.landmarks.coach = coach.group; registry.interactables.coach = coach.group;
  const liveTrades = createLiveTradeHologram(THREE, root, disposables); registry.signs.liveTrades = liveTrades.sprite;

  globalThis.WisdoWorldRegistry = Object.freeze({ ...registry, root });
  const diagnostics = { active: true, buildId: WORLD_BUILD_ID, businesses: Object.keys(registry.businesses), npcCount: npcs.length, palmCount: palms.length, coach: true, liveTradeHologram: true, financialHud: Boolean(ui?.hud), activityRibbon: Boolean(ui?.ribbon), executionFromWorldVisuals: false };
  globalThis.WisdoArcadeWorldDiagnostics = Object.freeze(diagnostics);
  window.dispatchEvent(new CustomEvent('wisdo:arcade-world-ready', { detail: diagnostics }));

  let destroyed = false; let frameId = 0; let last = performance.now(); let elapsed = 0; let syncBusy = false;
  async function syncWorld() {
    if (destroyed || syncBusy) return; syncBusy = true;
    try { const snapshot = await fetchJson('/api/world/state'); updateHud(snapshot); liveTrades.update(snapshot); }
    catch (error) { if (error.status !== 401 && debug) console.debug('[WISDO ARCADE WORLD] state unavailable', error.message); updateHud(null); liveTrades.update(null); }
    finally { syncBusy = false; }
  }
  async function syncBuild() {
    try { const build = await fetchJson('/api/world/build'); if (ui?.build) ui.build.textContent = `WORLD ${build.worldVersion} · ${build.buildId} · ${String(build.commit || 'unknown').slice(0, 8)}`; globalThis.WisdoWorldBuild = Object.freeze(build); }
    catch { if (ui?.build) ui.build.textContent = `WORLD ${WORLD_BUILD.worldVersion} · ${WORLD_BUILD_ID} · LOCAL`; }
  }
  syncWorld(); syncBuild(); const syncTimer = setInterval(syncWorld, 5000);

  function frame(now) {
    if (destroyed) return; frameId = requestAnimationFrame(frame); const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now; elapsed += dt;
    palms.forEach((row) => { row.fronds.rotation.y = Math.sin(elapsed * .32 + row.phase) * .035; row.fronds.rotation.z = Math.sin(elapsed * .55 + row.phase) * .018; });
    coach.ring.rotation.z += dt * .35; coach.material.opacity = .62 + Math.sin(elapsed * 1.2) * .08; coach.group.position.y = Math.sin(elapsed * 1.15) * .03;
    for (const row of npcs) {
      const a = row.route[row.segment % row.route.length], b = row.route[(row.segment + 1) % row.route.length]; row.t += dt * row.speed; if (row.t >= 1) { row.t = 0; row.segment = (row.segment + 1) % row.route.length; }
      const x = a[0] + (b[0] - a[0]) * row.t, z = a[1] + (b[1] - a[1]) * row.t; row.npc.position.set(x, 0, z); row.npc.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const swing = Math.sin(elapsed * 6 + row.phase) * .45; row.limbs.la.rotation.x = -swing; row.limbs.ra.rotation.x = swing; row.limbs.ll.rotation.x = swing; row.limbs.rl.rotation.x = -swing;
    }
  }
  frameId = requestAnimationFrame(frame);
  if (debug) console.debug('[WISDO ARCADE WORLD VERTICAL SLICE]', diagnostics);

  return { diagnostics, registry, destroy() { if (destroyed) return; destroyed = true; clearInterval(syncTimer); cancelAnimationFrame(frameId); scene.remove(root); for (const item of disposables.reverse()) item?.dispose?.(); document.getElementById('wisdoFinancialHud')?.remove(); document.getElementById('wisdoActivityRibbon')?.remove(); document.getElementById('wisdoLiveBuildBadge')?.remove(); document.getElementById('wisdoArcadePlazaStyles')?.remove(); delete globalThis.WisdoWorldRegistry; delete globalThis.WisdoArcadeWorldDiagnostics; } };
}
