// WISDO Personal World DNA v1
// Engine-neutral contract: AI edits this document; Babylon/Unreal/other runtimes render it.
export const WORLD_DNA_VERSION = 1;

export const WORLD_DNA_ENUMS = Object.freeze({
  visibility: ['private', 'invite_only', 'friends', 'discoverable'],
  era: ['ancient', 'medieval', 'modern', 'future', 'fantasy', 'custom'],
  gameMode: ['social', 'fps', 'rpg', 'racing', 'simulator', 'education', 'trading', 'hybrid'],
  timeOfDay: ['dawn', 'day', 'sunset', 'night', 'dynamic'],
  weather: ['clear', 'rain', 'storm', 'snow', 'fog', 'dynamic'],
});

function clean(value, max = 120) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}
function oneOf(value, allowed, fallback) {
  const normalized = clean(value, 40).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}
function list(value, max = 32, itemMax = 80) {
  return [...new Set((Array.isArray(value) ? value : []).map((v) => clean(v, itemMax)).filter(Boolean))].slice(0, max);
}

export function createDefaultWorldDNA(user = {}) {
  const userId = clean(user.id, 120) || 'unknown';
  const ownerName = clean(user.global_name || user.globalName || user.username || 'Explorer', 60) || 'Explorer';
  const now = new Date().toISOString();
  return {
    schemaVersion: WORLD_DNA_VERSION,
    worldId: `planet:${userId}`,
    ownerUserId: userId,
    name: `${ownerName}'s World`,
    description: 'A personal WISDO world waiting to be imagined.',
    visibility: 'private',
    discoverable: false,
    generation: { status: 'seed', revision: 1, sourcePrompt: '', lastCommand: '' },
    environment: {
      era: 'custom',
      artStyle: 'cinematic',
      biome: 'void',
      timeOfDay: 'night',
      weather: 'clear',
      gravity: 1,
      skyPreset: 'wisdo-void',
      terrainPreset: 'floating-origin',
    },
    gameplay: {
      mode: 'social',
      perspective: 'third_person',
      pvp: false,
      respawn: true,
      modules: ['social', 'creator'],
      rules: [],
    },
    architect: {
      companionForm: 'blob',
      onboardingComplete: false,
      openingQuestion: 'What world do you want to create?',
    },
    spawn: { x: 0, y: 2, z: 0, yaw: 0 },
    objects: [],
    portals: [],
    invitedUserIds: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function applyWorldDNAUpdate(dna, body = {}) {
  const next = structuredClone(dna);
  if (body.name != null) next.name = clean(body.name, 80) || next.name;
  if (body.description != null) next.description = clean(body.description, 400);
  if (body.visibility != null) next.visibility = oneOf(body.visibility, WORLD_DNA_ENUMS.visibility, next.visibility);
  next.discoverable = next.visibility === 'discoverable';

  const env = body.environment && typeof body.environment === 'object' ? body.environment : {};
  if (env.era != null) next.environment.era = oneOf(env.era, WORLD_DNA_ENUMS.era, next.environment.era);
  if (env.timeOfDay != null) next.environment.timeOfDay = oneOf(env.timeOfDay, WORLD_DNA_ENUMS.timeOfDay, next.environment.timeOfDay);
  if (env.weather != null) next.environment.weather = oneOf(env.weather, WORLD_DNA_ENUMS.weather, next.environment.weather);
  if (env.artStyle != null) next.environment.artStyle = clean(env.artStyle, 60) || next.environment.artStyle;
  if (env.biome != null) next.environment.biome = clean(env.biome, 60) || next.environment.biome;
  if (env.skyPreset != null) next.environment.skyPreset = clean(env.skyPreset, 60) || next.environment.skyPreset;
  if (env.terrainPreset != null) next.environment.terrainPreset = clean(env.terrainPreset, 60) || next.environment.terrainPreset;
  if (env.gravity != null && Number.isFinite(Number(env.gravity))) next.environment.gravity = Math.max(0, Math.min(4, Number(env.gravity)));

  const gameplay = body.gameplay && typeof body.gameplay === 'object' ? body.gameplay : {};
  if (gameplay.mode != null) next.gameplay.mode = oneOf(gameplay.mode, WORLD_DNA_ENUMS.gameMode, next.gameplay.mode);
  if (gameplay.perspective != null) next.gameplay.perspective = ['first_person','third_person'].includes(clean(gameplay.perspective, 30)) ? clean(gameplay.perspective, 30) : next.gameplay.perspective;
  if (typeof gameplay.pvp === 'boolean') next.gameplay.pvp = gameplay.pvp;
  if (typeof gameplay.respawn === 'boolean') next.gameplay.respawn = gameplay.respawn;
  if (gameplay.modules != null) next.gameplay.modules = list(gameplay.modules, 24, 60);
  if (gameplay.rules != null) next.gameplay.rules = list(gameplay.rules, 48, 160);

  if (body.invitedUserIds != null) next.invitedUserIds = list(body.invitedUserIds, 128, 120);
  if (body.tags != null) next.tags = list(body.tags, 20, 40);
  if (body.sourcePrompt != null) next.generation.sourcePrompt = clean(body.sourcePrompt, 1200);
  if (body.lastCommand != null) next.generation.lastCommand = clean(body.lastCommand, 1200);
  next.generation.revision = Math.max(1, Number(next.generation.revision || 1) + 1);
  next.updatedAt = new Date().toISOString();
  return next;
}

export function worldRuntimeManifest(dna) {
  return {
    worldId: dna.worldId,
    revision: dna.generation.revision,
    rendererContract: 'wisdo-world-dna-v1',
    environment: dna.environment,
    gameplay: dna.gameplay,
    spawn: dna.spawn,
    objects: dna.objects,
    portals: dna.portals,
    architect: dna.architect,
  };
}
