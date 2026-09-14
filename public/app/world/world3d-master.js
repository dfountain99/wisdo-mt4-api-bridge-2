import { THREE_MODULE_URL } from './world-config.js';
import { createWorldExperience as createProductionWorldExperience } from './world3d-production.js';

function publishSpatialContext({ THREE, scene, camera, renderer, sceneId = 'central' }) {
  if (!THREE || !scene || !camera || !renderer) return null;
  const instanceId = globalThis.WisdoWorldRenderInstance || globalThis.crypto?.randomUUID?.() || `spatial-${Date.now()}`;
  const context = Object.freeze({ instanceId, sceneId, THREE, scene, camera, renderer, get operator() { return scene.getObjectByName('WisdoOperator') || null; } });
  globalThis.WisdoWorldSpatialContext = context;
  window.dispatchEvent(new CustomEvent('wisdo:spatial-context-ready', { detail: { instanceId, sceneId } }));
  return context;
}

export async function createWorldExperience(options = {}) {
  const THREE = await import(THREE_MODULE_URL);
  const proto = THREE.WebGLRenderer.prototype;
  const originalRender = proto.render;
  let capturedScene = null, capturedCamera = null, capturedRenderer = null;
  proto.render = function wisdoMasterCapture(scene, camera) { capturedScene ||= scene; capturedCamera ||= camera; capturedRenderer ||= this; return originalRender.call(this, scene, camera); };
  let world;
  try { world = await createProductionWorldExperience(options); }
  finally { proto.render = originalRender; }
  const spatial = publishSpatialContext({ THREE, scene: capturedScene, camera: capturedCamera, renderer: capturedRenderer, sceneId: 'central' });
  const baseDestroy = world?.destroy?.bind(world);
  return { ...world, destroy() { const current = globalThis.WisdoWorldSpatialContext; if (spatial && current?.instanceId === spatial.instanceId) { delete globalThis.WisdoWorldSpatialContext; window.dispatchEvent(new CustomEvent('wisdo:spatial-context-destroyed', { detail: { instanceId: spatial.instanceId, sceneId: 'central' } })); } baseDestroy?.(); } };
}
