# WISDO Culture Lane OS v6.2.0

## Culture Identity and Presence foundation
- Editable, unique Culture ID with validation, reserved names, ownership index, and identity history.
- Permanent eight-digit Culture Number derived from the stable member identity.
- Editable display name, title, and preferred greeting.
- Separate Experience Rank and Access Rank so earned reputation is never replaced by a purchase.
- Paid Access Rank upgrades can bypass product gates while Experience Rank remains earned.
- Product entitlement map for Wisdo modes, Advanced Presence, Culture Band, Culture Dock, and holographic eligibility.
- Wisdo operating modes: Focus, Teach, Build, Harvest, Mission, and Legacy.
- Teach Mode session foundation with topic, account, lesson goal, and progress state.
- Member-facing `/app/presence` page and JSON APIs.
- Square checkout integration path for access upgrades. It reports configuration requirements instead of claiming payment is active when credentials are absent.

## Important billing completion step
The checkout route creates a signed Square payment link using the existing PaymentService. Production webhook fulfillment for `culture_access_upgrade` must call the admin-safe grant flow after a verified completed payment. Manual/admin grants are available through `POST /api/admin/access/grant`.
