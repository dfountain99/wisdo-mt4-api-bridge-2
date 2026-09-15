export const OG_MASTER_SERVER_BUILD = 'OG-MASTER-WISDO-PLAYABLE-V1';
export const OG_MASTER_ASSET_ID = 'og-master-wisdo';
export const OG_MASTER_INTRO_MISSION_ID = 'trained-mind-waits';

const MISSION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'trained-mind-waits',
    category: 'trading_psychology',
    title: 'A Trained Mind Waits',
    repeatable: true,
    minimumScore: 67,
    prerequisites: Object.freeze([]),
    answerKey: Object.freeze([1, 1, 2]),
    reward: Object.freeze({ masteryXp: 60, psychologyXp: 45 }),
  }),
  Object.freeze({
    id: 'impulse-is-expensive',
    category: 'trading_psychology',
    title: 'Impulse Is Expensive',
    repeatable: false,
    minimumScore: 75,
    prerequisites: Object.freeze(['trained-mind-waits']),
    answerKey: Object.freeze([1, 1, 0, 1]),
    reward: Object.freeze({ masteryXp: 120, psychologyXp: 100, badge: 'founder-discipline', title: 'Disciplined Mind', trophy: 'golden-stillness-token' }),
  }),
  Object.freeze({
    id: 'campaign-keeper',
    category: 'strategic_wisdom',
    title: 'Campaign Keeper',
    repeatable: false,
    minimumScore: 80,
    prerequisites: Object.freeze(['impulse-is-expensive']),
    answerKey: Object.freeze([0, 1, 1, 1]),
    reward: Object.freeze({ masteryXp: 170, psychologyXp: 70, badge: 'campaign-keeper', title: 'Campaign Keeper', trophy: 'founder-campaign-seal' }),
  }),
  Object.freeze({
    id: 'founder-mastery-trial',
    category: 'mastery_trials',
    title: 'Founder Mastery Trial',
    repeatable: false,
    minimumScore: 90,
    prerequisites: Object.freeze(['trained-mind-waits', 'impulse-is-expensive', 'campaign-keeper']),
    answerKey: Object.freeze([1, 0, 0, 1, 1]),
    reward: Object.freeze({ masteryXp: 300, psychologyXp: 150, badge: 'og-master-initiate', title: 'Master Wisdo Initiate', trophy: 'og-master-founder-crest', eliteFloorAccess: true, advancedCoachModule: 'founder-discipline' }),
  }),
]);

