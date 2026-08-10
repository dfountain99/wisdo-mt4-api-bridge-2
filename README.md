# WISDO Trading Operating System

WISDO is a Node 22 application joining Discord, the authenticated member portal, MT4 Reporter, copier routing, conversational controls, bot lanes, payments, affiliates, and operations behind one account-aware backend.

The production source of truth is `index.js`. Both `npm start` and Render start that file. Discord runtime and registration both use `commands/index.js`; the HTTP runtime is `server/apiServer.js`; critical production state is PostgreSQL-backed.

## Local validation

```bash
npm ci
npm run check
npm run audit:runtime
npm run audit:commands
npm run audit:stubs
npm run pressure:mt4
```

Migrations are applied with `npm run migrate:postgres`. Discord commands are registered with `npm run register-commands`. Neither command should be aimed at production without an approved release window and rollback checkpoint.

Voice execution remains protected by `DEMO_ONLY`; live-account voice execution is not enabled by this upgrade. See `UPGRADE_AUDIT.md`, `UPGRADE_RUNTIME_MAP.md`, `SECURITY.md`, and `OPERATIONS.md` before release work.
