# CEM CULTURE WISDO FULL ALL-DISCUSSED TRADING UPGRADE

Date: 2026-05-06

This package consolidates every issue discussed in the session into one deployable patch.

## 1. Fixed voice / intent routing

WISDO now protects trading words from being routed into the bot store.

Examples that must route to MT4 control now:

- `close my trades`
- `flatten my account`
- `take winners 100%`
- `close profits`
- `cut losers`
- `protect my account`
- `I am walking away, take over`
- `buy only`
- `sell only`
- `pause trading`
- `resume trading`

Store commands only route to Store when the user actually says buy/purchase/quote/order with bot language.

## 2. Fixed command writer bridge

The `/wisdo-*` EA control commands no longer stop at "Command built, but no queue writer was found" when `mt4CommandService` is in the command registry context.

EA control commands now try:

1. `context.mt4CommandService.queueCommandForAccount`
2. `context.mt4CommandService.queueCommand`
3. older project writer aliases

## 3. Fixed multi-bot duplicate-copy identity

The old Reporter blocked copied trades by `sourceTicket` only. That breaks your setup because you run multiple bots, symbols, magic numbers, and terminals.

The new copy identity is based on:

- source user
- source account
- source terminal
- source ticket
- symbol
- magic number
- bot / EA name
- side
- target account

The backend generates a short stable `sourceCopyId`, and MT4 stores that in the order comment. That means WISDO blocks exact duplicate copies but allows different bots/pairs/magic numbers to copy correctly.

## 4. Fixed XAUUSD / broker suffix symbol resolution

Copy trades now call the Reporter symbol resolver for copy commands, not only manual commands. The Reporter can resolve examples like:

- `XAUUSD` → `XAUUSDm`
- `XAUUSD` → `XAUUSD.`
- `XAUUSD` → broker Market Watch equivalent
- explicit aliases through `SymbolAliasMap`

## 5. Added follower-safe lot behavior

Backend copy sizing now supports safer follower lot calculation and passes min/max/risk information to MT4. The Reporter also reduces copied lots down toward broker minimum if free margin is too low.

If even the minimum lot cannot pass margin, MT4 returns:

`Insufficient free margin for copied trade, even at broker minimum lot`

## 6. Cleaner command poll behavior

Missing or stale pair codes should return clean reconnect-required JSON instead of scary command-poll HTTP 400 responses where patched routes are active.

## 7. Correct demo leader + live follower model

Recommended setup:

```text
Demo Lead = Leader / signal source / aggressive bot testing
Live Account = Follower / execution target / protected risk profile
```

Run:

```text
/connect name: Demo Lead role: Leader
/connect name: Live Account role: Follower
/my-accounts
/set-active-account account_id:<live-account-id>
/member-portal
```

## 8. Deploy steps

```bash
npm install
npm run register-commands
npm start
```

On Render, make sure the Start Command is still correct for the service root.

## 9. MT4 reset steps after deploy

1. Restart Render.
2. Register commands.
3. Generate brand-new pair codes.
4. Paste the demo code into demo terminal.
5. Paste the live code into live terminal.
6. Right-click Market Watch → Show All.
7. Open the gold chart once.
8. Reattach or refresh CultureCoin_MT4_Reporter.

## 10. Important compile note

The `.mq4` source was upgraded. The included `.ex4` may still be the older compiled binary unless you compile the patched `.mq4` in MetaEditor.

To activate the Reporter-level fixes, open:

`mql4/CultureCoin_MT4_Reporter.mq4`

Then click Compile in MetaEditor and copy the new `.ex4` into `MQL4/Experts`.

