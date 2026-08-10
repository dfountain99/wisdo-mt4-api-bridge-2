# Operations

Use `/health` for liveness, `/ready` for dependency readiness, and authenticated `/admin/system-health` for summarized application, database, Discord, Reporter fleet, queue, copier, voice, payment, and worker state. Logs carry request, interaction, command, account, and copier-event IDs without secrets.

Operational alerts should cover Reporter offline/reconnected, command failed/expired, copier rejection, margin/drawdown danger, payment activation, and worker/database degradation. Notifications need event IDs and cooldowns. Graceful shutdown stops HTTP acceptance, drains resources within `WISDO_SHUTDOWN_TIMEOUT_MS`, closes Discord, and exits deterministically.
