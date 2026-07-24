# CultureCoin Smart Account Selector + Trade Link State Patch

This patch implements the requested smart-account behavior:

- Global account dropdown on member pages
- `/member/link-account` redesign based on user state
- Website reads Discord-created pairing codes
- Website and Discord pairing flows share the same owner model
- `/api/me/accounts`
- `/api/me/pairing-codes`
- `POST /api/me/pairing-code`
- `POST /api/me/accounts/:accountId/set-primary`
- `POST /api/me/accounts/:accountId/reconnect`
- `POST /api/me/accounts/:accountId/disconnect`
- My Accounts V2 with privacy/role dropdowns
- Copy Hub follower account dropdown

Important isolation rule: never default to the global latest connected account for member views. Always filter accounts by the logged-in Discord user ID.
