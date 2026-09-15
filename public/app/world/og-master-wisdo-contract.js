export const OG_MASTER_WISDO_BUILD = 'OG-MASTER-WISDO-V1';
export const OG_MASTER_WISDO_NPC_ID = 'og_master_wisdo';

export const OG_MASTER_WISDO = Object.freeze({
  npcId: OG_MASTER_WISDO_NPC_ID,
  name: 'OG MASTER WISDO',
  role: 'Founder / Legendary Mentor / Master Guide',
  hierarchyTier: 3,
  district: 'WISDO Academy',
  room: 'Master Chamber',
  location: Object.freeze({
    worldScene: 'academy',
    wing: 'Upper Tier Founder Wing',
    centralWorldAnchor: Object.freeze([-42, 0, -49]),
    interactionRadius: 5.25,
  }),
  missionCategories: Object.freeze([
    'trading_psychology',
    'strategic_wisdom',
    'mastery_trials',
    'legacy_wisdom',
  ]),
  availability: Object.freeze({
    progressionGated: true,
    storyGated: true,
    prestigeUnlocked: true,
    minimumArcadeLevel: 5,
    minimumBestMastery: 70,
    rule: 'arcade_level_5_or_verified_mastery_70',
  }),
  interactionStyle: Object.freeze([
    'dialogue',
    'mission_assignment',
    'challenge_activation',
    'reward_debrief',
  ]),
  voiceStyle: Object.freeze(['calm', 'deep', 'authoritative']),
  visualTheme: Object.freeze({
    identity: 'elder Black founder mentor',
    beard: 'white',
    eyewear: 'premium gold glasses',
    headpiece: 'regal textured gold crown',
    clothing: 'reflective gold luxury jacket and dark founder tailoring',
    posture: 'calm seated authority',
    room: 'black and gold luxury',
    lighting: 'warm gold prestige lighting',
    tone: 'founder prestige, elder wisdom, strategic mastery',
    forbidden: Object.freeze(['generic NPC', 'cartoon king', 'comedic rich character', 'normal player operator']),
  }),
  chamber: Object.freeze({
    architecture: 'black-and-gold academy founder chamber',
    features: Object.freeze([
      'dark glass',
      'reflective gold details',
      'floating gold data lights',
      'market screens',
      'legacy trophies',
      'founder archive displays',
      'high-level mission table',
      'psychology challenge interface',
      'holographic chart review area',
      'premium throne-like lounge seat',
    ]),
  }),
  dialogue: Object.freeze([
    'Gold is not what you wear. It is what your discipline becomes.',
    'The market exposes the man who has not mastered himself.',
    'Impulse is expensive.',
    'Your account follows your character.',
    'A weak mind seeks action. A trained mind waits.',
    'Mastery is not more trades. Mastery is cleaner decisions.',
    'You are not fighting the chart. You are fighting your own disorder.',
  ]),
  integrations: Object.freeze({
    academyProgression: true,
    worldNpcFramework: true,
    missionSystem: true,
    rewardSystem: true,
    progressionSystem: true,
    smartHomeTrophies: true,
    coachKnowledgeProgression: true,
    futureCoopLearning: true,
    liveMt4Execution: false,
  }),
});

