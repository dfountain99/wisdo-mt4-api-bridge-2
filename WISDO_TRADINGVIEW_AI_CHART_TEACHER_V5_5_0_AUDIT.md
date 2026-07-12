# WISDO TradingView AI Chart Teacher V5.5.0 — Build Audit

## Implemented

- Live TradingView chart inside each webinar chart scene
- Full TradingView handoff for the selected symbol
- AI-generated safe chart plan
- Server-generated simulated OHLC teaching data
- Teaching zones, context/confirmation/entry markers, invalidation and objective lines
- Automatic chart-step zoom during narration
- Manual zoom, reset, timeframe, and step controls
- Strategy and learner market/timeframe defaults
- Explicit simulated-data and educational-risk notices
- Service-worker cache invalidation

## Architecture decision

TradingView's free advanced chart is embedded as an iframe. Browser cross-origin rules do not allow WISDO to reliably draw custom AI annotations inside that iframe or control its exact bar-range zoom. V5.5 therefore uses a dual-mode chart lesson:

- TradingView supplies the real interactive market chart.
- WISDO AI Markup supplies the controllable annotated teaching example.

This preserves real chart access while allowing deterministic instructional zoom and annotations.

## Validation result

- Product regression tests: 18 passed, 0 failed
- Source syntax checks: passed
- Protected strategy source remains excluded from public assets
