export const WORLD_VERSION = '2.0.0-third-person';
export const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js';

export const WORLD_CONFIG = Object.freeze({
  player: Object.freeze({
    capsuleRadius: 0.38,
    capsuleHalfHeight: 0.55,
    walkSpeed: 3.2,
    runSpeed: 5.2,
    sprintSpeed: 7.5,
    acceleration: 20,
    deceleration: 26,
    airControl: 0.38,
    jumpVelocity: 7,
    gravity: -24,
    slopeLimitDegrees: 45,
    groundSnapDistance: 0.25,
    stepHeight: 0.32,
    coyoteTimeMs: 100,
    deathHeight: -20,
    spawn: Object.freeze([0, 0.02, 68]),
  }),
  camera: Object.freeze({
    fieldOfView: 68,
    sprintFieldOfView: 74,
    distance: 4.5,
    minDistance: 1.2,
    maxDistance: 6,
    shoulderOffset: 0.45,
    targetHeight: 1.55,
    pitchMinDegrees: -20,
    pitchMaxDegrees: 65,
    damping: 14,
    sensitivity: 0.0022,
  }),
  world: Object.freeze({
    halfSize: 110,
    fogNear: 72,
    fogFar: 255,
    interactionRadius: 4.2,
    fixedDt: 1 / 60,
    maxFrameDt: 0.1,
  }),
});

export const QUALITY_PRESETS = Object.freeze({
  low: Object.freeze({ dpr: 1, shadows: false, shadowMap: 512, propDensity: 0.45, skylineDensity: 0.55, antialias: false }),
  medium: Object.freeze({ dpr: 1.25, shadows: true, shadowMap: 1024, propDensity: 0.72, skylineDensity: 0.78, antialias: true }),
  high: Object.freeze({ dpr: 1.5, shadows: true, shadowMap: 2048, propDensity: 1, skylineDensity: 1, antialias: true }),
});

export const LOCAL_DESTINATIONS = Object.freeze([
  { id: 'trading-tower', name: 'Trading Tower', short: 'TRADE', minLevel: 0, minTier: 'Member', route: '/member/command-center', icon: '↗', description: 'Live account command, protection, copy controls, and operator context.' },
  { id: 'academy', name: 'WISDO Academy', short: 'LEARN', minLevel: 0, minTier: 'Member', route: '/member/education', icon: '▤', description: 'Education, practice, readiness, and strategy learning.' },
  { id: 'vault', name: 'The Vault', short: 'OWN', minLevel: 1, minTier: 'Sovereign', route: '/member/bots', icon: '◇', description: 'Owned bots, licenses, presets, and premium systems.' },
  { id: 'bot-arena', name: 'Bot Arena', short: 'BUILD', minLevel: 0, minTier: 'Member', route: '/member/bots', icon: '⬡', description: 'Explore bot families and choose systems for your account.' },
  { id: 'switch-lab', name: 'Switch Lab', short: 'TUNE', minLevel: 1, minTier: 'Sovereign', route: '/member/wisdo', icon: '⌁', description: 'Tune WISDO capabilities and account-control behavior.' },
  { id: 'growth-chamber', name: 'Growth Chamber', short: 'GROW', minLevel: 0, minTier: 'Member', route: '/member/accounts', icon: '△', description: 'Account growth, health, history, and milestones.' },
  { id: 'strategy-lab', name: 'Strategy Lab', short: 'ANALYZE', minLevel: 2, minTier: 'Elite', route: '/member/simulator', icon: '⌬', description: 'Simulation, research, review, and strategy experiments.' },
  { id: 'coach-center', name: 'Coach Center', short: 'COACH', minLevel: 0, minTier: 'Member', route: '/member/wisdo', icon: '◉', description: 'WISDO intelligence, coaching, and guided operator actions.' },
  { id: 'culture-arena', name: 'Culture Arena', short: 'BELONG', minLevel: 0, minTier: 'Member', route: '/member/social', icon: '◎', description: 'Community, social trading, competition, and shared progress.' },
  { id: 'marketplace', name: 'Marketplace', short: 'UNLOCK', minLevel: 0, minTier: 'Member', route: '/pricing', icon: '▣', description: 'Plans, products, bots, and access upgrades.' },
  { id: 'vps-forge', name: 'VPS Forge', short: 'RUN', minLevel: 1, minTier: 'Sovereign', route: '/member/command-center', icon: '▦', description: 'Runtime operations and always-on trading infrastructure.' },
  { id: 'private-rooms', name: 'Private Rooms', short: 'COMMAND', minLevel: 3, minTier: 'Commander', route: '/member/home', icon: '♛', description: 'Commander identity, trophies, and private headquarters.' },
  { id: 'war-room', name: 'War Room', short: 'OPERATE', minLevel: 3, minTier: 'Commander', route: '/member/admin-wisdo', icon: '◆', description: 'High-authority WISDO operations.' },
]);

export const WORLD_LOCATIONS = Object.freeze({
  'trading-tower': Object.freeze({ position: [0, 0, -78], interaction: [0, 0, -57], size: [28, 92, 24], kind: 'tower' }),
  academy: Object.freeze({ position: [-58, 0, -58], interaction: [-45, 0, -45], size: [28, 16, 24], kind: 'campus' }),
  vault: Object.freeze({ position: [-82, 0, 5], interaction: [-66, 0, 5], size: [24, 13, 28], kind: 'vault' }),
  'bot-arena': Object.freeze({ position: [-66, 0, 62], interaction: [-52, 0, 52], size: [30, 18, 30], kind: 'arena' }),
  'switch-lab': Object.freeze({ position: [-20, 0, 82], interaction: [-20, 0, 66], size: [27, 16, 23], kind: 'lab' }),
  'growth-chamber': Object.freeze({ position: [34, 0, 82], interaction: [31, 0, 66], size: [30, 18, 22], kind: 'chamber' }),
  'strategy-lab': Object.freeze({ position: [82, 0, 38], interaction: [66, 0, 32], size: [26, 17, 25], kind: 'lab' }),
  'coach-center': Object.freeze({ position: [67, 0, -40], interaction: [53, 0, -35], size: [28, 20, 26], kind: 'center' }),
  'culture-arena': Object.freeze({ position: [84, 0, -8], interaction: [67, 0, -7], size: [30, 17, 28], kind: 'arena' }),
  marketplace: Object.freeze({ position: [-55, 0, 23], interaction: [-39, 0, 22], size: [30, 18, 26], kind: 'market' }),
  'vps-forge': Object.freeze({ position: [72, 0, 72], interaction: [57, 0, 60], size: [28, 20, 26], kind: 'forge' }),
  'private-rooms': Object.freeze({ position: [35, 0, -91], interaction: [30, 0, -70], size: [25, 15, 18], kind: 'private' }),
  'war-room': Object.freeze({ position: [-36, 0, -92], interaction: [-30, 0, -70], size: [25, 15, 18], kind: 'war' }),
});

export function chooseAutoQuality() {
  const coarse = globalThis.matchMedia?.('(pointer: coarse)').matches;
  const memory = Number(globalThis.navigator?.deviceMemory || 0);
  const cores = Number(globalThis.navigator?.hardwareConcurrency || 4);
  if (coarse || (memory > 0 && memory <= 4) || cores <= 4) return 'low';
  if ((memory > 0 && memory <= 8) || cores <= 8) return 'medium';
  return 'high';
}
