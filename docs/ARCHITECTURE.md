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
| `crowds/Crowd.ts` | Residents: roles, routing, avoidance, vehicle/horn reactions, stuck recovery, speech bubbles. |
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

`STATIC 1 · PROP 2 · VEHICLE 4 · RESIDENT 8 · PLAYER 16`. Vehicles do not physically collide with residents;
residents dodge (scripted) and are pushed clear on contact, so no one is flung across the bazaar.
The player's controller shape-casts against everything, including residents.
