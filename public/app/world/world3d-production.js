import { THREE_MODULE_URL, chooseAutoQuality, getWorldCapabilities } from './world-config.js';
import { createAdaptiveQualityController } from './world-quality.js';
import { installProductionFidelity } from './production-fidelity-layer.js';
import { installAuthoredOperator } from './authored-operator.js';
import { createWorldExperience as createCoreWorldExperience } from './world3d-core.js';

function publishQualityDiagnostics(patch = {}) {
  globalThis.WisdoQualityDiagnostics = Object.freeze({
    ...(globalThis.WisdoQualityDiagnostics || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  return globalThis.WisdoQualityDiagnostics;
}

export async function createWorldExperience(options = {}) {
  const THREE = await import(THREE_MODULE_URL);
  let capturedScene = null;
  let capturedCamera = null;
  let capturedRenderer = null;
  let core = null;
  let adaptive = null;
  let destroyed = false;
  const requestedQuality = options.preferences?.quality || 'auto';
  const proto = THREE.WebGLRenderer.prototype;
  const originalRender = proto.render;

  proto.render = function captureProductionWorld(scene, camera) {
    capturedScene ||= scene;
    capturedCamera ||= camera;
    capturedRenderer ||= this;
    return originalRender.call(this, scene, camera);
  };

  const telemetryProxy = (data = {}) => {
    const operator = globalThis.WisdoOperatorDiagnostics || {};
    const renderer = capturedRenderer;
    const enriched = {
      ...data,
      dpr: renderer?.getPixelRatio?.() ?? null,
      shadows: Boolean(renderer?.shadowMap?.enabled),
      rendererWidth: renderer?.domElement?.width || null,
      rendererHeight: renderer?.domElement?.height || null,
      operatorRenderer: operator.renderer || document.documentElement.dataset.wisdoOperator || 'PROCEDURAL_FALLBACK',
      operatorStatus: operator.status || 'STARTING',
      qualityDecision: globalThis.WisdoQualityDiagnostics?.activeQuality || data.quality || null,
    };
    globalThis.WisdoRenderDiagnostics = Object.freeze(enriched);
    adaptive?.sample(enriched);
    options.onTelemetry?.(enriched);
  };

  try {
    core = await createCoreWorldExperience({ ...options, onTelemetry: telemetryProxy });
  } finally {
    proto.render = originalRender;
  }

  const capabilities = getWorldCapabilities();
  publishQualityDiagnostics({
    requestedQuality,
    initialQuality: core?.quality || chooseAutoQuality(),
    activeQuality: core?.quality || chooseAutoQuality(),
    adaptive: requestedQuality === 'auto',
    capabilities,
    touchForcedLow: false,
    lastReason: 'initial-capability-policy',
  });

  adaptive = createAdaptiveQualityController({
    initialQuality: core?.quality || chooseAutoQuality(),
    enabled: requestedQuality === 'auto',
    setQuality: (quality) => core?.setQuality?.(quality),
    onChange: ({ quality, reason, sample }) => {
      publishQualityDiagnostics({ activeQuality: quality, lastReason: reason, lastFps: sample?.fps ?? null });
    },
  });

  if (!capturedScene || !capturedCamera || !capturedRenderer) {
    document.documentElement.dataset.wisdoFidelity = 'degraded';
    globalThis.WisdoFidelityStatus = Object.freeze({ active: false, reason: 'renderer_capture_failed', installedAt: new Date().toISOString() });
    console.warn('WISDO production fidelity layer could not capture the active Central renderer; core World remains active.');
    return core;
  }

  const debug = new URLSearchParams(location.search).get('debug') === '1';
  let fidelity = null;
  let authoredOperator = null;
  try {
    fidelity = await installProductionFidelity({
      THREE,
      scene: capturedScene,
      camera: capturedCamera,
      renderer: capturedRenderer,
      destinations: options.destinations || [],
      debug,
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

  // Load the authored human in the background. The World stays playable while a slow mobile network fetches it.
  document.documentElement.dataset.wisdoOperator = 'loading-authored-glb';
  const operatorTask = installAuthoredOperator({ THREE, scene: capturedScene, debug })
    .then((result) => {
      authoredOperator = result;
      if (destroyed) authoredOperator?.destroy?.();
      return result;
    })
    .catch((error) => {
      document.documentElement.dataset.wisdoOperator = 'procedural-fallback';
      const existing = globalThis.WisdoOperatorDiagnostics || {};
      globalThis.WisdoOperatorDiagnostics = Object.freeze({
        ...existing,
        renderer: 'PROCEDURAL_FALLBACK',
        active: false,
        status: existing.status?.includes?.('FAILED') ? existing.status : 'FAILED',
        failureReason: existing.failureReason || error?.message || 'authored_operator_failed',
        updatedAt: new Date().toISOString(),
      });
      globalThis.WisdoAuthoredAssets = Object.freeze({
        operator: Object.freeze({ active: false, fallback: true, reason: globalThis.WisdoOperatorDiagnostics.failureReason }),
      });
      console.warn('WISDO authored Operator unavailable; retaining procedural fallback.', error);
      return null;
    });

  const baseDestroy = core?.destroy?.bind(core);
  const baseSetPreferences = core?.setPreferences?.bind(core);
  return {
    ...core,
    visualPass: fidelity ? 'production-fidelity' : 'core-fallback',
    fidelityQuality: fidelity?.quality || null,
    get operatorRenderer() { return authoredOperator?.active ? 'authored-glb' : document.documentElement.dataset.wisdoOperator || 'procedural-fallback'; },
    setPreferences(next = {}) {
      baseSetPreferences?.(next);
      if (!Object.prototype.hasOwnProperty.call(next, 'quality')) return;
      if (next.quality === 'auto') {
        const automatic = chooseAutoQuality();
        core?.setQuality?.(automatic);
        adaptive?.reset?.(automatic);
        adaptive?.setEnabled?.(true);
        publishQualityDiagnostics({ requestedQuality: 'auto', activeQuality: automatic, adaptive: true, lastReason: 'user-auto' });
      } else {
        adaptive?.setEnabled?.(false);
        adaptive?.reset?.(next.quality);
        publishQualityDiagnostics({ requestedQuality: next.quality, activeQuality: next.quality, adaptive: false, lastReason: 'user-manual' });
      }
    },
    destroy() {
      destroyed = true;
      operatorTask?.then?.((loaded) => loaded?.destroy?.()).catch?.(() => {});
      try { authoredOperator?.destroy?.(); } catch (error) { console.warn('Authored Operator cleanup degraded', error); }
      try { fidelity?.destroy?.(); } catch (error) { console.warn('Fidelity cleanup degraded', error); }
      baseDestroy?.();
      delete document.documentElement.dataset.wisdoFidelity;
      delete document.documentElement.dataset.wisdoOperator;
    },
  };
}
