# Testing, performance and known issues

## Crowds, Ludhiana, audio and graphics presets (latest)

- `npm test` — 96 tests across 10 files pass, including new coverage for the Ludhiana district (road-graph
  connectivity from the bazaar, drop-off points clear of buildings, pothole density, its population and sellers),
  the street-call rate limiter, and the ordering of the graphics presets.
- `npm run typecheck` clean.
- Headless smoke test (software renderer, `gfx=low`): new game in the bazaar and, via the new debug flag
  `?start=<x>,<z>`, inside Ludhiana. No page errors, no frame errors; 125 residents and 13 traffic vehicles live
  around the player in the city, 5 people within 30 m standing in a bazaar gali.
- Found and fixed during this pass: the first cut of the Ludhiana galis was 6 m wide with shopfronts hard against
  the kerb, which put the chase camera inside a shop wall. Galis are now 9 m with a 3 m footpath either side.
- UI pass verified headless: the first-run graphics picker lists all four presets and applies the chosen one, the
  Gurmukhi logo reads **ਪੰਜਾਬੀ ਫ਼ਨ ਸ਼ਨ** (it previously read "Punjabi Function"), the 🚌 Stand button lists 15
  destinations with fares, and a ₹25 bus ride from the dhaba puts the player down at the Ludhiana Ghanta Ghar
  (−441, −266) with no errors.
- Not measured: real-device thermals. The Low preset's 30 fps cap is the intended fix for phones getting hot and
  should be confirmed on the actual handset.

## Open-world update (previous)

`npm test` — **82 tests, all passing** (adds: physics for all 8 vehicle types, potholes jolt a scooter without
flipping it and mud slows a car by >25 %, open-world layout sanity — nothing built on a road, fields and buildings
don't overlap, every canal crossing has a bridge, the 434-node road graph is one connected network reaching every
country destination — and the v2→v3 save migration).

Playtests (keyboard/touch only, external requests blocked), all **pass**:

| Script | Covers |
|---|---|
| `playtest.mjs` … `playtest4.mjs` | Milestone-1 regression: intro, delivery with medal, save/reload, auto reverse, robustness/UI, shops, outfit, tiffin carry (phase 2 needs `SEED_SAVE=tools/out/save-phase1.json`) |
| `playtest5.mjs` | Open world: punch walkers until one fights back and goes down → police star → constables arrive → *chai-paani* dialogue → bribe paid, stars cleared → scooter out of the bazaar gate to the G.T. Road with traffic and animals around → world map zoom |
| `mobiletest.mjs` | Phone landscape/portrait and tablet: joystick, look, multi-touch, jump, pause, map (zoom + Close fit a 390 px-tall screen), dialogue, auto with pedals |

Defects found by these runs and fixed: removed people (police leaving, despawned folk) stayed in the shadow-caster
list and could stall the frame loop; the map's Close button fell off short phone screens; instanced trees never
drew in this Babylon build (trees are now merged into scenery chunks); an unloaded BRDF lookup texture kept new
shader variants from compiling (disabled — no environment map is used).

# Milestone 1 record

## Test environment

| Item | Value |
|---|---|
| Machine | Cloud container, 4 vCPU Intel Xeon, 15 GB RAM, **no GPU** |
| Browser | Chromium 141 (Playwright 1.56.1), WebGL2 via **SwiftShader software rendering** |
| Node | 22.22.0 |
| Build | `npm run build` (Vite 7.3.7, TypeScript 5.9.3 strict) → served with `npm run preview` |

Because rendering is software-emulated, frame rates below are a **worst case** and say nothing reliable about a
real GPU. CPU-side frame cost and draw calls are the meaningful numbers.

## Automated checks

`npm test` — **36 tests, all passing**:

| Suite | What it covers |
|---|---|
| `tests/clock.test.ts` | Fixed-step accumulator, interpolation alpha, bounded catch-up, pause (time scale 0), clamping |
| `tests/save.test.ts` | Save round-trip, version rejection, sanitising/clamping, duplicate/invalid vehicles, v0→v1 migration, storage exceptions, corrupt JSON |
| `tests/world.test.ts` | No overlapping buildings, façade frames, safe spots/spawns/destinations on open ground, road graph reaches every destination, walk graph connected, medal and pay rules |
| `tests/sim/vehicle.test.ts` | **Headless Havok** (NullEngine): scooter & auto park stably, accelerate, stay upright, brake before reverse, turn right with bounded lean, cross real speed-breaker geometry at full throttle, mount an angled kerb, recovery teleport, resident capsules cannot shove vehicles |
| `tests/sim/player.test.ts` | Real `Player` controller in Havok: stands still, climbs 15 cm and 30 cm steps, the dhaba kerb+doorstep, blocked by a 1 m wall, jumps and lands |

`npm run typecheck` — strict mode, no errors.

## Playtests with normal controls

`tools/playtest*.mjs` launch the real game in Chromium and play it **only through keyboard events**. A read-only
probe (`?probe`) reports state so the scripts can steer (like a player watching the screen); nothing is teleported
or edited. All network requests leaving localhost are blocked and logged.

Final run against the **production build** (`dist/` via `vite preview`):

