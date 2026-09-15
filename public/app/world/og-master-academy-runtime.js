import { WORLD_CONFIG, WORLD_LOCATIONS } from './world-config.js';
import { OG_MASTER_WISDO } from './og-master-wisdo-contract.js';
import {
  collectMissionAnswers,
  dispatchMasterChamberScene,
  dispatchOgMasterAction,
  renderOgMasterAcademy,
  renderOgMasterDebrief,
  renderOgMasterMission,
} from './og-master-wisdo-playable.js';

const EDITABLE = 'input,textarea,select,[contenteditable="true"]';
const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function distance2d(player = {}, point = [0, 0, 0]) {
  const x = Number(player.x);
  const z = Number(player.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return Infinity;
  return Math.hypot(x - Number(point[0] || 0), z - Number(point[2] || 0));
}

export function isNearOgMasterAcademy(player = {}) {
  const academy = WORLD_LOCATIONS.academy?.interaction || [-45, 0, -45];
  const master = OG_MASTER_WISDO.location.centralWorldAnchor;
  return distance2d(player, academy) <= Number(WORLD_CONFIG.world.interactionRadius || 4.2)
    || distance2d(player, master) <= Number(OG_MASTER_WISDO.location.interactionRadius || 5.25);
}

function visualStatus() {
  return String(globalThis.WisdoNpcDiagnostics?.status || 'PENDING_ASSET').toUpperCase();
}

function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock?.();
}

export function installOgMasterAcademyRuntime() {
  let destroyed = false;
  let active = false;
  let player = null;
  let master = null;

  const show = (html) => {
    releasePointer();
    const body = $('modalBody');
    const modal = $('modal');
    if (!body || !modal) return false;
    body.innerHTML = html;
    modal.hidden = false;
    return true;
  };

  const leave = () => {
    if (!active) return;
    active = false;
    master = null;
    dispatchOgMasterAction('seated');
    dispatchMasterChamberScene(false, { source: 'og-master-academy-runtime' });
  };

  const bindHub = () => {
    document.querySelectorAll('[data-master-mission]').forEach((button) => {
      button.addEventListener('click', () => openMission(button.dataset.masterMission));
    });
    $('closeMasterAcademy')?.addEventListener('click', () => {
      $('modal').hidden = true;
      $('modalBody').replaceChildren();
      leave();
    });
  };

  const renderHub = () => {
    if (!master) return;
    show(renderOgMasterAcademy(master, { visualStatus: visualStatus(), guest: false }));
    bindHub();
  };

  const loadMaster = async () => {
    const payload = await api('/api/world/academy/master');
    master = payload.master;
    return master;
  };

  const openAcademy = async () => {
    if (destroyed || active) return;
    active = true;
    dispatchMasterChamberScene(true, { source: 'academy-interaction', phase: 'founder-wing' });
    dispatchOgMasterAction('greet');
    show('<span class="modal-kicker">WISDO ACADEMY · FOUNDER WING</span><h2 id="modalTitle">Connecting to OG MASTER…</h2><p>Loading verified Academy progression.</p>');
    try {
      api('/api/world/visit', { method: 'POST', body: JSON.stringify({ destinationId: 'academy' }) }).catch(() => {});
      await loadMaster();
      renderHub();
    } catch (error) {
      if (error.status === 401) {
        show('<span class="modal-kicker">WISDO ACADEMY · FOUNDER WING</span><h2 id="modalTitle">OG MASTER WISDO</h2><p>Sign in to begin verified market-learning and trading-psychology missions.</p><div class="modal-actions"><a class="action primary" href="/login?returnTo=/app/world" data-nav>Sign In</a><button class="action" id="closeMasterAcademy">Return to Central</button></div>');
        bindHub();
        return;
      }
      show(`<span class="modal-kicker">WISDO ACADEMY</span><h2 id="modalTitle">Founder Wing unavailable</h2><p>${String(error.message || 'Academy service unavailable.')}</p><div class="modal-actions"><button class="action" id="closeMasterAcademy">Return to Central</button></div>`);
      bindHub();
    }
  };

  const openMission = (missionId) => {
    if (!master) return;
    const state = master.missions?.find((mission) => mission.id === missionId);
    if (!state?.available) return;
    dispatchOgMasterAction('speak', { missionId, phase: 'briefing' });
    show(renderOgMasterMission(master, missionId));
    $('backToMasterAcademy')?.addEventListener('click', () => {
      dispatchOgMasterAction('seated', { missionId, phase: 'hub' });
      renderHub();
    });
    $('ogMasterMissionForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const answers = collectMissionAnswers(form, missionId);
      if (!answers) return;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) { submit.disabled = true; submit.textContent = 'OG MASTER REVIEWING…'; }
      dispatchOgMasterAction('speak', { missionId, phase: 'review' });
      try {
        const result = await api('/api/world/academy/master/mission', {
          method: 'POST',
          body: JSON.stringify({ missionId, answers }),
        });
        master = result.state;
        dispatchOgMasterAction(result.grade?.passed ? 'point' : 'seated', { missionId, phase: 'debrief', score: result.grade?.score });
        show(renderOgMasterDebrief(result));
        $('continueMasterAcademy')?.addEventListener('click', async () => {
          try { await loadMaster(); } catch {}
          dispatchOgMasterAction('seated', { missionId, phase: 'hub' });
          renderHub();
        });
      } catch (error) {
        if (submit) { submit.disabled = false; submit.textContent = 'Submit to OG MASTER'; }
        const message = document.createElement('p');
        message.className = 'locked-message';
        message.textContent = error.message || 'Mission submission failed.';
        form.prepend(message);
      }
    });
  };

  const onPlayerState = (event) => { player = event?.detail || null; };
  const onKeyDown = (event) => {
    if (destroyed || active || event.defaultPrevented) return;
    if (String(event.key || '').toLowerCase() !== 'e') return;
    if (event.target?.closest?.(EDITABLE)) return;
    if (!isNearOgMasterAcademy(player || {})) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAcademy();
  };
  const onPointerDown = (event) => {
    if (destroyed || active) return;
    const button = event.target?.closest?.('#interactBtn');
    if (!button || !isNearOgMasterAcademy(player || {})) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAcademy();
  };
  const onModalClose = (event) => {
    if (!active) return;
    if (event.target?.closest?.('#modalClose') || event.target?.id === 'modalBackdrop') leave();
  };

  window.addEventListener('wisdo:world-player-state', onPlayerState);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onModalClose, true);

  globalThis.WisdoOgMasterAcademy = Object.freeze({
    open: openAcademy,
    get active() { return active; },
    get master() { return master; },
    build: 'OG-MASTER-WISDO-PLAYABLE-V1',
    executionFromWorldEnabled: false,
  });

  return Object.freeze({
    open: openAcademy,
    get active() { return active; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      leave();
      window.removeEventListener('wisdo:world-player-state', onPlayerState);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onModalClose, true);
      if (globalThis.WisdoOgMasterAcademy?.open === openAcademy) delete globalThis.WisdoOgMasterAcademy;
    },
  });
}
