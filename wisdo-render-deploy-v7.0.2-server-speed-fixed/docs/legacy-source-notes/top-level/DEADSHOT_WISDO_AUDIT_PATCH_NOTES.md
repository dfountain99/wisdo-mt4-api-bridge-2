# Deadshot + Wisdo Full Audit Patch Notes

## Changed files
- `server/deadshotSite.js`
- `server/services/mt4CommandService.js`
- `services/mt4CommandService.js`
- `services/mt4SyncService.js`
- `storage/operatorDeskRepository.js`
- `config.js`
- `DEADSHOT_WISDO_FINAL_ARCHITECTURE_BLUEPRINT.md`

## Main fixes
1. Fixed the MT4 command queue indexing issue so delivered/completed/failed/expired statuses sync across every stored copy.
2. Added status lookup across website, Discord, and bridge-linked identities so command completion is not lost when a command was queued under a different linked ID.
3. Added account configuration to MT4 control: saving risk/bot settings now queues `CEM_SET_GLOBALS` when execution checks pass.
4. Added missing pair resume controls so individual pair control has close wins, close pair, pause pair, and resume pair.
5. Improved pairing-code expiry alignment with MT4 pairing TTL instead of the old short website-only timer.
6. Expanded Discord command execution detection so more actions map into the same MT4 command router.
7. Preserved locked/blocked behavior for inactive/free users without leaving controls silently dead.
8. Added final architecture blueprint for website + Discord + Wisdo + MT4 Reporter + future hardware.

## Validation performed
- `node --check` passed for every JavaScript file in the project.
- A direct MT4 command-service test confirmed one queued command updates all copies in `commandQueue`, `commandsByUserId`, and `commandsByAccountId` after delivered/completed.

## Live test path
1. Start web server: `npm run start:web`.
2. Login or create a member user.
3. Generate a pairing code from `/app/connect-account`.
4. Paste the code into `CultureCoin_MT4_Reporter.mq4` settings.
5. Confirm `/app/dashboard` changes from waiting to live bridge.
6. Activate membership/admin role for the user.
7. Press a Wisdo or Copier Engine button.
8. Confirm command appears in `data/operator-desks/mt4-commands.json` as pending.
9. Confirm Reporter polls `/mt4-command-poll`, executes, then posts `/mt4-command-complete`.
10. Confirm `/app/notifications` shows the completion event.

## Additional legacy portal hardening

The legacy `/member/*` portal inside `server/apiServer.js` was also audited so old pages cannot create the appearance of dead controls while the newer command-center UI is active.

- `/member/wisdo` command buttons now post to `/api/wisdo/command` with a real MT4 Reporter command mapping.
- Natural-language text on `/member/wisdo` now maps common phrases like close profits, close all, harvest 50%, pause bot, buy-only, sell-only, protect mode, and stop trading into queueable command records.
- `/api/wisdo/commands` now returns live queue status for a user instead of an empty array.
- Legacy feed/profile/film-room action buttons were converted to real links or existing checkout/support routes.
- Legacy admin cards now point to real admin pages instead of placeholder module links.
- Public pricing checkout cells now route to bot detail, billing, support, or product-specific pricing routes instead of static buttons.

## Verification added after legacy hardening

- `node --check` passed for all 109 JavaScript files.
- MT4 command service copy-sync test passed: queue, delivery, and completion status update every stored copy of a command.
- Primary member portal scan found no dead `href="#"` anchors.
- Active source scan found no old `TradersConnect`, `Trader Connect`, `TC Copier`, `TC Analyzer`, or `Trading Tools` labels.
