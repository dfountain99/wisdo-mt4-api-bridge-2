CEM / WISDO FULL MANUAL UPGRADE PATCH 6-20
Date: 2026-05-10

This patch continues Patch 1-5 and keeps the existing dashboard layout untouched.
Phase 10 was applied to MESSAGE SIGNALS ONLY.

Included:
6. Global Variable Doctrine
   - services/wisdoGlobalsService.js
   - /global-status
   - Shared WISDO_* dictionary for EAs/reporter bridge.

7. WISDO Brain V2 foundation
   - services/wisdoBrainV2.js
   - Normalized command classification foundation for future voice routing.

8. Confirmation System
   - services/commandSafetyService.js
   - /confirm
   - /close-all-safe requires confirmation before queueing.

9. Account Health Engine
   - services/accountHealthService.js
   - /health
   - /api/wisdo/account-health/:discordUserId

10. Signal Card V2 - MESSAGE SIGNALS ONLY
   - services/signalCardService.js
   - Existing dashboard was not changed.
   - Signal messages now use cleaner cards/buttons:
     Take Same Trade, Copy Future Trades, Close My Copy, Ask WISDO, Mute Updates.

11. Copy Trading V2 Foundation
   - /copy-settings
   - copy ticket map from Patch 1-5 remains active.
   - Signal buttons can queue COPY_CLOSE_TRADE.

12. Website Dashboard
   - Not changed by request.
   - Only backend/API foundations were added.

13. User Isolation Safety
   - New endpoints and commands resolve through user/account context.
   - Does not intentionally expose another user's account.

14. Bot Allocation Manager
   - services/botAllocationService.js
   - /bot-assign
   - /bot-health

15. History + Proof Engine
   - services/historyProofService.js
   - /history-proof
   - /api/wisdo/history-proof/:discordUserId

16. Learning Manual Upgrade
   - services/learningManualService.js
   - /manual-log

17-18. Marketplace + Payment/Commission Foundation
   - services/platformBusinessService.js
   - /marketplace-status
   - /api/wisdo/marketplace-foundation

19. WISDO Academy
   - /academy

20. Alert System Foundation
   - /alerts

Install:
1. Copy changed files into your project, or deploy full clean project.
2. Run npm install if needed.
3. Run npm run register-commands.
4. Restart Render / node server.

Test commands:
/global-status
/health
/signal-settings
/copy-settings max_trades:10 fixed_lot:0.01 symbols:XAUUSD
/bot-assign bot:DF HANDSFREE symbol:XAUUSD mode:sell-only risk:safe
/bot-health
/close-all-safe
/confirm phrase:CONFIRM CLOSE LIVE
/history-proof
/manual-log
/marketplace-status
/academy
/alerts

Important:
- This patch modifies Discord message signals only for Phase 10.
- It does not redesign or replace your member portal dashboard.
- CultureCoin_MT4_Reporter.ex4 was not recompiled here.
