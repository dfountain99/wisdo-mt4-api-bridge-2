# WISDO Open-World Engineering Research Atlas

## Scope and evidence standard

This research atlas studies publicly documented Grand Theft Auto V / Rockstar open-world design and engineering principles, then converts those principles into original WISDO implementation decisions.

It does **not** claim access to Rockstar proprietary source code, RAGE internals, private tools, assets, maps, animations, audio, shaders or production documents. Where public sources do not expose an exact implementation, this document labels the conclusion as an engineering inference rather than a Rockstar fact.

The useful question for WISDO is not “how do we copy GTA?” It is:

> What repeatable open-world principles made Los Santos feel like a place instead of a menu, and how can those principles be implemented safely in a browser-based financial world?

---

# Part I — Publicly documented GTA V lessons

## 1. A world to exist in, not a list of jobs

Rockstar leadership has repeatedly described the core value of the series as freedom inside a world that appears to exist around the player, not only when a mission needs it. Aaron Garbut described the attraction as being able to “mess around” in a world that feels broader than a predefined mission path, and said the goal is not simply huge maps full of jobs but a place that feels fully formed and interactive.

**Source:** GamesRadar, retrospective interview with Aaron Garbut: https://www.gamesradar.com/20-years-later-rockstar-reflects-on-how-gta-3-showed-us-the-first-glimpse-of-what-was-possible/

### WISDO translation

WISDO Central cannot remain a menu with walking controls. The city must have useful state even when the player has no immediate task:

- Reporter nodes can be healthy/offline.
- Authorized market billboards can appear or power down.
- verified Signal Events can alter the skyline.
- Coach can surface context.
- buildings can remain discoverable without forcing navigation.
- ambient NPCs may make the city feel occupied, but must never impersonate real users.

The member should be able to walk without starting a mission and still understand that WISDO is operating around them.

## 2. Open-world freedom + missions + online coexist

Rockstar’s original GTA V announcement explicitly framed the game around open-world freedom, storytelling, mission-based gameplay and online multiplayer rather than treating those as mutually exclusive modes.

**Source:** Rockstar Games, GTA V official announcement: https://www.rockstargames.com/newswire/article/o349k552544449/grand-theft-auto-vi-official-announcement.html

### WISDO translation

WISDO requires the same separation of concerns:

- **World freedom:** explore Home/Central/interiors.
- **Missions:** education, onboarding, system-readiness and exploration objectives.
- **Live platform:** real WISDO account/Reporter/market systems.
- **Future multiplayer:** real Operator presence.

No layer should require a separate product or duplicate account state.

## 3. Build a compressed, readable city—not a literal geography

Public discussion of Los Santos highlights that it is inspired by Los Angeles but condensed and reorganized for playability rather than being a one-to-one city reproduction.

**Source:** GamesRadar, “Why Los Santos is Grand Theft Auto's most iconic city”: https://www.gamesradar.com/los-santos-gta-grand-theft-auto-iconic-city/

### WISDO translation

WISDO should not chase map size. A high-quality 200–300 meter Central district with deliberate sightlines is more valuable than kilometers of empty geometry.

Central’s readable axis remains:

`Operator -> Boulevard -> Globe -> Market Installations -> Trading Tower -> Skyline`

District geography should teach platform meaning:

- Commodities / gold around Trading Tower.
- Forex surfaces along a currency corridor.
- Crypto can eventually occupy a distinct digital district.
- Academy belongs near a quieter campus edge.
- Command belongs where infrastructure visibly converges.

Geography becomes information architecture.

## 4. Scalability is a first-class rendering feature

For the PC version, Rockstar North publicly emphasized making the game scalable across a wide range of hardware and exposed more than 25 graphics/performance parameters. Rockstar also described automatic optimization for hardware.

**Source:** GameSpot interview with Rockstar North technology/engineering staff: https://www.gamespot.com/articles/what-new-things-should-you-expect-in-gta-v-pc/1100-6426472/

Rockstar’s PC announcement also documented configurable texture, shader, tessellation, anti-aliasing and population options.

**Source:** Rockstar Games: https://www.rockstargames.com/newswire/article/25o2411812a31k/grand-theft-auto-v-is-now-available-for-pc

