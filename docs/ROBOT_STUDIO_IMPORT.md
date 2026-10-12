# WISDO Robot Studio — Import and Rebuild (MQL4 / MQL5)

## What the current MVP implements

The first-party browser-based Robot Studio at `/app/robot-studio` contains an **Import & Rebuild** workspace:

- Choose or drag in an editable `.mq4` or `.mq5` **source** file (up to 4 MB).
- Detect the platform by extension, decode UTF-8 / UTF-16LE / UTF-16BE sources, and remember the original encoding and byte order mark.
- Identify simple source features: global input/sinput/extern declarations, event handlers, typical indicator APIs, trading functions, conditional statements and external include/import directives.
- Render those as cards in categorized visual lanes; rearrange cards with drag/drop, mobile-friendly move-up/down controls and group selectors.
- Edit safely mapped global input values and simple numeric `if (identifier comparison literal)` comparisons using form controls, without opening the source by hand.
- Preview the resulting code, inspect a list of changed snippets, reset edits, and download the file in its original `.mq4` or `.mq5` format.
- Keep source in the browser: no source upload to the WISDO server, external AI provider, or trading-account endpoint. The original source is kept intact if nothing is changed.
- Never attempt code execution or automatically enable trades.

## Transparency: this is not yet a universal reversible MQL compiler

MQL4 and MQL5 support unrestricted custom functions, procedural control flow, macros, includes, event handlers and broker-specific libraries. Their logic cannot always be inferred from a single file. A source explorer can show **discovered building blocks**, but discovering a method call is not proof of the surrounding trade signal or execution sequence.

Current limitations:
- **Only supported code patterns are editable.** Unmapped code and external dependencies remain unchanged and visible as discoveries or opaque code.
- **Dragging the cards changes the visual arrangement, not the robot's execution order.** Rewiring logic from an arbitrary upload requires a compiler-grade parser, validated intermediate representation, and compiler feedback; deceptively rewriting code using regex could silently change order placement or risk behavior.
- The browser cannot reconstruct compiled `.ex4`/`.ex5` binaries.
- Non-UTF-8/non-UTF-16 legacy text encodings must be converted safely before importing; unknown encodings are rejected, not silently corrupted.
- A standalone source may rely on missing `.mqh` includes, DLLs, custom indicators, account settings, indicator buffers or other files. This tool does not invent missing dependencies.
- Generated or modified code is not compiled or backtested by WISDO yet. MetaEditor and a demo account are required.
- No production strategy deployment, voice authority, MT4/MT5 bridge pairing, or cloud save is performed in this importer.

## Roadmap to the user's full drag-to-rewire experience

1. **Proper MQL language front ends** — tokenization, preprocessor/include resolution, syntax trees and symbol tables for MQL4 and MQL5.
2. **Strategy intermediate representation (IR)** — control flow, entry/exit conditions, position sizing, session windows, stop management, custom indicators, data dependencies and unsupported opaque nodes.
3. **Semantic editor** — rewire supported blocks with typed ports and ordering constraints. Immediately show affected generated source and prohibit changes where correctness cannot be established.
4. **Round-trip validation** — compile each generated source via correctly licensed MetaEditor/MetaTrader toolchain, report warnings/errors on node cards, compare original and edited control flows.
5. **Backtesting and release gates** — demo-only defaults, reproducible market data and strategy tester metrics, simulation of spread/fees, risk limits and manual live-account enable confirmation.
6. **WISDO account integration** — authenticated member-owned robot library, encrypted dependencies, role permissions, version history, account/bot binding through existing WISDO command infrastructure and emergency stop.

## Tests

```bash
node --test tests/robotStudioImport.test.js
```

Tests cover source preservation, known MT4/MT5 inputs and actions, comments, safe patching, computed-value protection, simple conditions, and common source encoding round-trips.

All edits should be inspected and compiled in the appropriate MetaEditor and then tested on demo before consideration for any live account.
