# CultureCoin Trade Signal Hard Fix V30

This patch fixes the signal pipeline so connected leader accounts actually create Discord trade signals.

## What was broken

`TradeSignalService` existed and the Discord button handler existed, but `Mt4SyncService.receiveSnapshot()` was not actually calling `tradeSignalService.createSignal()` after a leader trade appeared. That means MT4 snapshots could show open trades while `copySignalsOpened` stayed at 0.

## Fixes

- Adds `attachTradeSignalService()` support to MT4 sync.
- Adds open-trade detection per account.
- Stores seen trade keys per account to avoid duplicate signals.
- Creates a Discord signal when a new leader trade appears.
- Adds signal fallback posting to the leader desk if `SIGNAL_CHANNEL_ID` is missing.
- Adds signal diagnostics at `/api/signal-health`.
- Adds `/set-account-role` so accounts can be changed to `leader`, `follower`, `both`, or `private` from Discord.
- Logs `copySignalsOpened`, `copySignalsClosed`, and signal skip reason on every MT4 sync.

## Important env

```env
SIGNAL_CHANNEL_ID=optional_public_signal_channel_id
SIGNAL_BUTTON_TTL_SECONDS=60
WISDO_SIGNALS_FROM_ALL_CONNECTED=true
```

`WISDO_SIGNALS_FROM_ALL_CONNECTED=true` means a connected account can create signals even if it was left as `private`, except accounts marked `follower`.

## Test

1. Deploy.
2. Run `/set-account-role` and set the signal account to `leader` or `both`.
3. Close all trades on leader and let it sync once.
4. Open one fresh test trade.
5. Render logs should show `copySignalsOpened: 1`.
6. Discord should receive the signal.