### WISDO translation

Web realism must be scalable rather than all-or-nothing.

WISDO quality profiles should control independently:

- DPR
- shadow resolution/distance
- reflection quality
- postprocessing
- skyline density
- ambient NPC count
- animation update distance
- active skinned meshes
- market-chart LOD
- particle density
- material texture resolution
- audio voice count

A touch screen is not a low-end GPU signal. Runtime frame-time measurements should be allowed to lower quality after sustained poor performance.

## 5. Population density is part of world fidelity

Rockstar’s later GTA V releases explicitly increased population and traffic variety/density alongside lighting, vegetation and reflection improvements.

**Sources:**
- Rockstar 2022 enhanced versions: https://www.rockstargames.com/newswire/article/172872k8a375k8/gtav-and-gta-online-coming-march-15-for-playstation-5-and-xbox-series
- Rockstar 2014 new-generation announcement: https://www.rockstargames.com/es/newswire/article/o349k552525a57/Grand-Theft-Auto-V-Coming-this-Fall-to-PlayStation-4-Xbox

### WISDO translation

An empty technically advanced plaza still feels unfinished. WISDO needs layered population:

1. real multiplayer Operators — authoritative presence
2. ambient NPCs — clearly non-player environmental population
3. distant silhouettes / transport — visual ambience only
4. system activity — doors, screens, elevators, market displays

Never use fake online-user counts or make NPCs appear to be real members.

## 6. Fidelity comes from systems working together

Rockstar’s enhanced versions describe improvements to lighting, shadows, reflections, vegetation, traffic/population, loading and audio together. The lesson is that realism does not come from one shader.

### WISDO translation

Central quality requires a stack:

- authored geometry
- human scale
- PBR materials
- coherent lighting
- contact shadows
- reflections/IBL
- atmospheric depth
- animation
- environmental audio
- density
- UI restraint

Adding bloom to procedural cubes cannot close the quality gap alone.

## 7. Audio creates spatial credibility

Rockstar North’s GDC 2014 session “The Sound of Grand Theft Auto V” describes pushing audio technology/processes to support a diverse and immersive open world, including real-time synthesis and DSP.

**Source:** GDC Vault: https://www.gdcvault.com/play/1020587/The-Sound-of-Grand-Theft

Former Rockstar North audio director Matthew Smith later described efforts to capture environmental acoustic character so different spaces feel different.

**Source:** A Sound Effect interview: https://www.asoundeffect.com/the-future-of-game-audio-matthew-smith/

### WISDO translation

Audio should be zoned rather than a global loop:

- Smart Home: quiet HVAC/electronic room tone
- boulevard: city ambience
- Trading Tower lobby: large reflective interior
- Reporter Room: low infrastructure hum
- signal burst: original WISDO event sound
- Academy: quieter educational ambience

Audio is presentation only and never indicates a financial event unless the authoritative event exists.

## 8. The world supports storytelling because systems are persistent

Rockstar’s New York Film Festival presentation explicitly discussed the process of creating a “living, breathing world” alongside interactive storytelling and multiple playable characters.

**Source:** Rockstar Games: https://www.rockstargames.com/it/newswire/article/75o941131k1koo/rockstar-games-to-present-grand-theft-auto-v-at-the-new-york-fil.html

### WISDO translation

WISDO’s story is the member’s accumulated platform history:

- Operator identity
- Home progression
- achievements
- education
- Reporter infrastructure
- campaigns
- strategy history
- world discoveries

Missions should teach systems and create context, while the underlying platform continues operating regardless of mission state.

## 9. Mission systems are reusable building blocks

Modern GTA Online exposes objectives, actor behavior, locations and multi-player mission composition through Mission Creator. Although this is much later than GTA V launch, it demonstrates the value of data-driven reusable objective systems over one-off scripted experiences.

**Source:** Rockstar Games Mission Creator overview (2026): https://www.rockstargames.com/newswire/article/39a3412379o79o/play-thrilling-new-gta-online-experiences-built-by-the-community-with

### WISDO translation

WISDO missions should be data-driven:

`Mission -> ordered/conditional objectives -> event subscriptions -> reward -> persistence`

