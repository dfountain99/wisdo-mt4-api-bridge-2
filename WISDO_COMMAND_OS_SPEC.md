# WISDO Command OS

WISDO is a context-aware command bridge for the campaign EA. Text, voice, touch, drawing, and swipe gestures all compile to the same validated command object.

## Core rule

The user expresses intent. WISDO interprets intent. The EA evaluates market reality and safety. MT4 executes only an accepted command.

## Future goals

A future goal is a standing intention with a trigger, action, conditions, duration, resume rule, and expiration.

Example:

> After a compound target, pause new entries. Keep managing the hold. Wait for a reversal candle. Resume in the campaign direction only if the EA entry logic is valid.

Example:

> After a win, pause for 15 minutes. When the timer ends, evaluate the current logic and enter immediately only if valid.

“Enter now” always means `ENTER_IF_VALID`: request an immediate EA evaluation, never bypass the EA safety gate.

## Campaign states

`OBSERVING → ARMED → TRADING → PAUSED → EVALUATING → TRADING`

A rail failure can move the campaign into `REVERSAL_READY`. Emergency protection overrides every future goal.

## Institutional level canvas

Target lines snap to validated levels only. One notch means the next eligible institutional level. Three notches means advance through the next three eligible levels. Freeform price dragging is not accepted.

## Trail behaviors

- `STRUCTURE_KEEPER`: confirmed higher lows/lower highs
- `LIQUIDITY_GUARDIAN`: trail behind liquidity pools
- `PROFIT_VAULT`: prioritize locked profit
- `RUNNER_FREEDOM`: preserve room while structure holds
- `CANDLE_GUARD`: completed candle structure
- `CAMPAIGN_RAIL`: shared campaign protection
- `REVERSAL_SENTINEL`: tighten as reversal pressure rises

## Voice examples

- “Wisdo, enter now if valid.”
- “After this win, pause 15 minutes, then evaluate.”
- “After the compound target, pause SONIC until a reversal candle appears.”
- “Move the selected runners three institutional levels.”
- “Show me what happens before executing.”
- “Prepare the reversal, but do not execute.”

## EA response states

`ACCEPTED`, `WAITING_FOR_CONFIRMATION`, `BLOCKED_BY_PAUSE`, `BLOCKED_BY_SPREAD`, `BLOCKED_BY_DISTANCE`, `BLOCKED_BY_RISK`, `REJECTED`, `EXECUTED`, `BROKER_FAILED`.
