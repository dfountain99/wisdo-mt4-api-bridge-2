# WISDO V5 Production Launch Checklist

## Build

- [ ] `npm ci` succeeds from a clean checkout
- [ ] `npm run check` passes
- [ ] no `.env`, credentials, runtime JSON, logs, or `node_modules` are in the deploy artifact
- [ ] Render persistent disk is mounted and writable

## Security

- [ ] all generated secrets are long and unique
- [ ] credential encryption reports ready in `/api/public/health`
- [ ] broker webhook rejects missing/invalid signatures
- [ ] Stripe webhook rejects invalid signatures
- [ ] cron routes reject missing/invalid bearer tokens
- [ ] non-owner cannot control another follower account
- [ ] admin APIs reject normal members
- [ ] password reset link is one-time and changes the password

## Auth

- [ ] email login returns to the full requested app URL
- [ ] Discord OAuth returns to the full requested app URL
- [ ] Google OAuth returns to the full requested app URL
- [ ] logout invalidates the session cookie

## MT4 and copier

- [ ] two demo MT4 accounts show independent heartbeats
- [ ] account dropdown selects the correct account on desktop and mobile
- [ ] route save immediately appears in Active Culture Lanes
- [ ] delete uses route ID and removes indexes
- [ ] fixed lot, multiplier, equity ratio, and balance ratio are validated
- [ ] symbol aliases resolve per follower broker
- [ ] duplicate open webhook does not duplicate a follower trade
- [ ] close uses original copied ticket and symbol
- [ ] close is not blocked by allowed-symbol/opening filters
- [ ] Close All targets only the selected account
- [ ] reconnect does not replay already delivered commands

## Safety gates

- [ ] equity protection
- [ ] maximum daily loss
- [ ] trading hours
- [ ] spread threshold
- [ ] pending-order permission
- [ ] maximum open trades
- [ ] route pause/resume
- [ ] symbol execution automatch remains off until demo certification

## Product systems

- [ ] pricing total matches server calculation
- [ ] Stripe checkout and portal complete in test mode
- [ ] subscription webhook updates state
- [ ] Resend test message arrives
- [ ] push public key and subscription registration work
- [ ] market and AI cards clearly identify fallback/provider status
- [ ] Academy progress and badges persist
- [ ] affiliate activation and commission hold rules work
- [ ] support ticket appears for member and admin

## Public experience and compliance

- [ ] all public routes return 200
- [ ] page-specific title/description/OG metadata
- [ ] sitemap, robots, and llms routes load
- [ ] cookie consent persists
- [ ] Terms, Privacy, and Risk Disclosure are reviewed by counsel
- [ ] no performance claim implies guaranteed returns
