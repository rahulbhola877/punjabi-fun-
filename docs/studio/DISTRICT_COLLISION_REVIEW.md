# District actor collision review

Date: 2026-11-03. Role actually run: AI/world collision specialist, using the repository's Codex studio adaptation. No Claude runtime, hooks, commits, pushes or deployment. Source baseline: `origin/main` / `3e61edc`; preserved interrupted WIP: `8b1c3ed`. This report concerns the original Babylon districts.

## Findings and repairs

| ID | Severity / priority | Evidence | Result |
| --- | --- | --- | --- |
| DIST-1 | S2 / P1 | Original Japan/China player movement used only the static map predicate. The supplied external diagnostic at `/workspace/original-game-assessment-20261103/tests/districtNpcCollision.test.ts` isolates this path for Aiko and Mei. | Player movement now checks all district actors, including stationary named characters and walkers. |
| DIST-2 | S3 / P1 | First focused run against preserved WIP: **3 passed, 1 failed**. Oblique approach stopped at `z=-0.14310709188945275`; axis-only rejection could trap the player against a circular footprint. | Shared player movement projects blocked motion along the actor tangent and validates every resulting candidate against all bodies and static footprints. Retreat remains possible. |
| DIST-3 | S2 / P1 | WIP walker helper checked only the hero, omitted static and other-NPC checks, and only tested endpoint distance. A long crossing or shallow chord could have clear endpoints while crossing the footprint. | Swept circular checks reject the whole crossing. Walkers use all actor bodies and static predicates in displacement steps of at most 0.05 m. |
| DIST-4 | S3 / P1 | WIP integrated sine deltas into actual position; discarding blocked deltas permanently shifted the authored route. The old market walker also jumped from its authored initial `z=22` toward a route centered on `z=24`. | Walkers approach absolute authored route targets with bounded per-frame travel, so missed travel cannot accumulate into a teleport or shift endpoints. Facing follows actual movement; blocked walkers idle. |
| DIST-5 | S3 / P1 | New authored-route test initially failed for the market walker. Lane `x=-15` is 0.5 m from pole `(-15.5,24)`. Applying the player radius 0.42 m plus pole radius 0.12 m blocked this narrower NPC. | With lead-approved ownership, `canWalkChina` accepts an optional radius while retaining its 0.42 m default. Walkers use the existing actor radius 0.36 m, clearing the pole by 0.02 m without moving any actor route, pole or other scenery. Player and NPC boundary cases are tested. |

Named NPC coordinates, cultural assets, dialogue, interaction ranges, progression and map geometry are preserved. The three patrols retain their authored x coordinates, sine targets, frequencies and endpoints. The hero's root position is now also its movement state, so the collision registry always sees the same body that is rendered. Japan retains its conservative existing 0.4 m static footprint; China's optional NPC footprint is needed for the authored market clearance.

The initial oblique WIP test asserted that the player must finish on a particular side (`z > 0.3`). That is not required for collision sliding: the approach can validly pass below the body. The revised test instead requires forward progress beyond the actor (`x > 1`) while checking the full minimum separation every frame. It still detects the original stall without prescribing the wrong sliding direction.

## Focused verification

Command:

```sh
npx vitest run tests/districtActorCollision.test.ts tests/districtNpcCollision.test.ts tests/districtMovement.test.ts tests/japanMap.test.ts tests/chinaMap.test.ts --maxWorkers=2
```

**PASS — 5 files, 30 tests, exit 0.** Raw output: [district-focused-tests.txt](evidence/district-focused-tests.txt). Source/test digests at this validation handoff: [district-source-sha256.txt](evidence/district-source-sha256.txt). `git diff --check` passed.

Coverage includes:

- Aiko, Ken, Yuna, Mei, Lin, Wen and Shu approached at 4 FPS with the real static map predicates and all district NPC footprints: minimum 0.72 m body separation, interaction range reached, and retreat succeeds. Shu remains grounded on the real slope.
- Player sliding around an actor and beside a second actor/static wall; head-on walkers stopping and reversing; walker versus stationary NPC; self exclusion, vertical separation, and escape from existing overlap without crossing its centre.
- Full-body crossing and grazing-chord rejection; thin static obstacles; 5/60 FPS travel equivalence, diagonal/analog magnitude and background-time clipping.
- All three authored patrols simulated for 180 seconds each at 5 FPS, with the player blocking for 30 seconds. Every frame checks body/static clearance, speed and route bounds. After release, each patrol resumes and reaches both authored endpoints within 0.05 m.
- China market pole: the original player footprint remains blocked at `(-15,24)`, the NPC fits there, and moving it 0.03 m closer is blocked.

## Actual limits and handoff

These are deterministic logic/geometry tests, not an ordinary-input browser journey. They use the production movement functions and authored map data; they do not instantiate full rendered world scenes. The external original diagnostic was inspected, not rerun as an acceptance test: it intentionally invokes the old static-only movement composition and would still reproduce that historical path. The new tests exercise the production actor-aware composition instead.

Full-suite, typecheck/build and rendered browser checks are pending the lead's serialized integration gate. The QA worker has the real node names and routes for `tools/studio-actor-regression.mjs`. No pixel/art or device-performance pass is claimed here.

Bodies are simple upright circular footprints, not articulated limb physics. Walkers keep their lanes and wait for an obstruction to clear or their target to reverse; they do not plan alternate routes or push actors aside. Tests establish recovery after release/retreat, not passage through a permanently occupied lane. An already overlapping pair may separate through allowed movement; this repair does not teleport them apart. Static collision continues to use the districts' existing geometric predicates.
