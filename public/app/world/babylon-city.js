// WISDO Babylon City bridge for Culture Lane OS v7.1.0.
// Keeps the existing Three.js production world intact while exposing the full Babylon city as a first-class world route.
export const WISDO_BABYLON_CITY = Object.freeze({
  id: 'babylon-full-city-v2',
  title: 'WISDO Babylon Full City • Visual Fidelity V2',
  path: '/app/world/babylon-city/',
  engine: 'babylonjs',
  scope: 'full-city',
  visualFidelity: 'production-v2',
  animationRuntime: 'state-graph-v2',
  generatedAssetRuntime: true,
  humanVisualReviewRequired: true,
  districts: [
    'Central Plaza','WISDO Tower','WISDO Academy','Master Chamber',
    'Trading Hall','Bot Vault','Marketplace','Creator Row',
    'West Residences','East Commerce'
  ],
  blenderRegistry: '/app/world/generated-asset-registry.js',
  realtimeCompatible: true,
  tradingAuthority: 'server',
});
export function getWisdoBabylonCityRoute(){ return WISDO_BABYLON_CITY.path; }
