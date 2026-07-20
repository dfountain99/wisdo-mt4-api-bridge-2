# WISDO v7.0.4 Heap, Recognition, and Culture Lane Durability Audit

## Production failures addressed

1. Node terminated with `Reached heap limit` and `Runtime_MapGrow` while MT4 command polling and background services accumulated live keys.
2. The website did not visibly recognize the signed-in member or animate current account performance.
3. Account growth milestones were not surfaced at each 50% step.
4. Culture Lane changes could exist only in the hot process mirror until a buffered PostgreSQL flush completed, creating a crash/redeploy loss window.
5. Active Culture Lane relay routes were not automatically rebuilt after a process restart.

## Heap and command-queue repair

- MT4 commands use one queue-only durable state instead of duplicate user/account indexes.
- Copy open/close commands receive deterministic dedupe identities.
- Normal entry commands have global, per-user, and per-account hard limits.
- Close, emergency, protect, and profit-lock commands remain privileged.
- Legacy/corrupt command stores are scan-limited before compaction.
- Pairing, rate-limit, Reporter heartbeat, account, Discord refresh, rank-processing, and background-flight maps are size bounded.
- The ecosystem repository no longer keeps a second full long-lived clone as its normal last-known-good state.
- Memory pressure shedding begins before the V8 heap is exhausted.

## Personalized website recognition

Every authenticated `/app/*` workspace loads the v2 recognition layer after real Reporter account data is available.

The entrance animation displays:

- member name and Culture identity;
- rank/title when available;
- selected account or combined portfolio;
- balance;
- equity;
- floating P/L with profit/loss color state;
- open-trade count.

A compact persistent recognition HUD remains visible after the entrance card closes. Selecting another account refreshes and reanimates the account context.

The legacy generic greeting modal is suppressed whenever the v2 recognition layer is active, preventing two greeting systems from covering each other.

## Persistent 50% growth milestones

Each account receives a durable equity baseline. WISDO creates individual queued milestones at:

- 50%;
- 100%;
- 150%;
- every additional 50% level.

If an account jumps across multiple levels between Reporter snapshots, every crossed milestone is queued separately. A milestone is acknowledged only after the user closes the on-screen celebration. Unseen milestones survive refreshes, logout, another device, server crashes, and redeploys through PostgreSQL-backed rank state.

## Crash-safe Culture Lane persistence

Culture Lane configuration is commit-confirmed before the API reports success.

Durable configuration includes:

- lane identity, owner, name, status, and profile;
- leader account and all receiver accounts;
- risk budget and notification policy;
- symbol auto-match, allowed/blocked symbols, aliases, and exposure rules;
- Harvest policy and baseline configuration;
- all linked Culture Lane copier rules.

The repository detects Culture Lane configuration changes and forces the newest complete state through PostgreSQL. Explicit Culture Lane API mutations use a durable save path with a bounded 12-second database confirmation window. A timeout or database rejection returns an error instead of falsely telling the member the lane was saved.

After startup, WISDO loads the PostgreSQL state and automatically reconstructs every active Culture Lane relay route. Failed route restorations retry with bounded exponential delay.

## Verification

- Build audit: 109 JavaScript files.
- Production assets: 14 required assets present.
- Test suite: 108 passed, 0 failed.
- 1,000 simultaneous idle Reporter polls share one hot command-state read and perform zero writes.
- Duplicate copy signals collapse to one pending command.
- Offline entry queues cannot grow without limit.
- Critical close authority remains available under queue pressure.
- 50%, 100%, and 150% milestones are delivered and acknowledged in order.
- Culture Lane state restores in a simulated new repository instance after a durable flush.
- Source audit confirms all Culture Lane mutation routes use the commit-confirmed path and active relay restoration runs on boot.
