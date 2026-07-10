CEM ADAPTIVE NUMBER ENGINE V1.0
================================

Patched bots:
- DEADSHOT.mq4                  -> profile DEADSHOT_SNIPER
- DF SAUCE FINAL AI.mq4         -> profile SAUCE_REACTOR
- DF_Handsfree V10.6.mq4        -> profile HANDSFREE_V10_6
- DF_Handsfree V9.mq4           -> profile HANDSFREE_V9
- DF_Handsfree.mq4              -> profile HANDSFREE_CORE

Important:
- Source files (.mq4) were upgraded.
- Existing .ex4 files are included but are the old compiled binaries until you recompile the patched .mq4 files in MetaEditor.
- For the WISDO Reactor / input-based bots, integer inputs were changed from input int to extern int so the adaptive engine can adjust them live.

Design:
- No one shared WISDO risk variable controls every bot.
- Each bot has its own BotId, profile, symbol, account number, and magic-number namespace.
- The same bot can run on many pairs/accounts and still receive different numeric commands.
- The bots do not lock down. The engine reshapes integer settings after loss streaks or rough market state.

Global Variable command format:
1) CEM.<BOT>.<ACCOUNT>.<SYMBOL>.<MAGIC>.<INT_NAME>
2) CEM.<BOT>.<ACCOUNT>.<SYMBOL>.<INT_NAME>
3) CEM.<BOT>.<SYMBOL>.<MAGIC>.<INT_NAME>
4) CEM.<BOT>.<SYMBOL>.<INT_NAME>
5) CEM.<BOT>.<INT_NAME>
6) CEM.ALL.<ACCOUNT>.<SYMBOL>.<MAGIC>.<INT_NAME>

Example per-pair commands:
- CEM.DEADSHOT.5220807.XAUUSD.260408.MaxTradesPerSide = 3
- CEM.DEADSHOT.5220807.EURUSD.260408.MaxTradesPerSide = 1
- CEM.DF_HANDSFREE_V10_6.5220807.XAUUSD.77106026.InpMaxOpenTrades = 4
- CEM.DF_SAUCE_FINAL_AI.5220807.XAUUSD.77106026.InpBaseAddStepPoints = 750

Telemetry written by each bot:
- CEM.<BOT>.<ACCOUNT>.<SYMBOL>.<MAGIC>.LOSS_STREAK
- CEM.<BOT>.<ACCOUNT>.<SYMBOL>.<MAGIC>.MARKET_STATE
- CEM.<BOT>.<ACCOUNT>.<SYMBOL>.<MAGIC>.ADAPT_STATE

Market states:
0 = calm/unknown
1 = trend
2 = range
3 = high volatility
4 = spread danger

Adapt states:
0 = normal
1 = caution after loss streak trigger
2 = defense after longer loss streak
3 = reserved recovery state

New external engine controls added to every bot:
- CEM_AdaptiveEngineEnabled
- CEM_AdaptiveAllowGlobalOverrides
- CEM_AdaptiveAutoAfterLossStreak
- CEM_AdaptiveLossStreakTrigger
- CEM_AdaptiveMaxLossLookback
- CEM_AdaptiveWriteTelemetry
- CEM_AdaptiveTelemetrySeconds
- CEM_AdaptivePrintDebug
- CEM_AdaptiveBotId

Bot-specific adaptation:
DEADSHOT_SNIPER:
- Reduces MaxTradesPerSide after loss streaks.
- Increases entry/ladder cooldowns.
- Widens ladder/elastic step spacing.
- Requires stronger pulse confirmation.
- Tightens slippage tolerance.

SAUCE_REACTOR:
- Reduces max open trades/adds.
- Increases win/loss cooldowns.
- Increases seconds between entries/adds.
- Widens add spacing.
- Pulls against-core cut points closer during defense.

HANDSFREE_V10_6:
- Reduces max open trades/adds.
- Tightens max spread guard.
- Increases time between entries/adds.
- Widens add step.
- Harvests faster during defense.

HANDSFREE_V9 / HANDSFREE_CORE:
- Reduces campaign entries and rank/gold extra entries.
- Tightens max spread guard.
- Widens extreme-block buffer.
- Requires more RedDot confirmation.

How WISDO should command it:
- WISDO should write numeric MT4 Global Variables using the exact variable names for the bot.
- Use the longest namespace when possible: Bot + account + symbol + magic + setting.
- Avoid broad CEM.<BOT>.<SETTING> commands unless the user intentionally wants the whole bot family changed.
