# WISDO V5.2.1 — Reporter Account Sync Authority

- Reporter upgraded to v1.56.
- `SYNC_ACCOUNT`, `ACCOUNT_SYNC`, `REFRESH_ACCOUNT`, `REQUEST_SNAPSHOT`, and `SYNC_NOW` force an immediate MT4 snapshot.
- Sync completion now reflects the actual `/mt4-sync` result instead of returning unsupported.
- Snapshot payloads expose `reporterVersion` and `reporterCapabilities` for diagnostics.
- Existing v1.55 close-authority behavior is retained.
