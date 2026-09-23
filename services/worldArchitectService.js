// WISDO World Architect v1
// Deterministic command compiler. It never executes generated code; it emits safe World DNA patches.
import { WORLD_DNA_ENUMS } from './worldDNAService.js';

function text(value) { return String(value || '').trim().slice(0, 1200); }
function has(q, ...words) { return words.some((word) => q.includes(word)); }

export function compileWorldPrompt(prompt, currentDNA = {}) {
  const raw = text(prompt);
  const q = raw.toLowerCase();
  const patch = { sourcePrompt: raw, lastCommand: raw, environment: {}, gameplay: {} };
  const understood = [];

  const eraMap = [
    ['medieval', ['medieval','castle','knight','kingdom']],
    ['ancient', ['ancient','roman','egyptian','greek']],
    ['modern', ['modern','present day','city']],
    ['future', ['future','futuristic','cyberpunk','sci-fi','scifi']],
    ['fantasy', ['fantasy','magic','dragon']],
  ];
  for (const [era, words] of eraMap) if (has(q, ...words)) { patch.environment.era = era; understood.push(`era:${era}`); break; }

  if (has(q,'night','midnight')) { patch.environment.timeOfDay='night'; understood.push('time:night'); }
  else if (has(q,'sunrise','dawn')) { patch.environment.timeOfDay='dawn'; understood.push('time:dawn'); }
  else if (has(q,'sunset','dusk')) { patch.environment.timeOfDay='sunset'; understood.push('time:sunset'); }
  else if (has(q,'daytime','day light','daylight')) { patch.environment.timeOfDay='day'; understood.push('time:day'); }

  for (const weather of WORLD_DNA_ENUMS.weather) {
    if (weather !== 'dynamic' && q.includes(weather)) { patch.environment.weather=weather; understood.push(`weather:${weather}`); break; }
  }
  if (has(q,'first person','first-person','fps')) { patch.gameplay.perspective='first_person'; patch.gameplay.mode='fps'; understood.push('mode:fps'); }
  else if (has(q,'racing','race game')) { patch.gameplay.mode='racing'; understood.push('mode:racing'); }
  else if (has(q,'rpg','role playing','role-playing')) { patch.gameplay.mode='rpg'; understood.push('mode:rpg'); }
  else if (has(q,'trading room','trading world','trading simulator')) { patch.gameplay.mode='trading'; understood.push('mode:trading'); }

  if (has(q,'pvp','player versus player')) { patch.gameplay.pvp = !has(q,'no pvp','disable pvp'); understood.push(`pvp:${patch.gameplay.pvp}`); }
  if (has(q,'public','discoverable','anyone can visit')) { patch.visibility='discoverable'; understood.push('visibility:discoverable'); }
  else if (has(q,'invite only','invite-only')) { patch.visibility='invite_only'; understood.push('visibility:invite_only'); }
  else if (has(q,'private')) { patch.visibility='private'; understood.push('visibility:private'); }

  const modules = new Set(currentDNA.gameplay?.modules || ['social','creator']);
  if (patch.gameplay.mode === 'fps') ['combat','weapons','health','respawn'].forEach((x)=>modules.add(x));
  if (patch.gameplay.mode === 'racing') ['vehicles','checkpoints','timing'].forEach((x)=>modules.add(x));
  if (patch.gameplay.mode === 'rpg') ['inventory','quests','npc-dialogue'].forEach((x)=>modules.add(x));
  patch.gameplay.modules = [...modules].slice(0,24);

  return {
    ok: true,
    prompt: raw,
    understood,
    patch,
    requiresAssetGeneration: has(q,'castle','city','village','forest','mountain','house','tower','arena','spaceship'),
    safeRuntimeMutation: true,
  };
}
