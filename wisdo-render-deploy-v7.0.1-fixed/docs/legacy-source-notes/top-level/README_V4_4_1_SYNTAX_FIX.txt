CEM WISDO Bot Lanes Pagination/Search Syntax Fix V4.4.1

Fix:
- Corrected malformed JavaScript string joins in commands/wisdoBotRegistry.js.
- Node can now import this command file during npm run register-commands.

Install:
1. Copy commands/wisdoBotRegistry.js into your real repo commands/ folder.
2. Run: npm run register-commands
3. Commit/push and redeploy Render.
