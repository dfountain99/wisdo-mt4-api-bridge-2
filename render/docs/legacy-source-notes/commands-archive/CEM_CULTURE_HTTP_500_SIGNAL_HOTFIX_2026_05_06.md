# CEM CULTURE HTTP 500 Signal Hotfix - 2026-05-06

## Fixed

The MT4 sync endpoint could return:

`HTTP 500 {"ok":false,"error":"Cannot access 's...'"}`

Cause: duplicate service files were out of sync. One copy still wrote snapshot history before the signal/history object existed.

## Applied

- Synchronized `services/mt4SyncService.js`
- Synchronized `src/services/mt4SyncService.js`
- Synchronized `server/services/mt4SyncService.js`
- Synchronized `server/src/services/mt4SyncService.js`
- Confirmed MT4 snapshot smoke test returns `ok:true`
- Confirmed leader account trade signal summary returns:
  - `copySignalsOpened: 1`
  - `copySignalsClosed: 0`
  - `signalSkipped: false`

## After deploy

Run:

```bash
npm install
npm run register-commands
npm start
```

Then test:

1. Generate `/connect` pairing code for Demo Lead as leader.
2. Paste code into demo terminal Reporter.
3. Watch Render logs for `MT4 snapshot received`.
4. Open `/api/signal-health`.
5. Place one tiny demo trade and confirm Discord signal posts.
