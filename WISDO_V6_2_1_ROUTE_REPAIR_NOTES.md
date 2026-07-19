# WISDO v6.2.1 Route Repair

## New public pages
- /features
- /about

## Public compatibility routes
- /events -> /resources
- /leaderboard -> /member/leaderboard

## Repaired member compatibility routes
- /member/dashboard -> /app/dashboard
- /member/trades -> /app/trades
- /member/history -> /app/analyzer
- /member/performance -> /app/analyzer
- /member/harvest -> /app/compound-tracker
- /member/risk -> /member/risk-profile
- /member/copier -> /app/copier-engine
- /member/routes -> /app/copier-engine
- /member/copier-logs -> /app/lane-audit
- /member/symbol-routing -> /app/copier-engine
- /member/notifications -> /app/alerts
- /member/courses -> /app/education
- /member/webinars -> /app/education
- /member/replays -> /app/education
- /member/products -> /member/marketplace
- /member/orders -> /member/purchases
- /member/storefront -> /member/store
- /member/teach -> /member/presence?mode=teach
- /member/missions -> /member/presence?mode=mission
- /member/focus -> /member/presence?mode=focus
- /member/install -> /member/my-bots

## Other changes
- Added Features and About to public navigation.
- Added Features and About to sitemap.xml.
- Existing authentication requirements remain enforced on member routes.
- Test suite: 74 passed, 0 failed.