export const OG_MASTER_WISDO_MISSIONS = Object.freeze([
  Object.freeze({
    id: 'trained-mind-waits',
    category: 'trading_psychology',
    title: 'A Trained Mind Waits',
    repeatable: true,
    minimumScore: 67,
    prerequisites: Object.freeze([]),
    lesson: 'Patience under pressure and refusing low-quality action.',
    openingLine: 'A weak mind seeks action. A trained mind waits.',
    scenarios: Object.freeze([
      Object.freeze({ id:'late-entry', prompt:'Price already ran far beyond your planned entry and you feel left behind. What is the disciplined decision?', options:Object.freeze(['Chase with larger size before it goes farther','Wait for a new valid setup or let the move go','Enter now and move the stop farther away']) }),
      Object.freeze({ id:'no-confluence', prompt:'Your trigger appears, but the higher-timeframe structure and risk location do not agree. What now?', options:Object.freeze(['Take it because a trigger is always enough','Skip it until the full setup is aligned','Double the order so one quick move pays more']) }),
      Object.freeze({ id:'boredom', prompt:'Nothing has met your rules for an hour. What is the professional response?', options:Object.freeze(['Create a trade so the session is productive','Reduce your standards because the market is slow','Stay flat and protect decision quality']) }),
    ]),
    reward: Object.freeze({ masteryXp:60, psychologyXp:45, badge:null, title:null, trophy:null }),
  }),
  Object.freeze({
    id: 'impulse-is-expensive',
    category: 'trading_psychology',
    title: 'Impulse Is Expensive',
    repeatable: false,
    minimumScore: 75,
    prerequisites: Object.freeze(['trained-mind-waits']),
    lesson: 'Revenge trading, greed after profit, fear after loss, and emotional reset discipline.',
    openingLine: 'Impulse is expensive.',
    scenarios: Object.freeze([
      Object.freeze({ id:'after-loss', prompt:'You just took a clean loss and immediately feel the urge to win it back. Your next action should be:', options:Object.freeze(['Increase size and recover before the feeling grows','Pause, record why the trade lost, then require a fresh setup','Reverse immediately because the first direction must have been wrong']) }),
      Object.freeze({ id:'after-win', prompt:'You hit your planned target faster than expected and feel invincible. What protects the account?', options:Object.freeze(['Keep firing while confidence is high','Treat the next setup independently and keep the same rules','Raise risk because house money is easier to trade']) }),
      Object.freeze({ id:'fear', prompt:'A valid setup appears after two losses. Fear makes you want to break your process. What is mastery?', options:Object.freeze(['Follow the pre-defined risk and setup rules or stand down deliberately','Enter half-planned and decide the stop later','Ignore the setup but take a random smaller trade']) }),
      Object.freeze({ id:'recovery', prompt:'Your account is down today. Which objective comes first?', options:Object.freeze(['Get back to the starting balance before stopping','Protect decision quality and only take verified opportunities','Use all available margin on the next high-conviction entry']) }),
    ]),
    reward: Object.freeze({ masteryXp:120, psychologyXp:100, badge:'founder-discipline', title:'Disciplined Mind', trophy:'golden-stillness-token' }),
  }),
  Object.freeze({
    id: 'campaign-keeper',
    category: 'strategic_wisdom',
    title: 'Campaign Keeper',
    repeatable: false,
    minimumScore: 80,
    prerequisites: Object.freeze(['impulse-is-expensive']),
    lesson: 'Campaign patience, sizing restraint, hold/exit maturity, and protecting capital from recovery chasing.',
    openingLine: 'Your account follows your character.',
    scenarios: Object.freeze([
      Object.freeze({ id:'reduce-size', prompt:'Volatility expands and your normal stop distance doubles. To keep risk controlled, you should:', options:Object.freeze(['Reduce position size to preserve the planned account risk','Keep the same lot size because volatility creates opportunity','Remove the stop until volatility returns to normal']) }),
      Object.freeze({ id:'hold', prompt:'A trade is progressing normally but has not reached the planned objective. No invalidation has occurred. What is the mature choice?', options:Object.freeze(['Exit only because green profit is visible','Follow the campaign plan and manage only on defined evidence','Add maximum size every tick to force a faster result']) }),
      Object.freeze({ id:'walk-away', prompt:'Your daily decision quality is deteriorating and you are breaking review rules. What can be the strongest trade?', options:Object.freeze(['One final recovery attempt','Walking away and preserving the account','Changing systems mid-session']) }),
      Object.freeze({ id:'protect', prompt:'A setup offers poor reward relative to its required risk even though direction looks attractive. What should decide?', options:Object.freeze(['The excitement of being right','The quality of the full risk/reward decision','How much money was lost earlier']) }),
    ]),
    reward: Object.freeze({ masteryXp:170, psychologyXp:70, badge:'campaign-keeper', title:'Campaign Keeper', trophy:'founder-campaign-seal' }),
  }),
  Object.freeze({
    id: 'founder-mastery-trial',
    category: 'mastery_trials',
    title: 'Founder Mastery Trial',
    repeatable: false,
    minimumScore: 90,
    prerequisites: Object.freeze(['trained-mind-waits','impulse-is-expensive','campaign-keeper']),
    lesson: 'High-pressure judgment: signal quality, no-trade decisions, risk preservation, and disciplined maturity.',
    openingLine: 'Mastery is not more trades. Mastery is cleaner decisions.',
    scenarios: Object.freeze([
      Object.freeze({ id:'signal-pressure', prompt:'A popular signal arrives under time pressure, but it conflicts with your verified structure. Choose:', options:Object.freeze(['Follow the crowd before the entry disappears','Require your own structure and risk permission before acting','Enter first and analyze after']) }),
      Object.freeze({ id:'uncertain-edge', prompt:'Your edge is unclear and two independent conditions disagree. The founder-level response is:', options:Object.freeze(['No trade until uncertainty resolves','Split the difference with two opposite positions','Use larger size so a small move matters']) }),
      Object.freeze({ id:'drawdown', prompt:'You are in drawdown and the next valid setup has normal quality. How should the loss change your risk?', options:Object.freeze(['It should not justify revenge sizing; keep risk inside the plan','Triple risk because the account needs recovery','Move the stop closer than structure allows so the lot can be larger']) }),
      Object.freeze({ id:'character', prompt:'What is the purpose of discipline when no one else can see your trading decisions?', options:Object.freeze(['To make every trade win','To keep behavior aligned with the process even without external pressure','To avoid documenting mistakes']) }),
      Object.freeze({ id:'mastery', prompt:'Which statement best describes mastery?', options:Object.freeze(['More trades create more mastery','Cleaner decisions, controlled risk, and the ability to wait','Never taking a loss']) }),
    ]),
    reward: Object.freeze({ masteryXp:300, psychologyXp:150, badge:'og-master-initiate', title:'Master Wisdo Initiate', trophy:'og-master-founder-crest', eliteFloorAccess:true, advancedCoachModule:'founder-discipline' }),
  }),
]);

export function missionById(id){ return OG_MASTER_WISDO_MISSIONS.find((mission)=>mission.id===String(id||'')) || null; }

export function chamberUnlockState({arcadeLevel=1,bestMastery=0}={}){
  const level=Math.max(1,Math.trunc(Number(arcadeLevel)||1));
  const mastery=Math.max(0,Math.min(100,Math.trunc(Number(bestMastery)||0)));
  const unlocked=level>=OG_MASTER_WISDO.availability.minimumArcadeLevel || mastery>=OG_MASTER_WISDO.availability.minimumBestMastery;
  return Object.freeze({unlocked,arcadeLevel:level,bestMastery:mastery,requiredArcadeLevel:5,requiredBestMastery:70,rule:OG_MASTER_WISDO.availability.rule});
}
