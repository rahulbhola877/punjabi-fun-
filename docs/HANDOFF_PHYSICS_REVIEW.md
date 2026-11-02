# Physics and physical shelter review

Reviewed recovery/integration-20261102 at `ee2ddf6` against the reconstruction since `c61f654` on 2026-11-02. Read-only review of product code; this report is the only file written by this reviewer. No browser/GPU commands, commits, branch changes, pushes, or deployments.

## Confirmed finding: three visible shelter roofs are absent from physical cover

The roof index is populated from collision boxes (`World.ts:104`, streamed ownership at `World.ts:111`). These builders draw roofs but do not add matching collision boxes:

| Location | Source | Matching local collision box |
| --- | --- | --- |
| Orchard picnic shelter, (371, 1344) | `src/world/orchard.ts:124` | `collide(0, 2.65, 0, 4, .2, 3.3)` in the existing orchard-height frame |
| Forest keeper's shelter, (-905, 1897) | `src/world/forestStation.ts:50` | `collide(0, deck + 2.7, 0, 6.1, .18, 4.6)` in the existing world-height frame; retain the deck formula at lines 40–41 |
| Every bus shelter | `src/world/country.ts:1640` | `collide(0, 2.685, -.075, 4.8, .07, 2.05)` in the existing `at` frame |

All three drawn boxes are flat (`rotX = 0`); the bus roof comment says sloped, but the actual roof geometry is an axis-aligned box in its yawed frame. The thin posts and back screens are deliberately excluded by `RainShelter.add` and cannot substitute for these roofs.

Reproduction: use Vite SSR to load the real `Kit`, `buildOrchard`, `buildForestStation`, `StaticColliderBuilder` and `RainShelter`; construct both builders in Babylon NullEngine, then index their resulting boxes and query the shelter centres. No rendering is needed. Observed:

```text
orchard: ground = 6.309477033914885; coverHeight = -Infinity; standing eye covered = false; 60 boxes
forest: ground = 6.491852295610254; coverHeight = 7.12560650058196 (deck only); standing eye covered = false; 78 boxes
```

Consequences before correction: rain streaks passed through these visible roofs, splashes occurred below them, and the rain audio stayed outdoors when the camera was under them. The parent added the three exact matching roof colliders. Repeating the real-builder NullEngine queries after that correction produced:

```text
orchard: coverHeight = 9.059476852416992; standing eye covered = true; 61 boxes
forest: coverHeight = 9.91560650058196; standing eye covered = true; 79 boxes
bus shelters: 11 actual BUS_STOPS built; 11/11 standing-eye positions physically covered
```

The bus check used a Vite transform that only exported the existing private `busShelter` function in memory, then invoked it for all actual `BUS_STOPS` and their `shelterSpot` frames. It did not change source files or replace builder behavior. The roof top is 2.72 m above each frame.

Status: corrected by parent; actual orchard, forest and all eleven bus shelter builder cover verified after correction. This reviewer has not edited product code.

## Reviewed behavior with supporting evidence

