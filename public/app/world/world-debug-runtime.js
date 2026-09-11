const params = new URLSearchParams(location.search);

if (params.get('debug') === '1') {
  const panel = document.getElementById('debugPanel');
  if (panel) {
    panel.hidden = false;
    const shorten = (value, max = 72) => {
      const text = String(value ?? '-');
      return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
    };

    function render() {
      const coreText = String(panel.textContent || '').split('\n--- RUNTIME ---')[0].trim();
      const operator = globalThis.WisdoOperatorDiagnostics || {};
      const quality = globalThis.WisdoQualityDiagnostics || {};
      const render = globalThis.WisdoRenderDiagnostics || {};
      const caps = quality.capabilities || {};
      const lines = [
        coreText,
        '--- RUNTIME ---',
        `OPERATOR ${operator.renderer || 'PROCEDURAL_FALLBACK'}`,
        `OP STATUS ${operator.status || 'STARTING'}`,
        `ASSET ${shorten(operator.assetUrl || '-')}`,
        `LOAD ${operator.totalMs ?? operator.fetchMs ?? '-'}ms · ${operator.bytesLoaded ? `${Math.round(operator.bytesLoaded / 1024)}KB` : '-'}`,
        `CLIPS ${Array.isArray(operator.clips) && operator.clips.length ? operator.clips.join(', ') : '-'}`,
        `MODEL mesh=${operator.meshCount ?? '-'} skin=${operator.skinnedMeshCount ?? '-'} mat=${operator.materialCount ?? '-'} tex=${operator.textureCount ?? '-'} tri=${Number(operator.triangles || 0).toLocaleString()}`,
        `FAIL ${shorten(operator.failureReason || 'NONE', 96)}`,
        `QUALITY ${(quality.activeQuality || render.qualityDecision || '-').toUpperCase()} · AUTO ${quality.adaptive ? 'ON' : 'OFF'}`,
        `DEVICE touch=${caps.touchLike ? 'YES' : 'NO'} webgl2=${caps.webgl2 ? 'YES' : 'NO'} cores=${caps.cores ?? '-'} memory=${caps.memoryGb ?? 'UNKNOWN'}GB`,
        `DPR ${render.dpr ?? '-'} · SHADOW ${render.shadows ? 'ON' : 'OFF'}`,
        `RENDER ${render.rendererWidth ?? '-'}×${render.rendererHeight ?? '-'}`,
        `QUALITY REASON ${quality.lastReason || '-'}`,
      ].filter(Boolean);
      panel.textContent = lines.join('\n');
    }

    const timer = setInterval(render, 350);
    render();
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    window.addEventListener('wisdo:operator-diagnostics', render);
  }
}
