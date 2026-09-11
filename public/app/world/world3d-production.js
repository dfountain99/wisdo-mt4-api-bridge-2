import { THREE_MODULE_URL } from './world-config.js';
import { installProductionFidelity } from './production-fidelity-layer.js';
import { createWorldExperience as createCoreWorldExperience } from './world3d-core.js';

export async function createWorldExperience(options = {}) {
  const THREE = await import(THREE_MODULE_URL);
  let capturedScene = null;
  let capturedCamera = null;
  let capturedRenderer = null;
  const proto = THREE.WebGLRenderer.prototype;
  const originalRender = proto.render;

  proto.render = function captureProductionWorld(scene, camera) {
    capturedScene ||= scene;
    capturedCamera ||= camera;
    capturedRenderer ||= this;
    return originalRender.call(this, scene, camera);
  };

  let core;
  try {
    core = await createCoreWorldExperience(options);
  } finally {
    proto.render = originalRender;
  }

  if (!capturedScene || !capturedCamera || !capturedRenderer) {
    document.documentElement.dataset.wisdoFidelity = 'degraded';
    globalThis.WisdoFidelityStatus = Object.freeze({ active: false, reason: 'renderer_capture_failed', installedAt: new Date().toISOString() });
    console.warn('WISDO production fidelity layer could not capture the active Central renderer; core World remains active.');
    return core;
  }

  let fidelity = null;
  try {
    fidelity = await installProductionFidelity({
      THREE,
      scene: capturedScene,
      camera: capturedCamera,
      renderer: capturedRenderer,
      destinations: options.destinations || [],
      debug: new URLSearchParams(location.search).get('debug') === '1',
    });
    document.documentElement.dataset.wisdoFidelity = 'active';
    globalThis.WisdoFidelityStatus = Object.freeze({
      active: true,
      quality: fidelity?.quality || null,
      installedAt: new Date().toISOString(),
      renderer: 'production-fidelity',
    });
  } catch (error) {
    document.documentElement.dataset.wisdoFidelity = 'degraded';
    globalThis.WisdoFidelityStatus = Object.freeze({ active: false, reason: error?.message || 'install_failed', installedAt: new Date().toISOString() });
    console.warn('WISDO production fidelity layer degraded; core World remains active.', error);
  }

  const baseDestroy = core?.destroy?.bind(core);
  return {
    ...core,
    visualPass: fidelity ? 'production-fidelity' : 'core-fallback',
    fidelityQuality: fidelity?.quality || null,
    destroy() {
      try { fidelity?.destroy?.(); } catch (error) { console.warn('Fidelity cleanup degraded', error); }
      baseDestroy?.();
      delete document.documentElement.dataset.wisdoFidelity;
    },
  };
}
