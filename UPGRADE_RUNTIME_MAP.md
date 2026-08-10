# Upgrade Runtime Map

| Concern | Canonical runtime | Status |
|---|---|---|
| Production entrypoint | `index.js` via `npm start` | Active |
| Render startup | root `render.yaml` -> `npm start` | Active |
| Discord client initialization | `index.js` | Active |
| Slash-command registry | `commands/index.js` | Active; shared by runtime and registration |
| Command registration | `scripts/registerCommands.js` | Active |
| API and website router | `server/apiServer.js` | Active |
| MT4 sync | `Mt4SyncService.receiveSnapshot` and `/mt4-sync` | Active; DB-first ACK path |
| MT4 command queue | `services/mt4CommandService.js` plus PostgreSQL store | Active |
| Copier | `services/copyTradingService.js`; safety primitives in `copierSafetyService.js` | Active/compatibility |
| Authentication | signed Discord OAuth/session helpers and API auth middleware in `apiServer.js` | Active |
| Storage | `OperatorDeskRepository` with `PostgresMt4Store` for hot trading state | Active |
| Conversational WISDO | intent, orchestration, confirmation, memory, and voice services loaded by `index.js` | Active |
| Pi/edge | `src/wisdo_core` Python edge/server protocol | Separate execution surface; not a Node duplicate |
| Payments | Square gateway + signed webhook in `PaymentService` | Active only when configured |
| Affiliates | `AffiliateService` and integer-cent ledger fields | Active |

The root `render/` tree is a noncanonical deployment mirror and must not receive new feature work. Root `src/commands`, `src/services`, and `src/server` copies are historical/non-imported unless an import trace proves otherwise. They were retained to avoid a destructive rewrite; `scripts/auditRuntime.js` proves the currently executed path.
