# WISDO live placeholder audit

Repository target: V16 Placeholder Truth cleanup.

This audit distinguishes three things:

1. **Live** — a real authenticated/server path exists and success is based on a real dependency response.
2. **Fail closed** — the capability depends on an external provider, credential, GPU host, browser feature, or device. WISDO reports the missing dependency and does not invent success.
3. **Removed from product UI** — no execution backend exists, so the product does not show a disabled "soon" control or imply the feature is active.

## V16 corrections

| Surface | Previous problem | V16 disposition |
| --- | --- | --- |
| Aether Lobby PARTY / LOCKER / SHOP | Disabled "SOON" buttons with no backend | Removed from product navigation. Lobby now exposes only live destinations. |
| Studio creation library | Audio/video/music requests could be written to local history before provider acceptance | A creation is recorded only after a real service accepts it or a real builder opens. Failed requests are not saved as creations. |
| Workspace visual atmosphere | Browser dispatched a provider-adapter event and returned a synthetic pending result | Calls the real video route. 4xx/5xx stays failed; accepted jobs/results preserve the real response. |
| Analyzer AI chat | Missing provider returned `ok:true` with `rule_fallback` canned copy | Removed. Missing AI config returns 503; upstream failure returns 502; empty provider responses fail. |
| Living OS automations | Stored definitions could be marked enabled although no executor consumed them | Definitions remain disabled with `executionState=definition_only`. Attempts to enable return 409. Product navigation no longer presents them as active automation. |
| Living OS devices | Manually entered metadata was labeled `paired` with a fake sync timestamp | Manual records are `registered`, have no heartbeat/sync claim, and Device Registry copy explains the distinction. |
| Bot file scanner | Admin-created bot files used `pending_hook` / `pending_scan` despite no scanner integration | Files are explicitly `blocked_unscanned`, `trusted:false`; activation trust is not implied. |
| Member Education | Hard-coded 76% ring, fabricated module progress bars, and "future AI layer" copy | Fabricated progress removed. Only real modules/navigation and current WISDO education entry are shown. |
| Music bubble | UI said provider was ready before a request | Starts as provider-unverified/idle; real request decides readiness. |

## Honest fail-closed integrations

These are **not placeholders** and must stay unavailable until their real dependency exists:

| Capability | Required live dependency |
| --- | --- |
| Unreal / Pixel Streaming entry | Certified Unreal package, GPU stream host, allocator and stream origin |
| ElevenLabs music / long audio | Valid provider credential and enabled model/account access |
| ComfyUI cinematic video | Reachable private `WISDO_COMFYUI_URL`, generation workflow and output retrieval |
| Square checkout/subscriptions | Access token, location, plan variations, public URL and signed webhook |
| Web Push | VAPID keys, browser permission and registered subscription |
| Non-Coinbase historical symbols | Twelve Data entitlement or WISDO market-data bridge |
| Cross-instance world realtime | Shared Redis/fabric configuration when multi-instance consistency is required |
| cTrader | OAuth client credentials and valid callback configuration |
| Browser speech/camera/WebGL | Supported browser/device permission/hardware |

For all of these, the correct behavior is a specific unavailable/configuration state. WISDO must not substitute fake media, fake candles, fake payments, fake online users, fake device connections, or fake trading execution.

## Regression rule

`npm run audit:stubs` now also catches product-code regressions such as:

- `not live yet`
- `rule_fallback`
- `pending_hook`
- provider-adapter placeholder events/copy
- "adapter still needs" fake integration language

V16 tests additionally enforce the Aether, Studio, Living OS, scanner, AI-provider and education truth rules.
