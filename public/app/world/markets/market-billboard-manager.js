const BILLBOARD_ANCHORS = Object.freeze([
  { id: 'tower-market-01', district: 'COMMODITIES / TRADING TOWER', position: [0, 35, -67.6], rotationY: 0, hero: true },
  { id: 'forex-avenue-01', district: 'FOREX AVENUE', position: [-66, 19, -12], rotationY: Math.PI / 2 },
  { id: 'exchange-01', district: 'EXCHANGE DISTRICT', position: [66, 20, -8], rotationY: -Math.PI / 2 },
  { id: 'market-district-01', district: 'MARKET DISTRICT', position: [-57, 17, 56], rotationY: Math.PI / 4 },
  { id: 'digital-assets-01', district: 'DIGITAL ASSETS', position: [57, 18, 55], rotationY: -Math.PI / 4 },
  { id: 'central-transit-01', district: 'WISDO CENTRAL', position: [0, 21, 74], rotationY: Math.PI },
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clean = (value = '') => String(value ?? '').trim();
const priceText = (value, digits = null) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const precision = Number.isFinite(Number(digits)) ? clamp(Number(digits), 0, 8) : Math.abs(n) >= 100 ? 2 : 5;
  return n.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
};

function canvasSurface(THREE, width = 1400, height = 760) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearFilter;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawCandles(ctx, candles, area) {
  if (!Array.isArray(candles) || candles.length < 2) return false;
  const rows = candles.slice(-70);
  const lows = rows.map((row) => Number(row.low)).filter(Number.isFinite);
  const highs = rows.map((row) => Number(row.high)).filter(Number.isFinite);
  if (!lows.length || !highs.length) return false;
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = Math.max(Number.EPSILON, max - min);
  const y = (price) => area.y + area.h - ((Number(price) - min) / range) * area.h;
  const step = area.w / rows.length;
  ctx.strokeStyle = 'rgba(130,165,185,.13)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const gy = area.y + (area.h * i) / 5;
    ctx.beginPath(); ctx.moveTo(area.x, gy); ctx.lineTo(area.x + area.w, gy); ctx.stroke();
  }
  for (let i = 0; i <= 8; i += 1) {
    const gx = area.x + (area.w * i) / 8;
    ctx.beginPath(); ctx.moveTo(gx, area.y); ctx.lineTo(gx, area.y + area.h); ctx.stroke();
  }
  rows.forEach((row, index) => {
    const open = Number(row.open); const high = Number(row.high); const low = Number(row.low); const close = Number(row.close);
    if (![open, high, low, close].every(Number.isFinite)) return;
    const up = close >= open;
    const x = area.x + (index + .5) * step;
    const color = up ? '#73e8ff' : '#e5b761';
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1.5, step * .12);
    ctx.beginPath(); ctx.moveTo(x, y(high)); ctx.lineTo(x, y(low)); ctx.stroke();
    const top = Math.min(y(open), y(close));
    const height = Math.max(2, Math.abs(y(open) - y(close)));
    ctx.globalAlpha = .88;
    ctx.fillRect(x - Math.max(1.8, step * .26), top, Math.max(3.6, step * .52), height);
    ctx.globalAlpha = 1;
  });
  return true;
}

