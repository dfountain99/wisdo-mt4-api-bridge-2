# CultureCoin Multi-Account Risk + Profit Manager V28 FULL

This package is rebuilt on top of the user's latest uploaded project zip: `CEM UPGRADE 1ST 4 30.zip`.

## Major upgrade

This is not only a copier. It adds a WISDO profit management layer for users running 5+ bots/accounts:

- Multi-account same Discord support
- Account roles: Leader / Follower / Both / Private
- Risk-aware copier modes
- Same signal risk / custom percent / fixed lot / account-ratio copy modes
- Advanced Profit Manager page
- Advanced Profit Rules page
- Discord/website profit command queue
- MT4 execution support for close-profit commands
- Basket close by symbol/magic
- Partial close winners
- Walk Away Mode
- Equity floor / Lock Profit
- Copy Profit Lock concept
- Multi-Bot Commander concept
- Emergency Shield safety gates

## New website pages

- `/member/profit-manager`
- `/member/profit-rules`
- `/member/risk-profile` upgraded to risk-aware copier

## New API routes

- `GET /api/me/profit-status`
- `GET /api/me/profit-rules`
- `POST /api/me/profit-rules`
- `GET /api/me/risk-profile-v2`
- `POST /api/me/risk-profile-v2`
- `POST /api/me/profit-command`

## MT4 Reporter V1.50 commands

The patched reporter adds execution support for:

- `CLOSE_ALL_PROFITS`
- `CLOSE_ALL_WINNERS`
- `TRIM_PROFITS`
- `PARTIAL_CLOSE_WINNERS`
- `PARTIAL_CLOSE_BASKET`
- `CLOSE_ALL_LOSERS`
- `CLOSE_ALL_TRADES`
- `EMERGENCY_CLOSE_ALL`
- `CLOSE_BY_SYMBOL`
- `CLOSE_BY_MAGIC`
- `CLOSE_BASKET`
- `CLOSE_BY_BOT`
- `SET_EQUITY_FLOOR`
- `LOCK_PROFIT`
- `WALK_AWAY_MODE`

## Safety gates

By default:

- Closing winners is allowed.
- Closing losers/all trades is blocked unless `ProfitAllowCloseLosers=true`.
- Profit manager execution can be disabled with `EnableProfitManagerExecution=false`.
- Profit commands can filter by magic number or symbol.

## Recommended test settings

For live testing:

```txt
EnableProfitManagerExecution=true
ProfitAllowCloseLosers=false
ProfitPartialPercent=50
ProfitMinProfitToClose=0.01
EnableManualTradeExecution=true
ManualMaxLot=0.01
EnableCopyTrading=true only on follower accounts
CopyMaxLot=0.01 while testing
```

## Multi-bot guidance

Each bot should use its own magic number where possible. That allows WISDO to close/trim by bot/magic instead of closing everything.

Use:

- Leader bot accounts = Leader role
- Follower/copier accounts = Follower role
- Live accounts = Private or Follower until you trust settings
- Same Discord user can own many pairing codes/accounts

## Important

Render/server can queue profit commands, but MT4 must use the patched reporter and be compiled in MetaEditor before commands can close trades.
