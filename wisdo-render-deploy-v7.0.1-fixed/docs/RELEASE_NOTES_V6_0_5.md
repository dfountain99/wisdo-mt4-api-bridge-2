# WISDO v6.0.5 — Complete Compound Tracker Results

## Root cause

The Compound Tracker page rendered `dailyProgress` and `weeklyProgress`, but the analytics service never returned those fields. The page therefore displayed zero even when closed-trade history existed. It also exposed only four gauges and brief close-event cards despite storing richer Reporter history.

## New Compound Tracker report

The new `/api/v2/trades/compound-report` endpoint returns one consistent report for:

- All connected accounts.
- A complete Culture Lane.
- One individual trading account.

Periods include today, 7 days, 30 days, 90 days, one year, and all time.

## New results shown

- Combined balance and equity.
- Realized and floating profit/loss.
- Return percentage and open exposure.
- Win rate, loss rate, breakeven count, profit factor, payoff ratio, and expectancy.
- Gross profit, gross loss, average win, average loss, largest win, and largest loss.
- Current and maximum equity drawdown.
- Closed-trade drawdown and recovery factor.
- Winning and losing streaks.
- Average trade holding time.
- Daily and weekly cumulative profit charts.
- Performance tables by period.
- Symbol, account, and side contribution.
- Recent closed trades with ticket, lots, hold time, and P/L.
- Compound close totals, failures, pending events, realized result, and average confirmation time.
- Expandable close records with command ID, before/after analytics, and raw Reporter completion payload.

## Persistent goals

Users can save daily, weekly, and monthly dollar targets for the portfolio, a Culture Lane, or an account. Goal settings persist in PostgreSQL and drive the progress gauges.

## Export

The page can export the currently visible closed-trade results to CSV.

## Compatibility

Reporter v1.57 remains required. No Reporter source change is required for this release.
