# Desk System

Desk provisioning is desired-state reconciliation. `deskReconciliationService.js` validates the guild plan, computes only missing/changed category, role, channel, and overwrite operations, and is idempotent when repeated. `GuildProvisioningQueue` serializes mutations per guild. Failed work retains the desired plan for repair rather than deleting working channels.

Persisted lifecycle states are PLANNED, PROVISIONING, ACTIVE, PARTIAL, REPAIRING, ARCHIVED, and FAILED. Production operations should expose create, audit, repair, archive, restore, and dry-run while respecting Discord rate limits.
