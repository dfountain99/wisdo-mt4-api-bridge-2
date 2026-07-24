# WISDO Launch Relay Engine Audit Patch — 2026-07-01

## What was fixed

### 1. `/app` dashboard now gets the patch
The live URL uses the `/app/*` portal handled by `server/deadshotSite.js`. Earlier member-page updates could miss `/app/dashboard`, so this patch applies directly to the active portal route and mirrors the same patched file into duplicate project paths to prevent deploying the stale copy by mistake.

### 2. Selected account now controls relay execution
The old command flow could fall back to the first connected account or the active account in MT4 state. This patch adds a desk-wide account selector and passes `accountId` through:

- account dropdown selection
- mobile close-all buttons
- copier command buttons
- WISDO wake-word command box
- pair-level buttons
- command status polling
- backend command queue
- MT4 command queue by account

The backend now refuses to relay a command if the selected account is not owned by the user or shared to the user with copy/control permission.

### 3. Mobile account switching + mobile close controls
Every `/app/*` page now includes an Active Desk Account card:

- account dropdown
- selected equity/floating/open-trade status
- Close All Selected
- Close Profits
- Pause Relay
- Relay Setup shortcut

This makes phone use realistic: user switches account on mobile, taps close-all, and the backend queues the command for that exact account.

### 4. Live MT4 state is loaded for command APIs
The command endpoints now load live MT4 repository state before checking membership/account connection. This matters because an account can be real in the MT4 bridge even when the old website `connected_accounts` object is empty.

Patched command routes include:

- `/api/trade-copy/action`
- `/api/wisdo/command`
- `/api/command/status`
- `/api/command/queue-status`
- `/api/deadshot/active-account`

### 5. Demo bridge creation is disabled
The old `/api/deadshot/connect-demo-bridge` endpoint no longer creates fake connected accounts. It now returns a disabled response and tells the app to use a real pairing code through `/api/pairing/generate`.

### 6. Seminar + education portal updated
The replay page is no longer a video placeholder. It now acts as a WISDO Seminar + Education Portal with modules for:

- account relay basics
- reporter vs copier
- automatic relay setup
- mobile operator desk
- risk protection
- affiliate activation

Added public aliases:

- `/education`
- `/seminar`
- `/affiliate`

### 7. Affiliate activation + payout split backend added
Added `/api/affiliates/signup` with:

- affiliate signup
- referral code generation
- activation product selection
- split percent
- payout handle
- Stripe metadata support
- manual activation fallback when Stripe is not configured
- payout ledger creation on Stripe checkout completion

Stripe checkout metadata now carries:

- `affiliateId`
- `referralCode`
- `splitPercent`
- `signupType`

Webhook completion creates an `affiliatePayouts` record with gross amount, split percent, payout amount, and pending-review status.

### 8. Dropdowns and sliders added
The portal now uses account dropdown switching everywhere and adds range-style sliders for account risk settings such as daily target, max drawdown, max lot, and affiliate payout split.

## Files patched

- `server/deadshotSite.js`
- `src/server/deadshotSite.js`
- `server/server/deadshotSite.js`
- `commands/server/deadshotSite.js`
- `commands/server/server/deadshotSite.js`
- `commands/src/server/deadshotSite.js`

## Validation completed

Passed syntax checks:

```bash
node --check index.js
node --check server/apiServer.js
node --check server/deadshotSite.js
node --check services/mt4CommandService.js
node --check storage/operatorDeskRepository.js
```

`npm test` could not run because this project has no `test` script in `package.json`.

## 100 ecosystem expansion ideas

