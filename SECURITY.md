# Security

Production identity comes only from the signed Discord session. Query/body user IDs and `website-buyer` are not authentication. Private API families require login; tenant claims must match the session; admin routes require an OWNER/WISDO role and audit denial/override events.

Production startup requires a dedicated `SESSION_SECRET` of at least 32 characters. The built-in development fallback is not accepted as a production configuration. Broker credential encryption requires an `ENCRYPTION_KEY` of at least 32 characters. Cookies are HTTP-only, secure on HTTPS, SameSite-protected, and OAuth state validation remains mandatory.

MT4 APIs have body/rate limits and pairing/API-key authentication. Payment state changes require verified Square webhooks and durable event idempotency. Telegram review ingestion also fails closed unless its webhook secret is configured. Never log tokens, passwords, raw secrets, broker credentials, cookies, or payment data.

Before release, run secret scanning over the full Git history. If a real historical secret is found, rotate it; do not reproduce it in an issue or log.
