# WISDO World Smart Home Client

`world-v2.js` is the Smart Home-first launcher. Authenticated users default to `scene=home`; guests default to WISDO Central.

`home3d.js` renders the private starter residence and consumes only normalized state supplied by `/api/world/state`.

`world-data-runtime.js` polls the normalized World state at a controlled cadence and emits semantic World events instead of coupling rooms directly to backend APIs.

`home.css` provides the low-power/WebGL fallback. The fallback remains the same private residence concept and real account context, not a separate product.

The existing `world3d.js` remains the WISDO Central renderer.
