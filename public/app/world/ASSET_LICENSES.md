# WISDO World Asset and Library Record

WISDO World now uses a hybrid production asset strategy: authored glTF/GLB assets for high-visibility characters and future architecture, with procedural geometry retained as a resilience fallback and for lightweight distant/environment systems.

## Runtime library

- Asset/library: Three.js ES module
- Source: npm package distributed through jsDelivr
- Package: `three@0.185.1`
- Author/project: Three.js contributors
- License: MIT
- Runtime URL: `https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js`
- GLTFLoader URL: `https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/loaders/GLTFLoader.js`
- Changes made: none; loaded as route-local ES modules by WISDO World

## Default authored WISDO Operator — transitional production asset

- WISDO id: `wisdo-default-operator-v1`
- Asset: `suited.glb`
- Upstream project: `kunalkushwaha/vsim`
- Pinned upstream commit: `3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91`
- Upstream path: `packages/assets/library/suited.glb`
- Runtime URL: `https://cdn.jsdelivr.net/gh/kunalkushwaha/vsim@3f97faf85e46d2f9a122b0a8b8d3ccc0af598f91/packages/assets/library/suited.glb`
- License: CC0 1.0 / public domain
- Upstream provenance: realistic rigged human generated with MakeHuman / MPFB 2; skin, casual suit, shoes, rig and textures are documented by the source project as CC0 MakeHuman system assets. Walk/run/idle/wave clips are included by the source package.
- WISDO use: temporary high-quality default Operator while WISDO's own Smart Mirror / scan-to-avatar authored character pipeline is produced.
- Modifications at runtime: normalized to WISDO human scale, physically lit by the current World scene, shadow participation enabled, animation clips blended from live Operator movement, small WISDO identity badge layered by the runtime.
- No facial-recognition or authentication behavior is attached to this model.

The upstream CC0 provenance is recorded even though attribution is not legally required. Before WISDO replaces this transitional asset, the new first-party Operator GLB must be added to this record with its own source/license/provenance.

## Procedural WISDO fallback content

- WISDO Central / CEM Culture Plaza architecture: original procedural geometry plus WISDO-authored production fidelity layers
- Trading Tower: original procedural geometry and generated WISDO signage pending authored architectural GLB replacement
- Operator fallback: original primitive-based humanoid assembled at runtime; used only if the authored GLB cannot load
- Street props, skyline, roads, plaza, trees, benches and barriers: original procedural geometry/fidelity systems pending modular authored environment-kit replacement
- Downloaded environment textures: none at this stage; signage textures are generated at runtime with Canvas 2D

## Asset policy

- Do not use extracted Rockstar/GTA assets, maps, textures, animations, sounds, logos, or proprietary source content.
- Third-party production assets require explicit redistributable/commercial licensing and a pinned provenance record here.
- Financial state, Reporter data, World identity and command authority never live inside GLB assets.
