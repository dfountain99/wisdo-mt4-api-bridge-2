# WISDO V5.6.1 Audit

## Release purpose

This full release repairs the Render exit-134 failure, restores reliable open/close signal detection, adds a measurable 1,000-lead monthly funnel target, and adds signup email plus consent-based SMS delivery.

## Confirmed crash root cause

The MT4 state normalizer did not return `signalTrackingByAccountId`. Each Reporter heartbeat therefore forgot which master tickets were already open. Accounts with 45–102 open trades repeatedly recreated the same trade signals, expanded persisted signal data, and eventually exhausted the Node/V8 heap.

## Reporter and copier repairs

- `signalTrackingByAccountId` is now part of default and normalized MT4 state.
- Tracking retains only currently open trade keys and their Culture signal IDs.
- Removed master tickets delete their stale tracking entry and create one close event.
- Repeated identical snapshots create zero duplicate open signals.
- MT4 history stores account/equity metrics, not duplicated `openTrades` and `closedTradesToday` arrays.
- Snapshot history is bounded globally and per account.
- Trade signal storage prunes orphaned signal objects and bounds take/close arrays.
- Removed accounts also remove their signal tracking and history.

## Render prestart repair

`npm start` now runs `scripts/repairPersistentState.js` first.

The repair:

- Compacts existing `mt4.json` history.
- Preserves only active signal mappings.
- Prunes `trade-signals.json` to its configured retention.
- Quarantines an oversized or corrupt state file instead of allowing it to crash startup.
- Keeps quarantined files on the persistent disk for manual recovery; it does not silently delete them.

Default limits:

- Global MT4 history: 500 records.
- Per-account MT4 history: 100 records.
- Signal history: 500 signals.
- Oversized-state quarantine threshold: 96 MB.

## Growth funnel

- New public route: `/growth`.
- Existing webinar registration now records campaign attribution.
- UTM fields supported: source, medium, campaign, content, and term.
- Referral code attribution is retained.
- Lead submissions are deduplicated by campaign plus email/phone.
- Honeypot and per-IP submission throttling reduce automated spam.
- Admin route: `/admin/growth-funnel`.
- Dashboard reports visitors, leads, actual conversion, pace target, projection, gap, source mix, and recent leads.
- Default goal: 1,000 leads/month at a configurable 20% target conversion, which models approximately 5,000 visitors/month. This is a target model, not a guaranteed result.

## Signup email and SMS

- Transactional welcome email is queued on email, Google, and Discord signup when an email is available.
- Webinar/growth leads receive a registration confirmation email.
- SMS is queued only when the person supplies a valid phone number and explicitly checks SMS consent.
- Resend is used for email.
- Twilio is used for SMS.
- Every message is recorded in a durable outbox.
- Failed/provider-unconfigured messages remain retryable instead of disappearing.
- Admin can retry pending delivery from the growth-funnel dashboard.

## Required Render environment for live delivery

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=WISDO <notifications@your-domain.com>
WISDO_EMAIL_REPLY_TO=support@your-domain.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1...
```

Also confirm:

```text
PUBLIC_BASE_URL=https://your-render-domain
WISDO_STORAGE_PATH=/var/data/wisdo
DATA_DIR=/var/data/wisdo
FUNNEL_MONTHLY_LEAD_TARGET=1000
FUNNEL_TARGET_CONVERSION_RATE=20
```

## Automated verification

- `node scripts/checkBuild.js`: passed.
- Full test suite: 23/23 passed.
- Duplicate-open regression: passed.
- Master-ticket close detection: passed.
- Compact-history regression: passed.
- Funnel attribution/deduplication: passed.
- Email/SMS outbox behavior: passed.
- Public server smoke: `/health`, `/growth`, `/register`, and `/webinar/register` returned HTTP 200.
- Lead API smoke returned HTTP 201.
- Signup smoke created one user, one attributed lead, one email event, and one SMS event.
- Prestart repair reduced a synthetic 160.36 MB MT4 state file to 0.05 MB while preserving active signal tracking.

## Deployment order

1. Upload/deploy the full V5.6.1 project.
2. Keep the persistent disk mounted at `/var/data`.
3. Add the Resend and Twilio environment variables.
4. Deploy and inspect the first log lines for `[prestart] Repaired` or `[prestart] Quarantined`.
5. Confirm `/health` and `/api/public/health` return 200.
6. Attach Reporter V1.56 and verify the second identical heartbeat logs `copySignalsOpened: 0`.
7. Close one master ticket and verify `copySignalsClosed: 1` plus a follower close command.
8. Submit one `/growth` test lead and confirm email/SMS delivery status in `/admin/growth-funnel`.
