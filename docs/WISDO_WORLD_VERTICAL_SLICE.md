# Smart Home Vertical Slice

This branch proves the architecture of WISDO as a persistent world rather than a city launcher.

Implemented in this slice:

1. Existing WISDO authentication remains authoritative.
2. Every authenticated World member is initialized with a persistent versioned World Profile and private starter residence.
3. Authenticated members spawn at home by default; guests remain in Central preview.
4. The home reads real authorized MT4/Reporter state through `WorldDataAdapterService`.
5. Balance, equity, floating P/L, daily closed P/L, open positions, account identity, Reporter presence, and snapshot history are represented in the residence without persisting duplicate financial truth.
6. Account switching delegates to the existing authorized account-selection service.
7. The Trading Room is read-only for execution. Real trading controls remain in established WISDO control surfaces and retain their confirmation requirements.
8. The private 3D residence contains functional Account Vault, Trading Room, Reporter Room, Performance Room, Coach, Growth Room, Fast Mode terminal, and front-door transition to WISDO Central.
9. The World event bus emits normalized account, financial, position, Reporter, membership, XP, achievement, notification, and home-change events.
10. Mobile/low-power fallback remains a functional Smart Home using the same account and residence state.
11. WISDO Central remains the existing third-person city scene and can be entered without disconnecting identity/platform state.
12. Automated tests verify the live-data adapter, existing authorization delegation, home-first catalog contract, and the no-execution boundary.

Not falsely claimed as complete in this slice:

- true shared multiplayer presence/shards
- friend home visits
- voice execution of trading commands
- a dedicated tick/candle market-data service for a full 3D price chart
- vehicles or public transit
- creator storefront interiors
- full apartment/penthouse/estate upgrade catalog

Those systems can be added on top of the same World Profile, Home schema, World Data Adapter, and event architecture.
