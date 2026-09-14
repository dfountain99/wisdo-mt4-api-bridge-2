import { startWorldGameRuntime } from './world-game-runtime.js';
import { startWorldDirector } from './world-director.js';
import { startWorldTelemetry } from './world-telemetry.js';
import { startWorldCompanionDashboard } from './world-companion-dashboard.js';
import { startWorldAudioRuntime } from './world-audio-runtime.js';
import { startWorldPopulationRuntime } from './world-population-runtime.js';
import { startWorldAtmosphereRuntime } from './world-atmosphere-runtime.js';

const BUILD = 'MASTER-WORLD-V1';
const systems = [];
let stopped = false;

function start(name, factory) {
  try {
    const runtime = factory();
    if (runtime) systems.push([name, runtime]);
    return runtime;
  } catch (error) {
    console.warn(`WISDO World ${name} degraded`, error);
    return null;
  }
}

const game = start('game', startWorldGameRuntime);
const director = start('director', startWorldDirector);
const telemetry = start('telemetry', startWorldTelemetry);
const atmosphere = start('atmosphere', startWorldAtmosphereRuntime);
const companion = start('companion', startWorldCompanionDashboard);
const audio = start('audio', startWorldAudioRuntime);
const population = start('population', startWorldPopulationRuntime);

const marker = document.querySelector('[data-world-build]');
if (marker) { marker.dataset.worldBuild = BUILD; marker.textContent = `BUILD ${BUILD}`; }
document.documentElement.dataset.wisdoWorldMaster = BUILD;

globalThis.WisdoWorldMaster = Object.freeze({
  build: BUILD,
  product: 'WISDO_WORLD',
  architecture: 'single-world-route-single-authority-event-driven',
  systems: Object.freeze({
    game: Boolean(game),
    director: Boolean(director),
    telemetry: Boolean(telemetry),
    atmosphere: Boolean(atmosphere),
    companion: Boolean(companion),
    audio: Boolean(audio),
    ambientPopulation: Boolean(population),
  }),
  fastModeExplicitOnly: true,
  financialAuthority: 'SERVER',
  realPresenceFabricated: false,
});

function stop() {
  if (stopped) return; stopped = true;
  for (const [name, runtime] of systems.reverse()) {
    try { runtime?.stop?.(); } catch (error) { console.warn(`WISDO World ${name} cleanup degraded`, error); }
  }
  delete globalThis.WisdoWorldMaster;
  delete document.documentElement.dataset.wisdoWorldMaster;
}

window.addEventListener('pagehide', stop, { once: true });
window.dispatchEvent(new CustomEvent('wisdo:world-master-ready', { detail: { build: BUILD, systems: globalThis.WisdoWorldMaster.systems } }));
