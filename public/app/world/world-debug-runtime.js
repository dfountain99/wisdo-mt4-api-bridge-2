import { WORLD_BUILD } from './world-build.js?v=2026.09.14.runtime-recovery-v4';

const DEBUG_CLIENT_REVISION='2026.09.14.runtime-recovery-v4';
globalThis.WisdoDebugClientRevision=DEBUG_CLIENT_REVISION;
const params = new URLSearchParams(location.search);

if (params.get('debug') === '1') {
  const panel = document.getElementById('debugPanel');
  if (panel) {
    panel.hidden = false;
    const shorten = (value, max = 72) => {
      const text = String(value ?? '-');
      return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
    };
    let build = { ...WORLD_BUILD, commit: 'loading', environment: '-' };
    fetch('/api/world/build', { credentials: 'same-origin', cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))).then((payload) => { build = payload; render(); }).catch(() => { build = { ...WORLD_BUILD, commit: 'unavailable', environment: '-' }; render(); });

    function render() {
      const coreText = String(panel.textContent || '').split('\n--- RUNTIME ---')[0].trim();
      const operator = globalThis.WisdoOperatorDiagnostics || {};
      const quality = globalThis.WisdoQualityDiagnostics || {};
      const renderState = globalThis.WisdoRenderDiagnostics || {};
      const renderContext = globalThis.WisdoRenderContextDiagnostics || {};
      const cinematic = globalThis.WisdoCinematicDiagnostics || {};
      const arcade = globalThis.WisdoArcadeWorldDiagnostics || {};
      const multiplayer = globalThis.WisdoMultiplayerDiagnostics || {};
      const errors = globalThis.WisdoVisualRuntimeErrors || {};
      const safety = globalThis.WisdoWorldSafetyDiagnostics || {};
      const caps = quality.capabilities || {};
      const registry = globalThis.WisdoWorldRegistry || {};
      const cinematicError = errors['cinematic-primary'] || errors.cinematic || null;
      const arcadeError = errors['arcade-primary'] || errors['arcade-plaza'] || null;
      const componentErrors = Object.keys(arcade.componentErrors || {});
      const coreRevision=globalThis.WisdoWorldClientRevision||'MISSING';
      const fidelityRevision=globalThis.WisdoFidelityClientRevision||'MISSING';
      const revisionsMatch=coreRevision===DEBUG_CLIENT_REVISION&&fidelityRevision===DEBUG_CLIENT_REVISION;
      const lines = [
        coreText,
        '--- RUNTIME ---',
        `BUILD ${build.worldVersion || WORLD_BUILD.worldVersion} · ${build.buildId || WORLD_BUILD.buildId}`,
        `COMMIT ${String(build.commit || 'unknown').slice(0, 12)} · ENV ${String(build.environment || '-').toUpperCase()}`,
        `RENDERER ${build.renderer || WORLD_BUILD.renderer} · CITY ${build.city || WORLD_BUILD.city}`,
        `CLIENT REV debug=${DEBUG_CLIENT_REVISION} core=${coreRevision} fidelity=${fidelityRevision}`,
        `CLIENT COHERENCE ${revisionsMatch ? 'VERIFIED' : 'MISMATCH'}`,
        `RENDER CTX ${renderContext.status || 'UNKNOWN'} · ${shorten(renderContext.reason || renderContext.source || '-', 72)}`,
        `VISUAL ${cinematic.active ? cinematic.visualPass : 'CORE'} · ARCADE ${arcade.active ? 'ACTIVE' : 'DEGRADED'}`,
        `RECOVERY cinematic=${cinematic.recoveryMode ? 'YES' : 'NO'} arcade=${arcade.recoveryMode ? 'YES' : 'NO'}`,
        `SCENE brew=${registry.businesses?.brew ? 'YES' : 'NO'} arcade=${registry.businesses?.arcade ? 'YES' : 'NO'} gym=${registry.businesses?.gym ? 'YES' : 'NO'} coach=${registry.landmarks?.coach ? 'YES' : 'NO'}`,
        `POP npc=${arcade.npcCount ?? 0} palms=${arcade.palmCount ?? 0} drones=${cinematic.ambientDrones ?? 0}`,
        `CIN ERR ${shorten(cinematicError?.message || cinematic.recoveryCause || 'NONE', 96)}`,
        `ARC ERR ${shorten(arcadeError?.message || arcade.recoveryCause || 'NONE', 96)}`,
        `ARC PARTS ${componentErrors.length ? componentErrors.join(',') : 'NONE'}`,
        `OPERATOR ${operator.renderer || (cinematic.cinematicFallbackOperator ? 'CINEMATIC_FALLBACK' : 'PROCEDURAL_FALLBACK')}`,
        `OP STATUS ${operator.status || (cinematic.cinematicFallbackOperator ? 'CINEMATIC FALLBACK ACTIVE' : 'STARTING')}`,
        `ASSET ${shorten(operator.assetUrl || '-')}`,
        `LOAD ${operator.totalMs ?? operator.fetchMs ?? '-'}ms · ${operator.bytesLoaded ? `${Math.round(operator.bytesLoaded / 1024)}KB` : '-'}`,
        `CLIPS ${Array.isArray(operator.clips) && operator.clips.length ? operator.clips.join(', ') : '-'}`,
        `MODEL mesh=${operator.meshCount ?? '-'} skin=${operator.skinnedMeshCount ?? '-'} mat=${operator.materialCount ?? '-'} tex=${operator.textureCount ?? '-'} tri=${Number(operator.triangles || 0).toLocaleString()}`,
        `FAIL ${shorten(operator.failureReason || 'NONE', 96)}`,
        `QUALITY ${(quality.activeQuality || renderState.qualityDecision || '-').toUpperCase()} · AUTO ${quality.adaptive ? 'ON' : 'OFF'}`,
        `DEVICE touch=${caps.touchLike ? 'YES' : 'NO'} webgl2=${caps.webgl2 ? 'YES' : 'NO'} cores=${caps.cores ?? '-'} memory=${caps.memoryGb ?? 'UNKNOWN'}GB`,
        `DPR ${renderState.dpr ?? '-'} · SHADOW ${renderState.shadows ? 'ON' : 'OFF'}`,
        `RENDER ${renderState.rendererWidth ?? '-'}×${renderState.rendererHeight ?? '-'}`,
        `MULTIPLAYER ${multiplayer.connected ? 'CONNECTED' : multiplayer.status || 'UNKNOWN'} · ONLINE ${multiplayer.online ?? '-'}`,
        `EXECUTION FROM VISUALS ${safety.executionFromVisuals === false ? 'NO' : 'UNVERIFIED'}`,
        `EXEC AUTHORITY ${safety.authority || '-'}`,
        `QUALITY REASON ${quality.lastReason || '-'}`,
      ].filter(Boolean);
      panel.textContent = lines.join('\n');
    }

    const timer = setInterval(render, 350);
    render();
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    window.addEventListener('wisdo:operator-diagnostics', render);
    window.addEventListener('wisdo:world-renderer-ready', render);
    window.addEventListener('wisdo:cinematic-ready', render);
    window.addEventListener('wisdo:arcade-world-ready', render);
    window.addEventListener('wisdo:visual-runtime-error', render);
  }
}
