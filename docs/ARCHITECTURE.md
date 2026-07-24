# Architecture

Wisdo Core Alpha is the local edge runtime. SQLite preserves local events and growth baselines when the internet is unavailable. The Wisdo cloud remains authoritative for member identity, Culture Lanes, trading permissions, Discord delivery, and MT4 actions.

The local API intentionally uses Python's standard library so the first 1 GB Raspberry Pi prototype can boot with minimal memory and dependency pressure.
