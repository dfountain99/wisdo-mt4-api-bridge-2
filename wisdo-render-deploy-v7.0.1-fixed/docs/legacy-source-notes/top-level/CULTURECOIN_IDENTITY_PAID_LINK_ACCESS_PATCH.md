# CultureCoin Identity + Paid Link Access V23

Adds real Discord display identity, avatar/profile fields, paid link access marketplace, linked access dashboard, public profile pages, and admin link access management.

## Main fixes
- Stop showing `website-buyer` when a Discord OAuth user is logged in.
- `/api/me` returns `displayName`, `globalName`, `avatarUrl`, role, and tier.
- Users can pay/request access to traders, coaches, bot owners, signal rooms, and VPS operators.
- Admin can grant/revoke paid link access while Stripe webhooks are finalized.

## Routes
- `/member/link-access`
- `/member/linked-access`
- `/u/:username`
- `/admin/link-access`
- `GET /api/link-access/products`
- `POST /api/link-access/checkout`
- `GET /api/me/linked-access`
- `POST /api/admin/link-access/grant`
- `POST /api/admin/link-access/revoke`
