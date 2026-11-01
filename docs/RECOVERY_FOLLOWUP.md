# Recovery follow-up for review

This follow-up addresses the independent review of checkpoint `4ba70d4`. It preserves full rendering resolution, repairs map/input semantics, stages actual moving pursuit actors, and replaces several visual defects. **The request for a finished game with strong visuals everywhere remains incomplete.** This is a source and evidence handoff for integration review, with no main push or deployment. The unchanged main-world performance guard fails in both the original and follow-up; CPU results remain mixed.

## Source recovery and integration

The base fetched from remote main is `f3fada9ee7ccded22e52c60ae47b4104c1f99531`. The implementation stays on `recovery/cinematic-worlds-20261101`; original local branch `work` at `16d38ea` is preserved. No remote branch supplied the offline owner's reported unpushed optimization, planting, slopes, dry-bridge water-drag or indoor-rain work. That source is unavailable here and has not been overwritten or assumed recovered.

The final incremental bundle/patch starts at **`4ba70d4`**. Restore the first recovery archive before applying this increment. The source checkpoint `5263906` contains the final gameplay changes; a later copy-only fix makes contextual holster/recovery hints use saved bindings. Renderer comparisons use `3620753`; the later commit only refreshes riding poses and wheel extension inside cinematics, leaving the measured walking/district paths unchanged; the later handoff commit adds reports and evidence. Review and reconcile any subsequently recovered original work before merging.

## Changes and practical limits

| Review finding | Follow-up | Remaining limitation |
| --- | --- | --- |
| Expensive recurring district shadows | Immutable opaque casters are baked into a shadow-only world-space mesh; alpha-cutout casters stay separate. A bounded static sun map is cached, materials are frozen when safe, matte architecture uses a smaller diffuse shader, and reflection sampling is reserved for water/glass/metal. | Static shadow caching assumes fixed scenery and sun. Moving people receive a single batched approximate ground contact silhouette, not live limb/wall shadows. Shader compilation still creates large cold stalls. |
| Heavy distant people and coarse batch visibility | Distant kit bodies use reduced geometry with their original skeleton and normalized skin weights; near geometry remains intact. Japan/China static batches use 8 m spatial cells. | Target-device animation quality and sustained performance still need checking. Main-world crowd rendering is not replaced. |
| Quilt/diamond plaster and habitats | Generic normal relief is removed from plaster, painted metal and terrain. Roof slopes have upward normals and capped edges meeting the wall top. Wood retains restrained grain. Character PBR material and vertex colours are retained. | Repeated box architecture, simple characters and compact destination footprints remain visible. A faster dark character-material experiment was rejected and is absent from delivered source. |
| Floating garden shrubs, plain pond surround | The pond has a recessed bed, partially submerged stones, grounded moss/iris planting, a garden wall and irregular shore mesh. Japan timber rails/lattice and lifted roof profiles distinguish its street. | The garden is still sparse and stylized, well below the supplied detailed shoreline reference. No reference-compliance claim is made. |
| China river seam / weak identity | North river/bed/banks extend to the backdrop, with corrected upward normals on both banks; lifted roof sections, material changes and masonry composition provide more local distinction. | The documented north view is checked; every distant heading is not accepted. The street still needs substantially richer location-specific architecture and activity. |
| Weak Canada, moon and Neon | Canada arrival has additional pines/snow banks and a community-hub sign. Moon planet is a lit sphere with surface/cloud detail instead of a flat disc; terrain noise no longer uses repeating low RNG bits. Neon robot has metal/joints and walking articulation. | Canada is still a main-map snow district, without a new realistic lake. Lunar terrain remains sparse and angular. Neon remains a compact fictional quay. Pixel keeps its intentional 2D artwork. |
| Gurnam hidden by a pillar | Obstruction scoring includes rendered decorative geometry, multiple subject samples and the camera path. The workshop additionally uses an authored frontal speaker shot from the clear apron. Actual acceptance and three probe-only replay positions are captured. | The shot foreground can include the player's shoulder and a canopy post; the speaker's head/torso are clear in reviewed captures. This does not prove every conversation in the game is perfectly framed. |
| Frozen patrol cutscene | A real checkpoint chase starts the film only after its patrol is grounded and moving. Both actual vehicles advance in bounded substeps while mission/reward/catch logic is held. Visual wheel contacts are refreshed over curb/road changes and drivers are posed from the film camera without advancing traffic AI. Visibility scoring includes both motorcycle wheels and the rider. Live camera targets follow patrol then player; the camera returns to the final vehicle position. | This is a short staged pursuit insert, not a new full chase mission. Obstacle checks use three front rays and a slope guard, not a full swept-body collision solution for every terrain. Both vehicles need not appear in the same frame. |
| Focus/skip/replay safety | Film time and staged motion stop on blur/hidden document. Background controller presses are consumed; focus return with A held cannot release the film. Natural completion, either-shot skip and repeated active-pursuit replays preserve wanted/money. | Controller tests use a browser mock; physical controller/device behavior remains unverified. |
| Map opened pause; hard-coded hints | All five alternate worlds have actual local maps with footprints, landmarks, water, return and player location. Saved bindings drive help/HUD. Map and pause are distinct; analog movement, controller Back map and simultaneous movement/look touch input share consistent actions. | Pixel has a fixed camera by design, so its second touch has no 3D look action. Browser touch injection cannot establish physical touch comfort. Some legacy authored objective/dialogue prose still names default keys; live action prompts, help and HUD bindings are dynamic. |

