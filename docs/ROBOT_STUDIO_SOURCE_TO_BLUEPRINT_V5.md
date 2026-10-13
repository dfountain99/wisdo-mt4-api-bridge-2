# WISDO Robot Studio V5 — Import Source Directly Into the Main Blueprint

Open \`/app/robot-studio\`. **IMPORT MQ4 / MQ5** is the first button in the uppermost toolbar. It opens the phone/laptop's native file chooser. On desktop, editable MQ4/MQ5 files can also be dropped onto the Blueprint canvas.

## Working source-to-canvas behavior

- Import editable MQL4 or MQL5 source files up to 4 MB. Common UTF-8 and UTF-16 encodings are supported.
- Preserve a byte-level original backup in browser memory. Neither the source nor edits are uploaded to the server.
- Automatically analyze the actual imported file, including HIGHTOWER, using the existing Bot Hospital and source-guard discovery engines.
- Display source-backed subsystem **inventory cards**, mapped settings, editable numeric IF conditions, and only verified single-action IF-to-trade-call links on the **main fullscreen graph**. These are different from the forward-only starter compiler; unknown functions are **not** represented as verified executable edges.
- Tap modules to browse/search real original function names and inspect/edit recognized global settings and enum presets. Complex functions are inspect-only.
- **Expand a subsystem into individual original MQL function cards** on the main canvas. Dashed lines identify only lexical in-file function-name references; they are explicitly NOT trusted execution-path connections, and they do not support code rewiring.
- Edit precisely mapped input defaults and simple numeric IF comparisons. Any original source not mapped is preserved.
- On a verified direct-trade IF, **add a new AND-condition block** referencing an existing numeric input. Change its comparator or threshold, disconnect it, or reassign it to another verified IF. Unlike cosmetic card rearranging, these edits genuinely alter the downloaded MQL source.
- Move cards on the canvas visually; card position alone never rewrites the EA.
- Export a source file in its original MQ4/MQ5 format and original encoding/BOM, or a lightweight source-mapping JSON report. With no changes, export the exact original file bytes.
- Switch back to the normal typed MT4 Flow Builder with **Projects → Load example robot**. The code change is separate from the starter strategy project.

## Exact limits and safety contract

This release is **not** a general arbitrary MQL4/MQL5-to-fully-rewritable AST compiler. Some custom HIGHTOWER functions, complex conditionals, nested branches, library includes and API side effects cannot be inferred confidently from a single source file.

**Only precise mapped source changes and numeric AND gates on recognized direct-trade guards are allowed to modify imported EA logic.** Users can see other functions and controls, but their interconnections are not asserted as executable, and no arbitrary function-body rearrangement is performed. A diagram drawn from source evidence is not the same as a complete control-flow graph.

Adding an AND guard can deliberately prevent trades that previously would have occurred. Any source edit may change behavior. No source is compiled with MetaEditor, backtested in Strategy Tester, connected to an account, or executed in WISDO. Exported code must be compiled and demo-tested before considering live deployment.

## Next engineering stage

To enable arbitrary custom blocks, freely rewiring HIGHTOWER functions and safe round-trip compilation, WISDO needs a compiler-grade MQL front-end with include resolution, source maps, typed control flow, semantic validation, backtest/compile workers, and explicit release history. Until then, opaque source must remain protected.
