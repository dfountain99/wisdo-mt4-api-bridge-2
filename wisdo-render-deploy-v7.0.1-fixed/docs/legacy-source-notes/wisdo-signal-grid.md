# Wisdo Signal Grid

Wisdo Signal Grid replaces noisy per-trade Discord messages with one live pinned signal board per channel. Normal signal updates edit that pinned message; public channel spam stays off.

## Discord No-Spam Design

- `DiscordSignalGridService.ensurePinnedGridMessage(guildId, channelId)` creates or repairs the single pinned grid message.
- `updatePinnedGridMessage(channelId)` edits the existing pinned message and skips edits when the render hash has not changed.
- `repairMissingPinnedMessage(channelId)` recreates the grid if the saved message is deleted or unpinned.
- Trade updates from `TradeSignalService` now update `SignalGridService` and schedule a debounced pinned-message refresh instead of sending a new signal card.
- Pair/bot details use select menus and ephemeral replies so users can inspect or copy without adding public messages.
- Phase 2 Discord components live on the pinned message: select pair, select bot, view active basket, preview copy, website grid, and refresh my access. Discord row/select limits are respected by showing the first 25 options and routing larger/filterable views through `/signals` and the website grid.

## Discord Interaction Flow

The canonical Signal Grid interaction handler is `DiscordSignalGridService`. The bot router sends every `signal_grid_*` button and `signal_grid_select_*` menu to that service. Custom IDs stay compact:

- `signal_grid_select_pair`
- `signal_grid_select_bot`
- `signal_grid_view_basket:<signalId>`
- `signal_grid_preview_copy:<signalId>`
- `signal_grid_copy_basket:<signalId>`
- `signal_grid_confirm_live:<signalId>`
- `signal_grid_paper:<signalId>`
- `signal_grid_copy_bot:<botId>`
- `signal_grid_confirm_bot_live:<botId>`
- `signal_grid_copy_bot_paper:<botId>`
- `signal_grid_stop_copy:<botId>`
- `signal_grid_refresh_access`

The pinned message is the public command board. Every user action replies ephemerally. The service logs detail opens, previews, blocked copy attempts, copy actions, bot subscriptions, stop-copy actions, role refreshes, and interaction failures.

## Ephemeral Copy Flow

Selecting a pair or bot opens a private detail card with bot, symbol, direction, state, basket growth, floating P/L, trade count, average entry, session, volatility, age, expiration, provider, required role, education flag, selected account, risk mode, projected lot size, and blocked reason.

`Preview Copy` calls `SignalCopyService.previewCopySignal()` and displays the translated risk result. `Copy This Basket` never copies immediately; live copy shows a confirmation step for the selected account. `Paper Copy` records a paper copy privately. `Copy Future Bot` also requires confirmation for live mode and can run in paper mode. `Stop Copying Bot` pauses/cancels the subscription without touching the public grid.

Copying always goes through `SignalCopyService`; Discord has no separate lot sizing logic and never blind-copies source lot size.

## Grid Colors

| State | Meaning |
| --- | --- |
| Grey / `inactive` | No active trade |
| Green / `active` | Active trade with positive basket growth |
| Red / `negative` | Active trade with negative basket growth |
| Yellow / `upper_profit` | Strong profit / near target |
| Blue / `protected` | Protected or locked-profit mode |
| Black / `expired` or `offline` | Expired signal or offline bot |

## Basket Percentage

`SIGNAL_GRID_PERCENT_MODE` controls basket growth:

- `balance`: floating P/L as percent of account balance
- `equity`: floating P/L as percent of start equity
- `allocated`: floating P/L as percent of allocated bot balance
- `basket_risk`: floating P/L as percent of configured basket risk

## Website Grid

The member page is `/member/signal-grid`. It shows active/inactive cells, basket growth, P/L, open trades, bot, symbol, direction, session, volatility, risk mode, copy requirement, provider, expiration, and detail drawers.

Website APIs:

- `GET /api/wisdo/signal-grid`
- `GET /api/wisdo/signal-grid/detail/:signalId`
- `POST /api/wisdo/signal-grid/preview-copy`
- `POST /api/wisdo/signal-grid/copy-basket`
- `POST /api/wisdo/signal-grid/subscribe-bot`
- `POST /api/wisdo/signal-grid/unsubscribe-bot`
- `GET /api/wisdo/signal-grid/my-copies`

## Copy Rules

Copy actions are never lot-for-lot blind copies. `SignalCopyService` validates:

- `CULTURE COIN MEMBER+` or `copier_eligible`
- connected/selected account
- risk settings
- active, non-expired signal
- required education flag when present

The preview returns projected lot size and blocked reasons before copy. Paper mode still requires copy eligibility.

## Role Gates

Live copy and paper copy require `CULTURE COIN MEMBER+`, `copier_eligible`, or equivalent admin/owner access from the shared RBAC map. Admin slash subcommands require OWNER/WISDO/admin access before setup, refresh, repair, status, clear-expired, set-channel, percent-mode, or toggle-copy can run. `Refresh My Access` privately attempts Discord role sync and reports roles, Wisdo roles, copier eligibility, stale fallback warnings, and remaining locks.

## Slash Commands

- `/signal-grid setup|set-channel`: save channel and create/repair the pinned board.
- `/signal-grid refresh|repair|status|clear-expired|percent-mode|toggle-copy`: private admin operations.
- `/signals`: private active grid summary with pair, bot, and category filters.
- `/my-copies`: private copy subscription summary.
- `/copy-status`: private eligibility/status summary.
- `/stop-copy`: private bot subscription stop.
- `/risk-settings`: private link to website risk settings and command center.

## Admin Controls

Admin controls live in `/member/admin-wisdo` and protected `/api/wisdo/admin/signal-grid*` endpoints. Admins can configure the channel, set percent mode, expiration, copy buttons, website/Discord enable flags, force refresh, repair the pinned message, and view interaction logs.

## Rate-Limit Strategy

The Discord service stores `lastRenderHash` per channel and skips edits when nothing meaningful changed. Signal updates schedule a short delayed refresh so several ticks collapse into one edit. The website can poll more often because it does not create public Discord noise.

## Known Discord Limits

Discord embeds and components have row/field/select limits: 5 action rows, 25 select options, and limited button counts. The pinned message shows a compact top grid and uses select menus for detail. If the grid grows beyond limits, users should filter with `/signals` or open `/member/signal-grid`, which remains the full fidelity view.

## Future Upgrades

- SSE/WebSocket website refresh
- Per-role grid filters
- Advanced education completion checks
- Bot-specific alert subscriptions
- Historical replay charts
- Durable interaction context records for very complex component state
- Account-selection select menus inside ephemeral detail cards
- Broker-specific margin estimate models
- Education-completion enforcement per bot version
