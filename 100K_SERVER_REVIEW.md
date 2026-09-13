# WISDO 100K Server Review

This document turns a literal 100,000-review request into a repeatable engineering system instead of a 100,000-line list that nobody can maintain.

## The 100,000 recommendation matrix

Each audit cell produces one recommendation using this rule:

> For **Domain** on **Surface**, under **Failure Mode**, in **Operating State**, verify with **Verification Method** and remediate any violation before production exposure.

The matrix has 10 values on each of five axes:

`10 domains × 10 surfaces × 10 failure modes × 10 operating states × 10 verification methods = 100,000 distinct review recommendations.`

### Axis A — Domains

1. Authentication and sessions
2. Authorization and account ownership
3. MT4 command execution and receipts
4. Persistence and PostgreSQL correctness
5. Payments, affiliate accounting and entitlements
6. Discord, OAuth and role synchronization
7. WISDO AI, voice and automation
8. Web, World, uploads and browser security
9. Infrastructure, Render and runtime reliability
10. Observability, incident response and recovery

### Axis B — Surfaces

1. Public HTTP routes
2. Authenticated member routes
3. Admin routes
4. Webhooks and callbacks
5. MT4 Reporter sync and command polling
6. Database reads/writes and migrations
7. Background queues and workers
8. Browser/static/media surfaces
9. Third-party APIs and provider adapters
10. CI/CD, repository and deployment configuration

### Axis C — Failure modes

1. Spoofing or identity confusion
2. Privilege escalation or account crossover
3. Injection or unsafe parsing
4. Replay, duplication or idempotency failure
5. Data loss, corruption or stale reads
6. Resource exhaustion or denial of service
7. Secret, credential or personal-data exposure
8. Race condition or inconsistent lifecycle state
9. Dependency/provider outage or partial failure
10. Unsafe default, fallback or fail-open behavior

### Axis D — Operating states

1. Fresh deployment
2. Normal steady-state load
3. Burst traffic
4. Low-memory pressure
5. Database degradation
6. Provider/API degradation
7. Reporter disconnect/reconnect
8. Authentication/session expiry
9. Deployment rollback/recovery
10. Malformed or adversarial input

### Axis E — Verification methods

1. Unit test
2. Integration test
3. Contract test
4. Property/boundary test
5. Static audit
6. Secret/dependency scan
7. Load/pressure test
8. Failure-injection test
9. Staging smoke test
10. Production health/telemetry assertion

## Highest-priority recommendations distilled from the matrix

The 100K matrix is prioritized rather than implemented blindly. A recommendation is merge-ready only when it is high impact, testable, backward-compatible enough for the current release, and does not weaken trading safety.

### P0 — Authentication and identity

- Reject every unsigned legacy session format.
- Require an isolated `SESSION_SECRET`; never reuse Discord, MT4, payment or encryption credentials as the session signing key.
- Require at least 32 characters for the production session secret.
- Require exactly one recognized signed-session version and exactly three token components.
- Cap session-token size before parsing.
- Reject malformed Base64URL session components before decoding.
- Verify signatures before parsing user content.
- Reject sessions with missing or invalid expiration timestamps.
- Keep expiration bypasses diagnostic-only and explicit.
- Reject unsafe cookie names and normalize SameSite values.
- Force `Secure` when `SameSite=None` is requested.
- Keep authentication cookies `HttpOnly`.
- Reject control-character and external return paths.
- Treat every missing/invalid session as unauthenticated rather than guessing identity.
- Test tampering, expiry, unsigned legacy payloads and weak production secrets on every PR.

### P0 — Trading command integrity

- Resolve authenticated user before accepting a command.
- Resolve an exact authorized account before command creation.
- Never infer the first account as an execution target.
- Preserve one canonical command-envelope schema across Discord, web, voice and Pi surfaces.
- Enforce command idempotency and lifecycle transitions.
- Treat HTTP acceptance as queued work, not broker execution.
- Advance command truth only from Reporter receipts.
- Reject account spoofing even when a caller supplies a plausible account ID.
- Preserve view-only versus control permissions on shared accounts.
- Fail closed when account ownership is ambiguous.
- Keep dangerous voice execution in demo-only mode until explicitly production-certified.
- Rate-limit command creation, delivery and replay recovery independently.
- Bound active queues per user and per account.
- Preserve command history independently from active queues.
- Make reconnect behavior idempotent so a Reporter cannot replay already completed commands.

### P0 — Secrets and credentials

- Block committed runtime `.env` files.
- Scan for OpenAI, Square, GitHub, Google, AWS, Slack, Telegram, Discord and Stripe credential formats.
- Scan for Twilio auth-token assignments.
- Scan for private-key PEM material.
- Scan database and Redis URLs containing embedded passwords.
- Keep secret scanning before the full test suite so leakage fails quickly.
- Generate production secrets in the deployment environment rather than Git.
- Separate session signing, credential encryption, webhook signing and broker credentials.
- Rotate any secret that ever appears in Git history, screenshots or logs.
- Never print full tokens or passwords in health endpoints.
- Keep `.env.example` values empty for sensitive variables.
- Treat provider IDs and secret values differently; do not over-redact harmless IDs while leaking actual secrets elsewhere.

