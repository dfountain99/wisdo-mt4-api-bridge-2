# WISDO Major Stability Upgrade Audit

Starting point: protected commit `10e8651bb5a937044ded71139480b69be6de62f2`. Work is isolated on `codex/wisdo-major-stability-upgrade-2026-08-09`; no push or deployment is part of this audit.

Primary defects found were root/src/render drift, implicit first-account targeting, fragmented command status language, synchronous MT4 downstream work, permissive web identity fallbacks, fake/manual checkout success responses, float money fields, stale Reporter health labels, no-op review/Copy Hub routes, and missing durable webhook replay state. The upgrade repairs these without replacing the working Conversational Trading OS.

Manual recovery after the interrupted Codex run also hardened the effective OAuth route order, OWNER/WISDO health authorization, payout/account compatibility, payment amount verification, paid-only affiliate commission, fail-closed recurring billing, production session-secret requirements, and stable-account UUID migration guarantees.

Final sandbox evidence: 261/261 complete Node tests pass; focused unit/integration/command/smoke gates pass; the runtime audit identifies root `index.js`, `server/apiServer.js`, and `commands/index.js` as canonical; the command audit reports 100 unique commands; the stub audit reports zero review-required production items. In-memory MT4 pressure results are documented as simulation only.

Remaining release evidence must come from the Windows/staging environment: a clean install/audit, the final migration executed twice against disposable PostgreSQL, browser/OAuth/mobile smoke, Square sandbox webhook verification, and a demo Reporter command lifecycle. Local simulated pressure numbers must not be represented as Render/network/database production capacity.