1. Active account switcher on every dashboard page.
2. Mobile close-all for selected account only.
3. Mobile close profitable for selected account only.
4. Mobile pause/resume relay.
5. Per-account command confirmation timeline.
6. Account ownership verification before every queue action.
7. Shared account permission tiers: view, signal, copy, control, admin.
8. “Desk accounts” page with live/demo/shared tabs.
9. Account health color system: gray waiting, blue linked, green profit, gold goal hit, red drawdown.
10. Account status badges for terminal connected, EA enabled, stale bridge, live bridge.
11. Broker suffix translator per follower account.
12. Symbol allowlist per relay route.
13. Symbol blocklist per relay route.
14. Max lot slider per follower.
15. Max open trades slider per follower.
16. Equity floor slider.
17. Daily loss percent slider.
18. Daily profit target slider.
19. Risk multiplier slider.
20. Fixed-lot slider.
21. Copy SL/TP toggle.
22. Copy pending orders toggle.
23. Copy only gold/profit signals toggle.
24. Copy only when leader drawdown is healthy.
25. Pause copier after target hit.
26. Resume copier at next session.
27. Session filter by New York, London, Asia, broker time.
28. Holiday/news risk lockout mode.
29. Spread guard.
30. Slippage guard.
31. Max symbol exposure guard.
32. Basket profit close guard.
33. Basket drawdown close guard.
34. Per-symbol close buttons.
35. Per-symbol pause buttons.
36. Per-symbol resume buttons.
37. Per-symbol strength gauges.
38. Strongest pair widget.
39. Weakest pair widget.
40. Open trade grid in website.
41. Expiring signal grid in Discord.
42. Signal grid mirrored into member portal.
43. Signal card “Mirror This Trade” button.
44. Signal expiration timer.
45. Signal disappeared when expired.
46. Discord message edit instead of signal spam.
47. Website notification when signal grid updates.
48. WISDO themed signal speech.
49. Rank-up notifications after wins.
50. Win GIF animations after profitable close.
51. Command completed notification in Discord.
52. Command failed notification in Discord.
53. Command blocked reason card.
54. Reporter heartbeat monitor.
55. MT4 poll latency monitor.
56. Queue age monitor.
57. Emergency queue priority lane.
58. Immediate queue insert for close-all.
59. Duplicate command prevention.
60. Cooldown after emergency close.
61. Account link wizard.
62. Pairing code expiration and renewal.
63. QR code for mobile pairing.
64. Discord `/my-accounts` command.
65. Discord `/switch-account` command.
66. Discord `/close-selected` command.
67. Discord `/pause-relay` command.
68. Discord `/risk` command.
69. Discord account dropdown components.
70. Admin approve shared reporter access.
71. Owner approve/reject copy requests.
72. Community reporter discovery marketplace.
73. Public/private reporter visibility.
74. Leader performance cards.
75. Follower performance cards.
76. Copy route ROI tracking.
77. Copied/skipped/blocked trade logs.
78. Route-level audit trail.
79. User support tickets tied to accountId.
80. Education answer bot trained on setup modules.
81. Seminar registration CRM export.
82. Webinar replay progress tracking.
83. Offer countdown but no fake scarcity.
84. Activation fee checkout.
85. Setup fee checkout.
86. Monthly membership checkout.
87. Affiliate activation checkout.
88. Affiliate referral code link.
89. Affiliate payout ledger.
90. Affiliate split percent rules.
91. Affiliate dashboard with earnings.
92. Affiliate fraud/reversal status.
93. Admin payout approval.
94. Stripe webhook membership activation.
95. Discord role grant after payment.
96. Manual admin activation fallback.
97. Mobile-first bottom command dock.
98. PWA install prompt for phones.
99. Health check page for Render/bridge/Discord/Stripe.
100. Launch checklist with red/yellow/green readiness.

## Next critical backend pieces

1. Confirm MT4 Reporter includes `accountId` when polling `/mt4-command-poll` and completing `/mt4-command-complete`.
2. Confirm `queueCommandForAccount(userId, accountId, command, payload)` only returns commands to the selected account reporter.
3. Add automated integration tests for selected-account relay, unauthorized selected-account block, and mobile close-all command queue.
4. Add a production admin payout page for `affiliatePayouts`.
5. Add a health page that checks Render uptime, MT4 bridge state, command queue size, Stripe webhook config, Discord bot permissions, and stale reporter counts.
