# WISDO v7.0.1 Runtime Repair Audit

**Audit target:** `wisdo-render-deploy.zip`  
**Remodel source reviewed:** `build-a-discord-bot-feature-for.zip`  
**Release:** `7.0.1`  
**Audit date:** July 19, 2026

## Executive result

The package compiled and its original automated tests passed, but several production failures were caused by route ordering, unregistered command modules, slow Discord interaction acknowledgement, fragmented desk permissions, and a presence system that was not loaded by the actual member workspace.

The repaired release now has:

- one authoritative MT4 Reporter sync route by default;
- 77 unique, validated Discord slash commands;
- automatic guild command registration before the Discord gateway is ready;
- a command acknowledgement guard that prevents slow work from expiring interactions;
- safer desk creation, role assignment, category sharding, restoration, and diagnostics;
- first-visit, first-visit-of-day, new-session, and return-after-away website greetings;
- a `/health/discord` diagnostic endpoint;
- 83 passing automated tests and a successful production build check.

## Critical finding 1 — duplicate `/mt4-sync` authority

### Symptom

Render logged Reporter requests around 30 seconds, including:

```text
/mt4-sync responseTimeMS=30170 responseBytes=223158
```

### Root cause found in the package

Two POST handlers were registered for the same configured MT4 sync path:

1. an older remodel/Deadshot handler;
2. the newer authoritative Reporter handler in `server/apiServer.js`.

The older handler was registered first. It called `receiveSnapshot()`, then loaded and saved the broader website ecosystem state again before returning. This duplicated persistence and prevented the newer handler from becoming the real route authority.

### Repair

- The older handler is disabled by default and is available only with:

```env
ENABLE_LEGACY_DEADSHOT_MT4_SYNC=true
```

- Render explicitly sets it to `false`.
- The authoritative route now returns response timing in JSON and the `Server-Timing` header.
- Slow syncs over 2.5 seconds are logged with the Render/request ID and account context.
- Rank processing and desk-dashboard refresh stay asynchronous after the snapshot is accepted.
- Discord signal-board posting is now queued after execution routing instead of blocking Reporter.

## Critical finding 2 — missing Discord slash commands

### Symptom

Many `/` commands were unavailable even though their source file existed.

### Root cause

`commands/wisdoPhaseTwo.js` defined a large Phase Two command group, but `commands/index.js` never imported it into the canonical registry. The remodel also contained archived-desk restoration that was not integrated into the current command flow.

### Repair

The command registry now:

- imports the missing Phase Two command group;
- exposes `/restore-desk` through the current admin command module;
- validates command names, descriptions, uniqueness, and Discord’s 100-command guild limit;
- fails startup clearly if duplicate or invalid command definitions are introduced;
- contains 77 unique commands with no duplicates.

Restored command capabilities include:

- `/global-status`
- `/health`
- `/confirm`
- `/protect-profit`
- `/close-all-safe`
- `/signal-settings`
- `/mute-signal-updates`
- `/copy-settings`
- `/bot-assign`
- `/bot-health`
- `/history-proof`
- `/manual-log`
- `/marketplace-status`
- `/academy`
- `/alerts`
- `/restore-desk`

## Critical finding 3 — Discord “application did not respond” failures

### Root cause

Several commands performed database, file, guild, attachment, or MT4 work before acknowledging the Discord interaction. Discord invalidates an interaction that is not acknowledged quickly enough, producing errors such as `10062 Unknown interaction` or `40060 Interaction has already been acknowledged`.

### Repair

A reusable interaction guard now:

- allows fast commands to reply normally;
- automatically sends an ephemeral defer if a command is still working after 1.4 seconds;
- converts the command’s eventual first `reply()` into `editReply()`;
- uses `followUp()` only after the primary response is complete;
- does not auto-defer modal-first commands;
- safely handles expired or already-acknowledged interaction codes.

Modal commands now use bounded pre-modal reads so profile or clock workflows do not lose the interaction while waiting on storage.

Command registration is also attempted through Discord REST before `client.login()`, then safely checked again at `ClientReady`. This prevents slash commands from staying stale when the gateway takes longer to connect.

## Critical finding 4 — desk creation failures

### Root causes

The original desk workflow had several failure points:

- the private category did not always explicitly preserve bot access;
- role hierarchy and `Manage Roles` failures were reported only after creation failed;
- a single category could exceed Discord’s 50-child category limit;
- optional voice-channel failure could break an otherwise valid text desk;
- an archived desk could not reliably clear its `archivedAt` value;
- members without the Culture Coin role received an ineligible result even when an admin expected desk creation to grant access;
- the server-wide 500-channel capacity was not clearly checked against the number of channels a desk needed.