function drawMarketSurface(surface, market, chartState, anchor, lod = 'MID') {
  const { ctx, canvas, texture } = surface;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#03070b'); bg.addColorStop(.52, '#08131d'); bg.addColorStop(1, '#030608');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#cda85d'; ctx.lineWidth = 9; ctx.strokeRect(11, 11, canvas.width - 22, canvas.height - 22);
  ctx.strokeStyle = 'rgba(103,228,255,.55)'; ctx.lineWidth = 2; ctx.strokeRect(29, 29, canvas.width - 58, canvas.height - 58);

  ctx.fillStyle = '#d8b86c'; ctx.font = '700 27px system-ui,sans-serif';
  ctx.fillText(`WISDO LIVE MARKET · ${anchor.district}`, 58, 70);
  ctx.textAlign = 'right'; ctx.fillStyle = '#83eaff';
  ctx.fillText(`${market.activeOperatorCount} ACTIVE OPERATOR${market.activeOperatorCount === 1 ? '' : 'S'}`, canvas.width - 58, 70);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#ffffff'; ctx.font = '900 76px system-ui,sans-serif'; ctx.fillText(market.symbol, 58, 157);
  ctx.fillStyle = '#a8c4d2'; ctx.font = '700 27px system-ui,sans-serif';
  ctx.fillText(`WISDO PARTICIPANTS · ▲ ${market.buyParticipants} BUY  ·  ▼ ${market.sellParticipants} SELL`, 61, 205);
  ctx.textAlign = 'right'; ctx.fillStyle = '#f4f8fa'; ctx.font = '800 56px ui-monospace,monospace';
  ctx.fillText(priceText(market.currentPrice, market.instrumentMetadata?.digits), canvas.width - 58, 158);
  ctx.fillStyle = '#7fa0af'; ctx.font = '600 22px system-ui,sans-serif'; ctx.fillText('CURRENT VERIFIED REPORTER PRICE', canvas.width - 58, 196);
  ctx.textAlign = 'left';

  if (lod === 'DISTANT') {
    ctx.fillStyle = 'rgba(105,220,255,.09)'; roundedRect(ctx, 58, 254, canvas.width - 116, 360, 28); ctx.fill();
    ctx.fillStyle = '#77e8ff'; ctx.font = '900 104px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${market.buyParticipants} BUY   /   ${market.sellParticipants} SELL`, canvas.width / 2, 430);
    ctx.fillStyle = '#a8c4d2'; ctx.font = '700 34px system-ui,sans-serif'; ctx.fillText('AUTHORIZED WISDO WORLD PARTICIPATION', canvas.width / 2, 500);
    ctx.textAlign = 'left';
  } else {
    const chartArea = { x: 58, y: 254, w: canvas.width - 116, h: 390 };
    const rendered = chartState?.status === 'ready' && drawCandles(ctx, chartState.candles, chartArea);
    if (!rendered) {
      ctx.fillStyle = 'rgba(105,220,255,.055)'; roundedRect(ctx, chartArea.x, chartArea.y, chartArea.w, chartArea.h, 22); ctx.fill();
      ctx.fillStyle = '#7ce6ff'; ctx.font = '800 34px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(chartState?.status === 'loading' ? 'CONNECTING TO REAL MARKET SERIES' : 'REAL CHART FEED UNAVAILABLE', canvas.width / 2, 420);
      ctx.fillStyle = '#98adba'; ctx.font = '600 25px system-ui,sans-serif';
      ctx.fillText('WISDO WILL NOT GENERATE FAKE CANDLES', canvas.width / 2, 468);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#8ca8b7'; ctx.font = '600 20px system-ui,sans-serif';
    ctx.fillText(chartState?.status === 'ready' ? `${chartState.sourceName || 'AUTHORIZED MARKET DATA'} · ${chartState.interval || '5'} TIMEFRAME` : 'PARTICIPANT + CURRENT PRICE DATA REMAINS VERIFIED', 61, 690);
  }
  ctx.fillStyle = '#d8b86c'; ctx.font = '800 23px system-ui,sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('APPROACH · [E] INSPECT', canvas.width - 58, 704);
  ctx.textAlign = 'left';
  texture.needsUpdate = true;
}

function drawCapsule(surface, participant) {
  const { ctx, canvas, texture } = surface;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(3,8,12,.94)'; roundedRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 20); ctx.fill();
  ctx.strokeStyle = participant.direction === 'BUY' ? '#72e8ff' : '#d8b25f'; ctx.lineWidth = 4; roundedRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 18); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = '800 34px system-ui,sans-serif'; ctx.fillText(clean(participant.operatorAlias).slice(0, 24).toUpperCase(), 28, 50);
  ctx.fillStyle = participant.direction === 'BUY' ? '#72e8ff' : '#e5bd68'; ctx.font = '900 31px system-ui,sans-serif';
  ctx.fillText(`${participant.direction === 'BUY' ? '▲' : '▼'} ${participant.direction}`, 28, 94);
  const movement = Number(participant.movement?.value);
  const unit = participant.movement?.unit || 'PRICE Δ';
  ctx.fillStyle = Number.isFinite(movement) ? (movement >= 0 ? '#b9f7d8' : '#ffb5b5') : '#a5b8c2';
  ctx.font = '900 38px ui-monospace,monospace';
  ctx.fillText(Number.isFinite(movement) ? `${movement >= 0 ? '+' : ''}${movement.toFixed(unit === 'PRICE Δ' ? 3 : 1)} ${unit}` : 'MOVEMENT —', 28, 142);
  ctx.fillStyle = '#9cb2be'; ctx.font = '600 22px system-ui,sans-serif';
  const positions = Number(participant.positionCount || 0);
  const age = Number(participant.ageSeconds);
  const ageText = Number.isFinite(age) ? `${Math.floor(age / 60).toString().padStart(2, '0')}:${Math.floor(age % 60).toString().padStart(2, '0')}` : '—';
  ctx.fillText(`${positions > 1 ? `${positions} POSITIONS · ` : ''}${ageText} ACTIVE · ${participant.dataState || 'LIVE'}`, 28, 181);
  texture.needsUpdate = true;
}

