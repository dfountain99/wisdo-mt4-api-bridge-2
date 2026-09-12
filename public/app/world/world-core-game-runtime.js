import { createWorldDestinationRouter } from './world-destination-router.js';
import { startWorldGameRuntime } from './world-game-runtime.js';
import { startWorldDirector } from './world-director.js';
import { startWorldTelemetry } from './world-telemetry.js';

const router=createWorldDestinationRouter();
const game=startWorldGameRuntime();
const director=startWorldDirector();
const telemetry=startWorldTelemetry();
globalThis.WisdoCoreExperienceV1=Object.freeze({router,game,director,telemetry,version:'1.0.0'});
window.addEventListener('pagehide',()=>{telemetry.stop?.();director.stop?.();game.stop?.();router.stop?.();},{once:true});
