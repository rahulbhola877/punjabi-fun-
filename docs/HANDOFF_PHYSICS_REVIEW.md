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
