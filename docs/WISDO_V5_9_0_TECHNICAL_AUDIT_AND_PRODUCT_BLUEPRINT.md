# WISDO v5.9.0 PostgreSQL + Redis Technical Audit

## Executive finding

The uploaded ZIP is an **upgrade/overlay package**, not a complete deployable repository. It contains the modified PostgreSQL/Redis files, but 23 relative imports referenced by the included code are absent. It should be merged into the full `wisdo-v570-git` project, not deployed by itself.

## What is solid

- PostgreSQL-backed persistence adapter with sectioned JSONB storage.
- Legacy JSON-state import support.
- Serialized writes inside one Node process.
- Redis command envelopes, account/user routing, acknowledgements, metrics, and heartbeat primitives.
- Safe JSON-file fallback with primary and backup copies.
- Development test confirming command publish/ack decoration behavior.

## Critical issues before production

### 1. The package is incomplete by itself

The ZIP is missing core files referenced by `server/apiServer.js`, tests, and services, including server security/routes, MT4 command service, copy trading service, notification services, configuration files, and `storage/atomicJsonFile.js`.

**Impact:** The package cannot start or pass the full test suite independently.

**Required action:** Overlay these files onto the complete application repository and run installation/tests there.

### 2. PostgreSQL persistence can lose updates across multiple server instances

`WisdoPhase1Repository.updateState()` performs load-modify-save of the entire application state. The `stateChain` protects only one Node process. Two Render instances or two simultaneous workers can load the same revision and overwrite each other.

**Impact:** Public/private settings, accounts, copier relationships, notifications, and telemetry can revert or disappear under concurrency.

**Required action:** Add database-level optimistic concurrency using revisions, advisory locks, or move frequently updated entities into normalized tables with row-level updates.

### 3. Every mutation rewrites all state sections

The PostgreSQL adapter saves every top-level section and deletes sections absent from the snapshot.

**Impact:** High write amplification, slower requests as the dataset grows, larger memory usage, and dangerous deletion if a partial state object is accidentally saved.

**Required action:** Add `saveSection()` / `updateSection()` methods and stop rewriting unrelated sections.

### 4. Redis delivery is not a reliable work queue yet

Commands are pushed to Redis lists and published through Pub/Sub, but there is no atomic claim, visibility timeout, consumer group, or retry worker. Pub/Sub messages are lost when receivers are offline. Lists retain commands without an execution lease.

**Impact:** Delayed commands, duplicate execution, or commands never reaching MT4.

**Required action:** Use Redis Streams with consumer groups, or implement `BRPOPLPUSH`/processing queues with leases, retries, and dead-letter handling.

### 5. Commands can be duplicated into two queues

A command with both account and owner identifiers is pushed into both the account queue and user queue.

**Impact:** A receiver that polls both routes can execute the same close command twice.

**Required action:** Choose one authoritative execution queue. Use secondary channels only for notification/status broadcasting, and enforce command-ID idempotency at the receiver.

### 6. Pending-command retry is not implemented

The bridge adds command IDs to `wisdo:commands:pending`, but no included worker scans stale entries, retries delivery, expires commands, or moves failures to a dead-letter queue.

**Impact:** The pending count can grow indefinitely while commands remain unresolved.

**Required action:** Add a scheduled recovery worker with attempt limits, exponential backoff, TTL enforcement, and terminal failure status.

### 7. PostgreSQL copier tables are created but not used

The migration creates `wisdo_copier_commands` and `wisdo_receiver_heartbeats`, but the Redis bridge does not write to them.

**Impact:** Redis failure or restart removes the operational command history, and PostgreSQL cannot serve as the audit/recovery source intended by the schema.

**Required action:** Persist command lifecycle and receiver heartbeat snapshots to PostgreSQL while Redis handles low-latency delivery.

### 8. API health heartbeat expires after startup

The Redis API health key is written once with a 90-second expiration during connection and is not renewed.

