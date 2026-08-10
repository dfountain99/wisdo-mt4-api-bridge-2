# Authentication and Authorization

Discord OAuth establishes the server-side member session. The return path is allow-listed and OAuth state is validated. Production has no development identity fallback; `WISDO_DEV_USER_ID` is accepted only outside production for local testing.

Authentication answers who the user is. Authorization separately checks tenant ownership, account share permission, Discord role, product/license access, and action safety. Admin override is explicit and audited. Account control and account visibility are distinct permissions.
