import { createWorldExperience as createProductionWorldExperience } from './world3d-production.js';
import { installWorldNpcVisuals } from './world-npc-visual-runtime.js';
import { installOgMasterAcademyRuntime } from './og-master-academy-runtime.js';
import { installProductionAssetRuntime } from './production-asset-runtime.js';

export async function createWorldExperience(options = {}) {
  let renderContext = null;
  let npcRuntime = null;
  let academyRuntime = null;
  let productionAssetRuntime = null;
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
  const quality = globalThis.WisdoQualityDiagnostics?.activeQuality || options.preferences?.quality || 'medium';

  const productionAssetTask = renderContext?.THREE && renderContext?.scene
    ? installProductionAssetRuntime({
        THREE: renderContext.THREE,
        scene: renderContext.scene,
        renderer: renderContext.renderer,
        destinations: options.destinations || [],
        quality,
        onInteract: options.onInteract,
      }).then((runtime) => {
        if (destroyed) { runtime?.destroy?.(); return null; }
        productionAssetRuntime = runtime;
        return runtime;
      }).catch((error) => {
        console.warn('Blender production environment unavailable; authored/procedural World fallback continues.', error);
        return null;
      })
    : Promise.resolve(null);

  const npcTask = renderContext?.THREE && renderContext?.scene
    ? installWorldNpcVisuals({
        THREE: renderContext.THREE,
        scene: renderContext.scene,
        instanceId,
        debug,
      }).then((runtime) => {
        if (destroyed) { runtime?.destroy?.(); return null; }
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
  Object.defineProperty(world, 'productionAssetRuntime', { configurable: true, enumerable: true, get() { return productionAssetRuntime; } });
  Object.defineProperty(world, 'npcVisualRuntime', { configurable: true, enumerable: true, get() { return npcRuntime; } });
  Object.defineProperty(world, 'ogMasterAcademyRuntime', { configurable: true, enumerable: true, get() { return academyRuntime; } });
  world.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    try { academyRuntime?.destroy?.(); } catch (error) { console.warn('OG MASTER Academy cleanup degraded.', error); }
    academyRuntime = null;
    try { npcRuntime?.destroy?.(); } catch (error) { console.warn('NPC runtime cleanup degraded.', error); }
    npcRuntime = null;
    try { productionAssetRuntime?.destroy?.(); } catch (error) { console.warn('Production asset cleanup degraded.', error); }
    productionAssetRuntime = null;
    productionAssetTask.catch(() => {});
    npcTask.catch(() => {});
    baseDestroy?.();
  };
  return world;
}
