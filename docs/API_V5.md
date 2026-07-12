# WISDO V5 API Map

All protected routes require a valid signed WISDO session. Test identity headers are accepted only when `NODE_ENV=test` or `WISDO_ALLOW_TEST_IDENTITY=true`.

## Public and operational health

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Render/legacy health probe |
| GET | `/api/public/health` | product, persistence, security, and integration readiness |
| GET | `/api/runtime-audit` | feature flags and runtime safety audit |
| GET | `/api/market/widgets` | market context; provider-ready or clearly labeled fallback |
| POST | `/api/pricing/compute` | authoritative pricing computation |

## Authentication and profile

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/me` | current user and profile |
| PATCH | `/api/v2/profile` | update profile |
| DELETE | `/api/v2/me` | delete owned application data |
| GET/POST | `/login`, `/register` | email auth |
| GET/POST | `/forgot-password`, `/reset-password` | one-time reset flow |
| GET | `/auth/discord`, `/auth/google` | OAuth start with safe return path |

## Accounts and community access

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/v2/accounts` | list/create owned accounts |
| GET/PATCH/DELETE | `/api/v2/accounts/:id` | account detail/update/delete |
| POST | `/api/v2/accounts/:id/test` | connection readiness test |
| POST | `/api/v2/accounts/:id/sync` | request/update account state |
| POST | `/api/v2/accounts/:id/disconnect` | disconnect account |
| PATCH | `/api/v2/accounts/:id/community` | publish/unpublish a Culture Lead |
| GET | `/api/v2/community/leads` | owned, shared, and community leads |
| POST/DELETE | `/api/v2/account-shares[/:id]` | grant/revoke account copy access |

Broker credentials are encrypted at rest and never returned by account APIs.

## Copier rules and trades

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/v2/copier-rules` | list/create Culture Lanes |
| PATCH/DELETE | `/api/v2/copier-rules/:id` | edit/delete by stable route ID |
| POST | `/api/v2/copier-rules/:id/toggle` | pause/resume |
| GET/POST | `/api/v2/trades` | list/manual open |
| POST | `/api/v2/trades/:id/close` | close one ticket on its account |
| POST | `/api/v2/trades/close-all` | account-specific Close All |
| GET | `/api/v2/trades/stats` | summary statistics |

## Signed integration routes

| Method | Route | Authentication |
|---|---|---|
| POST | `/api/public/webhooks/broker-trade` | HMAC-SHA256 using `BROKER_WEBHOOK_SECRET` |
| POST | `/api/public/webhooks/stripe` | Stripe `stripe-signature` |
| POST | `/api/public/cron/sync-accounts` | `Authorization: Bearer <CRON_SECRET>` |
| POST | `/api/public/cron/refresh-market` | cron bearer token |
| POST | `/api/public/cron/close-expired-trials` | cron bearer token |

## Analyzer

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/analyzer/portfolio` | ROI, win rate, drawdown, P/L, equity series |
| GET | `/api/v2/analyzer/heatmap` | symbol P/L heatmap |
| GET | `/api/v2/analyzer/export.csv` | trade export |
| POST | `/api/v2/ai/trade-insight` | rule-based account insight with provider readiness |
| POST | `/api/v2/ai/risk-suggestion` | risk-control suggestion |
| POST | `/api/v2/ai/analyzer-chat` | OpenAI when configured, safe fallback otherwise |

## Billing and affiliate

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/subscription` | current subscription |
| POST | `/api/v2/billing/checkout` | Stripe Checkout session |
| POST | `/api/v2/billing/portal` | Stripe customer portal |
| POST | `/api/v2/subscription/cancel` | cancel at period end |
| POST | `/api/v2/subscription/resume` | resume cancellation |
| GET | `/api/v2/affiliate` | code, conversions, held/available commissions |
| POST | `/api/v2/affiliate/activate` | activation-fee checkout |

## Academy, alerts, support, and push

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/academy/tracks` | tracks and user progress |
| POST | `/api/v2/academy/lessons/:lessonId/complete` | progress, quiz score, badges |
| GET/PATCH/POST | `/api/v2/alerts...` | list/read/read-all |
| POST | `/api/v2/alerts/test-email` | verify Resend integration |
| GET | `/api/v2/push/public-key` | VAPID public key |
| POST/DELETE | `/api/v2/push-subscriptions[/:id]` | browser push registration |
| GET/POST | `/api/v2/support/tickets` | member support tickets |

## Administration

- `/api/v2/admin/stats`
- `/api/v2/admin/users`
- `/api/v2/admin/users/:id/roles`
- `/api/v2/admin/firms`
- `/admin/health`

Administrator and owner checks are enforced server-side.

## V5.2 copier capability routes

### GET `/copier/options`

Authenticated aliases: `/api/copier/options` and `/api/v2/copier/options`.

Returns one Reporter-backed payload containing:

- `accounts`: owned accounts used by Dashboard and account switchers
- `leads`: owned, shared, and community accounts with `canLead=true`
- `receivers`: owned accounts with `canReceive=true`
- `privateDesks`: owned accounts that need an explicit role
- `diagnostics`: missing-role and execution-readiness messages
- `summary`: lead, receiver, live, shared, and community counts

Each account includes `canLead`, `canReceive`, `canExecute`, `isShared`, `isCommunity`, `access`, `capabilities`, and `capabilityWarnings`.

## V5.2 Academy routes

- `GET /api/v2/academy/catalog`
- `GET /api/v2/academy/courses/:courseId`
- `GET|PATCH /api/v2/academy/profile`
- `POST /api/v2/academy/path`
- `GET /api/v2/academy/df-sauce/scenarios/:scenarioId`
- `GET /api/v2/academy/tradingview-config`
- `GET /api/v2/academy/tradingview`
- `POST /api/v2/academy/tutor`
- `GET|DELETE /api/v2/academy/tutor/history`

The Academy does not expose Pine or MQL strategy source.

## V5.4 AI Webinar Room

### Member routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/webinar-ai/config` | webinar capabilities, templates, and published strategies |
| GET | `/api/v2/webinar-ai/library` | current member's saved webinar sessions |
| POST | `/api/v2/webinar-ai/generate` | generate an on-demand narrated lesson |
| GET | `/api/v2/webinar-ai/sessions/:sessionId` | reopen one owned session |
| PATCH | `/api/v2/webinar-ai/sessions/:sessionId/progress` | save scene and completion progress |
| POST | `/api/v2/webinar-ai/sessions/:sessionId/quiz` | grade the webinar knowledge check |
| POST | `/api/v2/webinar-ai/sessions/:sessionId/questions` | ask a lesson-scoped follow-up question |
| POST | `/api/v2/webinar-ai/sessions/:sessionId/render-video` | request optional external MP4 rendering |

Member webinar payloads omit quiz answer indices. A requested strategy must exist in published status.

### Strategy Studio admin routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v2/admin/webinar-ai/strategies` | all strategy drafts and version history |
| POST | `/api/v2/admin/webinar-ai/strategies` | create a private strategy draft |
| PATCH | `/api/v2/admin/webinar-ai/strategies/:strategyId` | update structured teaching knowledge |
| POST | `/api/v2/admin/webinar-ai/strategies/:strategyId/publish` | validate, snapshot, and publish a version |

Editing a published strategy automatically moves it back to review. The edited knowledge is unavailable to members until republished.

### Optional external-video callback

`POST /api/public/webhooks/ai-webinar-video` requires `x-wisdo-video-secret` matching `WISDO_AI_VIDEO_WEBHOOK_SECRET`. The route fails closed when no secret is configured.