**Impact:** The API appears offline after 90 seconds even while running.

**Required action:** Refresh the key on an interval and clear it gracefully during shutdown.

### 9. Publish failures are hidden from callers

Redis operations use a safe fallback. A local command may be created successfully while Redis publishing silently fails, and the caller still receives the command as though it were queued.

**Impact:** The website may report success even though no receiver can receive the command.

**Required action:** Return explicit delivery state such as `stored`, `published`, `degraded`, or `failed`; block emergency controls from showing success without durable acceptance.

### 10. Acknowledgements need stronger validation

Acknowledgement updates do not verify that the acknowledging receiver owns the target account or that status transitions are valid.

**Impact:** Incorrect or stale receivers could update another command's state.

**Required action:** Validate receiver/account identity, use signed bridge credentials, and enforce transitions such as queued → claimed → delivered → completed/failed.

## Important secondary issues

- Redis TTL is multiplied by 24, making a requested 1-hour command record last 24 hours. Clarify whether this is intentional.
- Configuration Boolean conversion may treat a string value such as `"false"` as true in some code paths.
- State payloads lack schema validation and size limits.
- No explicit PostgreSQL pool shutdown integration was confirmed in the included server code.
- The included test suite tests the decorator but not Redis reconnect behavior, duplicate prevention, stale-command recovery, PostgreSQL conflicts, or multi-instance concurrency.

## Recommended build order

1. Merge the overlay into the complete `wisdo-v570-git` repository.
2. Make account visibility and copier relationships durable using section-level or normalized PostgreSQL writes.
3. Replace command lists with Redis Streams and command-ID idempotency.
4. Store every command lifecycle transition in PostgreSQL.
5. Add receiver heartbeat monitoring and API health renewal.
6. Add retry/dead-letter processing.
7. Make the website wait for durable command acceptance and display execution acknowledgements.
8. Add load, reconnect, duplicate-command, and multi-instance persistence tests.

## Deployment decision

**Do not deploy this ZIP by itself.** It is a promising persistence/Redis patch, but the reliability layer is not complete enough yet for live funded-account trade control without the fixes above.

---

# Product Direction: Culture Lane Portfolio Operating System

## Strategic conclusion

WISDO is moving toward something much larger than a standard MT4 copier. The platform should be designed as a **portfolio operating system** that coordinates every account inside a Culture Lane, makes portfolio-level decisions, manages account-specific restrictions, and records the full lifecycle of every trade and configuration decision.

The copier remains the execution layer, but the product should sit above it as the intelligence, risk, routing, harvesting, audit, and optimization layer.

## Culture Lane Smart Symbol Routing

The current manual symbol whitelist approach will not scale as leaders trade more instruments and followers use different broker symbol names or account restrictions. Each Culture Lane should use a formal **Symbol Policy**.

### Auto Match

When the leader opens a trade such as:

```text
SPXUSD Sell
```

The follower evaluates:

```text
Does the broker offer SPXUSD?

Yes -> copy the trade.
No  -> search approved aliases.
```

Possible aliases include:

```text
SPX500
US500
US500.cash
US500m
SPX500.i
```

When no compatible symbol exists, the system should:

```text
Skip the trade for that follower.
Notify the user.
Continue copying all other eligible trades.
```

Auto Match should be the recommended default because it minimizes setup while respecting broker availability.

### Symbol Discovery

The first time a reporter connects, it should upload the broker's complete symbol inventory.

```text
Reporter connects
        ↓
Downloads all broker symbols
        ↓
Uploads inventory to WISDO
        ↓
Website builds searchable symbol catalog
```

The dashboard can then display availability using checkboxes instead of requiring users to type symbol names manually.

```text
Broker Symbols

✓ EURUSD
✓ GBPUSD
✓ XAUUSD
✓ NASUSD
✗ SPXUSD
✓ US500
```

This inventory should also include metadata when available, such as digits, point size, contract size, minimum lot, maximum lot, lot step, trading status, and market session.

