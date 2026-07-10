CEM WISDO SignalSummary HTTP 500 Fix V3.1

Problem fixed:
Render /mt4-sync could return HTTP 500 with:
Cannot access 'signalSummary' before initialization

Cause:
services/mt4SyncService.js used signalSummary inside historyRecord before signalSummary was declared.

Install:
1) Copy services/mt4SyncService.js into your real wisdo-mt4-api-bridge repo, replacing the old file.
2) git status
3) git add services/mt4SyncService.js
4) git commit -m "Fix MT4 sync signalSummary initialization"
5) git push
6) Render -> Manual Deploy -> Deploy latest commit

No MT4 Reporter recompile is needed for this specific HTTP 500. This is a Render/backend fix.
