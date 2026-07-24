# CEM CULTURE / WISDO Community Trading Ecosystem Upgrade

Date: 2026-05-06
Package: `CEM_CULTURE_WISDO_COMMUNITY_ECOSYSTEM_PATCH_2026_05_06.zip`

## What was upgraded

This patch is focused on the full ecosystem flow, not one isolated page.

### 1. Discord slash command registration repaired
- Registered `wisdoPortal.js` inside `commands/index.js`.
- This restores slash commands such as:
  - `/member-portal`
  - `/link-trading-account`
  - `/my-linked-accounts`
  - `/mt4-history`
  - `/wisdo-session`
  - `/wisdo-pair`
- Added `/connect` as a shorter alias for `/connect-mt4`.

### 2. Multi-terminal / multi-account pairing repaired
Old behavior expired other pending codes for the same Discord user. That breaks your exact setup:

- Terminal 1: demo leader account
- Terminal 2: live follower/private/both account
- Same Discord desk
- Multiple pairing codes active at the same time

New behavior keeps up to 10 pending pairing codes per user and only expires the oldest pending code after that cap.

### 3. Demo leader + live follower routing strengthened
- Account records now carry account role: `leader`, `follower`, `both`, or `private`.
- The Discord signal button flow already supports account selection when the user has more than one account.
- The patch keeps that direction and protects against guessing the wrong terminal.
- `/set-active-account` still controls the default account for normal commands.
- Signal buttons should let the user choose the second terminal/account when taking the trade.

### 4. Trade signal creation hard bug repaired
`services/mt4SyncService.js` had a runtime bug where `historyRecord` used `signalSummary` before `signalSummary` existed.

That can stop snapshot processing and prevent trade signal creation/history tracking from behaving properly.

The patch now:
- Saves the account + latest snapshot first.
- Processes trade signal detection.
- Writes the snapshot history after the signal summary exists.
- Returns signal counters safely.

### 5. API signal health repaired
`/api/signal-health` referenced `tradeSignalService`, but `startApiServer()` did not receive it in its function parameters.

The patch adds `tradeSignalService` to the API server signature so the route can report signal readiness correctly.

### 6. Portal button infrastructure improved
- Added a global portal action handler for buttons using `data-api-action`.
- This makes future buttons easier to wire without every page needing custom JavaScript.
- Existing fetch-based buttons remain intact.

### 7. Community Share added
New page:

- `/member/community`

Purpose:
- Member wins
- Lessons
- Setups
- Bot results
- Discipline notes
- Community encouragement

New API:

- `POST /api/community/share`

### 8. Profit Pool added as a guarded demo/tracking layer
New page:

- `/member/profit-pool`

New APIs:

- `POST /api/profit-pool/create`
- `POST /api/profit-pool/join`

Important: this is deliberately framed as tracking/demo/education until proper legal, tax, custody, securities, and broker/copy-trading compliance is handled.

### 9. Navigation expanded
Added portal sidebar links:

- Profit Pool
- Community

### 10. Smoke checks passed
The following passed:

```bash
node --check commands/index.js
node --check commands/mt4.js
node --check commands/wisdoPortal.js
node --check services/mt4SyncService.js
node --check server/apiServer.js
node --check index.js
node --check scripts/registerCommands.js
node -e "import('./commands/index.js').then(...)"
node -e "import('./services/mt4SyncService.js').then(...)"
node -e "import('./server/apiServer.js').then(...)"
```

## Required deploy steps

1. Upload/push the patched files.
2. Run:

```bash
npm install
npm run register-commands
npm start
```

3. In Discord, test in your private operator desk:

```text
/connect name: Demo Lead role: Leader
/connect name: Live Account role: Follower
/my-accounts
/set-active-account account_id:<live-account-id>
/member-portal
```

4. In MT4:
- Attach `CultureCoin_MT4_Reporter` to Terminal 1 demo account with the demo pairing code.
- Attach another `CultureCoin_MT4_Reporter` to Terminal 2 live account with the live pairing code.
- Make sure both use the same Render sync URL.
- Add the Render base URL to MT4 WebRequest.
- Confirm both accounts appear in `/my-accounts` and `/member/accounts`.

5. Signal test:
- Demo leader opens a trade.
- WISDO should create a Discord signal.
- Click `Take This Trade`.
- Choose the live/follower account.
- Choose risk mode.
- The command should queue to the selected terminal/account.

## Notes

This patch does not compile or change the `.ex4` reporter binary. If the reporter itself is not polling `/mt4-command-poll` or is not sending open trade arrays, Discord cannot create signals or deliver copied trades. The Node side is now more prepared for that workflow.
