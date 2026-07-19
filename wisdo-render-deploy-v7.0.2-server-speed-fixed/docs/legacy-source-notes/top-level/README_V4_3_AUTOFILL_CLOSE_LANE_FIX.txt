CEM WISDO V4.3 - AUTOFILL CLOSE LANE FIX

Problem fixed:
- Voice/nickname close commands could still queue broad commands such as CLOSE_ALL_WINNERS.
- MT4 then searched without a guaranteed bot lane and returned: No matching trades found for profit command.

New behavior:
- Voice and registry close commands always queue CLOSE_BY_MAGIC.
- WISDO auto-fills from the bot registry:
  accountId, accountNumber, bot, botNickname, symbol, magicNumber, targetSymbol, targetMagic, laneKey, lanePrefix.
- Winners/losers/all is passed as closeMode while the command stays lane-specific.
- Reporter V1.53 reads closeMode for CLOSE_BY_MAGIC/CLOSE_BY_SYMBOL/CLOSE_BY_BOT.

Install backend files:
- index.js
- src/index.js
- server/index.js
- commands/wisdoBotRegistry.js

Install MT4 file:
- mql4/CultureCoin_MT4_Reporter.mq4
Compile it in MetaEditor and reattach the Reporter.

Test:
1) /wisdo-bot-lanes
2) /wisdo-nickname-bot lane_key:<copy lane key> nickname:Deadpool
3) Hey Coach, close all Deadpool trades

Expected MT4 log:
CultureCoin command CLOSE_BY_MAGIC -> Profit command closed ...

If it says no matching trades found, check /wisdo-bot-lanes and confirm Deadpool lane symbol/magic matches the actual open trades.
