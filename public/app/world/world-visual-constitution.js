export const WISDO_VISUAL = Object.freeze({
  colors: Object.freeze({
    OBSIDIAN: 0x05070a,
    CHARCOAL: 0x10151a,
    DEEP_NAVY: 0x071724,
    BLACK_METAL: 0x0d1217,
    DARK_GLASS: 0x102431,
    ARCHITECTURAL_CONCRETE: 0x323940,
    POLISHED_STONE: 0x171d22,
    GOLD: 0xc9a65d,
    GOLD_BRIGHT: 0xf0ce78,
    DATA_CYAN: 0x61e6ff,
    DATA_BLUE: 0x328cff,
    WARM_INTERIOR: 0xffc778,
    SIGNAL_BUY: 0x62f0c2,
    SIGNAL_SELL: 0xff8b86,
  }),
  atmosphere: Object.freeze({
    background: 0x06111b,
    fog: 0x0a1823,
    fogNear: 74,
    fogFar: 285,
    exposure: 1.08,
    hemisphereSky: 0x6d87a2,
    hemisphereGround: 0x11151a,
    hemisphereIntensity: 1.35,
    moonKey: 0x9dbbdb,
    moonIntensity: 2.1,
    goldFill: 0xffd38a,
    goldFillIntensity: 0.75,
  }),
  companion: Object.freeze({
    forward: 1.55,
    side: 1.08,
    height: 1.42,
    spring: 9,
    scale: 0.72,
    mobileScale: 0.56,
  }),
  budgets: Object.freeze({
    low: Object.freeze({ skyline: 14, citizens: 3, transit: 1, gatewayArches: 2, particles: 0 }),
    medium: Object.freeze({ skyline: 26, citizens: 8, transit: 1, gatewayArches: 4, particles: 12 }),
    high: Object.freeze({ skyline: 42, citizens: 16, transit: 2, gatewayArches: 5, particles: 24 }),
  }),
});

export function createWisdoMasterMaterials(THREE) {
  const C = WISDO_VISUAL.colors;
  const standard = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return Object.freeze({
    obsidian: standard(C.OBSIDIAN, 0.46, 0.34),
    blackMetal: standard(C.BLACK_METAL, 0.24, 0.88),
    gold: standard(C.GOLD, 0.22, 0.92),
    concrete: standard(C.ARCHITECTURAL_CONCRETE, 0.8, 0.05),
    stone: standard(C.POLISHED_STONE, 0.31, 0.18),
    glass: new THREE.MeshPhysicalMaterial({ color: C.DARK_GLASS, roughness: 0.12, metalness: 0.08, transmission: 0.3, transparent: true, opacity: 0.72, depthWrite: true }),
    dataCyan: new THREE.MeshStandardMaterial({ color: C.DATA_CYAN, emissive: C.DATA_CYAN, emissiveIntensity: 1.65, roughness: 0.22, metalness: 0.28 }),
    dataBlue: new THREE.MeshStandardMaterial({ color: C.DATA_BLUE, emissive: C.DATA_BLUE, emissiveIntensity: 1.15, roughness: 0.28, metalness: 0.28 }),
    goldLight: new THREE.MeshStandardMaterial({ color: C.GOLD_BRIGHT, emissive: C.GOLD_BRIGHT, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.4 }),
  });
}

export function disposeWisdoMaterials(materials) {
  for (const material of Object.values(materials || {})) material?.dispose?.();
}
