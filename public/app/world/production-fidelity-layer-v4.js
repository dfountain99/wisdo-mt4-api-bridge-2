import { installProductionFidelity } from './production-fidelity-layer.js?v=2026.09.25.city-phone-fix';
import { installWisdoVisualFidelityV4, WISDO_VISUAL_FIDELITY_V4_REVISION } from './world-visual-fidelity-v4.js?v=2026.09.17.visual-fidelity-v4';

export async function installProductionFidelityV4(options={}) {
  globalThis.WisdoFidelityClientRevision=WISDO_VISUAL_FIDELITY_V4_REVISION;
  const base=await installProductionFidelity(options);
  let v4=null;
  try {
    v4=installWisdoVisualFidelityV4(options);
  } catch (error) {
    console.warn('WISDO Visual Fidelity V4 degraded; previous production fidelity remains active.',error);
  }
  const diagnostics=Object.freeze({
    ...(base?.diagnostics||globalThis.WisdoWorldDiagnostics||{}),
    visualFidelityV4Active:Boolean(v4?.diagnostics?.active),
    visualFidelityV4:v4?.diagnostics||null,
    visualArchitecture:v4?.diagnostics?.artDirection||base?.diagnostics?.visualArchitecture||'production-city-core',
    visualRevision:WISDO_VISUAL_FIDELITY_V4_REVISION,
    updatedAt:new Date().toISOString(),
  });
  globalThis.WisdoWorldDiagnostics=diagnostics;
  return Object.freeze({
    ...base,
    v4:v4?.diagnostics||null,
    diagnostics,
    destroy(){try{v4?.destroy?.();}catch{}try{base?.destroy?.();}catch{}},
  });
}
