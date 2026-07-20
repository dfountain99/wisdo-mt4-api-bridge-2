# WISDO Culture Lane OS v7.0.6

Production repair for repeated MT4 snapshot churn and Render heap exhaustion.

Key protections:

- Ticket-stable signal tracking prevents unchanged trades from replaying as opens and closes.
- Legacy signal keys migrate automatically.
- Post-snapshot product and memory work is coalesced to one latest event per account.
- Slow background tasks keep their worker slot until they actually finish.
- Product trade ingestion uses indexed lookups and bounded account history.
- Buffered authoritative saves no longer clone the discarded full PostgreSQL namespace.
- Culture Lanes remain PostgreSQL-backed and restore after crashes or redeploys.
- Website identity recognition and 50% growth milestone celebrations remain enabled.

Validate before deployment:

```bash
npm ci
npm run check
npm run pressure:v706
```

Use Reporter v1.59 and attach only one active Reporter instance per MT4 account.