| Phase | Result |
|---|---|
| 1 · Intro | New game → walk into the dhaba → talk to Bhola (3 dialogue steps) → pick up the tiffin at the kitchen pass → walk out → ride the scooter 60 m to Gurnam Motor Works (≈15 s) → hand over → ₹200 + 10 rep → get off → buy brake pads (₹180) → remount → take a delivery job. **Pass** |
| 2 · Delivery loop | Continue from the phase-1 save → take a job from Bhola → ride via the GPS route → deliver; earlier runs earned gold (chemist, 26 s / par 36), silver (fruit 32.6 / 29, courtyard via the lane 34 / 38) and bronze (fruit 37.4 / 29). Medal and personal best stored. Horn → resident reaction bubble (when someone is in range). Pause → Save → reload page → Continue: money, reputation, deliveries and stage identical; vehicles within 0–9 cm. Auto-rickshaw: 8.6 m/s forward, holding S braked to a stop then reversed to −3.3 m/s. **Pass** |
| 3 · Robustness/UI | Jump (feet peak 0.84 m); window blur auto-pauses and clears held keys; Esc resumes; F1 help opens/closes; Settings reached and Mute toggled entirely by keyboard, persisted; simulated `QuotaExceededError` on save shows "Save failed: …" and the game stays playable. **Pass** |
| Console | 0 errors, 0 warnings in all final runs |
| Network | 0 requests outside localhost (fonts, WASM and code are bundled) |
| Diagnostics | 0 vehicle flips, 0 recoveries needed, 0 player recoveries, 0 stuck residents; 1 resident "bump" in phase 1 (the scripted rider brushed a pedestrian, who was pushed clear with the −1 reputation warning, as designed) |

## Measured performance (software renderer)

| Scenario | Draw calls | Active meshes | Vertices in scene | CPU frame time | FPS (SwiftShader) |
|---|---|---|---|---|---|
| Playtest, `gfx=low` (no shadows/post, 50 % resolution), 960×540 | 86–205 | 84–203 | ~386 k | 6–15 ms | ≈6 |
| Showcase, default settings (4096 shadow map, bloom, FXAA), 1280×720 | 250 | 54 | ~387 k | 114 ms (includes software rasterisation of the shadow pass) | ≈0.4 |

The fixed 60 Hz simulation is bounded to 5 steps per rendered frame; at software-rendering frame rates the
simulation runs slower than real time rather than becoming unstable (by design).

## Defects found during playtesting and fixed

| # | Defect (how it was found) | Root cause | Fix / regression test |
|---|---|---|---|
| 1 | Player stuck at the 15 cm dhaba threshold (playtest) | Capsule contact angle on the step edge (~60°) exceeded the 50° slope limit; Havok step-up didn't engage | Slope limit 62° + explicit step assist; `player.test.ts` |
| 2 | Step assist left the capsule balanced on the edge, sliding back (headless repro) | Lifted only 12 cm forward | Move the capsule centre past the edge (radius + 6 cm) |
| 3 | Jump did nothing (headless test) | Next step still reported ground support and "stick to ground" cancelled the jump | 0.2 s jump lock; test "jumps and lands" |
| 4 | Parked scooter/auto flung 10–20 m at game start (playtest) | Resident kinematic capsules were created at the origin then dragged to their spots, sweeping through vehicles; collision filters set on the compound container did not apply to child shapes | Place node before creating the body; filters on every leaf shape; "collision filtering" test |
| 5 | Vehicles sank into the road (headless) | A "parked settle" `setLinearVelocity` overwrote that step's suspension impulses | Impulse-based settle; "stays parked" test |
| 6 | Scooter over-leaned and pitched nose-down in tight turns (headless) | Yaw assist applied about the tilted body axis; turn rate not grip-limited | Orientation controller for two-wheelers + μg/v yaw limit; turn, kerb and speed-breaker tests |
| 7 | Recovery teleports silently refused ("Prestep type is set to DISABLED" warning in playtest console) | Havok refuses transforms for pre-step-disabled bodies | `Physics.teleport` temporarily switches pre-step mode; "recovery" test |
| 8 | Esc right after a focus-loss pause was ignored (playtest 3) | Modal listened only on its own element before focus arrived | Window-level modal key handling |
| 9 | Settings opened with focus on `<body>` (playtest 3) | Initial focus scheduled only via rAF | Synchronous focus + rAF fallback |
| 10 | Test-only `?gfx=low` leaked into saved settings | Override mutated the settings object | Runtime-only override |
| 11 | Production build > 25 min and 1.8 GB RAM | Barrel import of `@babylonjs/core` | Deep-import facade `src/babylon.ts` (build 1–3 min) |
| 12 | No visible sun shadows (screenshots) | Sky fill too strong vs sun; no tone mapping | Rebalanced lights, ACES tone mapping |
| 13 | Whole scene vanished with characters as casters (screenshots) | Cascaded shadow generator with skinned casters | Single 4096 shadow map covering the district |
| 14 | Visual: interaction prompt visible behind dialogue; black cash-counter slab; dupatta back drape read as straps; tiffin below the hands | — | Fixed |

## Not verified / limitations

- **Real-GPU frame rate** was not measured (no GPU available). Draw calls (≈90–250) and vertex count (~0.4 M) are
  modest, but performance on integrated GPUs is unverified.
- **Audio** was verified only as "AudioContext running, no errors"; nobody listened to the synthesised mix here.
- **Mouse look** with pointer lock was not exercised headlessly; the playtests used the keyboard camera (arrow keys).
- Only Chromium was tested (no Firefox/Safari), and only at 960×540 and 1280×720.
- The automated playtests drive along waypoint routes; they do not explore every alley or try to break collision.
- Residents use scripted dodging rather than physical reactions; very fast or very low-angle approaches can still
  clip a pedestrian visually for a frame before they are pushed clear.
- Two-wheelers use an explicitly assisted balance model, not true bicycle dynamics.
