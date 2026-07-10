# Wisdo Service Merge Map

This pass keeps the live Render/runtime path centered on the root `services/` directory. Divergent copies under `src/`, `server/`, and `commands/` were treated as comparison inputs, not new sources of truth.

## Source Of Truth

| Domain | Live service | Runtime role |
| --- | --- | --- |
| Operator desk/account facade | `services/operatorDeskService.js` | Discord desk workflows plus MT4 account selection and health facade |
| Copy trading | `services/copyTradingService.js` | Master/follower settings, copy requests, relationships, risk decisions, command queue records |
| Bot marketplace | `services/botStoreService.js` | Catalog, purchases, licenses, versions, marketplace access |
| MT4 command queue | `services/mt4CommandService.js` | Pending command creation, validation, account queue delivery/status |

## Divergent Copy Review

| Service | Divergent copies reviewed | Kept | Deferred |
| --- | --- | --- | --- |
| `operatorDeskService.js` | `server/services`, `src/services`, `commands/*` copies | Root service remains authoritative. Added account facade methods that reuse the existing repository MT4 state. | Server copy has Discord category overflow and desk-repair behavior. Useful, but it is Discord-channel maintenance rather than this persistence/source-of-truth pass. |
| `copyTradingService.js` | `server/services` and `src/services` copies | Merged ticket-map support, `signalId` passthrough, follower account payload fields, and status response enrichment. Added copy requests, relationships, risk logs, paper-mode metadata, and audit log hooks. | None for this pass. |
| `botStoreService.js` | `server/services` and `src/services` copies | Copies were functionally aligned with root. Added marketplace CRUD, versions, rollback, access grants, and manual purchase recording to the root service. | External marketplace search/ranking can come later when real marketplace data grows. |
| `mt4CommandService.js` | `src/services` copy | Root copy was stronger: priority queue, command copy sync, and status consistency. Added validation, command-object queueing, command-id-only status lookup, account command listing, and audit hooks. | None for this pass. |

## New Public Contracts

`OperatorDeskService`

- `getDesk(discordUserId)`
- `listAccounts(discordUserId)`
- `getSelectedAccount(discordUserId)`
- `setSelectedAccount(discordUserId, accountId)`
- `updateAccountSnapshot(discordUserId, accountId, snapshot)`
- `getAccountHealth(discordUserId, accountId)`

`CopyTradingService`

- `createCopyRequest(request)`
- `approveCopyRequest(requestId, approvedByUserId)`
- `denyCopyRequest(requestId, deniedByUserId, reason)`
- `getCopyRelationships(userId)`
- `pauseCopyRelationship(relationshipId, reason)`
- `resumeCopyRelationship(relationshipId)`
- `logCopiedTrade(event)`
- `logSkippedTrade(event)`
- `getTicketMap(followerAccountId)`

`BotStoreService`

- `listBots(filters)`
- `getBot(botId)`
- `createBot(bot, actorUserId)`
- `updateBot(botId, updates, actorUserId)`
- `addBotVersion(botId, version, actorUserId)`
- `rollbackBotVersion(botId, versionId, actorUserId)`
- `getBotAccess(discordUserId, botId)`
- `grantBotAccess(grant)`
- `recordBotPurchase(purchase)`

`Mt4CommandService`

- `createCommand(command)` or `createCommand(userId, accountId, command, payload)`
- `validateCommand(command)` or legacy positional inputs
- `queueCommand(command)` or legacy `queueCommand(userId, command, payload)`
- `getCommandStatus(commandId)` or legacy `getCommandStatus(userId, commandId, accountId)`
- `listAccountCommands(userId, accountId, options)`

## Audit Hooks

Each upgraded service now records local audit metadata at the service boundary:

- Copy trading: `auditLogs` inside `copy-trading.json`.
- Bot marketplace: embedded `audit` arrays on bot/order/license records.
- MT4 commands: `commandAuditLog` inside `mt4-commands.json`.
- Operator desk: returned audit metadata for selected-account changes, while the persistent account state remains in repository-owned MT4 state.

