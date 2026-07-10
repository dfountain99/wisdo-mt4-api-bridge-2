# Deadshot + Wisdo Command Center Final Architecture Blueprint

## Goal
This build turns the member website, Discord, Wisdo wake words, MT4 Reporter, and future Wisdo hardware into one command architecture. The website no longer acts like a static dashboard. Every visible command button either queues a real backend command or returns a clear locked/blocked reason through the same audit trail.

## Renamed TradersConnect-style modules
The TradersConnect-style ideas are implemented with Culture Coin names so the product does not look copied:

- **Copier Engine**: active-member execution lane for copy controls and emergency controls.
- **Copier Logs**: every allowed, blocked, queued, delivered, failed, expired, and completed copier event.
- **Account Trades**: live open-trade and closed-trade view from the MT4/MT5 Reporter.
- **Performance**: equity, floating P/L, daily goal, strongest/weakest pair, drawdown, margin, and history.
- **Account Connection**: shared website + Discord + MT4/MT5 pairing code center.
- **Account Configuration**: risk, bot mode, max lot, max drawdown, daily target, symbol controls, and Discord/MT4 sync.
- **Wisdo Command Center**: wake-word style actions mapped into MT4 Reporter commands.
- **Culture Coin Reporter**: free/inactive user-safe reporting layer.

## Command architecture
All control surfaces now follow the same lane:

1. **Frontend action**
   - Button click, pair control, account config form, Discord event, or Wisdo wake-word text.
2. **Backend gate**
   - Authenticated user check.
   - Active subscription or `culture_coin_member_active` role check.
   - Copier enabled check.
   - Connected trading account check.
   - Admin override support.
3. **CEM command router**
   - Text/action is normalized into a supported command family:
     - `CLOSE_ALL_PROFITS`
     - `TRIM_PROFITS`
     - `CLOSE_ALL_TRADES`
     - `EMERGENCY_CLOSE_ALL`
     - `CLOSE_ALL_LOSERS`
     - `CLOSE_BY_SYMBOL`
     - `MARKET_ORDER`
     - `PAUSE_COPIER`
     - `RESUME_COPIER`
     - `PAUSE_TRADING`
     - `RESUME_TRADING`
     - `LOCK_PROFIT`
     - `WALK_AWAY_MODE`
     - `CEM_SET_GLOBALS`
4. **Immediate MT4 queue**
   - Commands are written with `immediate: true`, high priority, TTL, account id, account number, origin, and requestedBy.
5. **Reporter poll**
   - Reporter calls `/mt4-command-poll` with the pairing code and account number.
   - The server checks website ID, Discord ID, requested ID, and bridge IDs so commands do not get lost under the wrong identity.
6. **Reporter execution**
   - Reporter executes the supported command or writes CEM Global Variables for bot/risk mode.
7. **Completion confirmation**
   - Reporter calls `/mt4-command-complete`.
   - Website and Discord notification streams record the result.
   - Win/profit completions can include win animation GIFs.

## Fixed command queue bug
The MT4 command service stored the same command in multiple indexes:

- `commandQueue`
- `commandsByUserId`
- `commandsByAccountId`

Older logic only updated one copy when a command was delivered or completed. That made another copy stay `pending`, which could cause repeat delivery, stale status, or buttons appearing broken. This build synchronizes every copy of the command by `command.id` for delivered/completed/failed/expired states.

## Website buttons and controls
No main portal button is intentionally dead:

- Locked trading buttons show a clear locked reason and backend also rejects them.
- Active allowed buttons queue an MT4 command.
- Pair buttons include close winners, close pair, pause pair, and resume pair.
- Wisdo text input maps wake-word commands to executable MT4 commands.
- Account configuration saves to website state, syncs to Discord, and queues CEM globals to MT4 when membership/account checks pass.
- Pairing buttons generate and sync registered MT4 pairing codes.
- Notification chat buttons mark read, copy chat, and route to the related account/Wisdo pages.
- Checkout buttons either open Stripe Checkout when configured or create a safe mock pending record in local development without faking active membership.

## Risk + bot control mapping
Account Configuration now creates these CEM Global Variables when execution is allowed:

- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.RiskMode`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.BotMode`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.MaxLot`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.MaxDailyDrawdownPct`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.DailyProfitTargetPct`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.CopierEnabled`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.ReporterEnabled`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.DiscordAlertsEnabled`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.EmergencyStopEnabled`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.AutoSyncEnabled`
- `CEM.WISDO.__ACCOUNT__.GLOBAL.0.NotificationFrequency`
- `CEM.WISDO.__ACCOUNT__.<SYMBOL>.0.SymbolAllowed`

This lets MT4 EAs and future Wisdo hardware read the same command bus through Global Variables without changing the website again.

## Future Wisdo hardware lane
The hardware controller should not talk directly to MT4. It should call the same backend command endpoint family as website and Discord:

- Pair hardware to a website/Discord identity.
- Hardware sends action intent to the backend.
- Backend runs the same membership and account gate.
- Backend queues the same MT4 command.
- Reporter executes and completes.
- Website/Discord/hardware all receive the same completion state.

This keeps buttons, voice, Discord, and hardware from becoming separate broken command systems.

## Required runtime checks
Before live deployment, confirm:

1. `PUBLIC_BASE_URL` points to the live server.
2. MT4 has WebRequest enabled for the base URL.
3. The Reporter uses the same pairing code generated by Account Connection or Discord.
4. `MT4_SYNC_API_KEY` matches in the server and Reporter if set.
5. Active Culture Coin users have either billing active or the Discord role configured by `CULTURE_COIN_ROLE_ID`.
6. MT4 AutoTrading is enabled when using trade execution commands.
7. EAs that should react to CEM Global Variables read the key names listed above.
