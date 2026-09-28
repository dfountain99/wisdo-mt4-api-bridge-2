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

  const singularity = new THREE.Group(); singularity.name='RankAscensionEnergyField'; group.add(singularity);
  const coreSphere=new THREE.Mesh(new THREE.SphereGeometry(1.72,64,48),new THREE.MeshPhysicalMaterial({color:0x03111d,metalness:.55,roughness:.14,transparent:true,opacity:.92,clearcoat:1,emissive:0x063d5b,emissiveIntensity:.8})); coreSphere.position.y=2.35; coreSphere.visible=false; singularity.add(coreSphere);
  const innerSphere=new THREE.Mesh(new THREE.IcosahedronGeometry(1.08,4),new THREE.MeshStandardMaterial({color:0x02070c,metalness:.88,roughness:.2,emissive:0x0b3150,emissiveIntensity:.7})); innerSphere.position.y=2.35; innerSphere.visible=false; singularity.add(innerSphere);
  const energyRings=[];
  [[2.0,.025,mat.cyanBasic,.25],[2.2,.018,mat.gold,.72],[2.42,.014,mat.cyanBasic,1.15],[1.86,.02,mat.gold,1.55]].forEach(([r,t,m,tilt],i)=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,128),m);ring.position.y=2.35;ring.rotation.x=Math.PI/2+tilt;ring.rotation.y=tilt*.7;singularity.add(ring);energyRings.push(ring);});
  const energyGeo=new THREE.BufferGeometry(); const pts=[]; for(let i=0;i<520;i++){const a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1),r=1.75+Math.random()*.7;pts.push(Math.sin(b)*Math.cos(a)*r,2.35+Math.cos(b)*r,Math.sin(b)*Math.sin(a)*r);} energyGeo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); const energyPoints=new THREE.Points(energyGeo,new THREE.PointsMaterial({color:0x63dfff,size:.025,transparent:true,opacity:.72,depthWrite:false,toneMapped:false})); singularity.add(energyPoints);
  const goldGeo=energyGeo.clone(); const goldPoints=new THREE.Points(goldGeo,new THREE.PointsMaterial({color:0xe4b64e,size:.018,transparent:true,opacity:.38,depthWrite:false,toneMapped:false})); goldPoints.rotation.y=.8; singularity.add(goldPoints);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.45, .72, 48), mat.black); base.position.y = .36; base.castShadow = true; group.add(base);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, .09, 48), materials.glass || mat.steel); deck.position.y = .79; group.add(deck);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 4.7, 12), mat.cyanBasic); spine.position.y = 2.65; group.add(spine);
  const healthRing = new THREE.Mesh(new THREE.TorusGeometry(2.05, .055, 8, 72), mat.cyanBasic); healthRing.rotation.x = Math.PI / 2; healthRing.position.y = .95; group.add(healthRing);
  const botCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.33, 2), mat.gold); botCore.position.set(-2.25, 1.28, 0); group.add(botCore);
  const accountCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.28, 1), mat.cyan); accountCore.position.set(2.25, 1.28, 0); group.add(accountCore);

  const guardianDeck3D = new THREE.Group();
  guardianDeck3D.name = 'LivingGuardianFloorDeck';
  group.add(guardianDeck3D);
  const guardianNodes = {};
  const guardianNodeDefs = {
    AUTO: { x: 0, z: 3.18, color: 0x62ddff, source: [0, 3.18, .2] },
    PROTECT: { x: -2.45, z: 2.42, color: 0x57e7c1, source: [-.72, 3.0, .16] },
    TAKE_PROFIT: { x: 2.45, z: 2.42, color: 0xe8bb51, source: [.72, 3.0, .16] },
  };
  Object.entries(guardianNodeDefs).forEach(([key, def]) => {
    const node = new THREE.Group();
    node.name = `GuardianControl_${key}`;
    node.position.set(def.x, .78, def.z);
    const discMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: .16, toneMapped: false, depthWrite: false });
    const ringMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: .34, toneMapped: false, depthWrite: false });
    const beamMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: .04, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.54,.68,.08,36), discMat);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(.72,.028,7,72), ringMat); ringA.rotation.x=Math.PI/2; ringA.position.y=.08;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(.94,.018,6,72), ringMat.clone()); ringB.rotation.x=Math.PI/2; ringB.position.y=.09;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.12,.48,2.3,24,1,true), beamMat); beam.position.y=1.18;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.17,1), new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:.55, toneMapped:false }));
    core.position.y=.18;
    node.add(disc,ringA,ringB,beam,core);
    const source = new THREE.Vector3(...def.source);
    const sourceCore = new THREE.Mesh(new THREE.IcosahedronGeometry(.1,1), new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:.12, toneMapped:false }));
    sourceCore.position.copy(source);
    guardianDeck3D.add(sourceCore);
    const path = new THREE.QuadraticBezierCurve3(source, new THREE.Vector3((def.x+source.x)*.45,2.0,def.z*.5), new THREE.Vector3(def.x,.92,def.z));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(path.getPoints(36));
    const lineMat = new THREE.LineBasicMaterial({ color:def.color, transparent:true, opacity:.08, toneMapped:false });
    const line = new THREE.Line(lineGeo,lineMat);
    guardianDeck3D.add(node,line);
    guardianNodes[key] = { node, disc, ringA, ringB, beam, core, line, sourceCore, target:0, current:0, color:def.color };
  });
  const temporalRingMat = new THREE.MeshBasicMaterial({ color:0x70e8ff, transparent:true, opacity:.12, toneMapped:false, depthWrite:false });
  const temporalRing = new THREE.Mesh(new THREE.TorusGeometry(3.35,.035,8,128), temporalRingMat);
  temporalRing.rotation.x=Math.PI/2; temporalRing.position.y=.88; group.add(temporalRing);
  let guardianControl = null;
  let guardianControlMode = 'idle';
  let timePulseLevel = 0;
  let temporalProgress = 0;

  const statusSurface = panelSurface(THREE);
  const statusPanel = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 2.25), new THREE.MeshBasicMaterial({ map: statusSurface.texture, toneMapped: false, transparent: true }));
  statusPanel.visible=false; statusPanel.position.set(0, 3.75, .85); statusPanel.rotation.x = -12 * Math.PI / 180; group.add(statusPanel);

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

  function setGuardianControlState(control=null, mode='idle') {
    const key = control ? String(control).toUpperCase() : null;
    guardianControl = guardianNodes[key] ? key : null;
    guardianControlMode = String(mode || 'idle').toLowerCase();
    for (const [name, item] of Object.entries(guardianNodes)) {
      const selected = name === guardianControl;
      item.target = selected
        ? guardianControlMode === 'retracting' ? 0 : guardianControlMode === 'summoning' ? .72 : 1
        : 0;
    }
  }

  function animateGuardianPose(mode='idle') {
    guardianControlMode = String(mode || 'idle').toLowerCase();
  }

  function setFloorProjection(control, active=true) {
    const key = control ? String(control).toUpperCase() : null;
    if (key && guardianNodes[key]) guardianNodes[key].target = active ? 1 : 0;
  }

  function setTimePulse(level=0) {
    timePulseLevel = clamp(Number(level)||0,0,1);
  }

  function setTemporalRing(progress=0) {
    temporalProgress = clamp(Number(progress)||0,0,1);
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
    singularity.rotation.y=elapsed*.035; energyPoints.rotation.y=elapsed*.08; goldPoints.rotation.y=-elapsed*.055; energyRings.forEach((ring,i)=>{ring.rotation.z=elapsed*(i%2?-.12:.16)+i;}); coreSphere.scale.setScalar(1+Math.sin(elapsed*1.35)*.018);
    botCore.rotation.y = elapsed * .7;
    accountCore.rotation.y = -elapsed * .55;
    const ready = Boolean(currentState?.executionHealth?.commandLinkReady);
    healthRing.material = ready ? mat.cyanBasic : mat.muted;
    commandRing.children.forEach((child, index) => { if (child.material?.emissiveIntensity != null) child.material.emissiveIntensity = .25 + (Math.sin(elapsed * 1.6 + index) + 1) * .12; });
    Object.values(guardianNodes).forEach((item,index) => {
      item.current += (item.target - item.current) * (1 - Math.exp(-7 * dt));
      const pulse = .86 + Math.sin(elapsed * (2.1 + index*.35)) * .14;
      item.node.scale.setScalar(.64 + item.current * .36);
      item.node.position.y = .46 + item.current * .32;
      item.disc.material.opacity = .05 + item.current * .32;
      item.ringA.material.opacity = .08 + item.current * .78 * pulse;
      item.ringB.material.opacity = .05 + item.current * .46;
      item.beam.material.opacity = item.current * .12 * pulse;
      item.core.material.opacity = .16 + item.current * .78;
      item.line.material.opacity = .02 + item.current * .82 * pulse;
      item.sourceCore.material.opacity = .08 + item.current * .9 * pulse;
      item.sourceCore.scale.setScalar(.7 + item.current * .55);
      item.ringA.rotation.z = elapsed * (index%2 ? -.85 : .95);
      item.ringB.rotation.z = -elapsed * .52;
    });
    temporalRing.rotation.z = elapsed * (.12 + timePulseLevel*.34);
    temporalRing.material.opacity = .08 + timePulseLevel*.26 + Math.sin(elapsed*2.2)*.025;
    temporalRing.scale.setScalar(.88 + temporalProgress*.16);
  }

  function destroy() { disposeGroup(group); group.parent?.remove(group); }

  return {
    group,
    setState,
    selectCampaign,
    setProposal,
    clearProposal,
    showReceipt,
    setGuardianControlState,
    animateGuardianPose,
    setFloorProjection,
    setTimePulse,
    setTemporalRing,
    update,
    destroy,
    get selectedCampaignId() { return selectedCampaignId; },
    get campaign() { return currentCampaign; },
    mapper,
  };
}
