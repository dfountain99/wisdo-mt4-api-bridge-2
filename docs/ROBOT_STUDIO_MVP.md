# WISDO Robot Studio — MT4 Starter MVP

This adds a first-party beginner-oriented trading robot editor inspired by the *concept* of visual strategy builders like fxDreema, without embedding, copying, or relying on the proprietary fxDreema editor.

## URL and scope

- Open `/app/robot-studio` (also linked from WISDO member navigation).
- Choose an EMA-crossover starter, optional RSI and broker-server-time session filters, buy/sell direction and safety inputs.
- See a dynamically updated, readable flow diagram of what the EA will do.
- Save a project **locally in the browser**, import/export editable WISDO JSON, preview and download MQL4 `.mq4` source.
- Compiling, backtesting and installing are done in MetaEditor/MetaTrader 4 by the user.
- No server-side storage, voice commands, copier connection, trading API execution, actual canvas drag/drop, MQL5 export or guaranteed profit is in this MVP.

## Generated EA behavior

- Processes a signal at the beginning of each chart candle using closed-bar EMA (and optional RSI) data.
- Ignores new signals while it holds an open market order for its symbol and magic number.
- Supports buy/sell direction, configurable spread threshold, fixed lot or approximate % equity-risk size.
- Performs free-margin and broker minimum-stop checks before attempting entry.
- Sets a stop loss and take profit as part of entry; reports `OrderSend` failures through MT4 logs.
- Session filter uses **broker server time**, not the visitor's browser timezone.
- Assumes suitable spread and broker pricing conventions. Broker tick values, commissions, gaps and slippage may cause realized losses above the intended risk.

## Safety and verification

New strategy source must be compiled in MetaEditor and backtested in the MT4 Strategy Tester on demo. The online editor does not attest to compilation, optimization or profitability.

Automated tests live in `tests/robotStudio.test.js` and cover normalized inputs, invalid risk/filter settings, deterministic source, and basic MQL4 safety guards. To run just these tests with Node 22:

```bash
node --test tests/robotStudio.test.js
```

The production JavaScript build checker scans for accidental public `.mq4` source; this feature generates files on-demand in the user's browser and does not commit any generated source files.

## Integration phases (not yet shipped)

1. **Canvas editor** — true drag-and-drop graph nodes, branches, composition rules, schema versioning, reusable blocks, undo/redo and mobile reorder controls.
2. **Strategy compiler** — intermediate representation and distinct, tested MT4/MT5 code generators with compiler diagnostics.
3. **WISDO strategy library** — authenticated per-member PostgreSQL storage and ACLs; versioned robot configurations and recovery.
4. **Backtests** — historical data provenance, spread/fee/slippage assumptions, walk-forward validation, and verification before enabling any deployment.
5. **Execution** — approved strategy artifacts bound to a verified MT4/MT5 account and the existing command bus with demo-only defaults, independent risk limits, audit logs and a guarded enable/disable/kill switch.
6. **Voice/presence integration** — clear, confirmable intent mapping; no unconfirmed trade execution from microphone or occupancy signals.

## Deployment note

The feature branch must be reviewed and merged, and Render must deploy the merged commit before `/app/robot-studio` becomes live. Existing WISDO Studio, trading runtime, copier and Command Center routes remain unchanged.
