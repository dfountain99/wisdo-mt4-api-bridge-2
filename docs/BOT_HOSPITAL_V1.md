# WISDO Bot Hospital V1 — Real Source X-Ray & Surgical Input Editing

Route: **/app/robot-studio#bot-hospital**, accessed via the **BOT HOSPITAL** third tab inside Robot Studio.

## Use it

1. Open Bot Hospital. Click **Load HIGHTOWER v6.21 from GitHub** (public \`mql4/HIGHTOWER_UNITY_CAMPAIGN_v6_21.mq4\`) or import your own editable \`.mq4\` / \`.mq5\` source file (up to 4 MB).
2. The browser keeps the source and an original-byte copy. It discovers enum definitions, input/extern/sinput settings, named function definitions, in-file function-call name references, and input identifiers referenced by functions.
3. Select a subsystem: market structure, SONIC ladder, campaign state, risk/margin, stops/trailing, profit collection, sessions, account/bridge, or unmatched custom code. **Grouping is inferred from names**, so use it as navigation, not proof of trading behavior.
4. Open a mapped input (numeric, bool, string, or recognized enum member) and make a change. The source preview, exact diff, and source-use count update. Read-only custom/computed expressions stay preserved.
5. Export an exact original backup, an altered source file with its original UTF-8 or UTF-16 encoding/BOM, and a JSON report listing mapped functions, identifiers, diagnostics, and edits.

All standard imports run fully in the browser. The HIGHTOWER sample is downloaded from the public GitHub repository only after clicking its button. Private files/edits are never sent to GitHub by this feature.

## Code integrity and interpretation

- MQL4/MQL5 source is **not** compiled, executed, decompiled, or backtested by this interface.
- This is a lexical browser-based source X-ray. It does not resolve preprocessor branches/macros, cross-file symbol identity, all overloaded methods, declaration shadowing, or dynamic dispatch. False positives and missing references are possible.
- An in-file function reference is **not an execution edge**, and an identifier match in a function is **not proof that a parameter affects live trading**.
- Source edits are limited to original, precisely located input declarations. Enum changes are restricted to the enumerators defined in the imported file. All other source and custom function bodies stay intact.
- A source that cannot be safely mapped stays read-only. Module drag-and-drop **only changes the visual order**.
- The UI does not claim it repaired compilation failures, performance issues, stop logic, or trading bugs; exporting an updated input value is not proof of correctness.
- External includes, imports, and custom indicator dependencies may require additional files. This version reports them but does not ingest dependency archives or inspect them.
- Before live use: compile in the appropriate MetaEditor, resolve compiler warnings, test in Strategy Tester and on a demo account, and compare the outcomes with the original EA. Orders require separate WISDO authorization.

## Engineering follow-on

1. Add a compiler-capable MQL language front-end with symbol tables and recursive .mqh include resolution.
2. Create a typed intermediate representation with confidence levels and opaque custom-code nodes; never generate code from conjectured control-flow links.
3. Support validated rewiring of proven paths using editable connections, guards, and rollback snapshots.
4. Add isolated Windows-based MetaEditor compile + MT4/MT5 Strategy Tester workers; surface errors in mapped source lines and blocks.
5. Add signed revision histories, version promotion from demo to release, and explicitly separate live authorization.

## Verification

\`\`\`bash
node --test tests/robotStudioHospital.test.js
\`\`\`

The tests use the actual large committed HIGHTOWER v6.21 source file, not an EMA toy example, and verify enum surgery, SONIC settings, exact patching, and source-use references.
