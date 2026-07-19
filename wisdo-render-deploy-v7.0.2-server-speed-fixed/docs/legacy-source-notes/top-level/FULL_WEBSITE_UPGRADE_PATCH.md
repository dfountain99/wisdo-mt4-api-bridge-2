# CultureCoin / WISDO Full Website Upgrade Patch

This package implements the next ecosystem patch from the supplied spec.

## Included

- Public marketing home page at `/` and `/public`
- Public pricing, education, results, and risk disclosure routes
- Connection onboarding page
- Culture Feed placeholder with TikTok-style trading post structure
- Copy Hub with gauges, social feed, invest/mirror form, and mirror-engine wiring
- Bot Marketplace with checkout-ready cards and bot detail routes
- WISDO Control Center placeholder
- WISDO Film Room review placeholders
- Trader Profile placeholder
- Admin Control Panel placeholder
- API placeholder routes for auth, feed, WISDO commands, reviews, and admin
- CEM Culture logo/media assets and moving video backgrounds

## Do not overwrite live data

Do not replace `.env`, `data`, `node_modules`, or `.git`.

## Deploy

```bat
git add server src public storage services index.js package.json package-lock.json render.yaml FULL_WEBSITE_UPGRADE_PATCH.md
git commit -m "Add full CultureCoin social trading website patch"
git push origin main
```

## Stripe

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PUBLIC_BASE_URL` for live checkout.
