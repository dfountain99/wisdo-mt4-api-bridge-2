# WISDO Member App Major All-Upgrades V5

## Rebuilt from the supplied product pass

This release uses `wisdo-member-app-product-pass(1).zip` as its source and upgrades that application in place. It does not merge in the prior V4 package.

## Major changes

- one ordered production source tree; duplicated nested project copies removed
- premium multi-page public product experience
- interactive pricing configurator with server-authoritative totals
- protected member workspace and account switcher
- operational account, copier, trade, analyzer, alert, billing, affiliate, Academy, support, push, and admin APIs
- community Culture Leads and account sharing
- signed broker webhook wired into follower command fanout
- original copied ticket/symbol used for closing events
- open-event idempotency and entry-only safety gates
- AES-GCM credential encryption and HMAC-signed sessions/webhooks
- synchronized account/user MT4 command delivery state
- portable pure-Node PNG chart rendering; native canvas dependency removed
- corrected web-only startup path
- complete login return-path preservation
- actual password update during reset flow
- Render persistent disk configuration
- PostgreSQL/Supabase migration path
- service worker, email templates, SEO, legal, and provider readiness

## Provider boundary

Stripe, Discord, Google, Resend, OpenAI/Google AI, market feeds, VAPID push, and PostgreSQL become live only after real production credentials and provider-side setup are supplied. Fallbacks are explicitly labeled and are not presented as live market or AI data.