- **Native parked sleep:** `ParkedBody.ts:13–25` checks both application eligibility and actual native activation. `Physics.ts:36–49` changes activation state, leaving motion type dynamic and activation control simulation-controlled. Installed Havok 1.3.14 primary declarations explicitly separate `HP_Body_SetActivationState` from `HP_Body_SetActivationControl` (`node_modules/@babylonjs/havok/HavokPhysics.d.ts:383–388`); installed Babylon 9.28 maps control policies separately (`havokPlugin.js:1074–1083`). There is no forced-inactive control or static conversion here.
- **Wake paths:** driver, player/camera proximity, wet grip, wreck/recovery, towing, velocity, loss of static support, native collision activation and external impulse all invalidate sleep. Existing native `tests/sim/parkedBody.test.ts` verifies real driven-car collision, external impulse, driver/proximity/wet changes, disposed support, dynamic motion type and no pose drift.
- **Towing:** `Trolley.fixedUpdate` assigns positive `towDrag` even for the empty 300 kg trolley (`src/traffic/Trolley.ts:133`), so `Vehicle.ts:197` rejects sleep. An independent native check settled a car for 600 steps, then assigned empty-trolley drag 103.005 N: it woke in one step and stayed awake for another 240 steps. Attach assigns drag on the next trolley update; the normal hitch path already has driver/proximity wake.
- **Support reuse:** static-only, non-instanced, live-body and world-transform guards remain in place; ordinary reuse recasts after five cached uses and rejects more than 0.1 mm contact drift. Sleeping support disposal is checked each fixed step, rather than waiting for a cached recast.
- **Hill recovery and axles:** recovery initializes both interpolation positions from the corrected physical node; axle grouping uses the midpoint of actual minimum/maximum local wheel Z, covering specs whose axles lie on the same side of zero. Native hill recovery and pickup-on-ridge tests pass.
- **Road-plane tyre impulses:** longitudinal and lateral impulses are tangent to the mean contacted road normal (`Vehicle.ts:389–417`), including lateral velocity measured in that same plane. The native banked-road test reports right-axis residual -0.001652637 and forward-axis residual approximately -3.98e-9, with grounded=true.
- **Bridge/contact-height water:** wheel surface callbacks receive the actual hit-point height (`Vehicle.ts:303`, `Game.ts:1236–1240`); `Weather.floodAt` subtracts that height and clamps to zero (`Weather.ts:255–259`). Canal hull buoyancy separately uses collider vertical extent, so being above a canal does not imply being immersed. Existing flood-height and native vehicle-water tests cover these cases.
- **Roof geometry/ownership:** yaw/pitch column intersection matches native roof collision in `tests/sim/rainShelter.test.ts`, including streaming removal. Highest exposed surface is appropriate for falling drops; cover below the camera does not muffle its rain audio. No additional reachable underside defect was identified. Audio filtering and gain receive the smoothed camera cover through `Game.ts`.
- **Terrain triangles:** hill and orchard sampling uses the actual grid's 00→11 triangle diagonal, rather than a smooth formula or bilinear interpolation. Ridge and outer sampling delegate to their existing triangle samplers. The native ground-height test compares eight off-vertex points across hill/orchard/ridge against actual mesh raycasts with a 2 mm bound. This test does not measure outer-tile seam overlap error.
- **Interior lights:** finite-light sphere/AABB exclusions affect static batches and are updated on streamed load/unload; dynamic actors remain eligible. Existing NullEngine test checks light-source inclusion after a moving actor enters range.

## Validation status

The current full-suite log `/tmp/gedi-handoff-final-suite.txt` was inspected after completion and reports **138 test files passed, 577 tests passed**, duration 220.03 s. This is the run at the reviewed reconstruction; subsequent parent changes require their own validation.

Previously supplied focused evidence: `/tmp/gedi-handoff-vehicle-tests.txt` (68 tests), `/tmp/gedi-context-trees-ground.txt` (10 tests), `/tmp/gedi-handoff-light-sleep.txt` (5 tests). Additional reviewer checks were small CPU-only Vite SSR/NullEngine probes, exited successfully, and printed the canopy and towing results above.

No other actionable defects found in the reviewed scope. No review actions were denied or left awaiting permission.

## Addendum: native bus departure regression from the new shelter roof

The later integrated suite at `3798b93` completed with **140 files passed, one failed; 591 tests passed, one failed** (`/tmp/gedi-handoff-integrated-final-suite.txt`, duration 209.99 s). The single failure is `tests/sim/buses.test.ts`, “every leg, on the real colliders, to the stop”: `r4 westBypass->ludhAdda@0` remains at approximately (-1103, -600), 724 m from its destination. The earlier 138-file/577-test result above is historical and does not describe this later integration.

### Exact geometry and trigger

At the western bypass stop, the road spans X [-1106, -1094]. `shelterSpot` currently sets the shelter centre to (-1107.6, -600), yaw π/2, using road-half-width + 1.6 m (`src/world/busRoutes.ts:59`). The new matching roof collider spans X [-1108.7, -1106.65], Z [-602.4, -597.6], Y [2.65, 2.72].

The failing departure's first route points are (-1102.6, -600), (-1102, -600), (-1102, -570). `legAt(L, 0)` therefore spawns the bus at yaw π/2, transverse to the north/south road, to follow the initial 0.6 m lane connector. Its 10.4 m main hull spans X [-1107.8, -1097.4], Z [-601.25, -598.75], with initial Y approximately [.55, 3.45] (`SPECS.bus`, `src/vehicles/specs.ts:142`). The rear starts **1.15 m inside the roof collider**. Native contact pins the bus downward before it can turn onto the road.

### Bounded native reproduction and safe placement

A CPU-only Vite SSR probe built the actual complete district collider set through `districtColliders`, spawned the actual bus/AIDriver on that exact leg, and compared the original placement with a westBypass-specific shelter setback. The alternative was applied only to the in-memory `shelterSpot` function so the complete shelter geometry and all colliders moved together. No product or test files were edited. The command had a 90 s wall-clock timeout and exited successfully within it.

