# WISDO V5.6.0 Release Notes

## Square migration

The active product no longer creates Stripe checkout sessions. It now creates Square-hosted payment links for subscriptions and one-time purchases. Square payment notes carry compact WISDO routing metadata, and access changes occur only after a signed Square webhook confirms a completed payment.

Covered checkout lanes:

- WISDO plan subscriptions
- Culture Coin legacy membership products
- One-time setup and webinar offers
- Bot marketplace purchases
- Paid-link access
- Affiliate activation and commission ledger creation

Subscription cancellation and resumption are controlled from WISDO and relayed to Square when a Square subscription ID is available.

## Real historical Study Room

The AI Chart Teacher no longer uses simulated candles. A chart lesson requests verified historical OHLC, selects a useful 64-bar teaching window, and records:

- provider and provider symbol
- exact range start and end
- requested TradingView symbol and timeframe
- context zone
- observed confirmation
- educational entry and invalidation
- educational 2R projection
- actual historical follow-through

When real data cannot be loaded, WISDO leaves the candle array empty, disables AI Historical Markup, explains the provider problem, and keeps Live TradingView available.

## Environment

Square requires `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `PUBLIC_BASE_URL`, webhook signature settings, and subscription plan variation IDs.

Real historical examples require either `TWELVE_DATA_API_KEY` or `WISDO_MARKET_DATA_URL`. Supported Coinbase markets can use the public Coinbase candle path when the selected interval is supported.

## Validation

- `npm run check`: passed
- JavaScript files checked: 80
- Automated tests: 19 passed, 0 failed
- Runtime smoke: health V5.6.0, Square feature enabled, fake chart fallback disabled
