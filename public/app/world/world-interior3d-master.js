import { THREE_MODULE_URL } from './world-config.js';
import { createWorldInterior as createProductionInterior } from './world-interior3d-v2.js';

export async function createWorldInterior(options = {}) {
  const THREE = await import(THREE_MODULE_URL);
  const proto = THREE.WebGLRenderer.prototype;
  const originalRender = proto.render;
  let capturedScene = null, capturedCamera = null, capturedRenderer = null;
  proto.render = function wisdoInteriorCapture(scene, camera) { capturedScene ||= scene; capturedCamera ||= camera; capturedRenderer ||= this; return originalRender.call(this, scene, camera); };
  let interior;
  try { interior = await createProductionInterior(options); }
  finally { proto.render = originalRender; }
  const instanceId = globalThis.WisdoWorldRenderInstance || globalThis.crypto?.randomUUID?.() || `interior-spatial-${Date.now()}`;
  const sceneId = options.sceneId || interior?.sceneId || 'interior';
  const spatial = capturedScene && capturedCamera && capturedRenderer ? Object.freeze({ instanceId, sceneId, THREE, scene: capturedScene, camera: capturedCamera, renderer: capturedRenderer, get operator() { return capturedScene.getObjectByName('WisdoOperator') || null; } }) : null;
  if (spatial) { globalThis.WisdoWorldSpatialContext = spatial; window.dispatchEvent(new CustomEvent('wisdo:spatial-context-ready', { detail: { instanceId, sceneId } })); }
  const baseDestroy = interior?.destroy?.bind(interior);
  return { ...interior, destroy() { const current = globalThis.WisdoWorldSpatialContext; if (spatial && current?.instanceId === spatial.instanceId) { delete globalThis.WisdoWorldSpatialContext; window.dispatchEvent(new CustomEvent('wisdo:spatial-context-destroyed', { detail: { instanceId: spatial.instanceId, sceneId } })); } baseDestroy?.(); } };
}
