# Wisdo Discord Role Sync

Wisdo now treats Discord server roles as the source of truth for first-pass platform access. The canonical mapping lives in `config/discordRoleMap.js` and is consumed by `services/discordRoleSyncService.js`, API routes, marketplace gates, copy gates, and admin page guards.

## Live Role Mapping

| Discord role | Wisdo roles | Primary access |
| --- | --- | --- |
| `OWNER` | `owner`, `super_admin` | Full platform, RBAC, payout, emergency, and MT4 confirmed actions |
| `WISDO` | `admin`, `wisdo_core` | Wisdo admin dashboard, marketplace, education, bots, logs, feature flags |
| `Culture` | `culture_member`, `trader`, `member` | Member portal, account connection, dashboard, standard education, copy requests |
| `CULTURE COIN MEMBER+` | `premium_member`, `paid_member`, `copier_eligible` | Premium marketplace, premium education, active copier, paid member sections |
| `Members` | `member`, `basic_user` | Basic member portal, accounts, marketplace preview, education |
| `TikTok` | `social_audience`, `lead` | Preview/onboarding funnel access |
| `PIP DRILL 🚨` | `signal_student`, `drill_member` | Pip drill education and signal practice track |
| `FLOW` | `flow_member`, `strategy_track_member` | Flow strategy education track |

Future placeholders are tracked in the same source of truth for Affiliate, Creator, Strategy Provider, VIP, and Beta Tester.

## Sync Flow

1. A member calls `POST /api/wisdo/me/roles/refresh`, or an admin calls `POST /api/wisdo/admin/users/:userId/roles/refresh`.
2. `DiscordRoleSyncService` fetches the configured guild member through the live Discord client when available.
3. Raw Discord role names are normalized and mapped to Wisdo roles and permissions.
4. The result is persisted in `roleSyncByUserId`, mirrored into `usersById`, and audit logged.
5. If the Discord client or guild is unavailable, Wisdo keeps the previous cached roles and marks the record `stale`.

## Exposed Endpoints

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/wisdo/me/roles` | Current user |
| `POST` | `/api/wisdo/me/roles/refresh` | Current user |
| `GET` | `/api/wisdo/admin/role-sync` | `OWNER` or `WISDO` |
| `GET` | `/api/wisdo/admin/role-map` | `OWNER` or `WISDO` |
| `POST` | `/api/wisdo/admin/users/:userId/roles/refresh` | `OWNER` or `WISDO` |
| `POST` | `/api/wisdo/admin/users/:userId/roles/override` | `OWNER` or `WISDO` |

Request-supplied role arrays are ignored by refresh endpoints. The service fetches roles from the Discord guild when the bot client is available, or reuses the stored cached sync when Discord is unavailable.

## Failure Behavior

Role sync should not break local or web-only operation. If the Discord client is not attached, the service returns a stale cached record or a guest fallback. Admin gates remain closed unless the cached record or configured `OWNER_USER_ID` grants admin access.

## Final Verification Notes

The final RBAC smoke verified that `OWNER` and `WISDO` can open the admin page, non-admin roles cannot, admin APIs under `/api/wisdo/admin/*` and legacy `/api/admin/*` are backend protected, role refresh ignores fake client-provided role arrays, and stale fallback preserves cached roles while marking the sync stale.