### Symbol Translator

Every Culture Lane should maintain a translation table that maps the leader symbol to the correct symbol on each follower.

```text
Master:     SPXUSD
Follower A: SPXUSD
Follower B: US500
Follower C: SPX500.cash
```

The copier should resolve the translation automatically before execution. Symbol routing decisions should be stored in the Trade Passport and Lane Timeline for later review.

### Recommended symbol-policy controls

Each follower should support:

- Auto Match enabled or disabled.
- Approved aliases.
- Allowed and blocked symbols.
- Asset-class restrictions.
- Per-symbol lot multiplier.
- Per-symbol maximum exposure.
- Skip-and-notify behavior.
- Require-manual-approval behavior.
- Fallback symbol mappings.

## Harvest Mode

The existing Compound Goal concept should become **Harvest Mode**, a flagship portfolio-level profit-management system.

The user sets a lane goal, for example:

```text
Daily Goal: 2%
```

WISDO continuously calculates the combined financial state of the leader and all followers:

```text
Leader
+
Follower 1
+
Follower 2
+
Follower 3
=
Culture Lane Equity
```

When the configured goal is reached, the system should:

```text
Close every eligible trade
        ↓
Wait for receiver confirmations
        ↓
Verify that exposure is flat
        ↓
Store performance statistics
        ↓
Notify Discord
        ↓
Notify Email
        ↓
Update the Culture Lane Vault
```

### Harvest behaviors

#### Harvest Once

```text
Reach the goal
      ↓
Close everything
      ↓
Pause until the next configured session or day
```

#### Harvest and Continue

```text
Reach the goal
      ↓
Close everything
      ↓
Resume trading
      ↓
Build toward the next harvest
```

#### Stair-Step Harvest

```text
2% -> Close
4% -> Close
6% -> Close
8% -> Close
```

The next target should be calculated from the selected reference point, such as start-of-day balance, start-of-cycle equity, or last harvested balance.

### Harvest goal types

Users should be able to trigger a harvest using:

- Percent gain.
- Dollar gain.
- Equity target.
- Balance target.
- Floating profit.
- Closed profit.
- Combined closed and floating profit.
- Maximum drawdown recovery.
- Time-based session target.

### Intelligent Harvest

Users should be able to choose immediate or intelligent execution after a goal is reached.

Example strong-trend behavior:

```text
Goal reached
      ↓
Trend score is strong
      ↓
Keep basket open
      ↓
Trail combined lane equity
      ↓
Close if equity retraces by 0.5%
```

Example weakening-trend behavior:

```text
Goal reached
      ↓
Trend score is weakening
      ↓
Close immediately
```

Intelligent Harvest should never override hard safety controls, daily loss limits, maximum drawdown limits, emergency close commands, or account-level permissions.

## Culture Lane Vault

The Culture Lane Vault should become the primary homepage for each lane. It should treat all connected accounts as one coordinated portfolio while still allowing drill-down into individual accounts.

Core metrics should include:

```text
Lane Balance
Lane Equity
Lane Daily Return
Lane Weekly Return
Lane Monthly Return
Lane Floating Profit
Lane Closed Profit
Largest Winner
Largest Loser
Profit Locked Today
Harvest Count
Current Compound Cycle
Next Harvest Goal
Current Drawdown
Peak Lane Equity
Open Lane Exposure
Execution Health
```

The Vault should also show whether the lane is active, paused, harvesting, awaiting acknowledgements, degraded, partially disconnected, or in emergency-stop mode.

## Culture Intelligence

Culture Intelligence should become the analytical brain of each lane. It should generate daily and weekly reports based on actual execution, risk, profit, latency, routing, and harvest data.

### Intelligence report contents

