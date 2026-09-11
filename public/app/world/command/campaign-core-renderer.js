const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export class PriceSpaceMapper {
  constructor({ minY = .55, maxY = 4.6, paddingRatio = .16 } = {}) {
    this.minY = minY;
    this.maxY = maxY;
    this.paddingRatio = paddingRatio;
    this.minPrice = 0;
    this.maxPrice = 1;
  }

  fit(campaign = {}) {
    const prices = [
      campaign.currentPrice,
      campaign.averageEntry,
      campaign.primaryEntry,
      campaign.stopLoss,
      campaign.takeProfit,
      ...(campaign.positions || []).flatMap((position) => [position.entryPrice, position.stopLoss, position.takeProfit]),
      ...(campaign.plannedAdds || []).map((row) => row.price),
    ].map((value) => finite(value, null)).filter((value) => value != null && value !== 0);
    if (!prices.length) { this.minPrice = 0; this.maxPrice = 1; return this; }
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    if (Math.abs(max - min) < Math.max(1e-9, Math.abs(max) * 1e-8)) {
      const span = Math.max(Math.abs(max) * .002, 1);
      min -= span; max += span;
    }
    const pad = (max - min) * this.paddingRatio;
    this.minPrice = min - pad;
    this.maxPrice = max + pad;
    return this;
  }

  y(price) {
    const value = finite(price, this.minPrice);
    const ratio = clamp((value - this.minPrice) / Math.max(Number.EPSILON, this.maxPrice - this.minPrice), 0, 1);
    return this.minY + ratio * (this.maxY - this.minY);
  }
}

function panelSurface(THREE, width = 900, height = 360) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

function drawStatusPanel(surface, state = {}) {
  const { ctx, canvas, texture } = surface;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#020609'); gradient.addColorStop(.55, '#07141d'); gradient.addColorStop(1, '#020507');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#caa85f'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  ctx.fillStyle = '#70e7ff'; ctx.font = '700 22px system-ui,sans-serif'; ctx.fillText('WISDO CAMPAIGN CORE', 38, 46);
  ctx.fillStyle = '#f6fbff'; ctx.font = '900 48px system-ui,sans-serif'; ctx.fillText(state.title || 'NO ACTIVE CAMPAIGN', 38, 107);
  ctx.fillStyle = '#9fb6c3'; ctx.font = '650 22px system-ui,sans-serif';
  const rows = state.rows || [];
  let y = 151;
  for (const row of rows.slice(0, 6)) {
    ctx.fillStyle = row.accent || '#9fb6c3';
    ctx.fillText(row.text, 38, y); y += 34;
  }
  texture.needsUpdate = true;
}

function makeTextSprite(THREE, text, accent = '#74e9ff') {
  const surface = panelSurface(THREE, 720, 150);
  const { ctx, canvas, texture } = surface;
  ctx.fillStyle = 'rgba(2,7,10,.91)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fillStyle = '#f5fbff'; ctx.font = '800 42px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(text).slice(0, 36), canvas.width / 2, canvas.height / 2);
  texture.needsUpdate = true;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.8, .58), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
}

function disposeGroup(group) {
  if (!group) return;
  group.traverse?.((object) => {
    object.geometry?.dispose?.();
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of mats) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
      material.dispose?.();
    }
  });
  group.clear?.();
}

function zoneMesh(THREE, material, yA, yB, radius = .62) {
  const height = Math.max(.02, Math.abs(yB - yA));
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28, 1, true), material);
  mesh.position.y = (yA + yB) / 2;
  return mesh;
}

