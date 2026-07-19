CEM BOT REGISTRY + NICKNAME + VOICE PATCH V4

WHAT THIS PATCH ADDS
1. Reporter auto-registers CEM bot lanes into the MT4 snapshot payload.
   It sends botKey, nickname, account, symbol, magic number, lane prefix, open trades, and floating P/L.

2. Render stores the live lane registry per Discord user.
   File: data/operator-desks/cem-bot-registry.json

3. New Discord commands:
   /wisdo-bot-lanes       Shows all discovered bot lanes.
   /wisdo-nickname-bot    Saves a nickname like Deadpool for a lane.
   /wisdo-close-bot       Closes a bot lane by nickname/bot name without typing magic/account manually.
   /wisdo-bot-command     Natural command text: close all Deadpool trades.

4. Reporter V1.52 keeps the previous CEM_SET_GLOBALS fix and adds adaptive registry payload fields.

INSTALL
1. Copy these files into your real repo:
   services/botRegistryService.js
   services/mt4SyncService.js
   commands/wisdoBotRegistry.js
   commands/index.js
   index.js
   src/index.js if your project uses src
   server/index.js if your Render starts server/index.js
   server/apiServer.js only if included in your repo from the patch package

2. Push to GitHub:
   git status
   git add .
   git commit -m "Add CEM bot registry nickname voice controls"
   git push

3. Render:
   Manual Deploy -> Deploy latest commit

4. Register Discord commands:
   npm run register-commands

5. MT4:
   Copy mql4/CultureCoin_MT4_Reporter.mq4 into MQL4/Experts.
   Compile in MetaEditor.
   Remove the old Reporter from the chart and attach the new one.
   Optional Reporter inputs:
     CemBotKey = DEADSHOT
     CemBotNickname = Deadpool
     CemLaneMagicNumber = your EA magic number if MagicNumberFilter is 0

TEST FLOW
1. Let Reporter sync once.
2. Discord: /wisdo-bot-lanes
3. Copy a lane key.
4. Discord: /wisdo-nickname-bot lane_key:<paste> nickname:Deadpool
5. Discord: /wisdo-close-bot bot:Deadpool symbol:XAUUSD mode:All matching trades
6. MT4 Experts tab should show CLOSE_BY_MAGIC / CLOSE_BY_SYMBOL style execution.

SAFETY
/wisdo-close-bot resolves by account + symbol + magic so Deadpool does not accidentally close Handsfree or Sauce.
