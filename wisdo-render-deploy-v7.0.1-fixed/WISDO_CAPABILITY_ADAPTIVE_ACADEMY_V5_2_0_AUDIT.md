# WISDO Capability + Adaptive Academy V5.2.0 — Audit

Date: 2026-07-10

## Source provenance

- Original source of truth: `wisdo-member-app-product-pass(1).zip`
- Base corrected release: V5.1.1 Copier Close Authority
- Current release: V5.2.0

## Problems addressed

### Copier option mismatch

The old member UI loaded Culture Leads and receivers from separate paths. Legacy master/slave labels, imported Reporter accounts, private desks, shared access, and community visibility could produce different account sets between Dashboard and Copier Engine.

V5.2.0 uses one Reporter-backed options response and explicit capabilities. The response includes owned accounts, accessible leads, owned receivers, private desks, unavailable accounts, access type, readiness warnings, and summary counts.

### Hidden account roles

Members can now set each account to Private Desk, Culture Lead, Mirror Receiver, or Dual Role from `/app/accounts`. Visibility can be private, approved sharing, or community discoverable. Invalid sharing combinations are rejected by the server.

### Education depth and privacy

The Academy contains 6,500 structured course records spanning trading foundations, technical and fundamental analysis, execution, risk, money management, personal finance, psychology, research, technology, asset classes, professional practice, and WISDO operations.

The AI tutor adapts to learner experience, goals, markets, interests, learning style, current course, and an optional selected account. Tutor history is persisted and can be cleared by the member.

The proprietary Pine source is not included in public assets or the deployable repository. DF Sauce training uses protected scenario simulations and a private TradingView layout handoff.

## Security and operational additions

- Pine source and private strategy source directories are blocked from accidental Git commits. The stale active Reporter EX4 is excluded; the existing private bot-library EX4 files are intentionally retained for member delivery.
- Receiver execution readiness requires Reporter freshness, terminal connection, and AutoTrading/Expert status.
- Copier diagnostics surface configuration problems instead of leaving empty dropdowns.
- PostgreSQL migration extended for explicit desk roles, sharing state, Reporter readiness, learner profiles, and tutor messages.

## Validation

- JavaScript syntax/build check passed: 75 files.
- Required production assets passed: 10.
- Public Pine/MQ strategy-source check passed.
- Automated regression suite passed: 12 passed, 0 failed, including:
  - MT4 storage concurrency
  - follower close authority
  - Reporter v1.55 behavior
  - member account and Academy unification
  - 6,500-course catalog and protected source checks
  - adaptive tutor history
  - unified copier options and capability fields
  - signed open/close webhook relay

## Provider boundary

The private TradingView layout requires `WISDO_DF_SAUCE_TRADINGVIEW_URL`. OpenAI tutoring requires `OPENAI_API_KEY`; otherwise WISDO uses its safe adaptive fallback. Live MT4 execution still requires the compiled Reporter v1.55 on every follower terminal.


## Repository privacy requirement

The package retains the existing `private-downloads/mt4-bots` delivery library, including compiled EX4 products. Host this repository as **private** or move those binaries to protected object storage before any public launch. Do not expose private bot downloads through public static routes.

## Curriculum scope note

The 6,500 records are structured, generated course units across 65 domains and five levels. They provide broad curriculum coverage and adaptive sequencing; they are not a claim that every financial rule, jurisdiction, product, or trading method in the world is exhaustively covered. Content should continue to be reviewed and expanded by qualified educators and compliance counsel.
