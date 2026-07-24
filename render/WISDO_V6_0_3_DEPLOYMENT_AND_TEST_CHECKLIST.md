# WISDO v6.0.3 Deployment and Test Checklist

## Deploy

- [ ] Extract the full v6.0.3 repository.
- [ ] Keep `.env` out of GitHub; retain production variables in Render.
- [ ] Run `npm ci --no-audit --no-fund`.
- [ ] Run `npm run check` and confirm 45 passing tests.
- [ ] Push the repository to the GitHub `main` branch watched by Render.
- [ ] Confirm `/api/public/health` reports `6.0.3`.
- [ ] Confirm PostgreSQL, Redis, Discord, and website health remain stable.

## Copier Engine

- [ ] Open `/app/copier-engine`.
- [ ] Select one Culture Lead.
- [ ] Select two or more receiver accounts using the checkboxes.
- [ ] Confirm the selected receiver count updates.
- [ ] Confirm the leader's historical symbols load automatically.
- [ ] Click symbols green/grey and save the lane.
- [ ] Refresh and edit the lane; confirm accounts and symbol highlights persist.
- [ ] Confirm one shared lane displays with one execution route per receiver.

## Combined Dashboard

- [ ] Open `/app/dashboard`.
- [ ] Confirm collective balance equals the sum of every lane account.
- [ ] Confirm collective equity, floating P/L, closed P/L, open trades, and drawdown.
- [ ] Confirm each account remains visible in the breakdown.
- [ ] Disconnect one Reporter and confirm degraded lane health appears.

## Harvest

Use demo accounts only.

- [ ] Save and arm a small floating-profit target.
- [ ] Press Check Goal and confirm the current and target values appear.
- [ ] Press Check Goal + Harvest after reaching the target.
- [ ] Confirm all lane accounts receive close sweeps in parallel.
- [ ] Press Harvest Lane Now and confirm it executes without requiring the goal.
- [ ] Confirm the cycle remains pending until all accounts report flat.
- [ ] Confirm Harvest Once pauses the lane after flat confirmation.
- [ ] Confirm Harvest and Continue resets its baseline for the next cycle.

## Leader-close relay

- [ ] Open one leader trade and verify all selected receivers copy it.
- [ ] Close the leader trade manually in MT4.
- [ ] Confirm every receiver receives a deterministic priority close.
- [ ] Confirm the correct stored follower tickets close.
- [ ] Repeat with the lane paused; closes must still relay.
- [ ] Confirm no duplicate receiver close command is created when closed history arrives after ticket disappearance.

## Reporter

- [ ] Compile and install Reporter v1.57 on every MT4 account.
- [ ] Confirm each chart displays v1.57 and a fresh heartbeat.
- [ ] Confirm Close All produces one atomic basket-sweep command per account.
- [ ] Confirm MT4 Experts logs show targeted, closed, and failed counts.
