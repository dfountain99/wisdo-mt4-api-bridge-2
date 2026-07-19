# Wisdo RBAC Phase 1

RBAC Phase 1 adds backend role checks without replacing the existing member experience. The system keeps pages browsable where preview is useful, but blocks admin actions and active copy operations server-side.

## Gates

| Area | Requirement | Behavior |
| --- | --- | --- |
| Admin Wisdo pages | `OWNER` or `WISDO` | Denied with 403 page and audit log |
| `/api/wisdo/admin/*` | `OWNER` or `WISDO` | Denied with 403 JSON and audit log |
| `/api/admin/*` | `OWNER` or `WISDO` | Legacy admin APIs are denied with 403 JSON and audit log |
| MT4 command APIs | Same user plus member/account permissions | Cross-user spoofing is denied; selected account must be owned/shared |
| Copy request | `Culture` or higher with `copy.request` | Non-members receive 403 |
| Active copy route | `CULTURE COIN MEMBER+`, `OWNER`, or `WISDO` | Preview remains visible; live route creation is denied |
| Copy request approval | Admin plus requester copier eligibility | Approval cannot create active relationship for non-premium requester |
| Marketplace | Role-aware item flags | Items are annotated with `accessAllowed`, `locked`, and `lockedReason` |
| Education | Role-aware module flags | Modules are annotated with `accessAllowed`, `locked`, and `lockedReason` |

## Final Fixes

The first HTTP smoke failed because legacy Deadshot `/admin/*` routes registered before the late `/admin/wisdo` route. The exact RBAC-protected `/admin/wisdo` route is now registered before the broad legacy routes, matching `/member/admin-wisdo`.

The same route-order issue affected `/api/wisdo/command`; the legacy command route was registered before the RBAC-aware command route. An exact protected command route now registers before the legacy routes and enforces caller identity, member/account permissions, and selected-account ownership before queueing MT4 commands.

## Persistence

Two new state buckets are part of the Wisdo Phase 1 state:

- `roleSyncByUserId`: latest Discord sync result, mapped Wisdo roles, permissions, gates, source, stale flag, and timestamps.
- `roleOverridesByUserId`: audited manual overrides managed through `POST /api/wisdo/admin/users/:userId/roles/override`.

Each sync writes audit rows for role refresh, role changes, and access grants after sync. Denied admin/copy/marketplace/MT4 actions are audit logged.

## Security Notes

The browser never decides access. UI cards only explain status and call backend APIs. All sensitive actions check the server-side access object derived from `DiscordRoleSyncService`.

The current fallback is intentionally conservative. A user without cached roles becomes `guest`; only `OWNER_USER_ID` can bootstrap owner access locally without Discord.

## Known Limitations

RBAC Phase 1 trusts persisted role sync records or a live Discord lookup. Full OAuth session enforcement and education-completion checks are still future hardening items. Marketplace data is mostly seed catalog data, so role-gated bot tiers depend on `accessLevel`, `requiredRole`, or `requiredDiscordRole` metadata being present on uploaded/admin-enriched bot records.
