CEM WISDO Adaptive Command Center V2 LITE

This lite zip excludes node_modules, private bot downloads, old logs, and .env secrets.

Install:
1) Copy these files into your WISDO project/repo.
2) Run: npm install
3) Run: npm run register-commands
4) In MT4, compile mql4/CultureCoin_MT4_Reporter.mq4.
5) In MT4, compile each mq4 in mql4/adaptive_bots/.
6) Attach reporter and upgraded bots.

Main purpose:
WISDO can now write bot/account/symbol/magic-specific MT4 Global Variables:
CEM.<BOT>.<ACCOUNT>.<SYMBOL>.<MAGIC>.<SETTING>
