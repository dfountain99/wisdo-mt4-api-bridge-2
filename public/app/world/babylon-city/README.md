# WISDO Babylon Full City V1

Browser-native Babylon.js full-city presentation layer integrated into WISDO Culture Lane OS v7.1.0.

## Production URL
`/app/world/babylon-city/`

## Scope
This is the full-city foundation, not a one-block proof. The world contains Central Plaza, WISDO Tower, Academy, Master Chamber, Trading Hall, Bot Vault, Market District, Creator Row, residential/social district, parks, road network, traffic, pedestrians, skyline, player controller, interactions, world-state reactions, quality scaling, district streaming hooks and WISDO API hydration.

## Asset upgrade pipeline
Procedural geometry is deliberately isolated behind constructors so GLB assets from Blender/MPFB/MakeHuman/Mixamo/Poly Haven can replace individual buildings, characters, vehicles and props without changing gameplay or WISDO API wiring.

## Controls
WASD/arrow keys move, Shift runs, mouse/touch rotates camera, E interacts, M toggles aerial map.

## WISDO integration
The client probes existing authenticated account/dashboard endpoints without issuing trade commands. Trading authority remains server-side. World visuals react only to returned state.

## Safety/performance
The city uses thin/regular instances where practical, frozen world matrices for static geometry, distance-based NPC/vehicle updates, hardware scaling, quality tiers, capped shadows, and no client-side authority for MT4 execution.
