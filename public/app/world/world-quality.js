const ORDER = Object.freeze(['low', 'medium', 'high']);

const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function mediaMatches(environment, query) {
  try { return Boolean(environment?.matchMedia?.(query)?.matches); }
  catch { return false; }
}

function detectWebGL2(environment) {
  try {
    const documentRef = environment?.document;
    const canvas = documentRef?.createElement?.('canvas');
    return Boolean(canvas?.getContext?.('webgl2'));
  } catch { return false; }
}

export function collectWorldCapabilities(environment = globalThis, overrides = {}) {
  const navigatorRef = overrides.navigator || environment?.navigator || {};
  const screenRef = overrides.screen || environment?.screen || {};
  const dpr = Math.max(1, numberOr(overrides.dpr ?? environment?.devicePixelRatio, 1));
  const cssWidth = Math.max(1, numberOr(overrides.width ?? environment?.innerWidth ?? screenRef.width, 390));
  const cssHeight = Math.max(1, numberOr(overrides.height ?? environment?.innerHeight ?? screenRef.height, 844));
  const memoryRaw = numberOr(overrides.memory ?? navigatorRef.deviceMemory, 0);
  const cores = Math.max(1, numberOr(overrides.cores ?? navigatorRef.hardwareConcurrency, 4));
  const coarse = overrides.coarse ?? mediaMatches(environment, '(pointer: coarse)');
  const reducedMotion = overrides.reducedMotion ?? mediaMatches(environment, '(prefers-reduced-motion: reduce)');
  const webgl2 = overrides.webgl2 ?? detectWebGL2(environment);
  const maxTouchPoints = Math.max(0, numberOr(overrides.maxTouchPoints ?? navigatorRef.maxTouchPoints, 0));
  const touchLike = Boolean(coarse || maxTouchPoints > 0);
  const renderDpr = Math.min(dpr, 2);
  const renderPixels = cssWidth * cssHeight * renderDpr * renderDpr;

  return Object.freeze({
    coarse: Boolean(coarse),
    touchLike,
    webgl2: Boolean(webgl2),
    reducedMotion: Boolean(reducedMotion),
    memoryGb: memoryRaw > 0 ? memoryRaw : null,
    memoryKnown: memoryRaw > 0,
    cores,
    dpr,
    cssWidth,
    cssHeight,
    renderPixels,
  });
}

export function chooseQualityFromCapabilities(capabilities = {}) {
  const memory = capabilities.memoryGb;
  const cores = Math.max(1, numberOr(capabilities.cores, 4));
  const renderPixels = Math.max(1, numberOr(capabilities.renderPixels, 1));
  const touchLike = Boolean(capabilities.touchLike || capabilities.coarse);
  const webgl2 = Boolean(capabilities.webgl2);

  // Hard limits may select LOW. Touch/coarse input by itself never does.
  if ((memory && memory <= 2) || (cores <= 2 && !webgl2) || renderPixels > 9_000_000) return 'low';

  if (touchLike) {
    // Safari commonly does not expose deviceMemory. Unknown memory is not treated as 4 GB.
    if (webgl2 && cores >= 6 && renderPixels <= 5_200_000 && (!memory || memory >= 6)) return 'high';
    return 'medium';
  }

  if ((!memory || memory >= 8) && cores >= 8 && webgl2 && renderPixels <= 6_500_000) return 'high';
  if ((memory && memory <= 4) || cores <= 4 || !webgl2) return 'medium';
  return 'medium';
}

export function chooseAutoQuality(environment = globalThis, overrides = {}) {
  return chooseQualityFromCapabilities(collectWorldCapabilities(environment, overrides));
}

export function stepQuality(current, direction) {
  const index = Math.max(0, ORDER.indexOf(current));
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, index + Math.sign(direction || 0)))];
}

export function createAdaptiveQualityController({
  initialQuality = 'medium',
  enabled = true,
  setQuality = () => {},
  onChange = () => {},
  downgradeSamples = 7,
  upgradeSamples = 18,
  cooldownMs = 15_000,
  lowFps = 27,
  highFps = 52,
  now = () => Date.now(),
} = {}) {
  let activeQuality = ORDER.includes(initialQuality) ? initialQuality : 'medium';
  let isEnabled = Boolean(enabled);
  let lowCount = 0;
  let highCount = 0;
  let lastChangeAt = -Infinity;

  function resetCounters() { lowCount = 0; highCount = 0; }

  function apply(next, reason, sample) {
    if (next === activeQuality || !ORDER.includes(next)) return false;
    activeQuality = next;
    lastChangeAt = now();
    resetCounters();
    setQuality(next);
    onChange({ quality: next, reason, sample, at: lastChangeAt });
    return true;
  }

  function sample(sampleValue = {}) {
    if (!isEnabled) return activeQuality;
    const fps = numberOr(sampleValue.fps, 0);
    if (fps <= 0) return activeQuality;
    const currentTime = now();
    if (currentTime - lastChangeAt < cooldownMs) return activeQuality;

    if (fps < lowFps) {
      lowCount += 1;
      highCount = Math.max(0, highCount - 2);
    } else if (fps >= highFps) {
      highCount += 1;
      lowCount = Math.max(0, lowCount - 1);
    } else {
      lowCount = Math.max(0, lowCount - 1);
      highCount = Math.max(0, highCount - 1);
    }

    if (lowCount >= downgradeSamples && activeQuality !== 'low') apply(stepQuality(activeQuality, -1), 'sustained-low-fps', sampleValue);
    else if (highCount >= upgradeSamples && activeQuality !== 'high') apply(stepQuality(activeQuality, 1), 'sustained-high-fps', sampleValue);
    return activeQuality;
  }

  return Object.freeze({
    sample,
    get quality() { return activeQuality; },
    get enabled() { return isEnabled; },
    setEnabled(value) { isEnabled = Boolean(value); resetCounters(); },
    reset(nextQuality = activeQuality) {
      if (ORDER.includes(nextQuality)) activeQuality = nextQuality;
      resetCounters();
      lastChangeAt = -Infinity;
    },
  });
}