| Probe | Original half-width + 1.6 m | Proposed half-width + 3.2 m |
| --- | --- | --- |
| Simulated duration | 30.0167 s, bounded early | 176.90 s, route completed |
| AI done | false | true |
| Distance from destination | 724.173 m | 2.42593 m (<5 m required) |
| Worst continuous stand | 30.0333 s | 3.16667 s (<8 s required) |
| Distance moved | .01744 m | 721.827 m |
| Final root Y | -.74332 m | -.05254 m |
| Final up-axis Y | .9999986 | approximately 1 |

Recommended source correction: use **road half-width + 3.2 m for westBypass**, keeping every other shelter at its existing placement. This moves that entire shelter 1.6 m west to X=-1109.2. Preserve the roof's matching visual/collider dimensions and height. Its road-facing roof edge becomes X=-1108.25. The bus's maximum horizontal yaw envelope radius is `sqrt(5.2² + 1.25²) = 5.34813 m`; from its initial centre its westernmost possible extent is X=-1107.94813, leaving **.30187 m clearance**. The following lane points move inward, and the native full-leg probe above confirms the departure stays clear.

The existing house/site/other-road clearance predicate from `tests/sim/buses.test.ts:34–39` was independently evaluated at the new shelter centre and returned no conflicts. Moving the shelter outward expands the open pedestrian approach by 1.6 m; the shared `shelterSpot` continues to place both the rendered shelter and waiting people consistently. This diagnosis does not require removing physical roof cover, raising the visible roof, changing route driving, or relaxing the route test.

Status at addendum creation: exact cause and validated placement sent to parent; parent owns the source correction and final full-suite rerun.

## Addendum: saved area 6 forest collision and shallow-wading gap

Read-only audit at `ed38af2` confirms this checklist item is **not implemented**. The actual mission file is `src/missions/ForestWater.ts`; there is no `ForestSpring.ts`. The earlier checklist phrase “existing forest spring/log/sluice/wading work is preserved for inspection” must not be interpreted as completed collision or wading behavior.

`ForestWater.ts` and `Player.ts` are unchanged against the available main base (`origin/main` and `handoff-20261102/main`, both `f3fada9`). The last main-base change to ForestWater is `0a8c1cd`. The newly added forest shelter roof collider is independent of the mission's spring geometry.

### Source facts

- `ForestWaterProps` creates meshes only. The channel bed/banks are visual strips (`ForestWater.ts:54–65`); the sluice frame is four visual boxes merged into `forest_sluice_gate` (lines 71–77); the obstruction is three visual cylinders (lines 78–84). The class imports or constructs no native physics body or shape.
- `sync` (lines 86–91) toggles the meshes. Logs show before stage 3; the common stream flows at stages 4–7; the pool branch at 4/6; hillside at 5/7. No collision is created, removed or restored with those transitions.
- Water quads follow the ridge at `hillY + .19`; the visible bed follows at `hillY + .14`. The underlying physical ridge remains at `hillY`. There is no stage-aware spring surface/depth query.
- `Game.updateWeather` computes foot wading exclusively from `weather.floodAt` (`Game.ts:4169`), then applies `wadeMul` through player `speedMul` (line 4404). The dry-weather restored forest pool returns flood depth zero.
- Player swimming is canal-only (`Player.ts:208`, `canalWaterAt`). The shallow forest water does not trigger it, and should remain walking rather than becoming a swimming volume.
- Both player footstep callbacks (`Game.ts:891`, `1057`) call `Audio.footstep` with the ordinary stone/tile/dirt surface. At the forest's X coordinates `Game.surfaceAt` returns dirt. `Audio.footstep` has no water option (`Audio.ts:1013`). The existing `Audio.splash` sample could support water steps but has no forest trigger.
- `WaterContactEffects` is also canal-only and emits periodic rings only for swimming. It does not give the forest stream shallow foot contact effects.
- Existing `tests/forestWater.test.ts` checks saved stages and mesh visibility; `forestTrail.test.ts` checks the path/grass/terrain. Neither verifies spring collision, depth, movement or water footsteps.

### Native confirmation

A small Vite SSR/NullEngine/Havok probe built the real ridge collider, constructed the actual `ForestWaterProps`, and queried the visible props:

```text
physics engine bodies before ForestWaterProps: 2
physics engine bodies after ForestWaterProps:  2
stage-2 log 0 visible top:                     11.650184602997724
vertical native ray at log 0:                 11.268095016479492 (ridge; log ignored)
short native ray through visible sluice post: no hit
stage-6 restored forest pool enabled:         true
ForestWaterProps.depthAt:                     undefined
weather flood depth at (-890,1904):           0
canalWaterAt(-890,1904):                       null
```