### Repair

Desk creation now includes:

- a preflight report for bot member visibility, required permissions, role hierarchy, and remaining server channel capacity;
- explicit WISDO bot overwrites on private categories, text desks, and voice desks;
- optional automatic assignment of the Culture Coin role from `/create-desk`;
- a clear instruction to move the WISDO bot role above Culture Coin when role assignment is blocked;
- automatic category sharding: the original category, then `... 2`, `... 3`, and so on before 50 children are reached;
- equivalent sharding for archived desks;
- text-desk success even when optional voice creation or repair fails;
- `/restore-desk` for moving an archived member desk back into the live category;
- correct clearing of `archivedAt` during restoration;
- diagnostics exposed at `/health/discord`.

### Required Discord role placement

The WISDO bot role must be above the Culture Coin role when automatic role assignment is enabled. The bot needs, at minimum:

- View Channels
- Manage Channels
- Send Messages
- Read Message History
- Manage Messages
- Manage Roles only when WISDO should grant the Culture Coin role

## Critical finding 5 — no website greeting

### Root cause

The presence engine and an earlier greeting shell existed, but the live `/app/*` member pages are rendered by `server/majorUpgradeRoutes.js`. That workspace never loaded the greeting experience, so users could log in without any greeting.

### Repair

Every real member workspace now loads a shared WISDO presence experience with:

- a greeting modal on a user’s first visit;
- a greeting on the first visit of each local day;
- a greeting when returning after at least 15 minutes away;
- a greeting for a new browser/session context;
- the current page, operating mode, active account, away duration, and resume path;
- a persistent WISDO orb for reopening the greeting/context panel;
- heartbeat updates every 60 seconds while active;
- visibility-change handling when a member leaves and returns to the tab;
- account-switch context updates.

The server records session IDs, daily visit state, visit counts, session counts, last page/account/device, away duration, and greeting reason. Ordinary heartbeats do not reopen the greeting repeatedly.

## Remodel integration decision

The remodel was not copied wholesale because it included older and conflicting runtime structures:

- duplicate root, `server/`, and `src/` applications;
- an older `/mt4-sync` route;
- `.env` credentials;
- `.git` history;
- `node_modules`;
- duplicate package manifests;
- runtime JSON/state patterns that conflict with the newer database-backed v7 system;
- malformed junk files such as `-` and `null)`.

The useful remodel behavior was selectively merged into the newer v7 authority:

- missing Phase Two command set;
- archived desk recovery;
- interaction timeout intent;
- Discord operational command capabilities;
- remodel-compatible member greeting/presence behavior.

This avoids regressing the newer copier, Culture Lane, PostgreSQL, Academy, Square, member-app, and Reporter systems.

## Files changed

- `.env.example`
- `commands/admin.js`
- `commands/index.js`
- `commands/mt4.js`
- `commands/profile.js`
- `commands/trading.js`
- `index.js`
- `package.json`
- `package-lock.json`
- `render.yaml`
- `scripts/registerCommands.js`
- `server/apiServer.js`
- `server/deadshotSite.js`
- `server/majorUpgradeRoutes.js`
- `server/presenceIdentityRoutes.js`
- `services/culturePresenceService.js`
- `services/operatorDeskService.js`
- `services/tradeSignalService.js`
- `tests/v701-runtime-repair.test.js`
- `utils/discordInteractionGuard.js`

## Verification performed

```text
Build check passed: 103 JavaScript files
Required production assets: 14
Public strategy source leak check: passed
Automated tests: 83 passed, 0 failed
Discord command registry: 77 unique, 0 duplicates, 0 invalid
```

The tests cover command restoration, interaction acknowledgement, presence greeting classification, archived-desk restoration, authoritative MT4 route selection, and presence injection into every member workspace, in addition to the existing copier, database, Reporter, Culture Lane, Academy, billing, and website tests.

## Remaining deployment-dependent verification

The code audit and local regression suite are complete. Live verification still requires the production Render environment and Discord guild credentials. After deployment, validate:

1. `/health`
2. `/health/discord`
3. `/api/copier-infrastructure-health`
4. a real Reporter heartbeat and its returned `responseMs`
5. `/create-desk` on one test member
6. `/restore-desk` on one archived test member
7. Discord command visibility after the deployment starts
8. first login of the day and return after 15+ minutes away

