# WISDO World V1–V5 integration status

This branch consolidates repository code for V2 spatial planning, V3 semantic theme/road metadata, V4 coordinate adapters and golden camera anchors, and V5 guarded session APIs and web entry. V1 Unreal scaffold and validation instrumentation were already merged in PRs #91 and #92. **Code integration is not runtime certification.**

| Gate | Status | Evidence needed |
| --- | --- | --- |
| Node contract suite and build check | PASS | 482 local tests, build check. |
| Secret audit | PASS | `npm run audit:secrets`. No credentials or environment files are committed. |
| Aurelia Prime Babylon rendering | PENDING | Desktop and portrait screenshots, operation health output, visual review. |
| UE 5.8 compile and editor boot | PENDING | Full engine build/runtime logs from a UE 5.8 machine. |
| Unreal actors, gameplay and portal | PENDING | Operation counts, transforms, movement/collision/overlap evidence. |
| Babylon–Unreal parity | PENDING | Paired captures from the six golden camera anchors. |
| Local Pixel Streaming | NOT STARTED | Packaged UE app, signaling server, browser video/audio/input/reconnect proof. |
| GPU allocator and live World Sessions | NOT STARTED | Trusted allocator deployment and persistent session coordination. The checked-in adapter is disabled without configuration. |
| Mobile stream controls | PENDING | The page has a responsive control shell; a Pixel Streaming frontend must consume the `wisdo:world-input` messages. This has not been tested against a stream. |

`POST /api/worlds/:worldId/enter` checks the signed-in owner and approved forged world. With no trusted GPU allocator and stream origin configured, it returns `gpu_session_unavailable`. An allocator must receive a server-issued session ID and short-lived launch token, launch the correct world version, fetch `/internal/world-sessions/:sessionId/manifest` with that token, report lifecycle/ready steps, and return a stream URL under the configured HTTPS origin. The browser never chooses the manifest or sees the runtime token. `GET /api/world-sessions/:sessionId` is owner-scoped.

The current session coordinator is process-local memory. It must be moved to a shared durable store with atomic transitions before horizontal deployment, and actual GPU allocation, UE manifest fetching, Pixel Streaming frontend signaling, mobile input bridging, and teardown still need host integration. Do not enable public Unreal entry or label V1.1 certified based on this repository merge. The Babylon preview remains the available renderer when hosting is offline.

The active finish-line gate remains visual Forge/Babylon validation as described in `docs/WISDO_WORLD_FINISH_LINE.md`. Complete that, then UE 5.8 certification, then local Pixel Streaming, then GPU sessions.
