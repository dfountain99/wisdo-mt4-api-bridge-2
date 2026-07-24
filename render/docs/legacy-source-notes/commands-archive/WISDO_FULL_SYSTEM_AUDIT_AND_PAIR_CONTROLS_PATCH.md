# WISDO Full System Audit + Pair Control Patch

## Audit result

This patch audits the rebuilt Culture Coin / Deadshot Trading Command Center after the Wisdo execution bridge fix.

### Critical issue found and fixed

The MT4 reporter polls `/mt4-command-poll` using the bridge pairing owner. Website button commands can be queued under the website user id, while Discord-generated or Discord-linked pairing codes can use the Discord user id. That identity mismatch can make the website say a command is queued while MT4 never receives it.

Fixed by making `/mt4-command-poll` and `/mt4-command-complete` resolve all linked identities:

- Discord user id
- Website user id
- `requestedByUserId` from the pairing code
- User ids linked in `discord_connections`

The poll endpoint now checks all linked ids before returning no command.

## Website upgrades added

### Dashboard visuals

- Account Health panel
- Health color states
  - Gray: reporter not linked
  - Blue: bridge linked
  - Green: account moving in profit
  - Gold: daily goal reached / over 100%
  - Red: drawdown or negative floating P/L
- Animated health ring
- Animated equity line
- More animated `.chart` effects
- Strongest/weakest pair gauges
- Pair strength radar
- Pair control grid

### Pair controls

Every active pair from the reporter snapshot now gets an individual control card showing:

- Symbol
- Open trades
- Buy/sell count
- Total lots
- Floating/closed P/L
- Pair strength gauge
- Close winners for that pair
- Close entire pair
- Pause pair flag

Pair buttons still go through backend membership gates and then queue supported MT4 reporter commands.

### Trade history

`/app/account-trades` now shows:

- Open trades
- Closed trades today
- Ticket
- Symbol
- Type/action
- Magic number
- Price
- P/L
- Pair-level controls above the table

### Performance

`/app/performance` now shows:

- Win rate
- Profit factor
- Daily goal progress
- Open trade count
- Strongest pair
- Weakest pair
- Snapshot history count
- Pair strength radar
- Account health visuals

## Command mapping audit

Website and Wisdo actions now map to MT4 reporter-supported command names:

- `close_profitable` -> `CLOSE_ALL_PROFITS`
- `close_losers` -> `CLOSE_ALL_LOSERS`
- `close_all` -> `CLOSE_ALL_TRADES`
- `emergency_close` -> `EMERGENCY_CLOSE_ALL`
- `close_symbol_profits` -> `CLOSE_BY_SYMBOL` with `closeMode=winners`
- `close_symbol` -> `CLOSE_BY_SYMBOL` with `closeMode=basket`
- `pause_copier` -> `PAUSE_COPIER`
- `resume_copier` -> `RESUME_COPIER`
- `lock_profit` -> `LOCK_PROFIT`
- `walk_away` -> `WALK_AWAY_MODE`
- `pause_symbol` -> `CEM_SET_GLOBALS` pair pause flag

## Backend gates audited

Trade execution still requires:

1. Authenticated user
2. `subscription_status === active`
3. `role === culture_coin_member_active` or admin
4. Copier enabled
5. Trading account connected

Reporter remains visible for free/inactive/active users.

## New/updated API routes

- `GET /api/account/health`
- `GET /api/account/pairs`
- Existing `/api/trade-copy/action` now supports pair-scoped payload fields:
  - `symbol`
  - `targetSymbol`
  - `closeMode`

## Audit checks run

- `node --check` on every JavaScript file: passed
- `server/apiServer.js`: passed
- `server/deadshotSite.js`: passed
- `commands/wisdoCommandCenter.js`: passed
- `scripts/registerCommands.js`: passed

## Could not fully run server in this sandbox

`npm install` could not complete in the sandbox because the native `canvas` dependency tried to download/build against external resources and the sandbox could not reach Node/GitHub headers. This is an environment/network issue, not a syntax issue in the patched files.

On your machine/server, run:

```bash
npm install
npm run start:web
```

If `canvas` fails on your Windows/VPS machine, install normal build tools or replace the chart rendering dependency later.
