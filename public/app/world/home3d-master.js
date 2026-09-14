import { THREE_MODULE_URL } from './world-config.js';
import { createHomeExperience as createProductionHomeExperience } from './home3d.js';

export async function createHomeExperience(options = {}) {
  const THREE = await import(THREE_MODULE_URL);
  const proto = THREE.WebGLRenderer.prototype;
  const originalRender = proto.render;
  let capturedScene = null, capturedCamera = null, capturedRenderer = null;
  proto.render = function wisdoHomeCapture(scene, camera) { capturedScene ||= scene; capturedCamera ||= camera; capturedRenderer ||= this; return originalRender.call(this, scene, camera); };
  let home;
  try { home = await createProductionHomeExperience(options); }
  finally { proto.render = originalRender; }
  const instanceId = globalThis.WisdoWorldRenderInstance || globalThis.crypto?.randomUUID?.() || `home-spatial-${Date.now()}`;
  const spatial = capturedScene && capturedCamera && capturedRenderer ? Object.freeze({ instanceId, sceneId: 'home', THREE, scene: capturedScene, camera: capturedCamera, renderer: capturedRenderer, get operator() { return capturedScene.getObjectByName('WisdoOperator') || null; } }) : null;
  if (spatial) { globalThis.WisdoWorldSpatialContext = spatial; window.dispatchEvent(new CustomEvent('wisdo:spatial-context-ready', { detail: { instanceId, sceneId: 'home' } })); }
  const baseDestroy = home?.destroy?.bind(home);
  return { ...home, destroy() { const current = globalThis.WisdoWorldSpatialContext; if (spatial && current?.instanceId === spatial.instanceId) { delete globalThis.WisdoWorldSpatialContext; window.dispatchEvent(new CustomEvent('wisdo:spatial-context-destroyed', { detail: { instanceId: spatial.instanceId, sceneId: 'home' } })); } baseDestroy?.(); } };
}
