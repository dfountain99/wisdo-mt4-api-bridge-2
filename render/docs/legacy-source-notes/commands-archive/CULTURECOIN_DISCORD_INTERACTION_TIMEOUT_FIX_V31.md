# CultureCoin Discord Interaction Timeout Fix V31

## Problem
Discord slash commands such as `/connect-mt4` returned `Unknown interaction` because the command performed desk/account work before acknowledging the interaction.

Discord requires a slash-command interaction to be acknowledged quickly. If the bot waits too long before `reply()` or `deferReply()`, Discord invalidates the interaction.

## Fix
- `/connect-mt4` now calls `deferReply({ ephemeral: true })` immediately.
- `/mt4-status`, `/sync-mt4`, `/my-accounts`, and `/set-active-account` also defer before slow operations.
- `OperatorDeskService.safeReply()` now edits an already-deferred reply instead of trying a late `reply()`.
- `safeReply()` now catches reply errors so one failed Discord reply does not crash the command flow.

## Result
Commands should no longer fail with:

```txt
DiscordAPIError[10062]: Unknown interaction
```

## Push

```bat
git add commands/mt4.js src/commands/mt4.js services/operatorDeskService.js src/services/operatorDeskService.js CULTURECOIN_DISCORD_INTERACTION_TIMEOUT_FIX_V31.md
git commit -m "Fix Discord slash command interaction timeouts"
git push origin main
```

Then re-register commands if slash definitions changed:

```bat
node scripts/registerCommands.js
```