## Validation

The full follow-up unit suite passed **126 files / 555 tests**. The final focus/framing changes then passed **9 targeted tests in 2 files**, and the production build (including TypeScript checking) passed. The full suite preceded the final small Gurnam anchor, patrol-readiness, focus guard, roof/bank normals and cinematic driver/tyre updates; those received targeted and browser validation rather than an unnecessary whole-suite repeat. The final holster/recovery key-label copy change also passed the 9 targeted tests and production build/typecheck; it does not alter the verified control/renderer paths. Raw logs are in [followup-evidence](followup-evidence/).

The final cinematic browser run passed real saved mission acceptance, three additional conversation replay positions, a checkpoint-triggered moving pursuit, focus pause, natural completion and repeated skips from either shot. Its player/patrol moved **28.41 m / 3.33 m**; wanted/money were retained. The unedited [in-game sequence](followup-evidence/moving-pursuit.webm) and [raw checks](followup-evidence/cinematic-checks.json) include software-renderer cadence, not device FPS.

Controls checks at `539e3ab` passed in Punjab, Canada and every alternate world (input/map code is unchanged in subsequent commits): saved keyboard bindings and map actions, controller movement/Back map, simultaneous movement/look touch input, pause, return/disposal, opening replay/skip and save reload. See [raw controls checks](followup-evidence/controls-checks.json). These checks use a standard gamepad mock and actual Chromium touch injection; Pixel intentionally has a fixed camera. Japan passed its tea errand, koi feeding, save/re-entry and return/disposal flow. China passed its story, saved evening lighting, re-entry and return/disposal flow. The first China return attempt overshot a lateral waypoint into the table at (-23,20); the final test stays in the open x≈-26 aisle. No collision or timeout was changed. Neon passed its first signal, fox interaction, saved re-entry, repeated return and scene disposal. Moon passed full launch/crossing/landing, flight skip and abort, lunar burst, all relay stages, save/re-entry and return/disposal. See the [accepted run manifest](followup-evidence/accepted-validation.json) and per-world logs.

Read this report with the included raw JSON, not with discarded experiments in local `artifacts/`.

Reproduce on an installed checkout:

```sh
npm test -- --maxWorkers=2
npm run build
# Start npm run preview -- --host 127.0.0.1 before the browser checks.
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/cinematic-controls-smoke.mjs
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/reviewed-cinematic-smoke.mjs
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/japan-smoke.mjs http://127.0.0.1:4173/
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/china-smoke.mjs http://127.0.0.1:4173/
# Main routes use the production preview to avoid development optimizer churn.
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 LABEL=review node tools/main-route-audit.mjs
# Start npm run dev -- --host 127.0.0.1 for actual-module district profiling.
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 LABEL=review node tools/district-render-audit.mjs
```

Run browser checks and measurements serially. Do not rebuild production while a preview browser still uses its lazy chunks. `reviewed-cinematic-smoke` exercises a real saved mission acceptance and triggered checkpoint pursuit; the additional conversation positions and either-shot pursuit replays use explicit probe-only camera hooks and do not grant rewards.

## Evidence and measurement method

District comparisons use actual world modules, identical fixed views and preload, full **1280×720 at scale 1**, system Chromium and **ANGLE/SwiftShader software rendering**. Four initial frames are discarded; at least 20 samples are collected over at least six seconds, bounded at 60 seconds per view. Draws are per-render deltas and submitted triangles include any shadow work. Render CPU, pre-render update CPU, p95 and software frame intervals are retained separately. These labels measure elapsed main-thread intervals with `performance.now()`, including synchronous driver waits and compilation, not sampled CPU cycles. Large cold shader stalls are not removed from the data.

