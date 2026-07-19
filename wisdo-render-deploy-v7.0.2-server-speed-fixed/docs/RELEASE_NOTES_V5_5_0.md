# WISDO V5.5.0 — TradingView AI Chart Teacher

## What changed

The AI Webinar Room now teaches directly on charts instead of relying on static scene icons.

Each trading webinar contains an on-chart example with two synchronized views:

1. **Live TradingView** opens the selected real market symbol and timeframe in the embedded advanced chart.
2. **AI Markup** renders a clearly labeled simulated teaching example that WISDO can annotate and control.

## Chart teaching controls

- Automatic zoom during webinar playback
- Context, confirmation, risk-map, and full-review steps
- Manual Zoom In, Zoom Out, and Reset controls
- Timeframe selector for 1m, 5m, 15m, 1h, 4h, and daily
- Open Full TradingView handoff
- Teaching-zone rectangle
- Confirmation, context, and practice-entry markers
- Educational entry, invalidation, and objective lines

## Data integrity

The AI chart is explicitly simulated. It is generated for instruction and is never represented as live or historical market data. The TradingView mode is used for comparison with the actual chart. Neither view is presented as a guaranteed signal or individualized financial advice.

## Backend

- AI Webinar schema version: `1.1.0`
- Product version: `5.5.0`
- Generation request supports `chartSymbol` and `chartInterval`
- Generated AI output supplies a safe chart plan; the server creates the teaching candles and annotations
- Every normalized trading webinar receives a chart example even if the external AI omits one

## Frontend

- Live TradingView is the default view when a chart scene opens
- Starting playback switches to AI Markup and advances the zoom sequence
- Chart steps can be selected manually and narrated independently
- Service-worker cache advanced to `wisdo-shell-v5.5`

## Validation

- JavaScript syntax validation passed
- Regression suite: 18 passed, 0 failed
- Chart generation, symbol mapping, timeframe normalization, session payloads, and client controls are covered by tests
