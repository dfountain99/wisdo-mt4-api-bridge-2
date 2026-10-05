# WISDO V23 — Ambient Life OS

V23 is the first production slice of WISDO as an ambient operating system across the physical home, digital workspace and verified trading control plane.

## What V23 actually does

V23 introduces one mission engine that can coordinate:

- approved smart-home components through the Universal Device Fabric,
- WISDO operating modes,
- enrolled workstations through the command bus,
- a small, explicit set of existing verified trading controls,
- household roles and temporary identities,
- room/privacy zones,
- house-law policies,
- simulation before execution,
- and a mission truth ledger.

It does **not** claim that every future Ambient Life idea is complete. Vehicle handoff, local voice inference, vision commissioning, self-healing network control and the offline edge mission runner remain future work.

## Mission execution model

A mission is a list of typed steps:

- `home` — uses approved + online Universal Device Fabric components and the existing smart-home risk floor.
- `workstation` — requires an enrolled device that advertises the requested capability.
- `trading` — supports only explicitly mapped verified commands in V23: pause/resume entries, Guard Mode, pause/resume copier and close winners.
- `mode` — updates WISDO's current operating mode.

Every run begins with simulation. Simulation resolves real targets, checks availability, household permission, default policies, custom policies and confirmation requirements.

If any step is blocked, no mission execution begins.

## Built-in house laws

V23 ships with non-removable baseline policies:

1. Presence, schedules and unattended automations cannot mutate trading.
2. Unattended routines cannot unlock doors, disarm alarms or open garages.
3. Camera actions are blocked while Guest context is active.
4. Physical-security actions require confirmation.
5. Whole-scene activation requires confirmation because a scene can hide multiple device effects.
6. Every trading mutation requires confirmation.

Additional user policies can only add deny/confirmation behavior in this release.

## Household roles

- **OWNER** — home, security, camera, workstation, mode and trading authority.
- **ADULT** — home/security/workstation/mode; trading is disabled unless explicitly granted.
- **CHILD** — low-risk home and mode controls.
- **GUEST** — low-risk home controls only.
- **TECHNICIAN** — low-risk home controls only unless explicitly narrowed/expanded by stored permissions.

Temporary household records can expire automatically.

## Home isolation

Smart-home mission targets inherit the mission's `home_id`. Universal component resolution now supports explicit home scoping, preventing a device alias in one property from resolving the same-named device in another property.

## Truth ledger

V23 records state changes separately:

`simulation.completed → run.blocked / run.awaiting_confirmation / step.queued / step.completed / step.failed → run.queued / run.completed / run.failed`

A queued device or MT4 command is not labeled physically completed.

## Local-safe manifests

V23 can compile a mission into a local-safe manifest only when:

- simulation passes,
- no confirmation is required,
- every step is home/mode only,
- every step is risk level 0–2,
- no trading or workstation step is present.

If `WISDO_LOCAL_ROUTINE_SIGNING_SECRET` is configured, the manifest receives an HMAC-SHA256 signature.

The **offline edge runner is intentionally disabled in V23**. A signed manifest is preparation for that runtime, not proof that offline automation is active.

## Member UI

`/member/life-os` is the authenticated member control surface; browser actions stay session-backed and do not expose edge-device bearer tokens.

It provides:

- mission composer,
- simulate-before-run,
- explicit run confirmation,
- room/privacy zones,
- household role setup,
- policy visibility,
- mission library,
- truth ledger,
- local-safe manifest compiler.

## Safety principle

Presence can change context. Presence cannot grant authority.

A device being discovered, a person entering a room, or a mission condition becoming true never bypasses device approval, home binding, household permissions, trading authorization, or physical-security confirmation.
