# WISDO v5.6.2 MT4 Sync Coalescing

- Changes the shipped Reporter snapshot default from 3 seconds to 10 seconds.
- Converts near-simultaneous duplicate snapshots from HTTP 429 errors into HTTP 202 coalesced acknowledgements.
- Prevents coalesced duplicates from running signal, persistence, rank, dashboard, or ecosystem update work.
- Adds `WISDO_MT4_SYNC_MIN_INTERVAL_MS` (default 750 ms).
- The Reporter should still be attached to only one chart per MT4 account.