The main-world comparison uses a fixed random seed, hour 9, the same four positions and native obstruction-aware follow camera, 20 warm frames and 20 real-input walking frames at a fixed 1/30 simulation step. These are short +Z walks at heading zero, including a highway view across the road; they do not cover an entire driving route or all camera headings. Population timing can differ between startup flows, so resident counts and walking endpoints are retained rather than assuming identical dynamic crowds. It records render and update CPU, draws, triangles, residents and endpoints. The first attempted fixed-camera route was inside a facade and was discarded. A separate baseline run overlapped a production build and was also excluded. A later development-server main run completed its routes but failed the final error audit because shared Vite optimizer chunks for Babylon shaders returned 404/outdated dependency responses. Its measurements are excluded. The accepted main comparison uses separate production previews and runs serially. Manual stepping and software wall times are **not device FPS or GPU timing**. Pixel's native 384×216 canvas at a 1280×720 display is its existing art format, not a resolution reduction used to claim optimization; its canvas commands cannot be equated to WebGL draw calls.

### Final adjacent district comparison

| View | Draws before → after | Triangles before → after | Median render CPU ms | Median update CPU ms | Render p95 ms before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Japan street | 148 → 120 | 101,342 → 99,248 | 8.4 → 8.4 | 0.8 → 1.2 | 28.7 → 417.8 |
| Japan pond | 40 → 39 | 17,310 → 26,510 | 1.4 → 3.7 | 0.5 → 0.9 | 2.8 → 108.6 |
| China street | 233 → 168 | 213,228 → 224,848 | 6.0 → 7.3 | 0.7 → 1.6 | 12.3 → 14.2 |
| China river | 57 → 48 | 53,460 → 69,323 | 2.2 → 2.3 | 0.8 → 1.2 | 16.9 → 9.7 |
| Neon | 195 → 73 | 12,515 → 13,033 | 2.4 → 1.6 | 0.2 → 0.4 | 6.7 → 8.3 |
| Moon | 215 → 130 | 144,249 → 156,115 | 5.6 → 4.2 | 0.4 → 0.9 | 16.1 → 10.1 |

The historical `4ba70d4` checkpoint submitted 249 Japan street draws and 360 China street draws; the final source submits 120 and 168. This is a measured reduction in recurring work. It does not establish an all-world CPU improvement: China street and the pond still cost more than the flat original, and the tail remains large. Japan's median in this adjacent pair is unchanged. The identical original source measured 4.2 ms in an earlier run and 8.4 ms here, so host/run variability is substantial. The earlier follow-up (before the roof/bank normal correction) measured 7.8 ms. Both are retained in the [earlier original](followup-evidence/earlier-district-original.json) and [pre-normal-fix diagnostic](followup-evidence/earlier-district-prenormal.json) rather than selecting the fastest experiment. The diagnostic is not final visual acceptance. No black-character material variant is used in these final measurements.

Pixel retained 302 median fill commands and approximately 0.3 ms median canvas-tick CPU in both versions. These are canvas work measurements, not WebGL draws or device FPS.

[Raw original](followup-evidence/district-before.json), [raw follow-up](followup-evidence/district-after.json).

### Main-world production comparison

| Route | Draws before → after | Triangles before → after | Median render ms | Median update ms | Residents before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| punjab-bazaar | 839 → 821 | 1,559,501 → 1,530,681 | 28.3 → 37.0 | 25.5 → 33.4 | 118 → 115 |
| punjab-highway | 683 → 701 | 1,154,250 → 1,173,498 | 20.3 → 33.0 | 33.5 → 29.7 | 123 → 123 |
| ludhiana | 353 → 350 | 920,422 → 946,084 | 25.9 → 17.0 | 51.9 → 27.4 | 72 → 73 |
| canada | 206 → 226 | 758,734 → 780,450 | 12.6 → 15.1 | 18.1 → 19.6 | 89 → 89 |

Both revisions completed all four routes with 20 measured walking frames per route, 2.286 m movement, 1280×720 rendering and no recorded browser/game errors. The same seed/settings/routes do not guarantee identical startup populations: the opening and initial frame timing differ. These results do **not** demonstrate a main-world speed improvement. CPU intervals and first-use shader/driver stalls remain high; Canada's additional pines also add submitted work. No claim is made that lower alternate-world draw counts fixed the main-world bottleneck.

[Raw original](followup-evidence/main-before.json), [raw follow-up](followup-evidence/main-after.json). Raw p95/manual wall intervals remain included; none is converted into device FPS.