function createBillboard(THREE, scene, market, anchor, chartState, qualityName) {
  const group = new THREE.Group();
  group.name = `MarketBillboard:${market.symbol}`;
  group.position.set(...anchor.position);
  group.rotation.y = anchor.rotationY;
  group.scale.setScalar(.001);
  scene.add(group);

  const hero = Boolean(anchor.hero);
  const width = hero ? 24 : 19;
  const height = hero ? 12.5 : 10;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: .26, metalness: .82 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc8a65f, emissive: 0x5b3c08, emissiveIntensity: 1.1, roughness: .26, metalness: .82 });
  const cyanMat = new THREE.MeshBasicMaterial({ color: 0x72e8ff, transparent: true, opacity: .62, toneMapped: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(width + 1.1, height + 1.1, .7), frameMat);
  body.castShadow = true; group.add(body);
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(width + 1.2, .14, .82), trimMat); topTrim.position.y = height / 2 + .48; group.add(topTrim);
  const bottomTrim = topTrim.clone(); bottomTrim.position.y = -height / 2 - .48; group.add(bottomTrim);
  const sideA = new THREE.Mesh(new THREE.BoxGeometry(.14, height + 1, .82), trimMat); sideA.position.x = -width / 2 - .48; group.add(sideA);
  const sideB = sideA.clone(); sideB.position.x *= -1; group.add(sideB);

  const surface = canvasSurface(THREE);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: surface.texture, toneMapped: false }));
  screen.position.z = .37; group.add(screen);
  const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(width * .9, .16), cyanMat); underGlow.position.set(0, -height / 2 - .72, .44); group.add(underGlow);

  const capsuleGroup = new THREE.Group();
  capsuleGroup.position.set(width / 2 + 3.15, height / 2 - 1.15, .2);
  group.add(capsuleGroup);
  const state = { market, anchor, group, surface, screen, capsuleGroup, chartState, phase: 'entering', phaseAt: performance.now(), lod: 'MID', lastDrawAt: 0, qualityName };
  rebuildCapsules(THREE, state);
  drawMarketSurface(surface, market, chartState, anchor, state.lod);
  return state;
}

function disposeObject(object) {
  object.traverse?.((child) => {
    child.geometry?.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const value of Object.values(mat)) if (value?.isTexture) value.dispose?.();
      mat.dispose?.();
    }
  });
  object.parent?.remove(object);
}

