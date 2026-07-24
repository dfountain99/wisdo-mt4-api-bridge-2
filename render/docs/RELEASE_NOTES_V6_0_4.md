# WISDO v6.0.4 — Durable Relay Recovery and Dashboard Close Authority

## Fixed

- Fixed Culture Lanes saving without registering in the live relay repository.
- Fixed leader trades not copying when website ownership and Reporter/Discord ownership use linked identities.
- Fixed live route loss after Render replacement by reconciling routes on Reporter heartbeats.
- Fixed product account and Culture Lane loss after redeploy by promoting production persistence to PostgreSQL.
- Registered the current Reporter connection before copy-signal processing so a repaired route can receive the same leader event.

## Dashboard controls

- **Close All Culture Lane** sends priority atomic sweeps to the leader and every receiver in parallel.
- **Close Leader Trades** sends one priority atomic sweep to the Culture Lead only. Normal lane close authority then follows matching leader tickets to receivers.

## Persistence

When `NODE_ENV=production` and `DATABASE_URL` exists, WISDO uses PostgreSQL even if an older Render setting still contains `WISDO_PERSISTENCE_MODE=json`. The Render blueprint now explicitly sets `WISDO_PERSISTENCE_MODE=postgres`.

## Validation

- 90 JavaScript files validated.
- 14 required production assets validated.
- 50 automated tests passed.
- 0 failures.
