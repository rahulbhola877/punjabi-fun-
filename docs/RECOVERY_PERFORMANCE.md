# Recovery performance follow-up — work in progress

This isolated branch continues the reviewed `9b1a147` recovery. Remote main
`f3fada9ee7ccded22e52c60ae47b4104c1f99531` and the reviewed recovery branch remain
preserved. Nothing has been pushed or deployed. Original offline unpushed work
has not been recovered. This is not an accepted final game release.

## Changes being verified

- Unoccupied, effectively stationary wheels can reuse a verified static support
  plane for at most five fixed steps. Forces, suspension, traction and Havok still
  advance at 60 Hz. Driven, moving, towed, dynamically supported or disturbed
  wheels query again. Projection must stay within 0.1 mm of the original contact.
- Opaque static shadow triangles are indexed in 40 m spatial cells. Only cells
  near the current shadow box upload depth buffers; distant buffers are released.
  Visible materials/geometry stay intact; alpha-cutout foliage retains its UVs and
  original material. Moving actors keep live shadows. Immutable depth proxies
  bypass colour-pass readiness/LOD evaluation.
- Added source-mapped CPU sampling and nested update-system timing, shadow-pass
  counters, and renderer/software-GPU process CPU accounting. Controlled population
  runs exclude creation/removal decisions, retain existing AI and physics, and fail
  if traffic/resident/vehicle counts change. Natural traversal is tested separately.
- Opening cameras now establish the bazaar from above the roofs and descend along
  its open street. A nearby pursuit can start with a joint aerial view before the
  existing patrol/player shots. Automatic filming waits for a grounded moving
  patrol within 8–32 m; it does not teleport either vehicle to manufacture the shot.
- Japan/China matte architecture is normalized for StandardMaterial's clamped
  diffuse lighting so roads/paving retain their authored palette. PBR character
  lighting is retained. China ridges use earth texture rather than masonry lines,
  and the background bank samples the continuing hill more closely. Japan's pond
  has darker stone, wet/moss shoreline colour and grouped grounded iris planting.

## Completed measurements so far

Native Havok oracle: 20 parked cars, identical initial state and fixed-step forces,
with the original always-query path selected in the comparison fixture. Over 120
steps, casts fall from 9,600 to 1,600; measured position error is zero. Three
alternating 1,200-step CPU trials (milliseconds):

| Trial order | Always query | Static-plane reuse |
| --- | ---: | ---: |
| Before, after | 1638.5 | 585.9 |
| After, before | 1138.4 | 580.7 |
| Before, after | 813.7 | 459.9 |

This isolates the parked-wheel mechanism. It is not whole-game FPS evidence.

The initial populated bazaar comparison uses 1280×720, full render scale, high
quality, fixed 30 Hz stepping, and 24 measured rendered frames after warm-up.
Both measured rendered windows contain 28 traffic vehicles and 115 residents.
The earlier timer-only population fixture was incomplete: later update-only
windows changed population. Those raw results remain diagnostic, with actual
counts recorded; they are not labelled strict fixed-population comparisons.

| Bazaar sample | Reviewed recovery | Nearby shadow cells + wheel reuse |
| --- | ---: | ---: |
| Median total draws | 975 | 926 |
| Median shadow draws | 391 | 313 |
| Median active triangles, including shadow work | 1,655,118 | 1,560,398 |
| Render submission median ms | 44.4 | 35.0 |
| Update elapsed median ms | 25.4 | 27.6 |
| Physics ray queries over 24 frames | 8,062 | 5,318 |
| Vehicle fixed updates over 24 frames | 2,496 | 2,496 |

The draw/query reductions are real measured work reductions. Update timings
remain mixed. These separate runs have different poses/body-build histories;
the render median is not a hardware speed guarantee. Chromium uses
ANGLE/SwiftShader, and its GPU process consumes CPU across several threads.
Process CPU milliseconds per frame can exceed wall time and are not GPU timers.

An eager all-world shadow upload was rejected. Its evaluated-vertex counter rose
from about 3.05M to 6.70M, and it created thousands of extra meshes. The current
variant creates nearby buffers on demand. Babylon `Scene.getTotalVertices()` is
an evaluated-candidate counter, not an inventory of all allocated geometry.
The profiler now separately deduplicates actual vertex/index DataBuffers and
records their allocation capacities; texture and driver memory are outside that
inventory. The unchanged guard's historical vertex threshold is not altered.

## Validation still in progress

- Full suite passed at `8338ed2`: 129 files / 563 tests; typecheck and production
  build passed. The later pond composition is undergoing a final full rerun.
- The old heading-zero highway walk is not driving acceptance. The first new
  natural route drove over 240 m and turned into the bazaar, but the simple
  waypoint controller turned too late into the 4 m west lane and hit a building
  corner. Its failure trace and captures are retained. A route through the 10 m
  city-road junctions is being used for the sustained driving comparison.
- The unchanged guard failed all twelve cases on both original main and the
  reviewed recovery. Eleven original/recovery count rows were identical; this
  was an inherited failure, not evidence of a speed improvement. A rerun with
  the actual shadow optimization is pending. No thresholds are reset.
- Final opening path samples, nearby-pursuit footage/skip checks, Japan/China
  captures and repeated controlled profiles are pending.

## Remaining acceptance limits

No physical GPU/device is exposed here, so device FPS and sustained mobile/GPU
thermal behaviour remain unverified. No resolution-reduction setting is used as
an optimization substitute. All worlds still need art/play acceptance; measured
work reductions do not establish photorealism or a completed commercial game.

The supplied visual reference image transfer remains blocked by transport:
Library preparation succeeded, but the supported consumer-local download helper
returned `download failed`. No policy denial was recorded. The parent inspected
the originals; this executor has not verified their pixels. No further alternate
download route was attempted. YouTube footage was not verified. These limitations
are preserved rather than claiming reference compliance.