function rebuildCapsules(THREE, state) {
  for (const child of [...state.capsuleGroup.children]) disposeObject(child);
  state.capsuleGroup.clear();
  const maxCapsules = state.qualityName === 'low' ? 4 : state.qualityName === 'medium' ? 7 : 10;
  const participants = state.market.participants.slice(0, maxCapsules);
  participants.forEach((participant, index) => {
    const surface = canvasSurface(THREE, 620, 220);
    drawCapsule(surface, participant);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 2.1), new THREE.MeshBasicMaterial({ map: surface.texture, transparent: true, toneMapped: false }));
    plane.position.set(index % 2 ? 3.1 : -3.1, -Math.floor(index / 2) * 2.28, 0);
    state.capsuleGroup.add(plane);
  });
  if (state.market.participants.length > maxCapsules) {
    const more = state.market.participants.length - maxCapsules;
    const surface = canvasSurface(THREE, 620, 150);
    const { ctx, canvas, texture } = surface;
    ctx.fillStyle = 'rgba(3,8,12,.94)'; roundedRect(ctx, 4, 4, canvas.width - 8, canvas.height - 8, 18); ctx.fill();
    ctx.strokeStyle = '#7ce8ff'; ctx.lineWidth = 4; roundedRect(ctx, 6, 6, canvas.width - 12, canvas.height - 12, 16); ctx.stroke();
    ctx.fillStyle = '#d8eff7'; ctx.font = '800 31px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`+ ${more} MORE AUTHORIZED OPERATORS`, canvas.width / 2, 89); texture.needsUpdate = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.42), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
    plane.position.set(0, -Math.ceil(maxCapsules / 2) * 2.28, 0); state.capsuleGroup.add(plane);
  }
}