Examples:

- inspect Trading Room
- check Reporter Mesh
- visit Central
- enter Trading Tower
- inspect a real market
- complete an Academy module
- review a completed campaign

Mission rewards should be World XP, education progress, cosmetics or access—not incentives to trade larger or more frequently.

## 10. Iteration/polish matters as much as architecture

Rockstar publicly delayed GTA V to provide more polish and emphasized the project’s complexity.

**Source:** Rockstar Games release-delay announcement: https://www.rockstargames.com/newswire/article/ak14o88385oo81/grand-theft-auto-v-is-coming-9172013.html

### WISDO translation

A sophisticated backend does not compensate for a visibly prototype world. Core Experience V1 imposes a feature freeze: complete the 15-minute loop before adding vehicles, giant maps or deep economy systems.

---

# Part II — Engineering inferences for browser open worlds

The following are WISDO engineering conclusions, not claims about proprietary Rockstar internals.

## 11. Scene continuity

A player should not experience every interaction as a web navigation. The browser document becomes a game shell and scenes stream inside it.

WISDO scene classes:

- private Home
- Central
- destination interiors
- specialized observatory/command scenes

Only explicit secure/external workflows leave `/app/world`.

## 12. World streaming

A browser cannot keep future districts, detailed interiors and all avatars at maximum fidelity simultaneously.

Use chunks:

- `CentralCore`
- `TradingTowerZone`
- `AcademyZone`
- `MarketZone`
- `CommandZone`
- `SkylineFar`

Load high-detail assets based on scene/distance. Keep distant skyline lightweight and instance repeated meshes.

## 13. LOD hierarchy

Every expensive class should have at least three states:

- **near:** full mesh/material/animation
- **mid:** reduced mesh/material/animation frequency
- **far:** silhouette/impostor/static representation

Apply to avatars, buildings, foliage, market billboards, NPCs and effects.

## 14. Data LOD vs graphics LOD

Financial data update rate and rendering frame rate are different problems.

Examples:

- player camera: 30–60 FPS
- price state: as delivered by authorized feed
- distant billboard texture: throttled refresh
- membership/access state: low-frequency refresh
- achievements: event-driven

Never poll APIs at render-frame frequency.

## 15. Mission/event fabric

World events should be normalized before presentation.

`Server/Event Source -> World Event Bus -> Systems`

One verified bot entry can drive:

- sky signal
- billboard highlight
- Signal Observatory
- Companion HUD
- Coach context

without creating five competing event objects.

## 16. World Director

The Director is presentation orchestration, not financial intelligence.

It can decide:

- which ambient event to show
- which audio zone is active
- which district assets are streamed
- which mission hint appears
- how much NPC ambience is allowed by quality tier

It cannot invent:

- trades
- prices
- signals
- Reporter state
- account state

## 17. Persistent gameplay state

World game state should store:

- discoveries
- completed missions
- tutorial progress
- cosmetic choices
- non-financial World XP

Financial state remains external and authoritative.

## 18. Human animation

The existing WISDO player physics should remain authority. Animation is a visual layer driven by movement state.

Recommended locomotion graph:

`idle <-> walk <-> run <-> sprint`

plus:

- start/stop
- strafe
- backward
- turn in place
- jump start
- fall
- land

Root motion should not silently replace current collision authority.

## 19. Character asset budget

Near/local Operator can use highest supported character LOD. Other players use lower LOD based on distance.

Budget categories:

- skinned mesh count
- bones
- morph targets
- material count
- texture memory
- animation clips

The current external GLB is a transitional asset, not the final WISDO identity standard.

## 20. PBR environment pipeline

Foreground assets should move from procedural primitives to authored modular GLBs.

Priorities:

1. Operator
2. spawn boulevard
3. Trading Tower entrance
4. Globe monument/base
5. roads/curbs/sidewalks
6. street furniture
7. key building façades
8. skyline foreground modules

Distant geometry may remain procedural/instanced where it is visually efficient.

## 21. Lighting architecture

Use one coherent rig rather than adding lights per feature.

Roles:

- environment/IBL
- primary directional blue-hour source
- practical white architectural lights
- gold WISDO identity accents
- cyan system/data lights
- billboard local influence

