# WISDO Visual Flow Builder V3 — Connected Logic → Real MT4 Code

**Route:** \`/app/robot-studio#flow-builder\` (the new default Robot Studio workbench).

## What now actually works

- A desktop/mobile-friendly dot-grid canvas and block palette.
- Add blocks using click/tap or dragging a palette card onto the board.
- Drag existing node headers to move them; the output sockets and source-code logic stay connected.
- Click an output port then a block's input port, or drag the output port to an input. Mobile users can connect by tapping.
- Every typed TRUE/FALSE/NEXT edge changes the actual compiled **MQL4 source text**. Delete links to restructure the strategy. Connections are stored as project data, not just cosmetic arrows.
- Edit block-level EMA cross direction/periods, RSI thresholds, server trading hour windows and spread guards through an inspector.
- Actions: BUY, SELL and do nothing/end branch.
- Robot-wide risk/lot sizing, stops, targets, slippage, spread limit, magic number, name. These reuse the original beginner builder's protected MQL4 order-submit helper.
- Each graph is validated for cycles, missing or unreachable blocks, invalid/duplicate ports and bad parameters before source/project export. One OnTick root, exactly one incoming connection per other node, max 50 nodes. The compiler handles an acyclic branching tree, **not general looping graphs**.
- Generated MQ4 uses *completed-candle evaluation*, closed-candle EMA and RSI comparisons, broker time for sessions, single open market trade per symbol+magic, lot/stop/margin/spread gates, and own order magic isolation. Download editable project JSON or browser-generated MQ4. Local draft save/load is browser-only.
- Graph status and generated code preview update as wires and settings change. An invalid graph cannot export executable source.

## Boundaries

This release **does not** reverse-compile imported arbitrary MQ4/MQ5/HIGHTOWER to an editable graph. Bot Hospital still shows actual function X-rays, safe source-linked parameter edits and source preserving export, with internal mappings identified as best-effort and unresolved code read-only.

The Flow Builder is a separate fxDreema-inspired **forward graph compiler** for a deliberately limited MT4 block set. Converting a complex HIGHTOWER EA requires a compiler-grade MQL parser and representation, dependency loading and program semantics validation.

This version does not compile with MetaEditor, run market-data backtests, connect trading accounts or execute orders. Downloaded source must be inspected, compiled with MetaEditor and exercised in the MT4 Strategy Tester and on a demo account. Valid graph code generation does **not** mean source compilation, strategy profitability or safety are guaranteed.

No AI-generated arbitrary code execution, server source uploads, private account access or live deployment are enabled by this feature.

## Tests

\`\`\`sh
node --test tests/robotStudioFlow.test.js
\`\`\`

Tests check real MQL4 branching, swapped branches resulting in changed source, connection and cycle safety, project round-trips, risk guard presence and actual page controls.
