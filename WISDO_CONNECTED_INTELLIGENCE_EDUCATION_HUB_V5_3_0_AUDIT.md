SUPERSEDED BY WISDO V5.4.0 AI WEBINAR ROOM + STRATEGY STUDIO. RETAINED FOR RELEASE HISTORY ONLY.

# WISDO Connected Intelligence + Education Hub V5.3.0 — Audit

Date: 2026-07-10

## Source and release lineage

- Sole product source remains the user-provided `wisdo-member-app-product-pass(1).zip`.
- This release continues the V5.2.1 Reporter sync and close-authority branch.
- No prior V4 project tree was merged into the production root.
- One root application remains authoritative: `index.js`, `server/`, `services/`, `public/`, `storage/`, `commands/`, `migrations/`, and `tests/`.

## Connected relay and data pipeline

The Culture Lane, Trades, WISDO Insight Engine, Alerts, and account health pages now use one event lifecycle:

1. Reporter snapshot arrives.
2. Stored Culture Lanes for the lead account are synchronized into signal detection.
3. Newly observed lead tickets create one copied-open event.
4. The follower command is queued with route, leader ticket, copy key, follower account, and resolved symbol.
5. MT4 command completion stores the actual follower ticket.
6. Open and closed trades are upserted into the member trade ledger.
7. Equity snapshots are appended to account telemetry.
8. Trade, risk, connection, and relay events create member alerts.
9. Analyzer results are calculated from the same closed-trade and equity evidence.
10. Lead close detection uses the same route and confirmed follower ticket as the open.

Entry filters remain open-only. Close authority bypasses pause, allowed-symbol, trading-hour, spread, daily-loss, drawdown, and maximum-position entry gates.

## Adaptive learning repair

- `Rebuild my learning path` returns a top-level `firstCourseId`.
- The browser automatically opens the first course after rebuilding.
- Course sessions contain five teachable stages rather than static module headings:
  - learner diagnostic
  - working vocabulary and worked example
  - market context and misconceptions
  - risk/money connection
  - replay practice, assessment, and review
- The path prioritizes stability, automation, data engineering, backtesting, probability, drawdown, position sizing, trade management, forex, metals, and money management when those goals appear in the learner profile.
- High win rate and explosive wins are treated as research goals, not promises.

## Education Hub

Four connected pillars are implemented:

1. Trading Academy
2. WISDO University
3. Resource Center
4. Live Learning

### Course universe

- 6,500 structured course units
- 65 knowledge domains
- 5 experience levels
- adaptive 36-course path
- searchable catalog
- interactive sessions
- quizzes, progress, badges, tutor history, and scenario labs

The catalog is broad but is not represented as literally exhaustive of every law, market, strategy, jurisdiction, or future financial development.

### Original resource library

390 generated original resources are available across the 65 domains:

- study guides
- decision checklists
- practice worksheets
- flash-card packs
- journal templates
- cheat sheets

Resources include title, description, difficulty, estimated time, tags, bookmark state, and download-readiness metadata. Copyrighted books or paid third-party courses are not bundled.

### Trading tools

Eight working educational calculators are included:

- position size
- risk-to-reward
- margin
- pip/point value
- gross profit/loss
- drawdown and recovery
- compounding
- risk-of-ruin scenario

Results explicitly warn that broker specifications, conversion, spread, commission, swap, slippage, taxes, and platform rules can change actual outcomes.

### Live Learning

The system includes provider-ready surfaces for:

- live webinars
- recorded seminars
- risk office hours
- market breakdowns
- automation reliability workshops
- DF Sauce interactive labs

`WISDO_WEBINAR_PROVIDER_URL` must be configured before a live room is shown as connected.

## Global Wisdo AI

Wisdo AI is injected into the public product shell, authenticated workspace shell, and legacy-compatible site shell.

Implemented behavior:

- floating desktop/mobile launcher
- minimize and full-screen modes
- current page context
- selected account context
- connected account summary
- Culture Lane count
- active/closed trade count
- unread alert count
- Academy profile and progress
- account-health warning badge
- page-specific suggested questions
- voice input through browser speech recognition
- screenshot attachment up to 2 MB
- conversation history and clear-history control
- navigation links to Education, Accounts, Copier Engine, and Support
- basic/public/premium daily-use limits
- provider fallback when OpenAI is not configured

Permission boundaries:

- explanation, navigation, education, and calculation are allowed
- card details are never collected in chat
- private DF Sauce/HIGHTOWER source is never reproduced
- trade closure, copier changes, automation changes, and payments are never executed from a normal AI answer
- risky intent returns a visible confirmation warning and sends the member to the normal account-specific control surface

## Database alignment

The production migration now includes:

- `education_resource_bookmarks`
- `wisdo_ai_messages`
- `wisdo_ai_usage`
- `live_learning_sessions`
- RLS policies for member-owned data
- admin-only write policy for live-learning sessions

## Validation

- JavaScript files checked: 77
- required production assets checked: 10
- public strategy-source exposure check: passed
- automated tests: 16 passed
- failed tests: 0
- HTTP health: 200
- `/app/education`: 200 with authenticated test identity
- `/api/v2/education/hub`: 200
- `/api/v2/education/tools`: 200
- `/api/wisdo-ai/context`: 200
- `/api/v2/trades`: 200
- `/api/v2/analyzer/portfolio`: 200
- `/api/v2/alerts`: 200
- `/api/copier/options`: 200

## Provider boundary

These systems require production credentials or provider setup:

- OpenAI assistant/tutor
- TradingView private layout
- webinar/live-room provider
- Discord bot and OAuth
- Google OAuth
- Stripe
- Resend
- market-data providers
- VAPID push
- PostgreSQL/Supabase
- MT4 Reporter installation and AutoTrading

Without provider credentials, WISDO exposes explicit fallback/setup status rather than claiming a demo response is live.
