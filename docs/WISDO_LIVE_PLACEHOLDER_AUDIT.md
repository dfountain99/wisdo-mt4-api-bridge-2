# WISDO live placeholder audit

Repository snapshot: `main` after PR #106 (`6bfef316`). This is a code and Blueprint audit, not a claim that every deployed Render environment has the required credentials or that WebGL and external providers were exercised. The Blueprint declares a production Node service and a separate static `wisdo-world-lab` service. Service deployment settings and secrets are external to Git.

## Product-facing inventory

| Surface | Finding | Current disposition | Live completion gate |
| --- | --- | --- | --- |
| `/app/kernel-control/` | Send button only printed “Command captured.” | Fixed in this branch: preview via authenticated `/api/kernel/v1/intents`, explicit confirmation before dispatch, real response/credential errors. | Test with an enrolled device and supported component; verify execution receipt. |
| Aether Lobby | PLAY button, second portal, and cards were inert pointer-only controls; “ONLINE” was unconditional. | Fixed in this branch: semantic links to existing experiences/Genesis and `/api/world/me` session status. | Browser check signed-in and signed-out navigation. |
| Aether Lobby PARTY/LOCKER/SHOP | Disabled “SOON” controls. | BLOCKED: there is no friend match/party, locker, or shop workflow behind these controls. Keep disabled. | Implement authorization, persistence, UI and tests for each. |
| Street Sprint | Solo local race; no friend session, verified result, or wallet payout. | PARTIAL: PR #107 holds the City Circuit work in draft; the production branch remains solo. | Exact-SHA visual play, authoritative multiplayer result, server-side reward idempotency. |
| Other Aether quick games | Canvas target/quick games are local experiences. | PARTIAL, honestly labeled as local games. | Game-specific server match and result validation before social/rewards claims. |
| Forge / personal world | Blueprint and manifest routes exist; UE and parity remain unverified. | PARTIAL. | Golden fixture browser evidence, UE 5.8 build/gameplay, renderer parity. |
| Enter Unreal World | `WorldSessionService` returns `gpu_session_unavailable` without allocator and stream origin. | BLOCKED by GPU host/Pixel Streaming; fail closed is correct. | Certified package, stream host, allocator, local then remote playthrough. |
| Automation Studio | Rules are stored; page says execution adapters can connect later. | PARTIAL. Do not imply enabled means actions execute. | Event consumers, per-action authorization, receipts, retry and trading safety tests. |
| Kernel Intelligence Workspace | Uses real device API, but command dispatch needs enrolled device and live component. | CONDITIONAL. | Enrolled device, component heartbeat, authenticated receipt. |
| Avatar scan | Camera scan has manual confirmation fallback and a saved configuration route. | CONDITIONAL; no claim of photoreal face replication. | Camera/browser QA and approved-asset review. |

## External/provider gates

| Capability | Code evidence | Why it is not globally “live” from a merge |
| --- | --- | --- |
| Music and long audio | `/api/wisdo/media/*` returns `WISDO_MUSIC_NOT_CONFIGURED` / `WISDO_AUDIO_NOT_CONFIGURED` when ElevenLabs configuration is missing. | Provider credentials, voice settings and a real output playthrough are deployment-specific. |
| Video generation | ComfyUI route returns `WISDO_COMFYUI_NOT_CONFIGURED`; external MP4 renderer also has explicit 503. | Needs provider/render host, job polling, storage and playback evidence. |
| Checkout and subscriptions | Square routes return 503 without access token, location and webhook configuration. | Requires configured Square account and real sandbox webhook/checkout validation. |
| Web push | VAPID routes return 503 when keys are absent. | Requires registered push subscription, permission and delivery proof. |
| Historical candles | Market service refuses synthetic candles without Twelve Data or configured market feed. | Provider entitlement and live data source must be verified. |
| Cross-instance realtime | `WorldRealtimeFabric` requires Redis when configured to require it; Blueprint defaults Redis off. | Multi-instance presence/matches need shared state and recovery proof. |
| cTrader connection | OAuth route returns 503 when client credentials/redirect are absent. | Broker app credentials and callback validation are external. |

## Merge rule

Do not replace disabled or unavailable states with optimistic text. A capability is live only when the authenticated route succeeds against its real dependency, the user flow has been exercised, and failures are surfaced without fake balances, players, media, trades, or rewards. Provider secrets belong in Render, never in Git. This audit identifies known high-impact placeholders and fail-closed integrations; it is not an exhaustive dynamic review of every deployed service.