Do not make every material emissive.

## 22. Reflection architecture

Use inexpensive environment reflections/PMREM for most materials. Reserve costly real-time techniques for limited hero surfaces if proven performant.

Ground wetness should be roughness variation, not a global mirror.

## 23. Contact and grounding

Player visual credibility depends heavily on contact:

- local shadow
- foot placement where feasible
- correct body scale
- believable ground normal/roughness
- nearby light response

A detailed model without grounding still appears pasted into the scene.

## 24. Ambient AI

Start with low-cost state machines:

`idle -> walk path -> pause -> look -> continue`

NPCs must be labelled internally as ambience and not tied to online member count.

Future real player presence uses a separate network system.

## 25. Interior design

Interiors should be modular game scenes, not ordinary web pages embedded as iframes.

Each interior consists of:

- architecture
- destination identity
- physical stations
- interaction prompts
- reusable data displays
- World return path

Precision forms/modals may appear over the 3D scene for complex input, but the player remains inside the World shell.

## 26. Fast Mode coexistence

A mature 3D interface does not force walking for every task.

Fast Mode remains valuable for:

- dense tables
- secure billing
- accessibility
- advanced text editing
- emergency conventional access

The rule is deliberate switching, not accidental ejection.

## 27. Browser navigation strategy

Use history state/query scene identifiers while keeping pathname `/app/world`.

Examples:

- `/app/world?scene=home`
- `/app/world?scene=central`
- `/app/world?scene=trading-tower`
- `/app/world?scene=academy`

Browser Back should change World scene rather than unexpectedly leaving the experience when possible.

## 28. Performance budgets

Each quality tier should define budgets for:

- draw calls
- triangles
- skinned meshes
- shadow casters
- active lights
- render DPR
- billboard update frequency
- NPC count
- texture memory

Diagnostics must be visible in `?debug=1`.

## 29. Mobile-first quality

Modern iPhone Safari is a primary target, not a degraded afterthought.

Core acceptance:

- stable authored Operator or explicit fallback reason
- medium quality not low solely due touch
- useful shadows
- persistent missions/interiors
- readable interaction UI
- adaptive downgrade only after sustained frame pressure

## 30. Failure behavior

A living world must fail clearly.

Examples:

- market feed stale -> display STALE
- Reporter offline -> command disabled
- GLB failure -> fallback + exact diagnostic
- WebGL loss -> Lite Mode/recovery
- server event disconnect -> world remains navigable, live state marked disconnected

Never continue animating stale financial values as if live.

---

# Part III — WISDO Core Experience V1 blueprint

## 31. The 15-minute loop

Target experience:

1. Login.
2. Enter WISDO World.
3. Operator loads.
4. Spawn at Smart Home.
5. Inspect account context.
6. Inspect live positions.
7. Check Reporter Mesh.
8. Open Campaign Command.
9. Exit home.
10. Walk Central.
11. Enter Trading Tower without leaving `/app/world`.
12. Inspect authoritative market/signal state.
13. Visit Academy or another district.
14. Return to Central.
15. Return Home.

This loop is the release gate for larger expansion.

## 32. Core mission set

### First Shift
Teaches Home -> infrastructure -> Command -> Central -> Trading Tower -> Home.

### Market Scout
Teaches Central -> Trading Tower -> World market -> Marketplace.

### Systems Check
Teaches Reporter Mesh -> Command -> Coach.

Missions do not reward financial risk or trade frequency.

## 33. Destination interiors

Each current destination becomes a persistent World scene. Shared interior code creates consistent third-person navigation and physical stations.

The first production interiors prioritize:

- Trading Tower / Signal Observatory
- Academy
- Coach Center
- VPS Forge
- Marketplace

Others may use the same reusable shell until authored architecture replaces it.

## 34. Trading Tower

The Trading Tower is the most important public destination after Central.

First-floor functions:

- Signal Observatory
- Live market terminal
- Campaign Command entry
- World market context

Long-term floors:

- analytics
- strategy labs
- copier operations
- developer floor
- backtesting
- publishing

## 35. Academy

Game missions should connect directly to learning objectives.

Safe progression:

