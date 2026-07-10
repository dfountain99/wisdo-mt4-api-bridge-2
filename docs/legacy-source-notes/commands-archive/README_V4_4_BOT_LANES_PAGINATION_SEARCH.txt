CEM WISDO BOT LANES PAGINATION + SEARCH HOTFIX V4.4

Replace:
  commands/wisdoBotRegistry.js

Then push/redeploy and run:
  npm run register-commands

New /wisdo-bot-lanes options:
  page   - page number
  search - search nickname, bot key, symbol, magic, account, lane key
  symbol - filter symbol such as XAUUSD
  bot    - filter bot/nickname such as Deadpool or DEADSHOT
  limit  - lanes per page, 1-8

Examples:
  /wisdo-bot-lanes
  /wisdo-bot-lanes page:2
  /wisdo-bot-lanes search:Deadpool
  /wisdo-bot-lanes symbol:XAUUSD
  /wisdo-bot-lanes bot:DEADSHOT page:2
