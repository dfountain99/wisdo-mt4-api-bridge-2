# Discord Command Matrix

Runtime and registration both call `createCommandRegistry()` in `commands/index.js`. Each builder owns the Discord description and handler; `scripts/auditCommands.js` rejects duplicates/invalid names. Network, database, and MT4 handlers use the shared interaction guard; trading operations defer ephemerally and report queued state.

| Commands | Permission | Required service | Account aware | Defer/response | Runtime + registration | Test | Status |
|---|---|---|---|---|---|---|---|
| create-desk, restore-desk, create-all-desks, desk-status, remove-desk, coach-note | admin/member by operation | operator desk, Discord | owner scoped | guarded; ephemeral/modal | admin builder / canonical registry | registry + desk reconciler | active |
| connect, connect-mt4, mt4-status, sync-mt4, my-accounts, set-account-role, set-active-account, my-id | member | MT4 sync/repository | yes | guarded; ephemeral | MT4 builder / canonical registry | command + MT4 tests | active |
| setup-profile, profile, edit-profile | member | profile repository | no | modal/ephemeral | profile builder / canonical registry | registry | active |
| bots, bot-info, claim-free-bot, negotiate-bot, buy-bot, my-bots, culture-coin-info, refresh-bot-catalog, store-status | member/admin by operation | store, registry, payment | user scoped | guarded; ephemeral | store builder / canonical registry | registry + product tests | active |
| clock-in, log-ea, clock-out, weekly-review, template | member | trading log/review | yes | modal or deferred ephemeral | trading builder / canonical registry | registry | active |
| wisdo, wisdo-adaptive-set, wisdo-adaptive-defense, wisdo-adaptive-normal, wisdo-adaptive-lane, wisdo-command | member | WISDO intent/confirmation/command bus | yes | immediate defer; ephemeral | WISDO builder / canonical registry | conversational tests | active; DEMO_ONLY execution |
| wisdo-review, wisdo-settings, member-portal | member | review/settings/web | yes where applicable | guarded; ephemeral | dedicated builders / canonical registry | registry | active |
| link-trading-account, my-linked-accounts, mt4-history, wisdo-session, wisdo-pair | member | account/MT4 services | yes | deferred ephemeral | portal builder / canonical registry | registry + MT4 tests | active |
| wisdo-bot-lanes, wisdo-nickname-bot, wisdo-close-bot, wisdo-bot-command | member + control grant | bot lane/command bus | exact account/lane | deferred ephemeral | EA control builder / canonical registry | command tests | active |
| pair, account, copier, wisdo-coach, reporter, wisdo-notifications, wisdo-help | member | WISDO command center | yes | guarded; ephemeral | command-center builder / canonical registry | registry | active |
| signal-grid, signals, my-copies, copy-status, stop-copy, risk-settings | member/education gate | signal grid/copy service | yes | deferred ephemeral | signal builder / canonical registry | product tests | active |
| global-status, health, confirm, protect-profit, close-all-safe, signal-settings, mute-signal-updates, copy-settings, bot-assign, bot-health, history-proof, manual-log, marketplace-status, academy, alerts | member; confirmation for mutations | Phase 2 services/command bus | yes | guarded; mutations defer | Phase 2 builder / canonical registry | command-bus tests | active |
| help, system-status | member | registry/health | no | ephemeral | operations builder / canonical registry | major stability core | active |
| command-health, active-account, switch-account, account-health, account-details, open-trades, trade-history | member | account selection, snapshot, queue | yes | immediate defer; ephemeral | operations builder / canonical registry | major stability core | active |
| copier-status, copier-routes, copier-test | member | copier/account/symbol services | exact account | immediate defer; ephemeral | operations builder / canonical registry | copier unit tests | active; test is dry-run |
| reporter-status, connection-doctor, command-queue, bot-lanes | member | Reporter/account/queue | yes | immediate defer; ephemeral | operations builder / canonical registry | major stability core | active |
| pause-bot, resume-bot | control grant + confirmation | account selection/command bus | exact account/lane | immediate defer; ephemeral receipt | operations builder / canonical registry | lifecycle/registry | active |
| close-profitable, close-losing, close-all, emergency-stop | control grant + strong confirmation | account selection/command bus | exact account | immediate defer; ephemeral queued receipt | operations builder / canonical registry | lifecycle/registry | active |
| report-problem | member | operational log | no | ephemeral | operations builder / canonical registry | registry | active |

Count: 100 unique commands. Modal handlers are also deduplicated by the canonical registry. “Active” means the command has a runtime handler; it does not mean a payment, Discord, Reporter, or voice dependency is configured in every environment.