- Why the lane made money.
- Why the lane lost money.
- Symbols that carried profits.
- Symbols that reduced performance.
- Best and worst sessions.
- Best and worst followers.
- Slowest follower.
- Most profitable strategy or bot.
- Average and maximum execution latency.
- Missed, skipped, rejected, and translated symbols.
- Harvest timing quality.
- Drawdown and recovery behavior.
- Slippage by account and broker.
- Disconnect and reconnect events.

Recommendations should be tied to measurable lane behavior. Examples:

> Most profits came from NASUSD during the New York session. Consider increasing the allocation budget for that session while preserving the lane's current drawdown ceiling.

> Three harvests occurred within twenty minutes. A slightly higher target may have produced more realized profit, but the recommendation should be tested against historical drawdown before activation.

Culture Intelligence should clearly separate observations, simulations, and recommended changes. No recommendation should be applied automatically without explicit user authorization unless the user has enabled an approved automation policy.

## Lane Profiles

Lane Profiles should provide professional presets that users can adjust instead of configuring every control from scratch.

### Compound Profile

Focused on long-term equity growth, wider harvest spacing, and reinvestment.

### Income Profile

Focused on frequent realized-profit harvesting and withdrawal planning.

### Capital Preservation Profile

Focused on reduced exposure, tighter drawdown controls, and faster safety intervention.

### Prop Challenge Profile

Focused on daily loss limits, maximum drawdown, consistency rules, position limits, and challenge-specific restrictions.

### Custom Profile

Allows the user to configure all available parameters.

Each profile should define defaults for risk budget, harvest mode, symbol policy, trading sessions, maximum open exposure, maximum correlated exposure, retry behavior, notification severity, and emergency-stop rules.

## Trade Passport

Every leader trade, copied order, and basket should receive a permanent identity. The Trade Passport should become the authoritative audit record for what happened across the lane.

Example:

```text
Passport #87425

Lane: Alpha
Leader: Deadshot
Accounts: 7
Execution Success: 100%
Average Delay: 42 ms
Harvest: Cycle 12
Closed By: Harvest Mode
Profit: +$2,413
Duration: 2h 18m
```

A passport should include:

- Original leader order.
- Every follower order.
- Symbol translations.
- Lot transformations.
- Risk calculations.
- Open and close timestamps.
- Execution latency.
- Slippage.
- Rejections, retries, and acknowledgements.
- Per-account profit distribution.
- News and market session context.
- Harvest cycle.
- Closing authority.
- Optional screenshots.
- Associated Genome version.

The Trade Passport should be immutable after finalization, with corrections recorded as append-only audit events.

## Lane Timeline

The Lane Timeline should function as a replay and debugging system for every important lane event.

Example:

```text
9:00 AM  Trades opened
9:15 AM  Follower 4 disconnected
9:16 AM  Follower 4 reconnected
10:02 AM Harvest trigger reached
10:02 AM Close All sent
10:02 AM Receivers acknowledged
10:02 AM Accounts confirmed flat
10:03 AM Lane paused
```

Users should be able to replay a day, filter by account or event type, inspect command payloads, and open the related Trade Passport.

This feature will support:

- Reliability debugging.
- Customer support.
- Education.
- Compliance and dispute review.
- Copier-performance demonstrations.
- Root-cause analysis.

Timeline events should be append-only and should come from durable PostgreSQL records rather than Redis alone.

## Lane DNA

Lane DNA should summarize the observed behavioral characteristics of a lane rather than presenting only conventional statistics.

Example:

```text
Lane DNA

Aggression: 72%
Patience: 81%
Average Hold: 3h 12m
Preferred Session: New York
Preferred Trend: Momentum
Most Reliable Symbol: NASUSD
Weakest Symbol: GBPUSD
Harvest Accuracy: 94%
Average Recovery: 1.8 days
Risk Profile: Balanced
```

DNA metrics should be calculated from clearly documented formulas and should include confidence levels when the data sample is limited.

### DNA evolution

```text
January  Growth Score: 71
February Growth Score: 78
March    Growth Score: 85
```

Users should be able to compare DNA across time ranges, accounts, bots, profiles, and Genome versions.

