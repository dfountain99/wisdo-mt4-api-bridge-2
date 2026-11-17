# WISDO: local loopback diagnostic (staging first)

The term **loopback failed** does not identify a cause by itself. The live Render log line has not yet been verified. Diagnose transport and dependency readiness separately before changing routing, trading, or public URLs.

## Run after startup

In an environment where the web service is already listening:

```bash
PORT=10000 npm run diagnose:loopback
```

Render injects its actual PORT, so use `npm run diagnose:loopback` inside the running instance instead of hardcoding 10000. On Windows PowerShell, set `$env:PORT = '3000'` for a local instance if not already present. The script only makes GET requests to `127.0.0.1` at `/health` and `/ready`. It never calls MT4 trading endpoints.

- Exit 0: both liveness and readiness responded successfully.
- Exit 1: local /health failed. Check bind address, PORT, crash/boot logs, memory, and request timeouts.
- Exit 2: /health responded, but /ready did not. Investigate PostgreSQL/Redis dependencies and bridge readiness; do not treat this as an HTTP listener problem.
- Exit 3: invalid diagnostic configuration.

Do not replace `/health` with `/ready` in Render's liveness probe. Do not self-call the public Render URL for local loopback, as that adds DNS, TLS, CDN/proxy, cold-start, and external routing variables.

## Release gates

1. Check `git status` and pin the exact commit intended for staging.
2. Run `npm ci`, `npm run build`, `npm test`, `npm run audit:runtime`, and the staging migration tests against a disposable database.
3. Start the staging web process; run the diagnostic locally and compare `/health` versus `/ready`.
4. Check Render startup/build logs, memory events, and external HTTPS from a separate client.
5. Verify OAuth, demo Reporter pairing, MT4 sync/poll/receipts, and Genesis pages independently.
6. Review GitHub Actions and use a staged rollout. Do not merge/deploy into the live trading service without proof of the real failure and clean release gates.

## Future scaling design

Separate the authenticated trading API, the Genesis multiplayer WebSocket gateway, background AI/media workers, and durable PostgreSQL + shared Redis presence. Preserve strict account authorization and Reporter receipt-based execution truth. A single-process 100-slot presence prototype is not validated 100-user production capacity.
