# WISDO World Asset and Library Record

The Phase 1 third-person district uses procedural geometry, generated canvas signage, CSS, and WISDO-authored materials. No Rockstar/GTA assets, extracted game content, third-party character models, music, textures, or maps are included.

## Runtime library

- Asset/library: Three.js ES module
- Source: npm package distributed through jsDelivr
- Package: `three@0.185.1`
- Author/project: Three.js contributors
- License: MIT
- Runtime URL: `https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js`
- Changes made: none; loaded as a route-local ES module by WISDO World

## Procedural WISDO content

- WISDO Central / CEM Culture Plaza architecture: original procedural geometry
- Trading Tower: original procedural geometry and generated WISDO signage
- Operator character: original primitive-based humanoid assembled at runtime
- Street props, skyline, roads, plaza, trees, benches and barriers: original procedural geometry
- Textures: no downloaded environment textures; signage textures are generated at runtime with Canvas 2D
