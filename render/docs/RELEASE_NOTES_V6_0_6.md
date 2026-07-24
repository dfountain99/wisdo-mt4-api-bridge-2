# WISDO v6.0.6 — Database AI, Broker API Center, and Reporter v1.58

## Executive result

This release repairs Reporter connection flapping, adds visible Broker API account onboarding, expands Academy and Lane Intelligence into one contextual WISDO education system, and removes active JSON state persistence from production.

## Reporter v1.58 resilient connection state

Reporter no longer changes a healthy account to `Error` after one temporary WebRequest failure.

New behavior:

- Keeps the last successful network heartbeat.
- Allows a configurable failure grace count.
- Uses exponential retry backoff.
- Caps the maximum retry interval.
- Distinguishes `Connected`, `Degraded`, `Retrying`, and `Offline`.
- Reports failure count and last successful network time to the website.
- Preserves Reporter v1.57 atomic basket sweeps and exact follower-ticket close authority.

Recommended defaults:

```text
NetworkFailureGraceCount = 3
NetworkBackoffBaseSeconds = 2
NetworkBackoffMaxSeconds = 60
NetworkOfflineAfterSeconds = 120
```

This improves state reporting and retry behavior; it cannot repair a wrong MT4 WebRequest URL, blocked firewall, invalid certificate, or unavailable Render service.

## Broker API Connection Center

`/app/accounts` now includes three connection methods:

### MetaApi

The member enters a MetaApi token and provider account ID. WISDO imports account information, open positions, orders, balance, equity, margin, floating P/L, and account metadata. Credentials are encrypted before persistence. A background worker refreshes active MetaApi connections.

### cTrader OAuth

The member authorizes WISDO through the cTrader OAuth flow. WISDO discovers authorized live and demo account identities. A registered cTrader Open API application and callback URL are required.

### Signed WISDO Broker Webhook

WISDO creates a per-connection secret and snapshot URL so an approved broker bridge can push account metrics and positions into WISDO.

### Execution boundary

Broker API accounts are created with:

```text
api_execution_enabled = false
execution_transport = monitor_only
```

They may be used for monitoring, analysis, combined portfolio totals, and eligible lead data. They cannot receive WISDO trade/close commands until a provider-specific execution adapter is implemented, reviewed, and explicitly enabled. MT4 receiver execution still requires Reporter.

## Active WISDO Lane Coach

Lane Intelligence now welcomes the member and provides a persistent contextual chat grounded in:

- Combined Culture Lane balance and equity.
- Floating and closed P/L.
- Open exposure and drawdown.
- Reporter freshness and disconnected accounts.
- Confirmed trade history.
- Symbol contribution.
- Lane Timeline events.
- Trade Passports.
- Shared WISDO Academy learning memory.

WISDO separates observation, education, risk warnings, and suggested checks. It does not promise profits or automatically execute a trade.

## Contextual Academy AI

Academy can now build a lesson from the selected Culture Lane, account history, symbols, execution behavior, and risk conditions. Academy tutor answers are saved into shared WISDO learning memory so Lane Intelligence and Academy can use the same approved context.

“Learning” means database-backed memory, summaries, preferences, and historical context. It does not retrain or modify the underlying foundation model.

## Proactive messages and delivery

When meaningful lane activity occurs, WISDO can generate a new in-app coach message after the configured minimum interval. With explicit member opt-in, warning or critical messages can also be sent through:

- Email using Resend.
- SMS using Twilio.
- Discord direct message using the WISDO bot.

The notification outbox, attempts, delivery status, and retry schedule are stored in PostgreSQL. Provider failures do not erase the message.

## Internal automation

The web service now starts internal workers for:

- MetaApi account synchronization.
- Meaningful-change WISDO coach analysis.
- Notification retry delivery.

External bearer-protected cron endpoints remain available for supervised execution.

## Database-only production

All active durable state now uses PostgreSQL, including:

- Profiles and operator desks.
- Reporter pairing and account connections.
- Latest MT4 snapshots and bounded snapshot history.
- Copier routes and signal tracking.
- Trade signal grid state.
- Bot registry and allocation.
- Command confirmations.
- Ranks and dashboard state.
- WISDO memory.
- Accounts and Culture Lanes.
- Allowed Symbols and Harvest policies.
- Genomes, Timeline, Passports, DNA, and Intelligence.
- Academy progress and shared AI memory.
- Broker API credentials and snapshots.
- Coach messages and notifications.

Production refuses startup when `DATABASE_URL` is absent. Automated tests use volatile memory only.

## Validation

```text
Version: 6.0.6
JavaScript files validated: 92
Required production assets: 14
Automated tests: 58
Passed: 58
Failed: 0
Active JSON state writers: 0
```

The Reporter MQ4 source passed structural regression checks. It still must be compiled in MetaEditor against the MT4 build used by each terminal.
