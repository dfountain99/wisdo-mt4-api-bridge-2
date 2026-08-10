# Account Model

Accounts have a stable UUID (`stable_account_id`) in addition to the legacy broker/account key used during migration. The model includes owner, Discord identity, nickname, broker/server/login, DEMO/LIVE/UNKNOWN type, Reporter and terminal identity/version, timestamps, health, balances, P/L, currency, roles, bot lanes, and sharing permissions.

`AccountSelectionService` is authoritative. It supports exact IDs, exact nicknames, `Account N`, and explicit aliases such as “my Atlanta live account.” Ambiguous or unauthorized references fail closed. No command selects database row zero. An active account must be explicitly persisted; shared control requires a control grant.
