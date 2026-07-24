CEM / WISDO Manual Upgrade Patch 1-5 - 2026-05-10

Upgrades included:
1) WISDO Memory Lock
   - Adds services/wisdoMemoryService.js.
   - Persists per-user active account, last known balance/equity, bot, drawdown, last command, and takeover state.
   - Updates memory after every MT4 snapshot.

2) Active Account Commander
   - Adds /use-account, /rename-account, /remove-account, /command-queue, and /account-summary.
   - Keeps /my-accounts and /set-active-account.
   - Active account is stored in both mt4.json and wisdo-memory.json.

3) Command Queue Reliability
   - Replaces the simple pending command list with a durable commandQueue.
   - Commands have pending/delivered/completed/failed/expired status.
   - Delivered commands can retry after 15 seconds if MT4 does not complete them.
   - Commands expire by default after 15 minutes.

4) WISDO Takeover Mode
   - Adds /takeover-mode.
   - Adds natural language support for takeover / walk away / protect account / pause / resume.
   - Queues MT4 global variables like WISDO_TAKEOVER_MODE, WISDO_WALK_AWAY_MODE, WISDO_PROTECT_PROFIT, WISDO_EQUITY_FLOOR, and WISDO_MAX_DRAWDOWN_PERCENT.

5) Copy Trading Ticket Map
   - Adds ticketMapByFollowerAccountId to copy-trading.json.
   - Completion responses from MT4 now record leaderTicket -> followerTicket.
   - Leader trade closes now create COPY_CLOSE_TRADE commands when detected by MT4 sync.

API additions:
- GET /api/wisdo-memory/:discordUserId/summary
- POST /api/accounts/:discordUserId/active
- GET /api/accounts/:discordUserId/command-queue

MT4 Reporter source update:
- CultureCoin_MT4_Reporter.mq4 now supports SET_GLOBAL_VARIABLES and WISDO control commands by applying numeric WISDO_* global variables.
- The .ex4 binary was not recompiled in this patch. Open the updated .mq4 in MetaEditor and compile it before distributing the reporter.

Deploy:
1. Copy changed files into your repo or use the full clean zip.
2. Do not push .env or node_modules.
3. npm install
4. npm run register-commands
5. npm start

Test in Discord:
/connect name: Demo Lead role: Leader
/connect name: Live Main role: Private
/my-accounts
/use-account live
/account-summary
/takeover-mode equity_floor:500 max_drawdown_percent:20
/command-queue