export function createCampaignCoreRenderer({ THREE, parent, position = [0, 0, 0], materials = {} } = {}) {
  const group = new THREE.Group();
  group.name = 'WISDOCampaignCore';
  group.position.set(...position);
  parent.add(group);

  const mat = {
    black: materials.black || materials.wallDark || new THREE.MeshStandardMaterial({ color: 0x04070a, roughness: .3, metalness: .72 }),
    steel: materials.steel || new THREE.MeshStandardMaterial({ color: 0x53616b, roughness: .25, metalness: .85 }),
    gold: materials.goldGlow || materials.gold || new THREE.MeshStandardMaterial({ color: 0xd5b665, emissive: 0x5a3a08, emissiveIntensity: 1.2, roughness: .24, metalness: .7 }),
    cyan: materials.cyan || new THREE.MeshStandardMaterial({ color: 0x73e8ff, emissive: 0x075d7a, emissiveIntensity: 1.6, roughness: .2, metalness: .3 }),
    cyanBasic: materials.cyanBasic || new THREE.MeshBasicMaterial({ color: 0x72e7ff, toneMapped: false }),
    positive: materials.positive || new THREE.MeshStandardMaterial({ color: 0x78f2b0, emissive: 0x0b5b34, emissiveIntensity: 1.1 }),
    negative: materials.negative || new THREE.MeshStandardMaterial({ color: 0xff9999, emissive: 0x6a1717, emissiveIntensity: .8 }),
    risk: new THREE.MeshBasicMaterial({ color: 0xb36a5d, transparent: true, opacity: .14, depthWrite: false }),
    opportunity: new THREE.MeshBasicMaterial({ color: 0x4d9db8, transparent: true, opacity: .1, depthWrite: false }),
    proposed: new THREE.MeshBasicMaterial({ color: 0xe8cc78, transparent: true, opacity: .48, wireframe: true, toneMapped: false }),
    muted: new THREE.MeshStandardMaterial({ color: 0x53616b, emissive: 0x17232b, emissiveIntensity: .3 }),
  };

  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.45, .72, 48), mat.black); base.position.y = .36; base.castShadow = true; group.add(base);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, .09, 48), materials.glass || mat.steel); deck.position.y = .79; group.add(deck);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 4.7, 12), mat.cyanBasic); spine.position.y = 2.65; group.add(spine);
  const healthRing = new THREE.Mesh(new THREE.TorusGeometry(2.05, .055, 8, 72), mat.cyanBasic); healthRing.rotation.x = Math.PI / 2; healthRing.position.y = .95; group.add(healthRing);
  const botCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.33, 2), mat.gold); botCore.position.set(-2.25, 1.28, 0); group.add(botCore);
  const accountCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.28, 1), mat.cyan); accountCore.position.set(2.25, 1.28, 0); group.add(accountCore);

  const statusSurface = panelSurface(THREE);
  const statusPanel = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.25), new THREE.MeshBasicMaterial({ map: statusSurface.texture, toneMapped: false, transparent: true }));
  statusPanel.position.set(0, 3.75, .85); statusPanel.rotation.x = -12 * Math.PI / 180; group.add(statusPanel);

  const dynamic = new THREE.Group(); dynamic.name = 'CampaignDynamic'; group.add(dynamic);
  const campaignOrbs = new THREE.Group(); campaignOrbs.name = 'CampaignOrbs'; group.add(campaignOrbs);
  const commandRing = new THREE.Group(); commandRing.name = 'CommandRing'; group.add(commandRing);
  const mapper = new PriceSpaceMapper();
  const priceOrb = new THREE.Mesh(new THREE.SphereGeometry(.22, 22, 16), mat.cyan); dynamic.add(priceOrb);
  const priceHalo = new THREE.Mesh(new THREE.TorusGeometry(.38, .035, 8, 40), mat.cyanBasic); priceHalo.rotation.x = Math.PI / 2; dynamic.add(priceHalo);
  let priceTargetY = 2.6;
  let currentState = null;
  let currentCampaign = null;
  let proposal = null;
  let receipt = null;
  let selectedCampaignId = null;

  const commandLabels = ['BOT', 'ENTRIES', 'TRAIL', 'BREAK EVEN', 'LOCK', 'CLOSE', 'SCOPE', 'EMERGENCY'];
  commandLabels.forEach((label, index) => {
    const angle = (index / commandLabels.length) * Math.PI * 2 - Math.PI / 2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.22, .11, .54), index === commandLabels.length - 1 ? mat.gold : mat.steel);
    plate.position.set(Math.cos(angle) * 3.45, .92, Math.sin(angle) * 3.45);
    plate.rotation.y = -angle;
    const labelMesh = makeTextSprite(THREE, label, index === commandLabels.length - 1 ? '#e5bd68' : '#74e9ff');
    labelMesh.scale.set(.44, .44, .44); labelMesh.position.set(plate.position.x, 1.18, plate.position.z); labelMesh.rotation.y = plate.rotation.y;
    commandRing.add(plate, labelMesh);
  });

  function planeAt(y, material, radius = 1.52, tube = .035) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 56), material);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; dynamic.add(ring); return ring;
  }

  function rebuild() {
    while (dynamic.children.length > 2) disposeGroup(dynamic.children[2]);
    campaignOrbs.clear();
    const campaigns = currentState?.campaigns || [];
    currentCampaign = campaigns.find((row) => row.campaignId === selectedCampaignId) || campaigns[0] || null;
    selectedCampaignId = currentCampaign?.campaignId || null;

    campaigns.slice(0, 8).forEach((campaign, index) => {
      const angle = (index / Math.max(1, Math.min(8, campaigns.length))) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(index === 0 ? .22 : .18, 14, 10), campaign.campaignId === selectedCampaignId ? mat.gold : mat.cyan);
      orb.position.set(Math.cos(angle) * 2.5, 1.22 + (index % 2) * .15, Math.sin(angle) * 2.5);
      orb.userData.campaignId = campaign.campaignId;
      campaignOrbs.add(orb);
    });

    if (!currentCampaign) {
      priceOrb.visible = false; priceHalo.visible = false;
      drawStatusPanel(statusSurface, { title: 'NO ACTIVE CAMPAIGN', rows: [{ text: 'COMMAND CORE STANDING BY' }, { text: currentState?.executionHealth?.commandLinkReady ? 'REPORTER COMMAND LINK READY' : 'REPORTER COMMAND LINK OFFLINE', accent: currentState?.executionHealth?.commandLinkReady ? '#79efb4' : '#a5b3bb' }] });
      return;
    }
    priceOrb.visible = true; priceHalo.visible = true;
    mapper.fit(currentCampaign);
    const avgY = mapper.y(currentCampaign.averageEntry);
    const currentY = mapper.y(currentCampaign.currentPrice);
    const stopY = currentCampaign.stopLoss != null ? mapper.y(currentCampaign.stopLoss) : null;
    const tpY = currentCampaign.takeProfit != null ? mapper.y(currentCampaign.takeProfit) : null;
    priceTargetY = currentY;
    priceOrb.position.set(0, currentY, 0); priceHalo.position.set(0, currentY, 0);

    if (currentCampaign.averageEntry != null) {
      const avg = planeAt(avgY, mat.gold, 1.48, .045); avg.userData.kind = 'average-entry';
      const label = makeTextSprite(THREE, `AVG ${Number(currentCampaign.averageEntry).toFixed(currentCampaign.instrumentMetadata?.digits ?? 2)}`, '#dfbf70'); label.position.set(1.85, avgY, 0); label.scale.set(.48, .48, .48); dynamic.add(label);
    }
    if (stopY != null) {
      const stop = planeAt(stopY, mat.negative, 1.42, .045); stop.userData.kind = 'protection';
      const label = makeTextSprite(THREE, `PROTECT ${currentCampaign.stopLoss}`, '#ff9f9f'); label.position.set(-1.9, stopY, 0); label.scale.set(.42, .42, .42); dynamic.add(label);
      if (currentCampaign.averageEntry != null) dynamic.add(zoneMesh(THREE, mat.risk, avgY, stopY, .86));
    }
    if (tpY != null) {
      const target = planeAt(tpY, mat.cyanBasic, 1.68, .065); target.userData.kind = 'target';
      const label = makeTextSprite(THREE, `TARGET ${currentCampaign.takeProfit}`, '#73e8ff'); label.position.set(1.9, tpY, 0); label.scale.set(.42, .42, .42); dynamic.add(label);
      if (currentCampaign.averageEntry != null) dynamic.add(zoneMesh(THREE, mat.opportunity, avgY, tpY, .92));
    }

    (currentCampaign.positions || []).slice(0, 24).forEach((position, index) => {
      const y = mapper.y(position.entryPrice);
      const angle = (index / Math.max(1, Math.min(24, currentCampaign.positions.length))) * Math.PI * 2;
      const radius = .75 + (index % 3) * .22;
      const material = position.classification === 'PRIMARY' || position.classification === 'CORE' ? mat.gold : position.direction === 'BUY' ? mat.positive : mat.negative;
      const node = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), material);
      node.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      node.userData.ticket = position.ticket; node.userData.kind = 'position'; dynamic.add(node);
      const tether = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, y, 0), node.position.clone()]);
      dynamic.add(new THREE.Line(tether, new THREE.LineBasicMaterial({ color: position.direction === 'BUY' ? 0x78f2b0 : 0xff9a9a, transparent: true, opacity: .52 })));
    });

    for (const planned of currentCampaign.plannedAdds || []) {
      const y = mapper.y(planned.price);
      const gate = planeAt(y, mat.proposed, 1.08, .028); gate.userData.kind = 'planned-add';
    }

    if (proposal?.proposedProtectionPrice != null) {
      const proposedY = mapper.y(proposal.proposedProtectionPrice);
      const proposed = planeAt(proposedY, mat.proposed, 1.58, .05); proposed.userData.kind = 'proposed-protection';
    }

    const unit = currentCampaign.floatingMovement?.unit || 'PRICE Δ';
    const movement = finite(currentCampaign.floatingMovement?.value, null);
    drawStatusPanel(statusSurface, {
      title: `${currentCampaign.symbol} ${currentCampaign.direction}`,
      rows: [
        { text: `${currentCampaign.strategyName || 'CAMPAIGN'} · ${currentCampaign.positionCount} POSITION${currentCampaign.positionCount === 1 ? '' : 'S'}`, accent: '#ffffff' },
        { text: `CURRENT ${currentCampaign.currentPrice ?? '—'} · AVG ${currentCampaign.averageEntry ?? '—'}` },
        { text: `TARGET ${currentCampaign.takeProfit ?? '—'} · PROTECT ${currentCampaign.stopLoss ?? '—'}` },
        { text: `FLOATING ${Number(currentCampaign.floatingMoney || 0) >= 0 ? '+' : ''}${Number(currentCampaign.floatingMoney || 0).toFixed(2)} · ${movement == null ? 'MOVEMENT —' : `${movement >= 0 ? '+' : ''}${movement.toFixed(unit === 'PRICE Δ' ? 3 : 1)} ${unit}`}`, accent: Number(currentCampaign.floatingMoney || 0) >= 0 ? '#8ff0bf' : '#ffb0b0' },
        { text: `REPORTER ${currentState?.executionHealth?.reporter || 'UNKNOWN'} · COMMAND ${currentState?.executionHealth?.commandLinkReady ? 'READY' : 'DISABLED'}`, accent: currentState?.executionHealth?.commandLinkReady ? '#79efb4' : '#b6a26e' },
        { text: receipt ? `LAST COMMAND ${receipt.command || ''} · ${String(receipt.status || '').toUpperCase()}` : 'SELECT CORE → REVIEW → ARM → HOLD → SERVER ACK' },
      ],
    });
  }

  function setState(next = {}, { campaignId = null } = {}) {
    currentState = next || {};
    if (campaignId) selectedCampaignId = campaignId;
    rebuild();
  }

  function selectCampaign(campaignId) { selectedCampaignId = campaignId; rebuild(); }
  function setProposal(next) { proposal = next || null; rebuild(); }
  function clearProposal() { proposal = null; rebuild(); }
  function showReceipt(next) { receipt = next || null; rebuild(); }

  function update(dt, elapsed) {
    if (priceOrb.visible) {
      priceOrb.position.y += (priceTargetY - priceOrb.position.y) * (1 - Math.exp(-9 * dt));
      priceHalo.position.y = priceOrb.position.y;
      priceHalo.rotation.z = elapsed * .8;
    }
    healthRing.rotation.z = elapsed * .16;
    botCore.rotation.y = elapsed * .7;
    accountCore.rotation.y = -elapsed * .55;
    const ready = Boolean(currentState?.executionHealth?.commandLinkReady);
    healthRing.material = ready ? mat.cyanBasic : mat.muted;
    commandRing.children.forEach((child, index) => { if (child.material?.emissiveIntensity != null) child.material.emissiveIntensity = .25 + (Math.sin(elapsed * 1.6 + index) + 1) * .12; });
  }

  function destroy() { disposeGroup(group); group.parent?.remove(group); }

  return {
    group,
    setState,
    selectCampaign,
    setProposal,
    clearProposal,
    showReceipt,
    update,
    destroy,
    get selectedCampaignId() { return selectedCampaignId; },
    get campaign() { return currentCampaign; },
    mapper,
  };
}
