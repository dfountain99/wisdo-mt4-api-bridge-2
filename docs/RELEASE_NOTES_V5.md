# V5.1.0 — Unified Member Experience, Account Hydration, Academy, and Dashboard Boot

This release builds directly on V5.0.1 and remains based solely on the user-supplied `wisdo-member-app-product-pass(1).zip` source tree.

## Member experience repairs

- Replaced the separate legacy education experience with the shared `/app/*` WISDO shell.
- Redirected `/member/education?bot=...` to `/app/education?bot=...` while preserving the selected bot.
- Unified sidebar, topbar, account selector, spacing, themes, motion backgrounds, and selected-account context across Dashboard, Accounts, Copier Engine, Trades, WISDO Insight Engine, Alerts, Academy, Affiliate, Settings, and Billing.
- Restored an original Xbox-inspired WISDO startup sequence when Dashboard is opened.
- Startup stages now reflect real work: authentication, Reporter account synchronization, command authority, live metrics, and dashboard rendering.
- The boot overlay has a Skip control and always exits into the dashboard or a visible recovery state.

## Account onboarding and data unification

- Added request timeouts, visible working/success/error states, and button recovery to the broker account form.
- Canonicalized MT4/MT5 account identity as `accountNumber:server`.
- Merged Reporter-backed accounts into the same account list used by every app screen.
- A successful MT4/MT5 save generates a pairing code immediately when no live Reporter heartbeat exists.
- Account list and selected-account metrics now include balance, equity, floating P/L, open trades, status, server, and heartbeat freshness.
- Account controls and analyzer queries follow the selected account rather than a disconnected placeholder store.

## WISDO Academy

- Added a fully interactive DF Sauce Campaign Character chart replay.
- Added Buy, Sell, Wait, and Close decisions with scoring and feedback.
- Added bot-brain state for EMA bias, market structure, BOS, 0.90 hold, targets, campaign mode, and cloud-break exit.
- Added interactive video chapters and checkpoints.
- Added a TradingView Watch Room with selectable XAUUSD, EURUSD, GBPJPY, NAS100, and USOIL symbols.
- Added a Pine explanation/download lab.
- Installed the complete owner-supplied 474-line Pine v6 `DF Sauce Campaign Character` script as the authoritative Academy source.

## Appearance and naming

- Renamed the member analytics product to **WISDO Insight Engine**.
- Added member-selectable themes: Midnight, Cobalt, Emerald, Violet, Gold, Ember, and Light.
- Added backgrounds: Mesh, Terminal, Motion A, Motion B, and Solid.
- Appearance persists locally and in the member profile.

## Reliability retained

- V5.0.1 serialized atomic JSON writes remain included.
- Concurrent MT4 command writes no longer share one `.tmp` filename.
- Account/user queue delivery state remains synchronized.
- Broker credential encryption, signed sessions, signed webhooks, and dangerous-command confirmation remain enabled.

## Validation

- JavaScript syntax/assets: passed.
- Automated tests: 7 passed, 0 failed.
- Concurrent command test: 40 writes retained, no temp-file race.
- HTTP smoke: Dashboard, Accounts, Academy, legacy education redirect, workspace JS, Academy JS, Pine asset, account create, and account list passed.