- complete lesson
- inspect concept
- run simulation
- review campaign

Never require live losses/profits for course completion.

## 36. Command

Command remains the physical control plane over existing authorized WISDO command services.

Command actions retain:

- scope
- permission
- proposal
- confirmation
- idempotency
- server revalidation
- Reporter acknowledgement
- receipt

Game missions may teach Command but cannot auto-execute a live command.

## 37. Signal events

Server time remains authoritative. The two-minute window is review context, not an automatic order deadline.

## 38. Market skyline

One visible symbol -> one billboard. Multiple Operators attach to the shared market representation under privacy rules.

The billboard represents authorized WISDO World participation, not the entire global market.

## 39. Multiplayer milestone

After the single-player Core Experience is stable:

- player position
- rotation
- movement state
- avatar config
- presence
- basic emotes

Milestone: two real users stand in Central, see the same verified market event and enter the same destination while maintaining separate private financial permissions.

## 40. Expansion gate

Do not prioritize cars, giant districts, businesses, jobs, full VR or a complex virtual economy until Core Experience V1 meets:

- no accidental exits from World
- stable iPhone session
- real Operator or explicit fallback diagnostics
- one polished Smart Home
- one polished Central
- Trading Tower interior
- Command/Campaign Core
- live market state
- real signal pipeline
- persistent mission loop

---

# Source register

Primary/first-party sources used:

1. Rockstar Games — GTA V Official Announcement
   https://www.rockstargames.com/newswire/article/o349k552544449/grand-theft-auto-vi-official-announcement.html
2. Rockstar Games — GTA V and GTA Online PS5/Xbox Series enhancements
   https://www.rockstargames.com/newswire/article/172872k8a375k8/gtav-and-gta-online-coming-march-15-for-playstation-5-and-xbox-series
3. Rockstar Games — GTA V PC release / graphics configuration / population controls
   https://www.rockstargames.com/newswire/article/25o2411812a31k/grand-theft-auto-v-is-now-available-for-pc
4. Rockstar Games — PS4/Xbox One/PC visual enhancements
   https://www.rockstargames.com/es/newswire/article/o349k552525a57/Grand-Theft-Auto-V-Coming-this-Fall-to-PlayStation-4-Xbox
5. Rockstar Games — NY Film Festival development/storytelling panel
   https://www.rockstargames.com/it/newswire/article/75o941131k1koo/rockstar-games-to-present-grand-theft-auto-v-at-the-new-york-fil.html
6. Rockstar Games — GTA V release delay / polish statement
   https://www.rockstargames.com/newswire/article/ak14o88385oo81/grand-theft-auto-v-is-coming-9172013.html
7. Rockstar Games — Mission Creator overview
   https://www.rockstargames.com/newswire/article/39a3412379o79o/play-thrilling-new-gta-online-experiences-built-by-the-community-with
8. GDC Vault — The Sound of Grand Theft Auto V, Alastair MacGregor, Rockstar North
   https://www.gdcvault.com/play/1020587/The-Sound-of-Grand-Theft
9. Rockstar North — studio disciplines include Animation, Art, Audio, Programming, Game Testing and Mission Scripting
   https://rockstarnorth.com/

Secondary/context sources:

10. GameSpot — GTA V PC interview with Rockstar North technology/engineering staff
    https://www.gamespot.com/articles/what-new-things-should-you-expect-in-gta-v-pc/1100-6426472/
11. GamesRadar — Aaron Garbut retrospective on worlds that exist around the player
    https://www.gamesradar.com/20-years-later-rockstar-reflects-on-how-gta-3-showed-us-the-first-glimpse-of-what-was-possible/
12. GamesRadar — Los Santos city design discussion
    https://www.gamesradar.com/los-santos-gta-grand-theft-auto-iconic-city/
13. A Sound Effect — interview with former Rockstar North audio director Matthew Smith
    https://www.asoundeffect.com/the-future-of-game-audio-matthew-smith/

## Final research rule

The research should continue to grow as WISDO enters authored asset, multiplayer and streaming phases, but no engineering decision should be justified by invented “Rockstar internals.” Publicly documented facts, general real-time engineering practice and WISDO-specific decisions must remain clearly separated.
