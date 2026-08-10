# Command Bus

The canonical envelope carries command/idempotency IDs, requester, source, exact account/Reporter/lane/symbol/magic target, action, parameters, safety class, timestamps, retry information, result, and error code.

Lifecycle: `PENDING -> DELIVERED -> ACKNOWLEDGED -> COMPLETED`, with terminal `FAILED`, `EXPIRED`, and `CANCELLED` states. APIs and Discord say “queued” until a Reporter completion receipt exists. High-risk and emergency actions require confirmation bound to the user, account, action, parameters, source, and expiration. Lane resolution never degrades to account-wide execution.