## Lane Genome

Every meaningful lane configuration change should create a new versioned Genome.

Example:

```text
Genome v1.0
Harvest: 2%
Risk: Medium

Genome v1.1
Added Intelligent Harvest

Genome v1.2
Reduced Risk Budget

Genome v1.3
Added NASUSD
```

A Genome version should capture:

- Profile and risk settings.
- Symbol policy and translations.
- Harvest configuration.
- Account membership.
- Allocation rules.
- Session rules.
- Copier and retry settings.
- Bot versions.
- Notification settings.
- User who approved the change.
- Effective timestamp.

The platform should compare Genome performance using profit, drawdown, volatility, harvest efficiency, execution success, and recovery metrics.

Example comparison:

> Genome v1.3 produced 24% more monthly profit with 18% less drawdown than Genome v1.0 during the selected comparison period.

Genome comparisons must disclose differences in market period, sample size, deposits, withdrawals, and account membership so users do not mistake correlation for causation.

## Product architecture implications

These features require the technical foundation identified earlier in this audit. The product vision should not be built on top of unreliable command delivery or whole-state JSON rewrites.

### Required durable entities

PostgreSQL should contain normalized or append-only records for:

- Culture Lanes.
- Lane memberships.
- Account permissions.
- Broker symbol inventories.
- Symbol aliases and translations.
- Lane Profiles.
- Genome versions.
- Harvest policies and cycles.
- Copier commands and acknowledgements.
- Receiver heartbeats.
- Trade Passports.
- Timeline events.
- Lane metrics and DNA snapshots.
- Intelligence reports.
- Notifications and delivery receipts.

### Redis responsibilities

Redis should be used for:

- Low-latency command delivery.
- Receiver work queues.
- Consumer groups.
- Short-lived locks.
- Live lane state.
- WebSocket fan-out.
- Rate limiting.
- Retry scheduling.

Redis should not be the only system of record for commands, passports, timelines, harvest cycles, or configuration history.

## Revised build roadmap

### Foundation: reliability and persistence

1. Merge the PostgreSQL/Redis overlay into the complete repository.
2. Replace whole-state writes with section-level or normalized writes.
3. Implement Redis Streams, consumer groups, retries, dead-letter handling, and command idempotency.
4. Persist every command state transition and receiver heartbeat in PostgreSQL.
5. Add live API and receiver health renewal.
6. Make emergency controls wait for durable acceptance and show account-level acknowledgements.

### Portfolio control layer

7. Add Culture Lane entities and membership permissions.
8. Add broker symbol discovery and symbol inventories.
9. Build Symbol Policy, Auto Match, and Symbol Translator.
10. Build the Culture Lane Vault.
11. Add lane-level close, pause, resume, and emergency controls.

### Harvest layer

12. Add Harvest policies, cycles, and goal calculations.
13. Add Harvest Once, Harvest and Continue, and Stair-Step modes.
14. Add confirmation-based flat-state verification.
15. Add Intelligent Harvest with protected basket trailing.
16. Connect Discord, email, dashboard, and audit notifications.

### Intelligence and audit layer

17. Build immutable Trade Passports.
18. Build the append-only Lane Timeline and replay interface.
19. Add Lane Profiles and versioned Genome configuration.
20. Calculate Lane DNA snapshots and evolution.
21. Build Culture Intelligence reports and explainable recommendations.

## Updated product position

WISDO should be positioned as a **multi-account portfolio management and execution operating system**, not merely a copier.

Its defining features should be:

- Culture Lane Smart Symbol Routing.
- Culture Lane Vault.
- Harvest Mode.
- Culture Intelligence.
- Lane Profiles.
- Trade Passports.
- Lane Timeline Replay.
- Lane DNA.
- Lane Genome Evolution.

Together, these features create a platform where one coordinated decision can govern an entire portfolio while every account still respects its own broker symbols, permissions, risk limits, and execution conditions.
