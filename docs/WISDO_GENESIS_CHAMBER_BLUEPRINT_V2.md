# WISDO Genesis Chamber — Blueprint II

## Mission
Genesis Chamber is the spatial design environment between an idea and a permanent WISDO world. The creator remains the architect; WISDO makes the idea visible, tests dependencies, and compiles only approved structural designs.

## Experience loop
Void -> Idea Cloud -> Holographic Planet -> God View -> Inside View -> Simulation -> Civilization/Technology/Crafting/Space Design -> Audit -> Preview -> Approval -> Genesis Forge -> Spawn in World.

## Idea Cloud
Capture concepts before geometry. Each concept is a semantic node with intent, relationships, constraints and confidence. WISDO clusters nodes into vision, environment, gameplay, civilization, progression, social, space and experience. The creator can merge, delete, pin, branch and ask WISDO to visualize the current interpretation.

## Spatial blueprint scales
planet -> continent -> region -> city -> district -> street -> building -> room -> object.
Commands inherit current spatial context. The same phrase may create different operations at different scales.

## God View + design lenses
Creators paint terrain and zones while rotating/scaling the holographic world. Lenses: geography, climate, resources, civilization, population, economy, energy, transport, crafting, technology, gameplay, NPCs, social, space, performance and security. Blueprint layers can be isolated without mutating the canonical design.

## Inside View
Creators can enter a translucent blueprint at player scale. Ghost buildings, NPC proxies, traffic paths, underground infrastructure and interaction volumes allow spatial inspection before permanent generation.

## Citizen Simulation
A creator can temporarily enter the blueprint as a new player with admin knowledge hidden. Headless agents test navigation, traffic, combat, population, resource availability, power, economy and progression. Simulation results are observations, not automatic design decisions.

## Time Machine + scenario branches
Run snapshots at configurable simulated years. Scenario changes create branches rather than overwriting the primary blueprint. A dependency graph explains downstream effects such as resource scarcity delaying construction or research.

## Technology constellation
Research nodes are spatial objects with prerequisites, unlocks, costs and eras. Moving a node causes dependency validation. Telescopes, observatories, radio, computing, navigation, rockets, satellites, ships and gates can form a creator-defined space progression.

## Crafting Laboratory + inventions
Recipes use semantic components and approved capabilities. Creators can prototype combinations in a holographic sandbox and save valid configurations as WISDO Blueprints. AI configures approved components; it does not generate arbitrary executable game code.

## Space Blueprint
Design moons, stations, asteroid belts, resource bodies, launch requirements, communication ranges and local travel. Galaxy Blueprint controls relationships to external user worlds but never edits another owner's planet.

## Discovery Fog + First Contact
Undiscovered user worlds can appear as anonymous celestial signals according to privacy/discovery rules. Technology may reveal additional public metadata. Owners remain authoritative over discoverability and landing permission. Invitations can grant direct authorized social transit regardless of civilization progression.

## Collaboration
Invite collaborators into the Blueprint Chamber with roles: Owner, Architect, Environment, Gameplay, Civilization, Technology, Space, Reviewer. Spatial comments, cursors and proposed revisions are synchronized; only authorized roles may approve structural changes.

## WISDO specialists
One companion identity can expose specialist modes: Architect, Engineer, Designer, Simulator, Economist and Navigator. Specialists surface factual dependency conflicts and alternatives; the creator chooses.

## Constitution + Genesis Lock
Foundational rules include ownership, building rights, imports, resource rights, combat, death/respawn, trading, visitors, destruction, privacy, AI authority and moderation. High-impact post-launch changes require a Major World Revision and holographic preview.

## Engineering diagnostics
Readiness is not a subjective quality score. Diagnostics report unresolved dependencies, resource coverage, spawn-path completion, travel dependencies, permission conflicts and device performance budgets.

## Genesis Preview
Before a full forge, compile a representative playable region containing spawn, a settlement, representative crafting/progression, NPC proxies and space/discovery rules.

## Forge ceremony
Stages: seed, planet, terrain, oceans, climate, biomes, resources, civilization, infrastructure, cities, buildings, crafting, technology, NPC systems, gameplay, space, social, travel, WISDO, optimization, activation. The renderer visualizes these phases as the hologram becomes physical.

## Protocol additions
Blueprint-only operations: IDEA_ADD, IDEA_LINK, SET_FOCUS, SET_LENS, SET_LAYER_VISIBILITY, PAINT_ZONE, PROPOSE_STRUCTURE, CREATE_SCENARIO_BRANCH, RUN_SIMULATION, SET_TECH_NODE, SET_RECIPE, SET_SPACE_BODY, SET_DISCOVERY_RULE, ADD_SPATIAL_COMMENT, REQUEST_PREVIEW, APPROVE_GENESIS.
Permanent WOP operations remain separate and are emitted only after approval.

## Server/runtime responsibilities
Blueprint Service stores intent and revisions. Blueprint Graph resolves relationships/dependencies. Simulation Harness runs noncanonical scenarios. Preview Compiler emits disposable representative worlds. World Compiler emits approved WOP. World Forge creates World DNA. Headless Simulator evolves deployed civilization state. Planet Instance hosts active players. Universe Transit handles authorized cross-server travel. Babylon/WebGPU and future Unreal adapters render the same canonical protocols.
