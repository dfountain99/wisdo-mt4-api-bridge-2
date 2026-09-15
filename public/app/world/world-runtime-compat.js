export function createThreeRuntimeCompat(THREE) {
  if (!THREE) throw new TypeError('Three runtime is required.');
  if (typeof THREE.CapsuleGeometry === 'function') return THREE;

  class CapsuleGeometryCompat {
    constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
      const safeRadius = Math.max(.001, Number(radius) || 1);
      const safeLength = Math.max(.001, Number(length) || 1);
      const safeRadial = Math.max(6, Math.floor(Number(radialSegments) || 8));
      const geometry = new THREE.CylinderGeometry(
        safeRadius,
        safeRadius,
        safeLength + safeRadius * 1.45,
        safeRadial,
        Math.max(1, Math.floor(Number(capSegments) || 4)),
        false,
      );
      geometry.userData = { ...(geometry.userData || {}), wisdoCompatibilityGeometry: 'capsule-cylinder' };
      return geometry;
    }
  }

  return new Proxy(THREE, {
    get(target, property, receiver) {
      if (property === 'CapsuleGeometry') return CapsuleGeometryCompat;
      return Reflect.get(target, property, receiver);
    },
  });
}

export function serializeVisualError(error) {
  return Object.freeze({
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Unknown visual runtime error'),
    stack: String(error?.stack || '').split('\n').slice(0, 5).join(' | '),
    at: new Date().toISOString(),
  });
}

export function publishVisualRuntimeError(system, error) {
  const previous = globalThis.WisdoVisualRuntimeErrors || {};
  const next = Object.freeze({ ...previous, [system]: serializeVisualError(error) });
  globalThis.WisdoVisualRuntimeErrors = next;
  try { window.dispatchEvent(new CustomEvent('wisdo:visual-runtime-error', { detail: { system, error: next[system] } })); } catch {}
  return next[system];
}

export function disposeObjectTree(root) {
  if (!root) return;
  root.traverse?.((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose?.();
      material.dispose?.();
    }
  });
  root.parent?.remove?.(root);
}

export function removeSceneObjectsByName(scene, name) {
  if (!scene || !name) return;
  let found = scene.getObjectByName?.(name);
  let guard = 0;
  while (found && guard < 8) {
    disposeObjectTree(found);
    guard += 1;
    found = scene.getObjectByName?.(name);
  }
}
