# HIGHTOWER native server control v6.22

This rebuild uses the complete 29,963-line source supplied on October 5, 2026. It preserves that source's trading engine and adds an HTTPS control bridge. It is NOT a replacement with the shorter v6.21 file from the repository.

## Status

Source implementation and targeted tests complete. Not compiled by MetaEditor, not installed in MT4, not deployed, and not validated against a broker. No EX4 is supplied. The PostgreSQL claim query has not been exercised against a running PostgreSQL instance. The C++ compatibility tests are not a substitute for MQL4 compilation.

## Installation

1. Review and deploy the accompanying server changes to the existing WISDO Node server. The source baseline is commit `6bb050e22d319131db9b01f0098f881a382f2cc6` in `dfountain99/wisdo-mt4-api-bridge-2`. No new provider is required. Existing pairing authentication and command storage are reused.
2. Copy `mql4/HIGHTOWER_UNITY_SERVER_v6_22.mq4` into MT4's `MQL4/Experts` folder and compile it with MetaEditor. Resolve compiler errors before installation.
3. Replace the previous HIGHTOWER EA on its chart. Run only one HIGHTOWER instance for the same account, broker, symbol and magic number. Keep the copier on its own chart. Do not run both old and new HIGHTOWER instances together.
4. Set `WisdoServerControl=true`.
5. Set `WisdoPairingCode` to the exact code the copier is currently using. The account must already be linked by the copier. No broker password is needed.
6. Set `WisdoServerBaseUrl` to the copier server's HTTPS origin, for example the origin portion of its SyncUrl. Remove `/mt4-sync` and any trailing slash. No production URL is hardcoded.
7. If the server requires an API key, use the copier's key in `WisdoServerApiKey`. Otherwise leave it empty. Do not share the code/key in screenshots.
8. Add that HTTPS origin under MT4 Tools → Options → Expert Advisors → Allow WebRequest for listed URL. Enable terminal AutoTrading and EA live trading permission for the demo test.
9. Missing or invalid bridge settings now leave the EA attached in SETUP REQUIRED mode. No trading engine or strategy-state saves run in that mode. Press F7, correct the Inputs, and click OK to initialize again. A duplicate scope or inaccessible Files folder also shows an on-chart explanation.
10. Verify the chart shows `PAIRED / PAUSED`. Sign into WISDO and open `/member/hightower-control`. Select the account, exact broker symbol (including suffix), and EA magic number (default `26080204`). Send a confirmed Resume command to arm the existing strategy.

The pairing code links the bot to the same account as the copier. It does not move trading execution into Node: MT4 must remain open and connected, on your computer or VPS.

## Native controls included

| Control | Actual effect |
|---|---|
| Pause / Manage only | Blocks every new OrderSend at the final Commander gate; attempts to delete this bot's pending orders. Existing position management continues. |
| Resume strategy | Allows the original strategy to evaluate entries under its existing logic and risk checks. Cannot clear an emergency latch. It does not force a market order. |
| Buy only / Sell only / Auto direction | Changes the final entry direction gate, cancels pending orders, and stays paused until explicit Resume. |
| Close bot trades | Pauses first, deletes scoped pending orders, then closes positions matching this chart symbol and magic. |
| Close profitable trades | Pauses first, deletes scoped pending orders, then closes matching market positions whose profit + commission + swap is positive when selected. Final fill profit can differ. |
| Emergency stop + close | Persists an emergency latch before attempting the scoped close. |
| Reset emergency | Clears the latch but remains paused. Resume is a separate action. |

This release's native route supports the controls above. Existing WISDO voice, gestures, campaign ATR overrides, counter-entry intentions, and campaign scheduling are not automatically rerouted into this new lane. Unsupported actions are rejected. The uploaded strategy's own exits and management remain active.

## Delivery and safety behavior

- HTTPS only; account and broker must match the existing pairing. Commands additionally match symbol and magic.
- `HIGHTOWER_CONTROL` is a distinct queue lane. Both file-backed and PostgreSQL ordinary Reporter polling exclude it, and the ordinary completion endpoint rejects its receipts.
- The server atomically assigns each command to one receiver. Another receiver cannot retry that delivered command. Install only one bot instance per scope; this is not a distributed active/standby terminal system.
- The bot starts paused on each attachment. A failed poll or stale connection blocks new entries; reconnection does not auto-resume. The default poll period is three seconds with a 1.2-second request timeout and 15-second maximum heartbeat age.
- The final Commander entry check applies to the source's sole OrderSend call, including pending-order creation. Existing broker-side pending orders can still fill during a disconnect or before deletion succeeds. Existing broker stops remain active; no software can cancel orders at a disconnected broker.
- Each command is journaled before its effects. Retries return the saved result. A crash between execution and result persistence is reported as uncertain/failed and is not replayed automatically. Inspect broker state before issuing a new instruction.
- Results distinguish complete, partial/failed, and queued. A broker refusal is not a success. Close actions leave entries paused.
- Legacy unscoped voice globals are ignored while native server control is enabled. The native entry gate remains authoritative even if legacy timers change their own pause variables.
- Changing a native control does not weaken the strategy's hardcoded/local trading gates. Resume does not promise an entry.
- Disabling `WisdoServerControl` restores the original local mode. WebRequest is unavailable in the MT4 Strategy Tester; use disabled bridge mode for offline strategy tests.
- WebRequest is synchronous and can delay this EA's tick processing during requests. Validate the selected polling interval against your trading workload. No claim of real-time execution or guaranteed fill prices is made.

## Server files

- `server/hightowerBridge.js`: authenticated pairing poll/receipt endpoints, owner-only web controls, confirmation preview, receipt status.
- `services/hightowerRouting.js`: dedicated-lane and scope checks.
- `services/mt4CommandService.js`: file-backed atomic claim and queue exclusion.
- `services/postgresMt4CommandStore.js`: PostgreSQL row-lock claim and queue exclusion; reuses existing schema.
- `server/apiServer.js`: registers the new routes before broad portal fallbacks and protects dedicated receipts.
- `public/hightower-control.html`: account selector, explicit confirmation and actual command receipts.

`/mt4-bot-poll` and `/mt4-bot-complete` use the same pairing authentication as the copier. The new bot does not send competing full-account snapshots: keep the Reporter/copier running for account telemetry.

## Validation performed

- `node --test tests/hightowerBridge.test.mjs`: seven tests passed, including the actual file-backed command service with concurrent claims, preview/confirmation behavior, scope isolation, and failure receipts.
- `python3 tests/testHightowerNative.py`: extracted new MQL functions passed C++ compatibility scenarios for JSON parsing, wrong account, stale heartbeat, directional order gates, pending cancellation, partial close, and emergency reset. Static check confirms the uploaded source's single OrderSend is gated.
- Node syntax checks passed for all changed server modules.

Before release: run the repository's normal validation, exercise the PostgreSQL claim path, compile with MetaEditor, and test in a demo terminal with the copier running. Check invalid code, wrong broker, two scoped bots, lost connectivity, stale command, receipt retry, pending cancellation failure, and broker close rejection. No live-account command has been sent during this work.
