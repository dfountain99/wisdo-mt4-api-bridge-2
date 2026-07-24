# WISDO v6.0.2 Deployment and Test Checklist

## Deploy

- [ ] Deploy the full v6.0.2 repository to the Render service watching the GitHub `main` branch.
- [ ] Keep existing Render environment variables; do not upload `.env` to GitHub.
- [ ] Confirm Render uses Node 22.
- [ ] Run PostgreSQL migrations if the service does not do this automatically.
- [ ] Confirm `/health` and `/api/public/health` report v6.0.2 and stay healthy beyond 90 seconds.

## Install Reporter v1.57

- [ ] Open `mql4/CultureCoin_MT4_Reporter.mq4` in MetaEditor.
- [ ] Compile with zero errors.
- [ ] Replace the old Reporter EX4 on every connected terminal.
- [ ] Reattach the Reporter and restore PairingCode, SyncUrl, API key, and follower settings.
- [ ] Confirm the chart displays v1.57.

A Render deployment cannot replace an EX4 already loaded inside MT4.

## Fast close demo test

- [ ] Use demo accounts only.
- [ ] Open several small trades on one MT4 account.
- [ ] From `/app/trades`, press Close All Now.
- [ ] Confirm one atomic sweep command is queued and the Reporter rapidly closes the captured basket.
- [ ] Build a lane with a leader and at least two followers.
- [ ] From `/app/culture-lanes`, press Close Entire Lane Now.
- [ ] Confirm commands are queued to all lane accounts in one parallel fanout and the UI reports `fanoutMs`.
- [ ] Disconnect one Reporter and confirm the lane does not falsely claim every account is flat.

## Visible pages

- [ ] Command Center displays Culture Lane Vault, Symbol Highlights, Harvest, Lane Audit, Lane Intelligence, and Compound Tracker cards.
- [ ] Desktop sidebar scrolls through every page.
- [ ] Mobile top bar page selector opens every new page.
- [ ] Existing Copier Engine routes appear automatically under `/app/culture-lanes`.

## Symbol highlights

- [ ] Leader historical symbols appear automatically under `/app/symbol-routing`.
- [ ] Click one symbol green and another grey.
- [ ] Save highlights and refresh; colors remain correct.
- [ ] Confirm only green symbols can create new follower orders.
- [ ] Confirm grey symbols are skipped and logged.
- [ ] Press Block All and confirm no new leader symbols in the displayed set copy.
- [ ] Add a fallback alias and confirm the intended follower broker symbol executes.
- [ ] Confirm a leader close still closes an existing follower position regardless of symbol highlight state.

## Harvest and audit

- [ ] Configure a small demo Harvest target at `/app/harvest`.
- [ ] Evaluate without closing.
- [ ] Evaluate and close; confirm parallel account commands and cycle history.
- [ ] Inspect `/app/lane-audit` for Genome, Timeline, and Trade Passport records.
- [ ] Generate Lane DNA and Culture Intelligence at `/app/lane-intelligence`.
- [ ] Confirm close records and daily/weekly gauges at `/app/compound-tracker`.

## Funded-account gate

Do not connect funded accounts until demo tests confirm correct account ownership, correct follower tickets, duplicate protection, parallel close acknowledgements, disconnected-account handling, and durable PostgreSQL/Redis recovery.
