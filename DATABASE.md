# Database

PostgreSQL is required for durable production trading state. Hot Reporter tables store pairings, accounts, latest snapshots, bounded history, signal tracking, active-account selection, commands, and signals. The ecosystem migration adds stable accounts, aliases/preferences, interaction telemetry, desks, copier routes/events/maps, bot lanes, presence, payment events, integer affiliate ledger values, and operational metrics.

Legacy JSON state remains only as a compatibility namespace for lower-frequency features. Render ephemeral files must not be treated as authoritative production storage.
