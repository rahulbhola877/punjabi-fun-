# Foliage and gameplay repair

The current main map uses the uploaded LowPoly Lab tree source instead of the
detailed, alpha-leaf broadleaf. Trunks, branches and crowns keep the same whole
source transform. Three seeded trees and two shrubs share one opaque material;
species keep different proportions. Existing roads, trees and playable bounds
are retained. The supplied viewer's Three.js runtime is not embedded in the game.

| Shared broadleaf | Before | After |
| --- | ---: | ---: |
| Triangles per tree | 3,934 | 394 |
| Runtime vertices per tree | 3,608 | 240 |
| Alpha-tested foliage triangles | 504 | 0 |

Other country trees also use opaque crowns. Safeda gains a small amount of
geometry (380 to 398 triangles) while removing 158 alpha-card triangles and
its skeletal silhouette. Pines keep their existing tiered geometry. These are
geometry comparisons, not hardware frame-rate measurements. Detailed original
Tunyard trees remain available for authored scenes, with geometry/maps loaded
on demand. Recipes and source checksum live beside `lowpoly-nature.json`.

The renderer now skips disabled meshes before Babylon's readiness traversal.
An identical paused scene retained all 222 active mesh identities while reducing
candidates from 5,804 to 1,638. A software-browser microbenchmark measured active
mesh evaluation at median 0.9 to 0.5 ms and p95 4.0 to 1.4 ms. This measures that
CPU operation only; it does not establish whole-game FPS on phones or PCs.

Water now has bounded contact, current, swimmer inertia, buoyancy and drag for
loose props/vehicles. The canal bed covers its full visible length. Surface
effects use a fixed eight-ring pool; the water shader adds no scene render pass.
This is a game water model, not a fluid simulation. Wet braking and maximum
cornering now use a shared tyre friction budget based on suspension load.

Audio input no longer resumes the paused main world while visiting another
scene. Region-owned water/footstep ambience and actual tyre/gravel/skid contact
replace silent/generic events. Canada residents are excluded from the Punjabi
voice catalog. Japan/China have native dialogue with English subtitles and
collision-safe running at low frame rates. They remain small authored districts;
they are not complete country maps. New regional voices are unrecorded, and
their translations have not had native-speaker review. The reusable audio skill
and exact-script export tool describe the recording workflow without claiming
that ElevenLabs output exists.

Validation for this pass: 546 tests across 123 files, TypeScript and production
build passed. The gameplay browser check walked into water, observed drift and
floating cargo, verified a dry bridge, drove/braked/exited a car, and checked
splash signal and contact-source cleanup. Japan/China actual-input checks cover
running, bilingual dialogue and paused main-world audio. Browser checks use
Chromium software rendering; mobile GPU and thermal performance remain unmeasured.

Reproduce with `npm test`, `npm run build`, then run
`tools/foundation-physics-smoke.mjs`, `tools/worlds-menu-smoke.mjs` and
`tools/regional-identity-smoke.mjs` against a running local server. Graphics still
need coherent terrain, landscape composition and architectural art direction;
the reference images are not yet matched. Avoid adding map area or repeating
tasks to obscure these remaining weaknesses.
