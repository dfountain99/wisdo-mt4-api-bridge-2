# V5.2.0 — Capability Model + Adaptive Academy

## Copier and account model

- Added one authoritative `/copier/options` response, with compatible `/api/copier/options` and `/api/v2/copier/options` aliases.
- Every account now exposes explicit `canLead`, `canReceive`, `canExecute`, `isShared`, and `isCommunity` capability fields.
- Dashboard, Accounts, and Copier Engine derive account identity from the same Reporter-backed registry.
- Added account-role editing for Private Desk, Culture Lead, Mirror Receiver, and Dual Role.
- Added visibility controls for private, approved sharing, and community discovery.
- Mirror Receiver options are limited to accounts owned by the signed-in member.
- Shared and community lead accounts include access type and permission metadata.
- Copier diagnostics explain missing lead/receiver roles, stale Reporter heartbeats, offline terminals, and disabled AutoTrading.

## Adaptive Academy

- 6,500 structured course records across 65 domains and five levels.
- Personalized 36-course learning paths based on experience, goals, markets, interests, time, and learning style.
- Searchable course catalog, modules, practice steps, knowledge checks, progress, points, and badges.
- Account-aware AI tutor with persistent history and course recommendations.
- Interactive DF Sauce scenario replay and decision grading without exposing protected implementation details.
- TradingView Watch Room redirects to a private saved layout when `WISDO_DF_SAUCE_TRADINGVIEW_URL` is configured.

## Private strategy protection

- Proprietary Pine source is absent from public assets and the release repository.
- `.gitignore` blocks `*.pine`, `private-strategies/`, public Academy Pine files, and compiled EX4 files.
- Academy APIs and prompts explicitly prohibit source reconstruction or exact private parameter disclosure.

## Existing protections retained

- Reporter v1.55 follower-ticket close authority.
- Close commands bypass opening filters and paused routes.
- Atomic serialized MT4 queue persistence.
- Encrypted broker credential vault.
- Signed sessions, broker webhooks, Stripe webhooks, and protected cron routes.
- Xbox-inspired dashboard boot sequence, member themes, account-aware metrics, and WISDO Insight Engine.
