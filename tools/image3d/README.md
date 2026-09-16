# WISDO Image3D Factory

Turns a user-provided 2D reference image into a WISDO-ready GLB by chaining an image-to-3D generator to the existing Blender production pipeline and generated asset registry.

## Flow

`2D image -> image-to-3D endpoint -> source GLB -> WISDO Blender build -> optimization/LOD/validation -> generated-asset-registry.js`

The factory never replaces the Blender pipeline. The AI generator only manufactures the source mesh; Blender remains the normalization/optimization/validation gate.

## Provider

The runner uses an HTTP endpoint compatible with Hunyuan3D-2's `/generate` API: JSON request `{ "image": "<base64>" }`, binary GLB response. Default endpoint: `http://127.0.0.1:8080/generate`.

Override with `WISDO_IMAGE3D_ENDPOINT` or `--endpoint`. Optional bearer auth can be supplied in `WISDO_IMAGE3D_TOKEN` for a trusted remote endpoint. Do not commit API tokens.

Hunyuan3D can be hosted on another GPU machine; the Blender worker and the image-to-3D GPU server do not have to be the same computer.

## Windows usage

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File tools/image3d/submit-image3d.ps1 -Image "C:\Pictures\master.jpg" -Id "og-master-wisdo" -Type character -Target npc -Height 1.84
```

For a prop:

```powershell
powershell -ExecutionPolicy Bypass -File tools/image3d/submit-image3d.ps1 -Image "C:\Pictures\terminal.png" -Id "wisdo-terminal-v1" -Type prop -Target prop
```

For a building:

```powershell
powershell -ExecutionPolicy Bypass -File tools/image3d/submit-image3d.ps1 -Image "C:\Pictures\central.png" -Id "wisdo-central-v1" -Type building -Target building
```

## Direct Node usage

```bash
node tools/image3d/wisdo-image3d.mjs --image ./reference.png --id my-asset --type prop --target prop
```

Use `--no-register true` to build/validate without changing the runtime registry.

## Production rule

AI-generated 3D is not guaranteed to have game-ready topology, correct hidden surfaces, a humanoid rig, or desired animation clips. Review the generated GLB and JSON report before committing/deploying it. Character generation creates a source mesh; a rigged/animated NPC still requires a compatible rig/animation source or a future autorig stage. The current WISDO Blender pipeline will optimize and validate what is present but does not fabricate missing humanoid animation data.

## Hardware note

Image-to-3D generation is GPU-heavy. Keep the endpoint configurable so low-power WISDO/MT4 machines can submit images to a separate GPU service while Blender continues to perform the WISDO asset processing locally.
