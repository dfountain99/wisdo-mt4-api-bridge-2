// Runtime bootstrap for production memory safety.
// Render can retain an older dashboard environment value even after render.yaml changes.
// Clamp the memory-shed ratio before the application imports apiServer.js so a stale
// WISDO_MEMORY_SHED_RATIO=0.65 cannot shed normal UI requests around ~333 MB RSS.

const MIN_MEMORY_SHED_RATIO = 0.88;
const MAX_MEMORY_SHED_RATIO = 0.98;

export function normalizeMemoryShedRatio(value = process.env.WISDO_MEMORY_SHED_RATIO) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_MEMORY_SHED_RATIO;
  return Math.max(MIN_MEMORY_SHED_RATIO, Math.min(MAX_MEMORY_SHED_RATIO, parsed));
}

export function applyRuntimeMemoryBootstrap(env = process.env) {
  const ratio = normalizeMemoryShedRatio(env.WISDO_MEMORY_SHED_RATIO);
  env.WISDO_MEMORY_SHED_RATIO = String(ratio);

  const configuredLimit = Number(env.WISDO_RENDER_MEMORY_LIMIT_MB);
  if (!Number.isFinite(configuredLimit) || configuredLimit < 256) {
    env.WISDO_RENDER_MEMORY_LIMIT_MB = '512';
  }

  return {
    memoryShedRatio: ratio,
    renderMemoryLimitMB: Number(env.WISDO_RENDER_MEMORY_LIMIT_MB),
  };
}

applyRuntimeMemoryBootstrap();
await import('../index.js');