const byId = new Map(MISSION_DEFINITIONS.map((mission) => [mission.id, mission]));
const unique = (values = []) => [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createOgMasterProgress() {
  return {
    schemaVersion: 1,
    build: OG_MASTER_SERVER_BUILD,
    completed: {},
    masteryXp: 0,
    psychologyXp: 0,
    bestMastery: 0,
    badges: [],
    titles: [],
    trophies: [],
    advancedCoachModules: [],
    eliteFloorAccess: false,
    updatedAt: null,
  };
}

export function normalizeOgMasterProgress(value = {}) {
  const progress = { ...createOgMasterProgress(), ...(value && typeof value === 'object' ? value : {}) };
  progress.completed = progress.completed && typeof progress.completed === 'object' && !Array.isArray(progress.completed) ? { ...progress.completed } : {};
  progress.masteryXp = Math.max(0, finiteInt(progress.masteryXp));
  progress.psychologyXp = Math.max(0, finiteInt(progress.psychologyXp));
  progress.bestMastery = clamp(finiteInt(progress.bestMastery), 0, 100);
  progress.badges = unique(progress.badges);
  progress.titles = unique(progress.titles);
  progress.trophies = unique(progress.trophies);
  progress.advancedCoachModules = unique(progress.advancedCoachModules);
  progress.eliteFloorAccess = Boolean(progress.eliteFloorAccess);
  return progress;
}

export function getOgMasterMissionDefinition(id) {
  return byId.get(String(id || '')) || null;
}

export function gradeOgMasterMission(id, answers = []) {
  const mission = getOgMasterMissionDefinition(id);
  if (!mission) {
    const error = new Error('Unknown OG MASTER mission.');
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(answers) || answers.length !== mission.answerKey.length) {
    const error = new Error(`Mission requires exactly ${mission.answerKey.length} answers.`);
    error.statusCode = 400;
    throw error;
  }
  const normalized = answers.map((answer) => finiteInt(answer, -1));
  if (normalized.some((answer) => answer < 0 || answer > 12)) {
    const error = new Error('Mission answers must be valid option indexes.');
    error.statusCode = 400;
    throw error;
  }
  const correct = mission.answerKey.reduce((sum, expected, index) => sum + (normalized[index] === expected ? 1 : 0), 0);
  const score = Math.round((correct / mission.answerKey.length) * 100);
  return Object.freeze({ missionId: mission.id, score, correct, total: mission.answerKey.length, passed: score >= mission.minimumScore, minimumScore: mission.minimumScore });
}

export function ogMasterChamberUnlock(progressValue = {}, { arcadeLevel = null } = {}) {
  const progress = normalizeOgMasterProgress(progressValue);
  const verifiedArcadeLevel = Number.isFinite(Number(arcadeLevel)) ? Math.max(0, finiteInt(arcadeLevel)) : null;
  const arcadeQualified = verifiedArcadeLevel !== null && verifiedArcadeLevel >= 5;
  const masteryQualified = progress.bestMastery >= 70;
  return Object.freeze({
    unlocked: arcadeQualified || masteryQualified,
    arcadeLevel: verifiedArcadeLevel,
    arcadeLevelConnected: verifiedArcadeLevel !== null,
    requiredArcadeLevel: 5,
    bestMastery: progress.bestMastery,
    requiredBestMastery: 70,
    qualifiedBy: arcadeQualified ? 'arcade_level' : masteryQualified ? 'verified_mastery' : null,
    introMissionAvailable: true,
    note: verifiedArcadeLevel === null ? 'Arcade-level bridge is not connected to this World persistence path yet; verified Mastery can unlock the chamber.' : null,
  });
}

function missionAccess(mission, progress, unlock) {
  const completedIds = new Set(Object.keys(progress.completed || {}).filter((id) => progress.completed[id]?.passed));
  const prerequisitesMet = mission.prerequisites.every((id) => completedIds.has(id));
  const intro = mission.id === OG_MASTER_INTRO_MISSION_ID;
  const completed = Boolean(progress.completed?.[mission.id]?.passed);
  const available = intro || (unlock.unlocked && prerequisitesMet && (mission.repeatable || !completed));
  let reason = null;
  if (!available) {
    if (!unlock.unlocked) reason = 'Complete the Academy introduction with 70+ verified Mastery or reach Trading Arcade Level 5.';
    else if (!prerequisitesMet) reason = 'Complete the required earlier OG MASTER mission first.';
    else if (completed && !mission.repeatable) reason = 'Mission already completed.';
  }
  return Object.freeze({ available, prerequisitesMet, completed, reason });
}

export function publicOgMasterState(progressValue = {}, { arcadeLevel = null } = {}) {
  const progress = normalizeOgMasterProgress(progressValue);
  const unlock = ogMasterChamberUnlock(progress, { arcadeLevel });
  const missions = MISSION_DEFINITIONS.map((mission) => {
    const access = missionAccess(mission, progress, unlock);
    const record = progress.completed?.[mission.id] || null;
    return Object.freeze({
      id: mission.id,
      category: mission.category,
      title: mission.title,
      repeatable: mission.repeatable,
      minimumScore: mission.minimumScore,
      prerequisites: mission.prerequisites,
      ...access,
      bestScore: record ? clamp(finiteInt(record.bestScore), 0, 100) : 0,
      attempts: record ? Math.max(0, finiteInt(record.attempts)) : 0,
      completedAt: record?.completedAt || null,
    });
  });
  return Object.freeze({
    build: OG_MASTER_SERVER_BUILD,
    assetId: OG_MASTER_ASSET_ID,
    chamber: unlock,
    progress: Object.freeze({
      masteryXp: progress.masteryXp,
      psychologyXp: progress.psychologyXp,
      bestMastery: progress.bestMastery,
      badges: Object.freeze([...progress.badges]),
      titles: Object.freeze([...progress.titles]),
      trophies: Object.freeze([...progress.trophies]),
      advancedCoachModules: Object.freeze([...progress.advancedCoachModules]),
      eliteFloorAccess: progress.eliteFloorAccess,
      completedCount: Object.values(progress.completed).filter((record) => record?.passed).length,
      updatedAt: progress.updatedAt || null,
    }),
    missions: Object.freeze(missions),
    executionFromWorldEnabled: false,
  });
}

export function applyOgMasterMissionAttempt(progressValue = {}, { missionId, answers, arcadeLevel = null, now = new Date() } = {}) {
  const progress = normalizeOgMasterProgress(progressValue);
  const mission = getOgMasterMissionDefinition(missionId);
  if (!mission) {
    const error = new Error('Unknown OG MASTER mission.');
    error.statusCode = 400;
    throw error;
  }
  const before = publicOgMasterState(progress, { arcadeLevel });
  const access = before.missions.find((item) => item.id === mission.id);
  if (!access?.available) {
    const error = new Error(access?.reason || 'This OG MASTER mission is not available yet.');
    error.statusCode = 403;
    throw error;
  }
  const grade = gradeOgMasterMission(mission.id, answers);
  const timestamp = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const previous = progress.completed[mission.id] || { attempts: 0, bestScore: 0, passed: false, completedAt: null };
  const firstCompletion = grade.passed && !previous.passed;
  progress.completed[mission.id] = {
    attempts: Math.max(0, finiteInt(previous.attempts)) + 1,
    bestScore: Math.max(clamp(finiteInt(previous.bestScore), 0, 100), grade.score),
    passed: Boolean(previous.passed || grade.passed),
    completedAt: previous.completedAt || (grade.passed ? timestamp : null),
    lastAttemptAt: timestamp,
  };
  progress.bestMastery = Math.max(progress.bestMastery, grade.score);
  const awards = { masteryXp: 0, psychologyXp: 0, badges: [], titles: [], trophies: [], advancedCoachModules: [], eliteFloorAccess: false };
  if (firstCompletion) {
    const reward = mission.reward || {};
    awards.masteryXp = Math.max(0, finiteInt(reward.masteryXp));
    awards.psychologyXp = Math.max(0, finiteInt(reward.psychologyXp));
    progress.masteryXp += awards.masteryXp;
    progress.psychologyXp += awards.psychologyXp;
    if (reward.badge && !progress.badges.includes(reward.badge)) { progress.badges.push(reward.badge); awards.badges.push(reward.badge); }
    if (reward.title && !progress.titles.includes(reward.title)) { progress.titles.push(reward.title); awards.titles.push(reward.title); }
    if (reward.trophy && !progress.trophies.includes(reward.trophy)) { progress.trophies.push(reward.trophy); awards.trophies.push(reward.trophy); }
    if (reward.advancedCoachModule && !progress.advancedCoachModules.includes(reward.advancedCoachModule)) { progress.advancedCoachModules.push(reward.advancedCoachModule); awards.advancedCoachModules.push(reward.advancedCoachModule); }
    if (reward.eliteFloorAccess && !progress.eliteFloorAccess) { progress.eliteFloorAccess = true; awards.eliteFloorAccess = true; }
  }
  progress.updatedAt = timestamp;
  return Object.freeze({
    progress,
    grade,
    firstCompletion,
    awards: Object.freeze({ ...awards, badges: Object.freeze(awards.badges), titles: Object.freeze(awards.titles), trophies: Object.freeze(awards.trophies), advancedCoachModules: Object.freeze(awards.advancedCoachModules) }),
    state: publicOgMasterState(progress, { arcadeLevel }),
  });
}

export function ogMasterMissionCatalog() {
  return MISSION_DEFINITIONS.map(({ answerKey: _answerKey, reward: _reward, ...mission }) => Object.freeze({ ...mission }));
}
