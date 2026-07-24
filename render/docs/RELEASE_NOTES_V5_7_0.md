# WISDO Funnel Learning + Portable AI v5.7.0

## Release purpose

This release upgrades the WISDO growth funnel from a single confirmation message into a consent-aware education and engagement system.

## Added

- Signed personal learning room for every captured lead.
- Immediate webinar and resource email after lead capture.
- Four-part educational email sequence for leads who explicitly consent:
  - Day 1: Reporter connection and duplicate-sync prevention.
  - Day 3: Culture Lane risk and follower close authority.
  - Day 5: Portable WISDO AI learning guide.
  - Day 7: complete next-step checklist.
- Existing SMS confirmation remains optional and consent-based.
- Tracked webinar, resource, and video links.
- Video started and video completed funnel events.
- Lead stages automatically move from new to engaged and signed_up.
- Portable public WISDO AI identity and conversation history through a signed lead token.
- AI context includes lead name, platform, campaign, stage, and engagement count.
- Educational unsubscribe link cancels scheduled marketing lessons while preserving transactional account/security messages.
- Admin funnel dashboard now shows engaged leads, signed-up leads, training opt-ins, scheduled/sent lessons, lead stages, and engagement events.

## Security and consent

- Personal learning links use HMAC-signed, expiring tokens.
- Set `WISDO_LEAD_PORTAL_SECRET` in production.
- Educational drip emails are queued only when `marketingConsent` is true.
- SMS is sent only with a valid phone number and explicit SMS consent.
- WISDO AI remains education and troubleshooting only. It cannot silently execute trades, modify Culture Lanes, or process payments.

## New environment settings

```text
WISDO_LEAD_PORTAL_SECRET=<long random secret>
WISDO_LEAD_PORTAL_TTL_DAYS=30
WISDO_FUNNEL_SEQUENCE_STEP_MINUTES=0
```

Keep `WISDO_FUNNEL_SEQUENCE_STEP_MINUTES=0` in production. A positive number accelerates the 1/3/5/7-day sequence for testing.

## Validation

- Build check passed for 84 JavaScript files and 14 required production assets.
- 27 of 27 automated tests passed.
- Smoke-tested health, lead capture, learning room rendering, video engagement, portable AI context/history, tracked resource redirects, education sequence scheduling, and unsubscribe cancellation.
