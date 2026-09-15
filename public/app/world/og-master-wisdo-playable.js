import { OG_MASTER_WISDO, OG_MASTER_WISDO_MISSIONS, missionById } from './og-master-wisdo-contract.js';

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const pretty = (value = '') => String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function ogMasterMissionContent(id) {
  return missionById(id);
}

export function dispatchOgMasterAction(action, extra = {}) {
  const detail = Object.freeze({
    npcId: OG_MASTER_WISDO.npcId,
    assetId: OG_MASTER_WISDO.asset.assetId,
    action: String(action || 'idle'),
    ...extra,
  });
  try { window.dispatchEvent(new CustomEvent('wisdo:npc-action', { detail })); } catch {}
  return detail;
}

export function dispatchMasterChamberScene(active, extra = {}) {
  const detail = Object.freeze({
    scene: active ? 'academy' : 'central',
    room: active ? 'master-chamber' : null,
    npcId: active ? OG_MASTER_WISDO.npcId : null,
    visualAssetRequired: false,
    ...extra,
  });
  try { window.dispatchEvent(new CustomEvent('wisdo:game-scene', { detail })); } catch {}
  return detail;
}

function chamberStatus(master = {}) {
  const chamber = master.chamber || {};
  if (chamber.unlocked) return { label: 'MASTER CHAMBER OPEN', note: chamber.qualifiedBy === 'arcade_level' ? `Trading Arcade Level ${Number(chamber.arcadeLevel || 0)} verified.` : `${Number(chamber.arcadeBestMastery || 0)} verified Arcade Mastery.` };
  const level = chamber.arcadeLevel == null ? '—' : Number(chamber.arcadeLevel);
  const mastery = chamber.arcadeBestMastery == null ? '—' : Number(chamber.arcadeBestMastery);
  return { label: 'MASTER CHAMBER GATED', note: `Reach Trading Arcade Level 5 or 70+ verified Arcade Mastery. Current: Level ${level} · Mastery ${mastery}.` };
}

export function renderOgMasterAcademy(master = {}, { visualStatus = 'PENDING_ASSET', guest = false } = {}) {
  const status = chamberStatus(master);
  const progress = master.progress || {};
  const missionRows = (master.missions || []).map((mission) => {
    const state = mission.completed ? 'COMPLETE' : mission.available ? 'READY' : 'LOCKED';
    const reason = mission.available ? `${mission.minimumScore}% required${mission.repeatable ? ' · repeatable' : ''}` : mission.reason || 'Locked';
    return `<div class="list-row">
      <div><strong>${esc(mission.title)}</strong><br><small>${esc(pretty(mission.category))} · ${esc(reason)}${mission.bestScore ? ` · best ${Number(mission.bestScore)}%` : ''}</small></div>
      <button class="action ${mission.available ? 'primary' : ''}" data-master-mission="${esc(mission.id)}" ${mission.available ? '' : 'disabled'}>${state}</button>
    </div>`;
  }).join('') || '<div class="list-row"><div><strong>No Master missions available</strong></div></div>';

  const visualReady = String(visualStatus || '').toUpperCase() === 'ACTIVE';
  return `
    <span class="modal-kicker">WISDO ACADEMY · FOUNDER WING</span>
    <h2 id="modalTitle">OG MASTER WISDO</h2>
    <p>${esc(OG_MASTER_WISDO.role)}. Market learning and trading psychology are educational progression only; no mission can place or alter a live trade.</p>
    <div class="metric-grid">
      <div class="metric"><span>CHAMBER</span><strong>${esc(status.label)}</strong></div>
      <div class="metric"><span>MASTER XP</span><strong>${Number(progress.masteryXp || 0).toLocaleString()}</strong></div>
      <div class="metric"><span>PSYCHOLOGY XP</span><strong>${Number(progress.psychologyXp || 0).toLocaleString()}</strong></div>
      <div class="metric"><span>MISSIONS</span><strong>${Number(progress.completedCount || 0)}/${OG_MASTER_WISDO_MISSIONS.length}</strong></div>
      <div class="metric"><span>ARCADE LEVEL</span><strong>${master.arcade?.level == null ? '—' : Number(master.arcade.level)}</strong></div>
      <div class="metric"><span>ARCADE MASTERY</span><strong>${master.arcade?.bestMastery == null ? '—' : `${Number(master.arcade.bestMastery)}%`}</strong></div>
    </div>
    <p>${esc(status.note)}</p>
    <p><strong>3D MASTER:</strong> ${visualReady ? 'Generated Blender character active in World.' : 'Mission logic active now · final Blender character still pending.'}</p>
    ${guest ? '<p class="locked-message">Sign in to save verified mission progress and rewards.</p>' : `<div class="list">${missionRows}</div>`}
    <div class="modal-actions">
      <a class="action" href="/member/education" data-nav>Open Full Academy</a>
      ${master.rewardHandoff?.trophyRoom?.earnedTrophyIds?.length ? '<a class="action gold" href="/member/home" data-nav>View Trophy Room</a>' : ''}
      <button class="action" id="closeMasterAcademy">Return to Central</button>
    </div>`;
}

