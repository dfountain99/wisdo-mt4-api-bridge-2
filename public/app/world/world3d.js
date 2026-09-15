import { createWorldExperience as createProductionWorldExperience } from './world3d-production.js';
import { installWorldNpcVisuals } from './world-npc-visual-runtime.js';
import { installOgMasterAcademyRuntime } from './og-master-academy-runtime.js';

export async function createWorldExperience(options = {}) {
  let renderContext = null;
  let npcRuntime = null;
  let academyRuntime = null;
  let destroyed = false;
  const externalRenderContext = options.onRenderContext;

  const world = await createProductionWorldExperience({
    ...options,
    onRenderContext(context = {}) {
      renderContext = context;
      try { externalRenderContext?.(context); } catch (error) { console.warn('External WISDO render-context observer degraded.', error); }
    },
  });

  const instanceId = globalThis.WisdoWorldRenderInstance || null;
  const debug = new URLSearchParams(globalThis.location?.search || '').get('debug') === '1';
  const npcTask = renderContext?.THREE && renderContext?.scene
    ? installWorldNpcVisuals({
        THREE: renderContext.THREE,
        scene: renderContext.scene,
        instanceId,
        debug,
      }).then((runtime) => {
        if (destroyed) {
          runtime?.destroy?.();
          return null;
        }
        npcRuntime = runtime;
        return runtime;
      }).catch((error) => {
        console.warn('Generated NPC visuals unavailable; production World continues.', error);
        return null;
      })
    : Promise.resolve(null);

  try {
    academyRuntime = installOgMasterAcademyRuntime();
  } catch (error) {
    console.warn('OG MASTER Academy interaction layer unavailable; production World continues.', error);
  }

  const baseDestroy = world?.destroy?.bind(world);
  Object.defineProperty(world, 'npcVisualRuntime', {
    configurable: true,
    enumerable: true,
    get() { return npcRuntime; },
  });
  Object.defineProperty(world, 'ogMasterAcademyRuntime', {
    configurable: true,
    enumerable: true,
    get() { return academyRuntime; },
  });
  world.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    try { academyRuntime?.destroy?.(); } catch (error) { console.warn('OG MASTER Academy cleanup degraded.', error); }
    academyRuntime = null;
    try { npcRuntime?.destroy?.(); } catch (error) { console.warn('NPC runtime cleanup degraded.', error); }
    npcRuntime = null;
    npcTask.catch(() => {});
    baseDestroy?.();
  };
  return world;
}
