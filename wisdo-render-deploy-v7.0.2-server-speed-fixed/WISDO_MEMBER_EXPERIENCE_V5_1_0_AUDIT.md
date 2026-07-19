# WISDO Member Experience V5.1.0 — Audit

Date: July 10, 2026

## Source provenance

- Sole original source: `wisdo-member-app-product-pass(1).zip`
- V5.0.1 storage-race repair retained.
- No prior V4 project tree was merged into this release.

## User-reported issues repaired

### Dashboard loading screen

The older launch animation existed only in the legacy shell. The active `/app/*` shell did not consume its session flag, so clicking Dashboard produced no Xbox-inspired startup experience.

V5.1.0 adds a native WISDO Command Center boot overlay to the actual workspace shell. Dashboard links and the WISDO logo set the launch state. Login `?launch=1` and the legacy `deadshotLaunch` flag are also supported. The overlay follows real workspace readiness and cannot block the user indefinitely.

### Broker account form freeze

The account form previously lacked a frontend request timeout and a durable visible error path. Saved broker identities also lived apart from Reporter heartbeat identities, making successful saves appear absent elsewhere.

V5.1.0 adds timeout handling, busy-state cleanup, explicit success/error messaging, canonical account IDs, immediate pairing-code generation, and Reporter/store synchronization.

### Connected accounts missing from app screens

All member screens now load `/api/v2/accounts?includeReporter=1`. Reporter accounts are normalized and merged into the application account store before the response is returned. The selected account persists in session storage and drives Dashboard, Trades, Copier Engine, and WISDO Insight Engine.

### Sloppy education transition

`/member/education` is now a compatibility redirect to `/app/education`, preserving `bot=df-sauce-final-ai`. The Academy renders inside the same WISDO workspace shell as Dashboard.

### Static education content

Academy now contains interactive candle replay, decision grading, bot-brain state, interactive video checkpoints, TradingView Watch Room, Pine explanation/download, lesson progress, points, and badges.

### Pine strategy source

The complete user-supplied Pine v6 script is included at:

`public/academy/df-sauce-campaign-character.pine`

The WISDO simulator uses equivalent lesson concepts for education. Pine execution itself remains in TradingView.

### Analyzer naming and appearance

The member-facing product is now **WISDO Insight Engine**. Settings provide seven color themes and five background modes, including optional motion video backgrounds.

## Automated validation

```text
Build check: 74 JavaScript files passed
Required assets: 9 passed
Automated tests: 7 passed
Failed tests: 0
Pine source: 474 lines
```

## Live HTTP smoke validation

```text
200 /app/dashboard?launch=1
200 /app/education?bot=df-sauce-final-ai
302 /member/education?bot=df-sauce-final-ai -> /app/education?bot=df-sauce-final-ai
200 /app/accounts
200 /js/workspace.js
200 /js/df-sauce-academy.js
200 /academy/df-sauce-campaign-character.pine
200 account create API
200 Reporter-aware account list API
```

## Deployment boundary

This release is code-complete and locally validated. It has not been deployed to the live Render service. Production environment variables and the `/var/data` persistent disk must remain configured. Keep live symbol automatch execution disabled until two demo accounts pass open/close relay certification.