export function renderOgMasterMission(master = {}, missionId) {
  const contract = ogMasterMissionContent(missionId);
  const state = (master.missions || []).find((mission) => mission.id === missionId);
  if (!contract || !state) return '<span class="modal-kicker">OG MASTER</span><h2 id="modalTitle">Mission unavailable</h2>';
  const scenarios = contract.scenarios.map((scenario, questionIndex) => `
    <fieldset class="setting" style="margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.12);border-radius:12px">
      <legend><strong>${questionIndex + 1}. ${esc(scenario.prompt)}</strong></legend>
      ${scenario.options.map((option, optionIndex) => `<label style="display:block;margin:10px 0"><input type="radio" name="q${questionIndex}" value="${optionIndex}" required> ${esc(option)}</label>`).join('')}
    </fieldset>`).join('');
  return `
    <span class="modal-kicker">OG MASTER WISDO · ${esc(pretty(contract.category))}</span>
    <h2 id="modalTitle">${esc(contract.title)}</h2>
    <p>${esc(contract.lesson)}</p>
    <p><strong>OG MASTER:</strong> “${esc(contract.openingLine)}”</p>
    <p>Verified pass score: ${Number(contract.minimumScore)}%${state.bestScore ? ` · Your best: ${Number(state.bestScore)}%` : ''}</p>
    <form id="ogMasterMissionForm" data-mission-id="${esc(contract.id)}">
      ${scenarios}
      <div class="modal-actions">
        <button class="action primary" type="submit">Submit to OG MASTER</button>
        <button class="action" type="button" id="backToMasterAcademy">Back to Founder Wing</button>
      </div>
    </form>`;
}

export function collectMissionAnswers(form, missionId) {
  const mission = ogMasterMissionContent(missionId);
  if (!mission || !form) return null;
  const answers = [];
  for (let index = 0; index < mission.scenarios.length; index += 1) {
    const selected = form.querySelector(`input[name="q${index}"]:checked`);
    if (!selected) return null;
    answers.push(Number(selected.value));
  }
  return answers;
}

export function renderOgMasterDebrief(result = {}) {
  const grade = result.grade || {};
  const awards = result.awards || {};
  const master = result.state || {};
  const earned = [
    Number(awards.masteryXp || 0) ? `+${Number(awards.masteryXp)} Mastery XP` : '',
    Number(awards.psychologyXp || 0) ? `+${Number(awards.psychologyXp)} Psychology XP` : '',
    ...(awards.badges || []).map((value) => `Badge: ${value}`),
    ...(awards.titles || []).map((value) => `Title: ${value}`),
    ...(awards.trophies || []).map((value) => `Trophy: ${value}`),
  ].filter(Boolean);
  const line = grade.passed
    ? OG_MASTER_WISDO.dialogue[Math.min(OG_MASTER_WISDO.dialogue.length - 1, Math.max(0, Number(master.progress?.completedCount || 1) - 1))]
    : 'Precision begins with reviewing the decision, not defending it.';
  return `
    <span class="modal-kicker">OG MASTER WISDO · DEBRIEF</span>
    <h2 id="modalTitle">${grade.passed ? 'Trial Passed' : 'Review Required'}</h2>
    <div class="metric-grid">
      <div class="metric"><span>SCORE</span><strong>${Number(grade.score || 0)}%</strong></div>
      <div class="metric"><span>REQUIRED</span><strong>${Number(grade.minimumScore || 0)}%</strong></div>
      <div class="metric"><span>CORRECT</span><strong>${Number(grade.correct || 0)}/${Number(grade.total || 0)}</strong></div>
    </div>
    <p><strong>OG MASTER:</strong> “${esc(line)}”</p>
    ${earned.length ? `<div class="list">${earned.map((item) => `<div class="list-row"><strong>${esc(item)}</strong></div>`).join('')}</div>` : '<p>No new persistent reward was issued on this attempt.</p>'}
    <div class="modal-actions"><button class="action primary" id="continueMasterAcademy">Continue Founder Wing</button></div>`;
}
