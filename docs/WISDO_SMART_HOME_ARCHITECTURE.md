# WISDO Smart Home Architecture

WISDO World is a presentation and interaction layer over the existing WISDO platform. It does not become the owner of trading truth, account authorization, or trade execution.

## Product center

Authenticated members spawn in a private Smart Home by default. The home is their spatial WISDO operating system. WISDO Central remains the public/shared city layer.

```
WISDO DATA
  -> WISDO SERVICES
  -> WorldDataAdapterService
  -> normalized World state
  -> World event bus
  -> Smart Home / WISDO Central scenes
```

## Authoritative financial state

Balance, equity, floating P/L, positions, Reporter status, and linked-account state are read from the established MT4/Reporter services. The World does not persist copies of those values as home state.

The World persists only semantic World choices such as avatar identity, home template, room unlocks, privacy mode, cosmetics, selected trophies, and home preferences.

## Safety boundary

The World client has no direct MT4 credentials or secret material. `executionFromWorldEnabled` remains false. Account selection delegates to the existing authorized account-selection service. Real trading controls remain behind existing server permissions and confirmations.

## Smart Home schema

The first home schema is versioned and includes:

- Entry Foyer
- Central Smart Living Hub
- Trading Room
- Reporter / System Room
- Performance Room
- Account Vault
- Growth Room
- Trophy Room
- Identity / Wardrobe

The default home is `operator-house-v1`, tier `starter_residence`.

## Runtime data

`WorldDataAdapterService` normalizes authorized data into:

- `accounts`
- `activeAccount`
- `financial`
- `positions`
- `history`
- `reporters`
- `reporterSummary`
- `selectedSymbol`

The browser `WorldEventBus` derives normalized events from changes in that state, including:

- `account.selected`
- `account.updated`
- `financial.updated`
- `position.opened`
- `position.updated`
- `position.closed`
- `reporter.online`
- `reporter.offline`
- `achievement.unlocked`
- `membership.updated`
- `notification.updated`
- `xp.updated`
- `home.updated`

## Scene behavior

Authenticated users enter the private Smart Home unless `?scene=central` is requested. Guests enter WISDO Central preview mode.

The home includes real-data stations for account switching, live positions, Reporter Mesh, performance history, Coach entry, Growth, Fast Mode, and the front-door transition to WISDO Central.

On lower-power devices or without WebGL, the same residence remains available as a functional Smart Home Lite interface rather than degrading into an unrelated dashboard.

## Scaling model

The initial home is client-instantiated from:

```
HOME TEMPLATE
+ USER HOME CONFIG
+ AUTHORIZED LIVE WISDO DATA
= ACTIVE PRIVATE HOME INSTANCE
```

This keeps private residences instance-based and avoids permanently running one server-side world process per member. Future public districts can use independent shards/instances without changing the home data contract.
