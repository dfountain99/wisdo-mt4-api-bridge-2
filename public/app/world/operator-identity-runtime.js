import { worldEventBus } from './world-event-bus.js';
import { runGuidedOperatorCapture } from './avatar-capture.js';

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

let currentOperator = null;
let phonePoll = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function modal() {
  return { shell: document.getElementById('modal'), body: document.getElementById('modalBody') };
}

function show(html) {
  const ui = modal();
  if (!ui.shell || !ui.body) return false;
  ui.body.innerHTML = html;
  ui.shell.hidden = false;
  return true;
}

function launchButton() {
  let button = document.getElementById('operatorMirrorLaunch');
  if (button) return button;
  button = document.createElement('button');
  button.id = 'operatorMirrorLaunch';
  button.type = 'button';
  button.className = 'operator-mirror-launch';
  button.textContent = 'CREATE OPERATOR';
  button.addEventListener('click', openIdentityMirror);
  document.body.appendChild(button);
  return button;
}

function refreshLaunchButton() {
  const button = launchButton();
  button.textContent = currentOperator ? 'IDENTITY MIRROR' : 'CREATE OPERATOR';
  button.classList.toggle('configured', Boolean(currentOperator));
}

function editorOptions(config = {}) {
  const select = (name, values, selected) => `<label>${name}<select name="${name}">${values.map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${value.toUpperCase()}</option>`).join('')}</select></label>`;
  return `
    ${select('headPreset', ['standard','soft','angular','oval','round'], config.headPreset || 'standard')}
    ${select('skinMaterial', ['neutral-1','neutral-2','neutral-3','neutral-4','neutral-5','neutral-6','neutral-7','neutral-8'], config.skinMaterial || 'neutral-4')}
    ${select('hairPreset', ['none','close','fade','short-curls','medium-curls','waves','locs-short','locs-long','braids','straight-short','straight-long','bun'], config.hairPreset || 'close')}
    ${select('facialHairPreset', ['none','stubble','mustache','goatee','short-beard','full-beard'], config.facialHairPreset || 'none')}
    ${select('bodyPreset', ['slim','balanced','athletic','broad'], config.bodyPreset || 'balanced')}
    ${select('heightSetting', ['short','medium','tall'], config.heightSetting || 'medium')}
    ${select('outfit', ['cem-operator-black-gold','cem-operator-midnight','cem-operator-formal'], config.outfit || 'cem-operator-black-gold')}
    <label>FACE WIDTH<input name="faceWidth" type="range" min="-1" max="1" step="0.05" value="${Number(config.morphParameters?.faceWidth || 0)}"></label>
    <label>JAW WIDTH<input name="jawWidth" type="range" min="-1" max="1" step="0.05" value="${Number(config.morphParameters?.jawWidth || 0)}"></label>`;
}

function configFromForm(form, seed = {}) {
  return {
    headPreset: form.elements.headPreset.value,
    skinMaterial: form.elements.skinMaterial.value,
    hairPreset: form.elements.hairPreset.value,
    facialHairPreset: form.elements.facialHairPreset.value,
    bodyPreset: form.elements.bodyPreset.value,
    heightSetting: form.elements.heightSetting.value,
    outfit: form.elements.outfit.value,
    accessories: seed.accessories || [],
    morphParameters: {
      ...(seed.morphParameters || {}),
      faceWidth: Number(form.elements.faceWidth.value),
      jawWidth: Number(form.elements.jawWidth.value),
    },
  };
}

function previewMarkup(config = {}, quality = null) {
  return `<div class="operator-preview">
    <div class="operator-preview-figure" aria-label="Standardized WISDO Operator preview silhouette"></div>
    <div><span class="modal-kicker">WISDO OPERATOR PREVIEW</span><h3>${esc(config.headPreset || 'STANDARD')} · ${esc(config.outfit || 'CEM OPERATOR')}</h3><p>${esc(config.hairPreset || 'close')} hair · ${esc(config.facialHairPreset || 'none')} facial hair · ${esc(config.bodyPreset || 'balanced')} frame · ${esc(config.heightSetting || 'medium')} height range</p>${quality ? `<div class="operator-capability">Capture: ${quality.faceDetected ? 'face detected' : 'manual confirmation'} · lighting ${esc(quality.lighting)} · blur ${esc(quality.blur)} · ${Number(quality.posesCompleted || 0)}/5 poses</div>` : ''}</div>
  </div>`;
}

function renderIntro() {
  show(`<div class="operator-intro"><span class="modal-kicker">WISDO IDENTITY MIRROR</span><h2 id="modalTitle">${currentOperator ? 'Your Persistent Operator' : 'Welcome, Operator.'}</h2>
    ${currentOperator ? `${previewMarkup(currentOperator)}<p>Your approved Operator configuration is attached to your World Profile. Cosmetics do not change trading permissions.</p>` : '<p>Your WISDO identity has not been created. Build it with this camera, securely hand the scan to your phone, or create it manually.</p>'}
    <div class="identity-privacy-note"><strong>Privacy boundary:</strong> WISDO does not request the camera until you choose a camera option. Raw frames remain on the capture device in this build. The identity service stores only approved render parameters.</div>
    <div class="privacy-grid"><span>FACE AUTHENTICATION<strong>OFF</strong></span><span>RAW CAPTURE STORAGE<strong>OFF</strong></span><span>BODY INFERENCE<strong>OFF</strong></span></div>
    <div class="modal-actions"><button id="useCameraBtn" class="action primary">Use This Camera</button><button id="scanPhoneBtn" class="action">Scan With Phone</button><button id="manualOperatorBtn" class="action">Build Manually</button></div></div>`);
  document.getElementById('useCameraBtn')?.addEventListener('click', useCurrentCamera);
  document.getElementById('scanPhoneBtn')?.addEventListener('click', scanWithPhone);
  document.getElementById('manualOperatorBtn')?.addEventListener('click', () => renderManualEditor(currentOperator || {}));
}

function renderManualEditor(config = {}) {
  show(`<span class="modal-kicker">WISDO IDENTITY MIRROR · MANUAL</span><h2 id="modalTitle">Build Your Operator</h2><p>Face scanning is optional. You control your body frame, height range, hair, facial hair, materials, and outfit.</p><form id="manualOperatorForm" class="operator-editor">${editorOptions(config)}<div class="modal-actions"><button class="action primary" type="submit">Save Operator</button><button id="manualBackBtn" class="action" type="button">Back</button></div></form>`);
  document.getElementById('manualOperatorForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const avatar = configFromForm(event.currentTarget, config);
      const result = await api('/api/world/avatar/manual', { method: 'POST', body: JSON.stringify({ avatar }) });
      currentOperator = result.operator;
      refreshLaunchButton();
      worldEventBus.emit('avatar.updated', { operator: currentOperator, source: 'manual-save' });
      renderIntro();
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  });
  document.getElementById('manualBackBtn')?.addEventListener('click', renderIntro);
}

async function createScanSession() {
  return api('/api/world/avatar/scan-session', { method: 'POST', body: '{}' });
}

async function useCurrentCamera() {
  let session;
  try {
    session = await createScanSession();
    show('<span class="modal-kicker">WISDO IDENTITY MIRROR</span><h2 id="modalTitle">Camera starts only after your approval</h2><div id="identityCaptureMount"></div>');
    const result = await runGuidedOperatorCapture({ mount: document.getElementById('identityCaptureMount'), onCancel: renderIntro });
    renderCapturedEditor(session, result.avatarSeed, result.quality, result.fittingCapability);
  } catch (error) {
    show(`<span class="modal-kicker">WISDO IDENTITY MIRROR</span><h2 id="modalTitle">Camera unavailable</h2><p>${esc(error.message)}</p><div class="modal-actions"><button id="cameraManualBtn" class="action primary">Build Manually</button><button id="cameraBackBtn" class="action">Back</button></div>`);
    document.getElementById('cameraManualBtn')?.addEventListener('click', () => renderManualEditor({}));
    document.getElementById('cameraBackBtn')?.addEventListener('click', renderIntro);
  }
}

function renderCapturedEditor(session, seed = {}, quality = {}, capability = '') {
  show(`<span class="modal-kicker">WISDO IDENTITY MIRROR · CAMERA</span><h2 id="modalTitle">Confirm Before Preview</h2><p>Your camera frames have not been uploaded. ${capability === 'basic-face-shape' ? 'This browser exposed a basic local face-shape measurement.' : 'This browser did not expose local face landmarks, so appearance confirmation remains manual.'}</p><form id="capturedOperatorForm" class="operator-editor">${editorOptions(seed)}<div class="modal-actions"><button class="action primary" type="submit">Generate Preview</button><button id="captureAgainBtn" class="action" type="button">Rescan</button></div></form>`);
  document.getElementById('capturedOperatorForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const avatar = configFromForm(event.currentTarget, seed);
      await api('/api/world/avatar/scan-session/complete', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ avatar, quality }) });
      const status = await api(`/api/world/avatar/scan-session/${encodeURIComponent(session.sessionId)}`);
      renderScanPreview(status.session);
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  });
  document.getElementById('captureAgainBtn')?.addEventListener('click', useCurrentCamera);
}

async function renderQr(canvas, text) {
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
    const qr = module.default || module;
    if (typeof qr.toCanvas !== 'function') throw new Error('QR renderer unavailable.');
    await qr.toCanvas(canvas, text, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
    return true;
  } catch (error) {
    console.warn('Local QR rendering unavailable', error);
    return false;
  }
}

async function scanWithPhone() {
  clearInterval(phonePoll);
  try {
    const session = await createScanSession();
    show(`<span class="modal-kicker">WISDO IDENTITY MIRROR · PHONE HANDOFF</span><h2 id="modalTitle">Scan With iPhone or Android</h2><div class="qr-shell"><canvas id="avatarQr" width="240" height="240"></canvas><div><p>Scan this QR using your phone. The one-time token is scoped only to this avatar capture and expires quickly.</p><p>Pair code: <strong>${esc(session.pairCode)}</strong></p><p class="qr-fallback">${esc(session.captureUrl)}</p><div class="modal-actions"><button id="copyCaptureLink" class="action">Copy Link</button><button id="cancelPhoneScan" class="action">Cancel</button></div></div></div><p id="phonePairStatus">Waiting for phone capture…</p>`);
    const canvas = document.getElementById('avatarQr');
    const rendered = await renderQr(canvas, session.captureUrl);
    if (!rendered) canvas.replaceWith(Object.assign(document.createElement('div'), { className: 'operator-capability', textContent: 'QR rendering is unavailable on this browser. Use Copy Link instead.' }));
    document.getElementById('copyCaptureLink')?.addEventListener('click', async () => {
      await navigator.clipboard?.writeText?.(session.captureUrl);
      document.getElementById('phonePairStatus').textContent = 'Secure phone link copied.';
    });
    document.getElementById('cancelPhoneScan')?.addEventListener('click', () => { clearInterval(phonePoll); renderIntro(); });
    phonePoll = setInterval(async () => {
      try {
        const status = await api(`/api/world/avatar/scan-session/${encodeURIComponent(session.sessionId)}`);
        const label = document.getElementById('phonePairStatus');
        if (label) label.textContent = status.session.status === 'ready_for_preview' ? 'Phone capture received. Loading preview…' : `Waiting for phone capture · ${status.session.status}`;
        if (status.session.status === 'ready_for_preview') {
          clearInterval(phonePoll);
          renderScanPreview(status.session);
        }
        if (status.session.status === 'expired') {
          clearInterval(phonePoll);
          if (label) label.textContent = 'Phone pairing expired. Create a new QR to try again.';
        }
      } catch (error) {
        if (document.getElementById('phonePairStatus')) document.getElementById('phonePairStatus').textContent = error.message;
      }
    }, 1_500);
  } catch (error) {
    show(`<span class="modal-kicker">WISDO IDENTITY MIRROR</span><h2 id="modalTitle">Phone pairing unavailable</h2><p>${esc(error.message)}</p>`);
  }
}

function renderScanPreview(session) {
  const config = session.draftAvatar || {};
  show(`<span class="modal-kicker">WISDO IDENTITY MIRROR · PREVIEW</span><h2 id="modalTitle">Accept, Edit, or Rescan</h2>${previewMarkup(config, session.captureQuality)}<form id="scanPreviewForm" class="operator-editor">${editorOptions(config)}<div class="modal-actions"><button class="action primary" type="submit">Accept Operator</button><button id="previewRescanBtn" class="action" type="button">Rescan</button><button id="previewManualBtn" class="action" type="button">Save As Manual Edit</button></div></form>`);
  document.getElementById('scanPreviewForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const edits = configFromForm(event.currentTarget, config);
      const result = await api('/api/world/avatar/accept', { method: 'POST', body: JSON.stringify({ sessionId: session.sessionId, edits }) });
      currentOperator = result.operator;
      refreshLaunchButton();
      worldEventBus.emit('avatar.updated', { operator: currentOperator, source: 'mirror-accept' });
      renderIntro();
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  });
  document.getElementById('previewRescanBtn')?.addEventListener('click', scanWithPhone);
  document.getElementById('previewManualBtn')?.addEventListener('click', () => renderManualEditor(config));
}

export async function startOperatorIdentityRuntime() {
  try {
    const result = await api('/api/world/avatar/me');
    currentOperator = result.operator || null;
    refreshLaunchButton();
  } catch (error) {
    if (error.status === 401) document.getElementById('operatorMirrorLaunch')?.remove();
    else console.warn('Operator identity state unavailable', error);
  }
  worldEventBus.on('avatar.updated', (event) => {
    if (event.detail?.operator) {
      currentOperator = event.detail.operator;
      refreshLaunchButton();
    }
  });
  globalThis.WisdoIdentityMirror = { open: openIdentityMirror, get operator() { return currentOperator; } };
  return globalThis.WisdoIdentityMirror;
}

export function openIdentityMirror() {
  clearInterval(phonePoll);
  renderIntro();
}
