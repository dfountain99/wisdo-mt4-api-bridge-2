// Compatibility alias for callers pinned to the V4 experiment path.
// The stable production entrypoint now owns the V4 implementation so existing
// World contracts keep one canonical renderer boundary.
export { createWorldExperience } from './world3d-production.js?v=2026.09.17.visual-fidelity-v4';