async function fetchChart(symbol, interval = '5') {
  const response = await fetch(`/api/world/markets/${encodeURIComponent(symbol)}/candles?interval=${encodeURIComponent(interval)}&outputSize=120`, { credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Real market series unavailable.');
  return payload;
}

export function createMarketBillboardManager({ THREE, scene, camera, qualityName = 'medium', onChanged = null } = {}) {
  const billboards = new Map();
  const chartCache = new Map();
  let markets = [];
  let lastChartSweep = 0;

  function chartState(symbol) {
    return chartCache.get(symbol) || { status: 'idle', candles: [], sourceName: '', interval: '5', checkedAt: 0 };
  }

  async function ensureChart(symbol, force = false) {
    const current = chartState(symbol);
    const now = Date.now();
    if (!force && (current.status === 'loading' || now - Number(current.checkedAt || 0) < 30_000)) return current;
    const loading = { ...current, status: 'loading', checkedAt: now };
    chartCache.set(symbol, loading);
    const board = billboards.get(symbol);
    if (board) { board.chartState = loading; drawMarketSurface(board.surface, board.market, loading, board.anchor, board.lod); }
    try {
      const payload = await fetchChart(symbol, '5');
      const ready = { status: 'ready', candles: payload.candles || [], sourceName: payload.sourceName || payload.provider || 'AUTHORIZED MARKET DATA', interval: payload.interval || '5', checkedAt: Date.now() };
      chartCache.set(symbol, ready);
      const active = billboards.get(symbol);
      if (active) { active.chartState = ready; drawMarketSurface(active.surface, active.market, ready, active.anchor, active.lod); }
      return ready;
    } catch (error) {
      const unavailable = { status: 'unavailable', candles: [], error: error.message, checkedAt: Date.now(), interval: '5' };
      chartCache.set(symbol, unavailable);
      const active = billboards.get(symbol);
      if (active) { active.chartState = unavailable; drawMarketSurface(active.surface, active.market, unavailable, active.anchor, active.lod); }
      return unavailable;
    }
  }

  function setMarkets(nextMarkets = []) {
    markets = Array.isArray(nextMarkets) ? nextMarkets.filter((market) => market?.symbol && Number(market.activeOperatorCount || 0) > 0) : [];
    const wanted = new Set(markets.slice(0, BILLBOARD_ANCHORS.length).map((market) => market.symbol));
    for (const [symbol, board] of billboards) {
      if (!wanted.has(symbol) && board.phase !== 'leaving') { board.phase = 'leaving'; board.phaseAt = performance.now(); }
    }
    markets.slice(0, BILLBOARD_ANCHORS.length).forEach((market, index) => {
      const anchor = BILLBOARD_ANCHORS[index];
      let board = billboards.get(market.symbol);
      if (!board) {
        board = createBillboard(THREE, scene, market, anchor, chartState(market.symbol), qualityName);
        billboards.set(market.symbol, board);
        ensureChart(market.symbol);
      } else {
        board.market = market;
        board.anchor = anchor;
        board.group.position.set(...anchor.position);
        board.group.rotation.y = anchor.rotationY;
        board.phase = board.phase === 'leaving' ? 'entering' : board.phase;
        board.phaseAt = board.phase === 'entering' ? performance.now() : board.phaseAt;
        rebuildCapsules(THREE, board);
        drawMarketSurface(board.surface, market, board.chartState, anchor, board.lod);
      }
    });
    onChanged?.({ markets, billboardCount: billboards.size });
  }

  function update(dt, elapsed) {
    const now = performance.now();
    for (const [symbol, board] of [...billboards]) {
      const distance = camera.position.distanceTo(board.group.position);
      const nextLod = distance > 100 ? 'DISTANT' : distance > 35 ? 'MID' : 'CLOSE';
      if (nextLod !== board.lod) {
        board.lod = nextLod;
        drawMarketSurface(board.surface, board.market, board.chartState, board.anchor, board.lod);
      }
      if (board.phase === 'entering') {
        const t = clamp((now - board.phaseAt) / 900, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        board.group.scale.setScalar(Math.max(.001, eased));
        if (t >= 1) board.phase = 'active';
      } else if (board.phase === 'leaving') {
        const t = clamp((now - board.phaseAt) / 950, 0, 1);
        board.group.scale.setScalar(Math.max(.001, 1 - t));
        if (t >= 1) { disposeObject(board.group); billboards.delete(symbol); continue; }
      }
      board.group.position.y = board.anchor.position[1] + Math.sin(elapsed * .55 + board.anchor.position[0] * .01) * .08;
    }
    if (Date.now() - lastChartSweep > 30_000) {
      lastChartSweep = Date.now();
      for (const market of markets.slice(0, BILLBOARD_ANCHORS.length)) ensureChart(market.symbol);
    }
  }

  function nearest(playerPosition, radius = 8) {
    let best = null; let distance = Infinity;
    for (const board of billboards.values()) {
      if (board.phase === 'leaving') continue;
      const dx = playerPosition.x - board.anchor.position[0];
      const dz = playerPosition.z - board.anchor.position[2];
      const d = Math.hypot(dx, dz);
      if (d < distance) { distance = d; best = board; }
    }
    if (!best || distance > radius) return null;
    return {
      id: `market:${best.market.symbol}`,
      kind: 'market-billboard',
      name: `${best.market.symbol} Live Market`,
      short: 'MARKET',
      symbol: best.market.symbol,
      market: best.market,
      unlocked: true,
      description: `${best.market.activeOperatorCount} authorized WISDO operators · ${best.market.buyParticipants} buy · ${best.market.sellParticipants} sell`,
    };
  }

  function destroy() {
    for (const board of billboards.values()) disposeObject(board.group);
    billboards.clear(); chartCache.clear(); markets = [];
  }

  return { setMarkets, update, nearest, ensureChart, destroy, anchors: BILLBOARD_ANCHORS };
}
