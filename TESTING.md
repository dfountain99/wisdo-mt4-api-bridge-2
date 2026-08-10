# Testing

Primary gates:

```bash
npm ci
npm run check
npm run lint
npm run test:unit
npm run test:integration
npm run test:commands
npm run smoke
npm run audit:runtime
npm run audit:commands
npm run audit:stubs
npm run pressure:mt4
npm audit --omit=dev
```

Manual-finish evidence on 2026-08-09:

- Complete Node suite: 261/261 passed.
- Unit gate: 87/87 passed.
- Integration gate: 43/43 passed.
- Command gate: 9/9 passed.
- Smoke gate: 29/29 passed.
- Build audit: 309 JavaScript files and 14 required production assets passed.
- Command audit: 100 unique runtime/registration commands.
- Stub audit: 529 files scanned; 0 production items required review.

`pressure:mt4` is an in-memory/simulated integration test unless explicitly connected to disposable PostgreSQL; it is not a Render/network capacity benchmark. Never load-test production.

The sandbox npm audit endpoint was unavailable (private mirror returned HTTP 404), so the final `npm audit --omit=dev` must be repeated on the Windows checkout. The user's preceding clean `npm ci` reported 0 vulnerabilities. Browser/OAuth/mobile checks and the final PostgreSQL migration run also remain staging gates.
