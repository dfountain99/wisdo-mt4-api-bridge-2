# Copier Engine

Copier routes use stable master and follower account IDs. `copierSafetyService.js` rejects self routes, duplicates, and cycles; immutable source event IDs provide deduplication. `SymbolResolver` accepts exact inventory matches or explicit/verified aliases and never blindly strips broker suffixes.

Lot policies cover fixed, multiplier, balance/equity proportional, and risk allocation, then normalize to broker min/max/step. The dry-run simulator reports exact accounts, source/resolved symbol, calculated lot, risk checks, and the command that would be queued without performing execution.
