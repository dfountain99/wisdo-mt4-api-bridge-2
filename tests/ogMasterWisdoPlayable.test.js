import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyOgMasterMissionAttempt,
  createOgMasterProgress,
  gradeOgMasterMission,
  ogMasterChamberUnlock,
  publicOgMasterState,
} from '../services/ogMasterWisdoService.js';
import { OG_MASTER_WISDO_MISSIONS } from '../public/app/world/og-master-wisdo-contract.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const CORRECT = Object.freeze({
  'trained-mind-waits': Object.freeze([1, 1, 2]),
  'impulse-is-expensive': Object.freeze([1, 1, 0, 1]),
  'campaign-keeper': Object.freeze([0, 1, 1, 1]),
  'founder-mastery-trial': Object.freeze([1, 0, 0, 1, 1]),
});

test('server grading matches the four canonical OG MASTER mission contracts', () => {
  assert.equal(OG_MASTER_WISDO_MISSIONS.length, 4);
  for (const mission of OG_MASTER_WISDO_MISSIONS) {
    const grade = gradeOgMasterMission(mission.id, CORRECT[mission.id]);
    assert.equal(grade.score, 100, mission.id);
    assert.equal(grade.passed, true, mission.id);
    assert.equal(grade.minimumScore, mission.minimumScore, mission.id);
  }
});

test('Master Chamber uses verified Trading Arcade Level 5 or 70+ Arcade Mastery', () => {
  const progress = createOgMasterProgress();
  assert.equal(ogMasterChamberUnlock(progress, { arcadeLevel: 4, arcadeBestMastery: 69 }).unlocked, false);
  assert.equal(ogMasterChamberUnlock(progress, { arcadeLevel: 5, arcadeBestMastery: 10 }).qualifiedBy, 'arcade_level');
  assert.equal(ogMasterChamberUnlock(progress, { arcadeLevel: 1, arcadeBestMastery: 70 }).qualifiedBy, 'verified_arcade_mastery');
  assert.equal(ogMasterChamberUnlock(progress, {}).arcadeProgressionConnected, false);
});

test('Academy introduction remains playable outside the prestige chamber while deeper missions stay gated', () => {
  const state = publicOgMasterState(createOgMasterProgress(), { arcadeLevel: 1, arcadeBestMastery: 20 });
  assert.equal(state.chamber.unlocked, false);
  assert.equal(state.missions.find((mission) => mission.id === 'trained-mind-waits').available, true);
  assert.equal(state.missions.find((mission) => mission.id === 'impulse-is-expensive').available, false);
});

test('server owns rewards, prerequisites and one-time award issuance', () => {
  let progress = createOgMasterProgress();
  const intro = applyOgMasterMissionAttempt(progress, {
    missionId: 'trained-mind-waits',
    answers: CORRECT['trained-mind-waits'],
    arcadeLevel: 5,
    arcadeBestMastery: 80,
    now: new Date('2026-09-15T12:00:00Z'),
  });
  progress = intro.progress;
  assert.equal(intro.grade.passed, true);
  assert.equal(intro.awards.masteryXp, 60);
  assert.equal(intro.state.missions.find((mission) => mission.id === 'impulse-is-expensive').available, true);

  const repeated = applyOgMasterMissionAttempt(progress, {
    missionId: 'trained-mind-waits',
    answers: CORRECT['trained-mind-waits'],
    arcadeLevel: 5,
    arcadeBestMastery: 80,
    now: new Date('2026-09-15T12:05:00Z'),
  });
  assert.equal(repeated.firstCompletion, false);
  assert.equal(repeated.awards.masteryXp, 0);
  assert.equal(repeated.progress.masteryXp, 60);

  const impulse = applyOgMasterMissionAttempt(repeated.progress, {
    missionId: 'impulse-is-expensive',
    answers: CORRECT['impulse-is-expensive'],
    arcadeLevel: 5,
    arcadeBestMastery: 80,
  });
  assert.ok(impulse.progress.badges.includes('founder-discipline'));
  assert.ok(impulse.progress.trophies.includes('golden-stillness-token'));
  assert.ok(impulse.progress.titles.includes('Disciplined Mind'));
});

test('client Academy layer intercepts physical Academy interaction and uses server-authoritative mission APIs', () => {
  const runtime = read('public/app/world/og-master-academy-runtime.js');
  const ui = read('public/app/world/og-master-wisdo-playable.js');
  const world3d = read('public/app/world/world3d.js');
  assert.match(runtime, /isNearOgMasterAcademy/);
  assert.match(runtime, /\/api\/world\/academy\/master/);
  assert.match(runtime, /\/api\/world\/academy\/master\/mission/);
  assert.match(runtime, /stopImmediatePropagation/);
  assert.match(runtime, /wisdo:world-player-state/);
  assert.match(ui, /wisdo:game-scene/);
  assert.match(ui, /wisdo:npc-action/);
  assert.match(world3d, /installOgMasterAcademyRuntime/);
  assert.doesNotMatch(runtime, /placeTrade|closeTrade|commandBus|mt4Command/i);
  assert.doesNotMatch(ui, /placeTrade|closeTrade|commandBus|mt4Command/i);
});

test('generated NPC runtime consumes semantic greet/speak/point/seated action requests with clip fallback', () => {
  const runtime = read('public/app/world/world-npc-visual-runtime.js');
  assert.match(runtime, /wisdo:npc-action/);
  assert.match(runtime, /semanticClipCandidates/);
  assert.match(runtime, /greet/);
  assert.match(runtime, /speak/);
  assert.match(runtime, /point/);
  assert.match(runtime, /seated/);
  assert.match(runtime, /lastActionPlayed/);
});

test('kernel registers OG MASTER education after Arcade progression without giving it MT4 services', () => {
  const kernel = read('server/kernelRouteRegistry.js');
  const routes = read('server/ogMasterWisdoRoutes.js');
  const progression = read('services/ogMasterWisdoProgressionService.js');
  assert.match(kernel, /registerOgMasterWisdoRoutes/);
  assert.match(kernel, /arcadeProgression:\s*arcade\.progression/);
  assert.match(routes, /\/api\/world\/academy\/master/);
  assert.match(progression, /wisdo_og_master_progress/);
  assert.match(progression, /trophyRoom/);
  assert.match(progression, /advancedModules/);
  assert.doesNotMatch(routes, /mt4CommandService|placeTrade|closeTrade|commandBus/);
  assert.doesNotMatch(progression, /mt4CommandService|placeTrade|closeTrade|commandBus/);
});
