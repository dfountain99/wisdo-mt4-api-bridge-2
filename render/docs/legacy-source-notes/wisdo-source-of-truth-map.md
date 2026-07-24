# Wisdo Source Of Truth Map

Date: 2026-07-04

## Live Startup Chain

Production is started by Render with:

```text
render.yaml -> startCommand: npm start
package.json -> scripts.start: node index.js
index.js -> root config, root commands, root services, server/apiServer.js
```

Canonical live files:

| Area | Live source of truth | Notes |
| --- | --- | --- |
| Production entry | `index.js` | Render reaches this through `npm start`. |
| Web-only entry | `scripts/startWebOnly.js` | Local/web smoke path; now reads canonical config through `server/config.js` re-export. |
| Config | `config.js` | Canonical env parsing, aliases, normalization. |
| Server config compatibility | `server/config.js` | Re-exports root `config.js`; not an independent config. |
| Command registry | `commands/index.js` | Root production bot and `scripts/registerCommands.js` both import this. |
| API/member server | `server/apiServer.js` | Live route registration and new Wisdo premium APIs/pages. |
| Deadshot portal aliases | `server/deadshotSite.js` | Registered by `server/apiServer.js`; broad aliases must stay after exact Wisdo routes. |
| Runtime services | `services/*.js` | Root `index.js` imports these for production bot runtime. |
| Runtime storage | `storage/*.js` | Root services use these. |
| Runtime utils | `utils/*.js` | Root services use these. |

## Route Registration Order

Canonical route order lives in `server/apiServer.js`:

1. Webhook/raw integrations.
2. Core middleware and static assets.
3. Exact Wisdo premium `/member/*` routes.
4. Deadshot portal aliases and fallbacks.
5. Public/auth/API/member/admin routes.

Important: exact Wisdo pages such as `/member/command-center`, `/member/education`, `/member/simulator`, `/member/social`, and `/member/admin-wisdo` must register before `registerDeadshotCommandCenterRoutes(...)`. The Deadshot portal intentionally redirects broad legacy `/member/*` paths.

## Duplicate Inventory

| Live file | Duplicate/stale files | Difference summary | Recommended action |
| --- | --- | --- | --- |
| `config.js` | `src/config.js`, `commands/config.js`, `commands/src/config.js`, `commands/server/config.js`, `commands/server/src/config.js`, `server/src/config.js` | Multiple config parsers and defaults. Root config is current and has env aliases. `server/config.js` is now a re-export. | Keep root. Keep `server/config.js` re-export. Archive/delete stale copies after imports are proven absent. |
| `index.js` | `src/index.js`, `server/index.js`, `server/src/index.js`, `commands/index.js` root copy trees, nested `commands/server/index.js`, nested `commands/src/index.js` | Several entrypoints differ in size/hash. Production does not use them. | Keep root `index.js`. Do not edit duplicate entrypoints except to archive later. |
| `commands/index.js` | `src/commands/index.js`, `server/commands/index.js`, `server/src/commands/index.js`, nested `commands/**/commands/index.js` | Root registry includes newer Wisdo bot registry and command center modules. Some `src` registries include older phase-two shape. | Keep root `commands/index.js`. Future slash command work goes there only. Archive stale trees later. |
| `server/apiServer.js` | `src/server/apiServer.js`, `server/server/apiServer.js`, `server/src/server/apiServer.js`, `commands/server/apiServer.js`, `commands/src/server/apiServer.js`, nested copies | Live file is larger/newer and contains Wisdo premium pages/APIs. Duplicates hash together as older copies. | Keep `server/apiServer.js`. Never patch API routes in copied trees. Archive stale API copies after smoke tests. |
| `server/deadshotSite.js` | `src/server/deadshotSite.js`, `server/server/deadshotSite.js`, nested copied versions | Live route plugin is imported only by `server/apiServer.js`. It owns app aliases and admin protection. | Keep `server/deadshotSite.js`. Later compare nested copies before archive. |
| `services/operatorDeskService.js` | `src/services/operatorDeskService.js`, `server/services/operatorDeskService.js`, `server/src/services/operatorDeskService.js`, nested copies | Divergent hashes and sizes. Root production imports `services/operatorDeskService.js`. | Keep root service as production source. Review newer/larger server copy before any deletion; may contain patches not live. |
| `services/mt4CommandService.js` | `src/services/mt4CommandService.js`, `server/services/mt4CommandService.js`, nested copies | Root and `server/services` share one newer hash; `src` has older hash. | Keep root. Archive `src` later. |
| `services/copyTradingService.js` | `src/services/copyTradingService.js`, `server/services/copyTradingService.js`, nested copies | Root is smaller/different than server/src copies; production imports root. | Keep root for now. Review server copy for missing improvements before merge. |
| `services/botStoreService.js` | `src/services/botStoreService.js`, `server/services/botStoreService.js`, nested copies | Root differs from server/src copies; production imports root. | Keep root. Compare before future marketplace work. |
| `services/mt4SyncService.js`, `services/tradeSignalService.js`, `services/paymentService.js` | Multiple `src`, `server`, and nested copies | Hashes are identical across most copies, so these are replicated rather than divergent. | Keep root. Archive identical duplicates after one clean boot/test cycle. |
| `scripts/registerCommands.js` | `server/scripts/registerCommands.js`, `commands/scripts/registerCommands.js`, `commands/server/scripts/registerCommands.js` | Identical hashes. Root script is canonical via package.json. | Keep root script. Archive duplicates later. |
| `scripts/startWebOnly.js` | `commands/scripts/startWebOnly.js` | Identical copy. Root script is canonical via package.json. | Keep root script. Archive duplicate later. |
| `frontend/`, `mql4/`, `public/`, `private-downloads/` | Nested copies under `commands/` and `server/` | Asset/code duplication from prior patch packaging. | Keep root runtime folders. Treat nested asset trees as archive candidates, not production. |

## Duplicate Counts

Snapshot from this pass:

| Tree | JS files |
| --- | ---: |
| `commands/` | 251 |
| `src/` | 54 |
| `server/` | 106 |
| `commands/server/` | 109 |
| `commands/src/` | 57 |
| `server/src/` | 51 |

These counts confirm copied project trees exist inside the repo. They should not receive new feature work.

## Consolidation Completed In This Pass

- `server/config.js` now re-exports root `config.js`.
- `config.js` remains the canonical config source and keeps backward-compatible aliases.
- `.env.example` was cleaned to one non-duplicated set of canonical env names matching Render.
- `index.js` documents the live production import chain.
- `commands/index.js` documents the canonical command registry.
- `server/apiServer.js` documents the route registration order that protects exact Wisdo pages.

## Archive Strategy

No duplicate folders were deleted in this pass. The repo has large nested trees and several divergent service files, so deletion should happen only after a dedicated archive pass.

Recommended archive plan:

1. Create a branch or commit point after this consolidation.
2. Run production smoke tests.
3. Move identical nested copies to an archive folder or remove them in small batches.
4. For divergent service files, compare changes before deletion:
   - `operatorDeskService.js`
   - `copyTradingService.js`
   - `botStoreService.js`
   - `mt4CommandService.js`
5. Re-run Discord command registration dry checks and web smoke tests after each batch.

## Rules For Future Wisdo Work

- New runtime config goes in `config.js`.
- New Discord slash commands go in root `commands/`.
- New API/member routes go in `server/apiServer.js` or a module imported directly from it.
- Exact Wisdo member pages must register before Deadshot broad aliases.
- Do not patch `src/`, `commands/src/`, `commands/server/`, `server/src/`, or `server/server/` unless the task is explicitly an archive/migration diff.
