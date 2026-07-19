# Wisdo AI Everywhere

## Purpose

Wisdo AI is a page-aware assistant layer across the member portal. It explains pages, routes users to the right workflow, supports education, interprets simulator and Signal Grid behavior, summarizes risk context, and helps admins review operational next steps.

Wisdo AI is educational only. Trading involves risk. Results are not guaranteed. Nothing here is financial advice.

## Global UI

Every page rendered through `htmlShell` receives the floating Wisdo AI dock. The dock sends the current page context and prompt to:

- `POST /api/wisdo/ai/ask`

The dedicated AI center is available at:

- `/member/ai`

## API Endpoints

- `GET /api/wisdo/ai/context`
- `POST /api/wisdo/ai/ask`
- `POST /api/wisdo/ai/explain`
- `GET /api/wisdo/ai/insights`

## AI Modes

- General
- Command Center
- Academy
- Bot Education
- Simulator
- Signal Grid
- Risk
- Marketplace
- Admin
- Support

## Provider Behavior

If `OPENAI_API_KEY` or `WISDO_AI_API_KEY` is configured, Wisdo calls an OpenAI-compatible chat endpoint.

If no provider key is configured, or `WISDO_AI_DISABLE_PROVIDER=true`, Wisdo returns deterministic fallback coaching so the portal stays useful in dev and production.

Every provider answer is post-processed with the Wisdo risk disclaimer.

## Persistence

AI interactions are stored in:

- `aiCoachLogsByUserId`
- `aiInsightsById` reserved for future generated insights

The logs keep prompt previews, provider/model, answer preview, mode, page, and timestamp.

## Safety Rules

Wisdo AI should:

- explain, summarize, and coach
- recommend education, simulator, paper mode, and risk controls
- avoid guaranteed-profit language
- avoid financial advice
- refuse to bypass safety gates
- route users to human/admin review when data is missing or risky

## Next Upgrades

- Add per-module AI buttons for simulator cards, academy lessons, Signal Grid cells, and marketplace bot detail.
- Add admin AI weekly digest generation.
- Add AI-generated support ticket summaries.
- Add optional vector/search grounding over academy docs and bot manuals.
