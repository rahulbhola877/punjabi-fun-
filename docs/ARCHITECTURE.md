# Punjabi Fun Shun — Feasibility & Architecture

## Feasibility assessment

| Area | Approach | Risk / notes |
|---|---|---|
| Rendering | Babylon.js 9.28 WebGL2, PBR materials, one directional sun + hemispheric sky fill, 4096 shadow map, ACES tone mapping, light bloom, FXAA | Low. Procedural art keeps the bundle small and fully local. |
| Physics | Havok (`@babylonjs/havok` 1.3.14) through Babylon's v2 physics API; WASM bundled by Vite | Low. Scene auto-stepping is disabled; the game owns stepping. |
| Characters | Procedural skinned humanoids (17 bones, 2 influences, lofted limbs with blended joint weights) + procedural animation | Medium: stylised rather than photoreal; avoids external asset dependencies. |
| Vehicles | Dynamic Havok bodies with raycast suspension and an explicitly *assisted* handling model (yaw-rate and lean targets) | Medium: tuning is iterative. Two-wheelers use a lean controller rather than true gyroscopic balance. |
| Crowd | Kinematic residents on a waypoint graph with local avoidance; animated capsules so the player cannot walk through them | Low for 25–40 people. |
| Audio | 100% WebAudio synthesis (no sample files) | Low. Sounds are stylised. |
| Saving | Versioned JSON in `localStorage`, validated + migrated | Low. |
| Helicopter, powers, full district | Planned for Milestones 2–3 | See backlog. |

**Test environment caveat:** the development container has no GPU; Chromium runs WebGL via SwiftShader
(software). Frame rates measured there are far below what a consumer GPU achieves and are reported as such.

## Module map (`src/`)

| Module | Responsibility |
|---|---|
| `app/Game.ts` | Application root: owns the engine, the **only** render loop (`engine.runRenderLoop`) and the **only** simulation clock. Wires every system. |
| `app/FixedClock.ts` | Fixed 60 Hz accumulator, ≤5 steps/frame, returns interpolation alpha; supports time scale (pause/slow-mo). |
| `app/config.ts` | Constants and Havok collision groups. |
| `input/Input.ts` | Logical actions, pointer lock, edge/held state, clears held keys on blur/visibility change. |
| `camera/CameraRig.ts` | Third-person orbit camera; modes for foot / interior / two-wheeler / car (flight reserved); obstruction raycasts; keyboard rotation; sensitivity. |
| `physics/Physics.ts` | Havok init with locally bundled WASM, manual stepping, raycasts, chunked compound static colliders. |
| `render/` | Geometry builder, procedural painterly textures, PBR material library, signage atlas (Gurmukhi + English). |
| `world/` | Layout data (single source of truth), buildings, interiors (dhaba, workshop), street, props, navigation graphs, markers. |
| `characters/` | Humanoid builder, procedural animator, appearances, player controller (Havok `PhysicsCharacterController`). |
| `crowds/Crowd.ts` | Residents: roles (walker, roamer, keeper, seated, chatter, child), per-person walk graphs, avoidance, vehicle/horn reactions, stuck recovery, speech bubbles, runtime spawn/remove, and a `brain` hook that fights and quarrels take over. |
| `crowds/countryFolk.ts` | Countryside population in groups (fields, village, city, highway, deras) spawned near the player and removed when far. |
| `world/region.ts` | The open world as data: roads (axis-aligned rects), canal and bridges, sites, generated city/village buildings, farm plots, road defects, safe spots. |
| `world/country.ts` | Builds the countryside into large culled chunks: ground, roads and markings, potholes/mud, canal, town wall, fields, merged trees, buildings and landmark sites. |
| `combat/Combat.ts` | Melee: player combo, NPC fighter brain (approach, guard, swing, stagger, knock-down, get up), damage and knockback. |
| `combat/Police.ts` | Wanted stars, constables on foot or a police jeep chase, catch → *chai-paani* bribe → stand down. |
| `combat/Jhagde.ts` | Street quarrels (and breaking them up), lafanga gangs, road rage after a bump, the akhada dangal. |
| `traffic/` | `AIDriver` (pure pursuit on lane-offset road-graph paths, turn slowing, braking, unsticking, zig-zag) and `Traffic` (ring spawning around the player, drivers, honkers). |
| `animals/Animals.ts` | Dogs, cats, buffaloes, cows: wander, cross, stand in the road, chase bikes, flee horns; big animals have kinematic collision. |
| `missions/Rides.ts` | Auto-rickshaw passenger rides (sawari). |
| `vehicles/` | Specs (data), models, `Vehicle` physics/controller. |
| `missions/Missions.ts` | Intro sequence, repeatable delivery jobs, scoring, medals, personal bests. |
| `audio/Audio.ts` | Synthesised engines, horns, footsteps, impacts, ambience, stingers. |
| `ui/` | DOM HUD, menus (native buttons, focus trap), dialogue, map renderer. |
| `save/schema.ts` | Versioned save format, validation, migration, storage error reporting. |

## Simulation order (one fixed step)

1. Player capsule: `checkSupport` → velocity → `integrate` (Havok character controller).
2. Vehicle controls from input → per-vehicle suspension raycasts, drive/brake/grip impulses, assisted yaw/lean.
3. Crowd steering (kinematic) → `setTargetTransform` on resident capsules.
4. `physics.step(dt)` — the single Havok step.
5. Post-step: capture vehicle transforms for interpolation, jolt detection, mission timers.

Rendering then interpolates player and vehicle visuals between the last two steps using the clock's alpha.
Visual meshes are never written back into physics bodies except through explicit teleports
(`setPhysicsBodyTransformation`) for recovery.

## Collision groups

`STATIC 1 · PROP 2 · VEHICLE 4 · RESIDENT 8 · PLAYER 16 · ANIMAL 64` (buffaloes/cows block vehicles and the player but are ignored by suspension rays). Vehicles do not physically collide with residents;
residents dodge (scripted) and are pushed clear on contact, so no one is flung across the bazaar.
The player's controller shape-casts against everything, including residents.

## Open world: keeping 1.4 km cheap

- **Chunked, culled scenery.** The countryside is batched per material into 160 m chunks; each chunk mesh gets a
  null LOD level at 460 m (300 m on phones) so fog-hidden geometry is skipped. Trees are low-poly templates merged
  into those chunks (thin instances were tried and did not draw in this Babylon deep-import build).
- **Shadows follow the player.** The single shadow map uses a fixed 110–130 m frustum centred on the player, and only
  scenery chunks whose bounds come within it are in the caster list (refreshed every 12 m of movement).
- **People and traffic only near the player.** Countryside folk are spawned per group within ~220–290 m; traffic is
  kept at 9 vehicles (5 on phones) spawned 90–240 m away, behind the camera when possible, and removed beyond 330 m;
  animals the same within 170/230 m. Far residents skip animation and rendering.
- **One road graph.** `buildRoadGraph` joins the bazaar centreline to the country road network (a node at every
  junction and every ≤40 m), used for traffic, police routing, delivery par times and the gold route line.