### P1 — CI/CD and repository safety

- Give GitHub Actions read-only repository permissions unless a job explicitly needs write access.
- Cancel superseded runs on the same ref to reduce stale validation and compute waste.
- Give every workflow a timeout.
- Run dedicated security regressions before broad integration suites.
- Keep launch gates on both pull requests and main pushes.
- Require secret audit, build check, unit tests, integration tests, command tests, smoke tests and runtime audits.
- Keep Node and Python test lanes independent so failures identify the affected runtime.
- Automate npm, Python and GitHub Actions dependency updates.
- Review automated dependency PRs through the same launch gates as feature changes.
- Keep production deployment configuration canonical at repository root.
- Do not bypass database migrations during deploy.
- Validate `/health` and `/ready` separately: liveness is not readiness.
- Deploy from reviewed main rather than arbitrary stale branches.
- Prefer small reversible hardening commits over one unreviewable mega-change.

### P1 — Persistence and recovery

- Require PostgreSQL in production.
- Run migrations before application startup.
- Make migrations idempotent enough to validate twice in staging.
- Keep authoritative trading snapshots durable before noncritical downstream processing.
- Fail closed for writes when database truth cannot be established.
- Make any fail-open read mode explicit, bounded and observable.
- Bound stale-cache lifetimes.
- Use query and statement timeouts.
- Use circuit breakers for repeated database failure.
- Preserve account, command and receipt identity across restarts.
- Test deployment rollback against a staging clone of production schema.
- Back up before destructive or irreversible migration work.

### P1 — Web and media surfaces

- Inventory every public static mount and classify whether the content is truly public.
- Do not serve private customer/member uploads from predictable unauthenticated static paths.
- Disable directory indexing and dotfile exposure for static content.
- Add `X-Content-Type-Options: nosniff` on user-controlled files.
- Use private/no-store caching for authenticated personal content.
- Validate MIME type and file size server-side for uploads.
- Store uploads under generated identifiers rather than user-controlled paths.
- Prevent path traversal during upload and download.
- Apply authorization at download time, not only upload time.
- Keep service-worker caching rules explicit so stale application shells do not hide deployments.
- Version rapidly changing World assets to avoid stale browser caches.
- Test mobile memory/compositing behavior separately from desktop rendering.

### P1 — Runtime reliability

- Bound every in-memory queue and cache.
- Expose queue depth and memory pressure in health telemetry.
- Preserve critical MT4 health routes during memory shedding.
- Shed optional read traffic before command/receipt traffic.
- Use deterministic timeouts for third-party calls.
- Disable background workers that cannot fit the selected Render memory tier.
- Keep low-memory relay behavior explicit and tested.
- Avoid self-triggering browser observers or render loops.
- Do not resize decorative canvases every animation frame.
- Degrade visual effects before degrading command/control correctness.
- Separate visual World failures from trading backend failures.

### P1 — Payments and entitlements

- Verify signed payment webhooks before mutating entitlement state.
- Make webhook handling idempotent.
- Keep recurring billing fail-closed until the subscription lifecycle is complete.
- Never grant a license from a client-side success page alone.
- Record provider event IDs and processed state.
- Reconcile payment state against provider truth.
- Keep affiliate amounts in integer cents.
- Prevent self-referral unless explicitly enabled.
- Apply hold periods and refund clawbacks deterministically.
- Audit every admin payout or entitlement override.

### P2 — Maintainability and architecture

- Continue decomposing mega route files by bounded domain.
- Keep authentication, command bus, payments, persistence, World rendering and admin concerns in separate modules.
- Eliminate copied/archive runtime trees from production import paths.
- Keep one source of truth for configuration.
- Keep one source of truth for command schemas.
- Remove one-release compatibility paths after their planned window.
- Delete stale apply/manifest artifacts once no longer needed for recovery.
- Close or archive obsolete pull requests and branches.
- Document every intentionally public endpoint.
- Add ownership notes for high-risk modules.
- Prefer contract tests at domain boundaries over tests coupled to implementation details.

## Merge policy for the 100K matrix

A matrix recommendation can be merged automatically only when all of the following hold:

1. The change is reversible or has a safe migration path.
2. The change does not create live trading authority that did not previously exist.
3. The change includes a regression test or an executable audit when practical.
4. Secret scanning and the complete WISDO launch gates are green.
5. Deployment behavior remains compatible with the canonical root `render.yaml`.
6. Database and command truth stay server-authoritative.
7. Failures default to denial, no-op, queue preservation or degraded visuals rather than unauthorized execution.

## Phase 1 implemented by this review

This branch implements the first high-confidence slice of the matrix:

- strict signed sessions with legacy unsigned sessions rejected;
- isolated production session secret requirements;
- session size/shape/expiry validation;
- safer cookie construction and redirect-path checks;
- expanded high-confidence committed-secret scanning;
- dedicated security regression tests;
- least-privilege CI permissions and concurrency cancellation;
- explicit workflow timeouts;
- automated dependency update coverage for npm, Python and GitHub Actions.

The remaining matrix stays a living review framework. Future changes should select the highest-risk cells, implement them in bounded batches, run the launch gates, then merge only after green validation.