### Minimal concrete integration

1. Give the channel bed/banks, sluice frame and each visible log matching native static geometry. The merged gate and bed/bank meshes can use static mesh collision; log collision should preserve the real cylinder transform and dimensions. Water itself should remain a nonsolid surface so the capsule can wade through it.
2. Change log collision only when visibility/stage changes, removing it at stage 3+ and restoring it when a different/reset save brings the obstruction back. Do not recreate native bodies every rendered frame: `sync` currently runs each frame. Dispose the owned bodies/shapes with the scene/props lifecycle.
3. Expose one stage-aware spring surface/depth query using the generated water triangles, including exact strip boundaries and the wider pool. Drive both the maximum of forest/flood foot depth and shallow water-step audio from that same query. Common stream is active at 4/5/6/7, pool at 4/6, hillside at 5/7; dry or unselected outlets must stay dry.
4. Keep rendered and physical depth coherent. Once the rendered bed receives collision at +.14 m, the existing water at +.19 m is only .05 m deep. The existing `depth > .05` wade threshold would not reliably engage. Either explicitly support that ankle-shallow depth with appropriate movement/audio thresholds, or intentionally revise the rendered water/bed heights together. A query that reports .19 m above the underlying ridge while the player stands on the +.14 m bed would overstate immersion.
5. Verify the complete native flow: a character collides with visible gate/logs; logs stop colliding when cleared and restore on reset; selected wet branch slows movement and emits water steps; the dry branch, raised feet and cleared obstruction remain physically distinct. Check real mesh triangle heights, not mission-stage labels alone.

Installed Babylon 9.28 API caveat: assigning `PhysicsBody.shape = null` only changes its JavaScript field; the setter calls the native plugin only for a truthy shape (`node_modules/@babylonjs/core/Physics/v2/physicsBody.js:147–152`). It does **not** clear the existing native collision shape. Use actual collision-filter changes or dispose/recreate the log bodies on stage transitions.

Status: confirmed missing behavior reported to parent; no product/test edits made by this reviewer. The area-6 collision and shallow-wading requirement remains open until implementation and validation.

### Authorized implementation and focused validation

The parent subsequently authorized implementation limited to `src/missions/ForestWater.ts` and focused forest-water tests. Those changes are now present, without any edits by this reviewer to Game, Player, Audio or Weather:

- `ForestWaterProps.surfaceYAt(x, z): number | null` returns the highest actual enabled Float32 water triangle. The query uses the rendered strip indices, including the wider pool and exact strip ends; outside active water it returns null.
- `ForestWaterProps.depthAt(x, z, feetY): number` returns positive foot immersion, or zero outside water/above the surface. Invalid coordinates/heights return no water. Stage and selected-outlet visibility remain unchanged.
- Stream, bed, gate and log height placement now uses `groundHeight`. The decorative bed is lowered from +.14 m to +.003 m over the native ridge; the water remains +.19 m at sampled vertices. Native terrain remains foot support; water stays nonsolid. Representative measured ground depth is constrained to .16–.22 m. Wide decorative bed triangles cross some ridge edges; the tested pool bed stays within 5 mm of the intended ground offset.
- The merged sluice frame and all three cylinder meshes now have exact static mesh collision, with world pose computed before native construction. Pure NullEngine scenes without physics retain their existing visual-only construction support.
- Clearing the obstruction disposes its native bodies and shapes immediately. Restoring/resetting the stage recreates them, while repeated unchanged `sync` calls preserve stable body counts. The gate remains physical. Explicit idempotent `dispose()` and the scene disposal callback release owned meshes, bodies and shapes.

`tests/sim/forestWaterContacts.test.ts` verifies selected-outlet stages and shallow depth, water-triangle/ray agreement, dry strip ends, matching native sluice and rotated-log ray hits within 2 mm, immediate native log removal, reset restoration and body/mesh cleanup. No stage-label-only assertion substitutes for the native contact checks.

Validation command:

```text
npm test -- --maxWorkers=2 tests/forestWater.test.ts tests/forestTrail.test.ts tests/sim/forestWaterContacts.test.ts tests/sim/groundHeight.test.ts
4 files passed; 11 tests passed; 3.04 s
npm run typecheck
passed
git diff --check (owned source and tests)
passed
```

Integration instructions supplied to parent: use `max(weather.floodAt(x,z,feetY), forestWater.depthAt(x,z,feetY))` for walking immersion; emit shallow footstep splashes using that same depth; use `surfaceYAt` for the correct water-contact surface if adding visual effects. Keep canal swimming separate. Parent owns that Game/Audio connection and its complete-flow/final-suite verification.
