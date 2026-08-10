# Apply WISDO v7.1.0 Live Desk

Repository: `C:\Users\jaque\Documents\wisdo-mt4-api-bridge-2`

## Windows CMD

```bat
cd /d C:\Users\jaque\Documents\wisdo-mt4-api-bridge-2
git checkout main
git pull origin main
git checkout -b agent/wisdo-v7-1-0-live-desk
```

Extract the **overlay ZIP** into the repository root, then run:

```bat
npm ci
npm run check
npm run audit:runtime
npm run audit:commands
npm run audit:stubs
npm run audit:secrets
node --test tests/live-desk.test.js
git diff --check
git status --short
```

Never stage `.env`. The release ZIP contains only `.env.example`.

Commit and push only after all locally available gates pass:

```bat
git add -A
git status
git commit -m "add WISDO v7.1.0 Live Desk broadcasting"
git push -u origin agent/wisdo-v7-1-0-live-desk
```

After merging to `main`, use the **existing** Render service and choose **Manual Deploy → Deploy latest commit**.

Keep:

```text
WISDO_VOICE_EXECUTION_MODE=DEMO_ONLY
SQUARE_ENVIRONMENT=sandbox
```

For reliable phone/cellular viewing, configure TURN in Render without pasting its shared secret into Git or chat:

```text
WISDO_WEBRTC_TURN_URLS
WISDO_WEBRTC_TURN_SHARED_SECRET
WISDO_WEBRTC_TURN_TTL_SECONDS=3600
```
