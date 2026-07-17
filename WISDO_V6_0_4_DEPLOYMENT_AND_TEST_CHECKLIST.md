# WISDO v6.0.4 Deployment and Test Checklist

## Render environment

- Confirm `DATABASE_URL` is present.
- Set `WISDO_PERSISTENCE_MODE=postgres`.
- Keep `REDIS_URL` and `REDIS_ENABLED=true`.
- Confirm `/api/public/health` reports version `6.0.4` and persistence `postgres`.

## Redeploy survival

1. Create or verify two accounts and one Culture Lane.
2. Save Allowed Symbols and a Harvest policy.
3. Redeploy Render.
4. Confirm the accounts, lane, symbols, Harvest policy, and combined Dashboard profile remain.
5. Wait for both Reporter v1.57 terminals to heartbeat.
6. Open Copier Engine and confirm no live-relay warning remains; use **Repair Live Relay** once if a terminal was offline.

## Relay test

1. Use demo accounts.
2. Connect one leader and at least one receiver.
3. Open a new leader trade after both Reporters show live.
4. Confirm one `COPY_OPEN_TRADE` reaches each receiver.
5. Close the leader trade.
6. Confirm the exact follower tickets receive priority close commands.

## Dashboard close controls

- Test **Close Leader Trades** with positions on leader and receiver; only the leader atomic sweep is directly queued.
- Test **Close All Culture Lane**; one atomic sweep must be queued for every lane account in parallel.
- Confirm all commands expire after two minutes and report MT4 completion.
