# WISDO V5.4.0 — AI Webinar Room + Strategy Studio

## Purpose

This release turns the Academy webinar surface into an actual on-demand teaching system. It does not require scheduled webinars or a human host.

## Member experience

- Open **AI Webinar Room** from `/app/education`.
- Enter a question, topic, experience level, lesson length, and optional published strategy.
- WISDO creates an interactive AI-video lesson with narrated scenes, visual lesson boards, examples, risk guidance, summary, and quiz.
- Members can pause, replay, move between scenes, save progress, reopen past webinars, complete a graded knowledge check, and ask contextual follow-up questions.
- Browser narration works immediately through the Web Speech API.
- OpenAI enhances generation when configured; the built-in adaptive generator remains available when it is not.

## Admin experience

The **Strategy Studio** is visible only to authorized admins.

Admins can create and maintain structured knowledge for:

- market conditions
- entry and confirmation rules
- exit and invalidation rules
- risk controls
- common mistakes
- examples and FAQs
- source notes and required disclaimers

A strategy cannot be taught until an admin publishes it. Publishing requires a summary, at least three teaching rules, and at least one invalidation rule. Published versions are snapshotted. Editing published knowledge returns it to review until it is published again.

## Optional MP4 rendering

The interactive narrated lesson is the primary experience. An external MP4 renderer can be attached with:

```env
WISDO_AI_VIDEO_PROVIDER_URL=
WISDO_AI_VIDEO_PROVIDER_KEY=
WISDO_AI_VIDEO_WEBHOOK_SECRET=
```

The provider receives the lesson scenes and callback information. The webhook requires the configured secret.

## API additions

- `GET /api/v2/webinar-ai/config`
- `GET /api/v2/webinar-ai/library`
- `POST /api/v2/webinar-ai/generate`
- `GET /api/v2/webinar-ai/sessions/:sessionId`
- `PATCH /api/v2/webinar-ai/sessions/:sessionId/progress`
- `POST /api/v2/webinar-ai/sessions/:sessionId/quiz`
- `POST /api/v2/webinar-ai/sessions/:sessionId/questions`
- `POST /api/v2/webinar-ai/sessions/:sessionId/render-video`
- `POST /api/public/webhooks/ai-webinar-video`
- `GET /api/v2/admin/webinar-ai/strategies`
- `POST /api/v2/admin/webinar-ai/strategies`
- `PATCH /api/v2/admin/webinar-ai/strategies/:strategyId`
- `POST /api/v2/admin/webinar-ai/strategies/:strategyId/publish`

## Safety and privacy

- Only published strategy knowledge is available to member generation.
- Unpublished or edited knowledge is blocked.
- Prompts prohibit profit guarantees, personalized live trade commands, invented strategy rules, and protected-source disclosure.
- Member session payloads omit quiz answer indices.
- External-video webhooks fail closed when no secret is configured.

## Validation

`npm run check` validates all JavaScript files, required assets, protected-source boundaries, and the complete regression suite.
