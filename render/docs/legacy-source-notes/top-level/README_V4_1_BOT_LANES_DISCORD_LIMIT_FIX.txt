CEM WISDO Bot Registry V4.1 Hotfix

Fixes:
- /wisdo-bot-lanes crashed with DiscordAPIError[50035] because reply content exceeded Discord's 2,000-character limit.
- Bot lane output is now compact, capped, and safely truncated before editReply.
- /wisdo-close-bot queued output is also capped so large multi-pair accounts do not crash the command.

Install:
1. Copy commands/wisdoBotRegistry.js into your real repo:
   C:\Users\jaque\Documents\Codex\2026-04-24\build-a-discord-bot-feature-for\commands\wisdoBotRegistry.js
2. Push to GitHub:
   git add commands/wisdoBotRegistry.js
   git commit -m "Fix bot lanes Discord message length"
   git push
3. Render: Manual Deploy -> Deploy latest commit.
4. No MT4 recompile is needed for this hotfix.
5. No slash command re-register is needed because command names/options did not change.

Notes:
- The repeated "pairing code was unknown" warnings are from terminals/reporters still using old or expired CEM pairing codes. Disconnect old Reporter charts or create/connect fresh pairing codes for those terminals.
