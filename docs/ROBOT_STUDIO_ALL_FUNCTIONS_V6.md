# WISDO Robot Studio V6 — All Functions → Eight-Engine Collapse → Focused Category

**User request:** Imported HIGHTOWER-style EAs should *start with every source function on the full-screen Robot Logic Blueprint*, not just eight summary cards and a handful of functions. Users can collapse to eight engine cards, then open one engine to work on every function within that category.

## Behavior

- **Default: All functions.** Every function found in the imported source is added as an individual inspectable node. The view lays nodes out in consecutive source-category groups, with readable columns and a vertically scrollable map. Import X-ray functions are **not limited to 9/38/50 nodes**.
- **Collapse to 8 engines.** Precisely eight overview cards, with counts of all functions and controls. Categories: Market structure, SONIC, Campaign, Risk, Protection, Collection, Session, Accounts/server/other.
- **Work within one category.** Select an engine from the new dropdown or tap a collapsed engine card; that view shows **all** its original source functions, not just the first nine. The remaining functions are still stored in the project and remain accessible through All functions.
- **Unknown/custom symbols are retained.** The eighth umbrella intentionally contains Account/Server and other unclassified functions. Function identity, source references and source code remain unchanged.
- **No drop in edit functionality.** Source-linked input and simple IF edits, plus vetted AND gates, continue to use exact source spans. Switching between visual views never changes program execution or undoes staged code edits.
- **Mobile usability.** A vertically scrollable, dynamically sized canvas rather than forcing 333 functions into 850px. Fit scales the **width** for tall imported blueprints; users scroll to the rest or focus one engine.
- **Connections are honest.** On the complete map, function cards are source definitions, not a fabricated MQL control-flow graph. In an individual category, dashed lines show lexical function references **only**, not proven runtime execution. Verified trade guard wires remain distinct.

## Constraints

No compiler-grade reverse engineering or arbitrary function rewiring has been added. Importing, expanding, collapsing and dragging function cards only changes the **view**. Compiling, backtesting, and safe rewiring of unverified HIGHTOWER functions are separate future work. Users must compile modified code in MetaEditor and demo-test before live use.

## Tests

Run \`node --test tests/robotStudioAllFunctions.test.js\`. The test suite checks full function inclusion for real HIGHTOWER source, exact eight-engine collapse, full coverage across category drilldowns, persistent positions and edited parameters, nonexecution reference wires, dynamic board sizing and top controls.