| Main route capture | Original | Follow-up |
| --- | --- | --- |
| punjab-bazaar | [before](screenshots/followup/before-main-punjab-bazaar.png) | [after](screenshots/followup/after-main-punjab-bazaar.png) |
| punjab-highway | [before](screenshots/followup/before-main-punjab-highway.png) | [after](screenshots/followup/after-main-punjab-highway.png) |
| ludhiana | [before](screenshots/followup/before-main-ludhiana.png) | [after](screenshots/followup/after-main-ludhiana.png) |
| canada | [before](screenshots/followup/before-main-canada.png) | [after](screenshots/followup/after-main-canada.png) |

### Existing repository performance guard

The unchanged `npm run budget` guard **failed all 12 preset/view cases** for triangles and/or draws. No thresholds were raised and `UPDATE` was unset. Its historical guard is distinct from the fresh paired measurements above. Original `f3fada9` also fails **all 12 cases** with the same counts in 11 rows; low bazaar differs slightly with initial NPC timing (original 445k/282 draws, follow-up 438k/281). This is a pre-existing main-world guard breach, not a passed check or a reason to raise its thresholds. [Original guard log](followup-evidence/budget-original.txt), [follow-up guard log](followup-evidence/budget-followup.txt).

## Rendered evidence

All captures below are unedited game frames. The district pairs use the matched full-resolution cameras; they are not generated illustrations or reference-image edits.

| View | Original `f3fada9` | Follow-up |
| --- | --- | --- |
| Japan street | [before](screenshots/followup/before-japan.png) | [after](screenshots/followup/after-japan.png) |
| Japan pond | [before](screenshots/followup/before-japan-pond.png) | [after](screenshots/followup/after-japan-pond.png) |
| China street | [before](screenshots/followup/before-china.png) | [after](screenshots/followup/after-china.png) |
| China river / north banks | [before](screenshots/followup/before-china-river.png) | [after](screenshots/followup/after-china-river.png) |
| Neon | [before](screenshots/followup/before-neon.png) | [after](screenshots/followup/after-neon.png) |
| Moon | [before](screenshots/followup/before-space.png) | [after](screenshots/followup/after-space.png) |
| Pixel (art retained) | [before](screenshots/followup/before-pixel.png) | [after](screenshots/followup/after-pixel.png) |

Cinematics: [opening bazaar drone](screenshots/followup/opening-bazaar.png), [real Gurnam handoff](screenshots/followup/gurnam-actual-handoff.png), [additional position 1](screenshots/followup/gurnam-position-1-moving-camera.png), [position 2](screenshots/followup/gurnam-position-2-moving-camera.png), [position 3](screenshots/followup/gurnam-position-3-moving-camera.png), [patrol at shot start](screenshots/followup/pursuit-shot-0-start.png), [moving patrol / riding pose](screenshots/followup/pursuit-shot-0-motion.png), [player escape shot](screenshots/followup/pursuit-shot-1-relationship.png), [unedited in-game WebM](followup-evidence/moving-pursuit.webm).

Actual local maps: [Japan](screenshots/followup/controls-japan-map.png), [China](screenshots/followup/controls-china-map.png), [Neon](screenshots/followup/controls-neon-map.png), [Moon](screenshots/followup/controls-space-map.png), [Pixel](screenshots/followup/controls-pixel-map.png). [Canada menu-arrival capture](screenshots/followup/controls-canada.png) comes from the actual navigation/control check.

## Outstanding blockers and acceptance

- **Original offline source:** no patch or remote recovery commit is available. Integration with those unpushed changes is pending.
- **Reference transfer:** the parent supplied exact Library and backing file IDs and inspected the image pixels. In the one newly authorized diagnostic attempt here, `prepare_materialize` returned transfers with download URLs and `workspace_path: null`. The current Library helper then failed each consumer-local `materialize` with exit 1 and exact stderr **`library file transfer failed: download failed`**. Neither `/workspace/reference-images-diagnostic/1000340231.jpg` nor `1000340233.jpg` became readable. No policy denial was returned; the helper did not expose a deeper transport reason. No alternate route or further retry was attempted. See the sanitized [diagnostic](followup-evidence/reference-transfer-diagnostic.json). This executor used the parent's written visual observations and actual game pixels; it did not inspect the supplied reference pixels itself.
- **Video:** no accessible footage was verified from the supplied YouTube link. Metadata access is not watching the video.
- **Hardware:** no physical GPU, phone, controller or touch device is available. Sustained frame pacing, thermals, shader warm-up and usability need device testing. Software results establish measured work and browser behavior, not phone performance.
- **Visual completion:** all-world realistic graphics, rich landscapes/shorelines, stronger architecture, higher-quality characters/animation and more authored cinematic scenes remain open. These changes are substantial repairs to the prototype, not acceptance of a finished realistic game.

No automatic approval rejection occurred in this executor. Main integration and release remain pending parent review; no push or deployment was attempted.
