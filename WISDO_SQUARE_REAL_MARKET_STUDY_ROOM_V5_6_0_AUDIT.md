# WISDO Square Checkout + Real Historical Study Room V5.6.0 Audit

## Scope completed

### Checkout
- Replaced active Stripe imports and checkout-session creation with Square payment links.
- Removed the Stripe package dependency.
- Migrated subscriptions, legacy memberships, setup products, bot purchases, paid-link purchases, and affiliate activation.
- Added compact Square payment-note metadata with a 500-character guard.
- Added Square webhook HMAC verification using the raw request body and exact notification URL.
- Added webhook event deduplication.
- Added Square subscription cancel/resume handling.
- Added additive database columns and webhook event storage for Square.

### Study Room
- Removed generated/simulated candle construction.
- Added historical OHLC normalization, validation, ordering, and deduplication.
- Added custom WISDO bridge, Twelve Data, and supported Coinbase provider routes.
- Requires at least 32 valid candles; lessons normally select a 64-bar teaching window.
- Displays source name, provider symbol, fetch time, and exact range.
- Disables AI Markup with zero fake candles when data is unavailable.
- Retains Live TradingView for direct chart inspection.
- Added automatic zoom stages and manual zoom controls over verified history.

## Security and trust controls
- Payment access is not granted from the browser redirect. It is granted after a verified Square webhook.
- Webhook signatures use constant-time comparison.
- Duplicate Square events are recorded and ignored.
- Historical chart annotations are labeled educational and are not live signals.
- No private strategy source is exposed.

## Validation results
- Build check: passed
- JavaScript files checked: 80
- Required production assets: 14
- Tests: 19 passed, 0 failed
- Runtime smoke: passed
- Health version: 5.6.0
- `realHistoricalExamples`: true
- `fakeChartFallbackDisabled`: true
- `squareCheckout`: true

## Deployment warning
Square sandbox credentials and sandbox plan variation IDs must be tested first. Production access requires production Square credentials, an exact production webhook notification URL, and production Catalog plan variation IDs. Real historical AI Markup remains disabled until a historical provider is configured.
