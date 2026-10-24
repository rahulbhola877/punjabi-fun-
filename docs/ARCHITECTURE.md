# Gedi Route: architecture

Babylon.js 9 (WebGL2, optional WebGPU), Havok physics, TypeScript, Vite. The game ships as a static site and as an Android build (Capacitor). Updated 2026-10-24 for V2.

## Stack

| Area | Approach |
|---|---|
| Rendering | Babylon PBR materials, one sun and a hemispheric fill, ACES tone mapping, optional SSAO, bloom and FXAA. Four quality presets in `app/quality.ts` (Low, Medium, High, Ultra) |
| Physics | Havok through Babylon's v2 API. Scene auto-stepping is off: the game owns the fixed 60 Hz step |
| People | The **kit** (`src/kit`, a vendored body and face builder, `@ts-nocheck` in three files) for the player and the nearest 10 to 28 people; the older `HumanBuilder` bodies for drivers, riders, passengers and far folk |
| Vehicles | Dynamic Havok bodies with raycast suspension and an assisted handling model |
| Audio | WebAudio synthesis for engines, horns, steps, ambience and a mumble; recorded voice clips (`public/audio/voice`) chosen through the voice map |
| Saving | Versioned JSON in `localStorage` (`save/schema.ts`), validated and migrated |

The dev container has no GPU: headless Chromium uses SwiftShader. Triangle and draw counts measured there are real; frame rates are not.

## Module map (`src/`)

| Module | Responsibility |
|---|---|
| `app/Game.ts` | Application root. Owns the engine, the only render loop and the only simulation clock, and wires every system. `app/config.ts` holds constants, collision groups, `FREE_PLAY` and `DEV_TOOLS` (`?probe`) |
| `app/quality.ts`, `app/engine.ts` | Quality presets, frame cap, renderer choice |
| `input/`, `camera/` | Logical actions and rebinding; the third-person rig with hold shots for the home |
| `physics/` | Havok setup, raycasts, chunked static colliders |
| `render/` | Geometry builder, procedural textures, material library, signage atlas (Gurmukhi and English) |
| `world/layout.ts`, `region.ts` | The map as data: buildings, points of interest, roads, sites, zones |
| `world/country.ts`, `colonies.ts`, `houseBuilder.ts` | Builds the countryside, the colonies and the facades into culled chunks |
| `world/home.ts`, `openHouses.ts`, `interiors.ts` | The family home, the walk-in kothis, their plots and interiors |
| `world/DayNight.ts`, `Weather.ts` | Sun, sky, lamps, rain, floods |
| `world/nav.ts`, `busRoutes.ts` | Road graph and bus routes |
| `characters/` | Player controller, animators, appearances, the kit wrapper (`KitHuman`, `KitAnimator`) |
| `crowds/Crowd.ts` | Residents: roles, walk graphs, avoidance, bubbles, plot guard (`keepOut`, `streetFree`), the `brain` hook |
| `crowds/` (others) | `countryFolk` (groups near the player), `Barkers` (greetings, street calls), `Gossip`, `Morning`, `Processions`, `kites`, `umbrellas` |
| `combat/` | `Combat` (melee), `Police` (stars, chase, bribe), `Posts` (nakas and chowkis), `Jhagde` (quarrels, gangs, road rage, crashes, dangal) |
| `traffic/` | `AIDriver`, `Traffic` (ring spawning), `Buses` and `busPlan` |
| `animals/` | Dogs, cats, buffaloes, cows |
| `missions/` | `Missions` (the first job and delivery jobs), `Home` and `HomeTv` (family life), `Rides` (auto sawari), `Shops`, `Travel` (the stand), `Places` |
| `audio/` | `Audio` (synthesis and playback), `VoiceDirector` + `voiceMap.json` (who says what, when) |
| `ui/` | DOM HUD, menus, dialogue, map renderer, touch controls |
| `save/` | Save schema and migration |

## Rules that hold the systems together

- **One line, one voice.** Any line that has a recording goes through `Game.speak`, which shows the words of the take that plays. `crowd.say` is for lines with no recording. The voice map (`tools/voice_map.py` makes `voiceMap.json` and `docs/voice-map.xlsx`) says who may say what and when.
- **Plots are walls for street events.** Open houses carry a plot rectangle; spawns and street events avoid it (`openPlotAt`, `streetFree`), and `Crowd.keepOut` moves intruders out.
- **Test tools hide behind `?probe`.** The T menu and the `window.__pfs` read-only API exist only with it.
- **Deploy** by fast-forwarding `main` from `first-mission`.

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
