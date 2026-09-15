# WISDO Visual Completion Rule

A visual feature is not complete because source files, Blender files, GLBs, JavaScript modules, or CSS exist.

For Player, Arcade, hero architecture, vehicles, vegetation, or first-production-slice work, completion requires all of the following:

1. **Active loader identified** — the exact runtime module that consumes the asset is named in the PR.
2. **Runtime path confirmed** — the final `/world-assets/...` URL is present in the active authored/generated asset registry and the referenced file exists in `public/`.
3. **Fallback state explicit** — the PR states whether the production runtime is using the new authored asset or a fallback. A new visual asset may not be called shipped while fallback is active.
4. **Blender report passes** — scale, ground, transforms, GLB export, and asset-type-specific checks pass. Character work also requires armature PASS.
5. **Runtime validation passes** — generated registries must point only at files that exist and their reports must be readable. CI enforces this through `npm run test:visual-completion`.
6. **Visual proof exists before release labeling** — capture the same intended camera/view in a runnable WISDO build and attach the screenshot or artifact reference to the PR. "Code exists" is not visual proof.
7. **CI passes** — normal test and WISDO Launch Gates must pass before merge.
8. **Production verification is post-merge release proof** — after deployment, verify the deployed World is loading the new asset and record the deployed build/commit. Until that check exists, say "merged" rather than "live".

The rule is intentionally strict: silent primitive fallback, dead imports, unreferenced GLBs, and Blender exports that are never loaded do not count as completed visual work.
