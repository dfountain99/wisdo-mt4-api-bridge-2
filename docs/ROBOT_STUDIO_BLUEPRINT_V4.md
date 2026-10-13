# WISDO Robot Studio V4 — Blueprint First

URL: \`/app/robot-studio\` (Visual Flow opens by default), or \`/app/robot-studio#flow-builder\`.

**Experience:** The Robot Logic Blueprint is now the full-viewport Studio. The node graph, not settings panels or a marketing hero, occupies the browser window. The fixed top command bar and unobtrusive bottom status/zoom bar are the only persistent chrome.

## Daily workflow

1. **Blocks:** Opens a temporary block library drawer. Tap a block to add it, or drag onto the canvas on desktop.
2. **Canvas:** Pan with the browser's scroll area. Drag a node header to move it; click/tap an output dot and another node's input dot to connect; true/false connections change the generated MQ4 source.
3. **Inspector:** Tap a block to bring up editable conditions. Close the inspector to restore 100% of the canvas.
4. **Risk:** Opens all common robot risk and order protection fields; the connections list is also here.
5. **Code / Export:** Opens source preview, validation errors, downloadable MQ4 and editable WISDO graph project.
6. **Projects:** Save local browser project, load existing JSON, reset example graph, or cancel a pending connection.
7. **More Studios:** Open Bot Hospital, Import & Rebuild, or Quick Robot Builder. These remain accessible without taking up permanent canvas space.
8. **Zoom:** Minus, plus, and Fit-to-screen. Zoom affects visual coordinates; dragging nodes and dropping palette blocks convert viewport coordinates back to native canvas coordinates.

## Implementation

- \`public/app/robot-studio/index.html\`: full-screen flow layout; original secondary editor views and controls retained.
- \`public/app/robot-studio/blueprint-focus.css\`: viewport-priority design, retractable side panels, desktop and mobile behavior.
- \`public/js/robot-studio-flow-ui.js\`: transient drawers, focus/escape/backdrop behavior, canvas zoom and scaled pointer movement.
- \`public/js/robot-studio-workspace.js\`: adds/removes full-screen body mode on workspace change.
- \`tests/robotStudioBlueprintFullscreen.test.js\`: checks viewport layout, complete control mapping, zoom and view routing.

## Limits

No compiler logic or trading execution changes are introduced by this layout release. The graph compiler supports a limited set of typed MT4 flow blocks; it does **not** transform arbitrary HIGHTOWER MQ4/MQ5 code into rewritable control-flow blocks. Generated source must be compiled in MetaEditor and backtested/demo-tested separately. No live account orders are triggered by the editor.
