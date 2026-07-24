# WISDO Copier Timeout Hotfix v5.6.3

- Gives Culture Lane saves a dedicated 45-second browser timeout.
- Separates successful save feedback from noncritical page refresh failures.
- Removes duplicate relay synchronization from read-only copier endpoints.
- Performs one ecosystem-state write instead of two before responding.
- Bounds live relay registration to `WISDO_COPIER_RELAY_TIMEOUT_MS` (default 5000 ms).
- Returns `relayPending: true` when the lane is saved but relay registration is still completing.
- Adds start, finish, rejection, and failure timing logs with a request ID.
