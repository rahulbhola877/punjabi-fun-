# Render reconstruction and handoff evidence

## Evidence boundary

This review captures the immutable production build served at `http://127.0.0.1:4188/` from `/tmp/gedi-handoff-rebuilt`, matching product source `ee2ddf6`. It is a review of the captured views, not a full-game polish or reference-matching certification. The original user video was inaccessible/loading, and earlier reference attachments were unavailable to this reviewer. No pixel-match claim is made.

All PNGs are actual, unretouched 1280×720 browser screenshots. The 3D engine also reports 1280×720. Chromium `/usr/bin/chromium` uses ANGLE SwiftShader (`SOFTWARE=1`) with high quality, render scale 1, high shadows, seeded randomness, and a 09:00 initial clock. Native tests/CPU work ran concurrently. These captures establish visual behavior, not device FPS or timing performance.

## Reconstruction represented by this source

The native vegetation is built through `src/world/punjabTrees.ts`, with guarded young street neem placed by `props.ts`, regional tree selection in `country.ts`, and kinnow rows in `orchard.ts`. The orchard reserves a walkable path and a picnic destination. Canada uses the travel district and winter backdrop/shrub sources. Japan and China use their separate real scenes and the fixed-scene shadow policy in `src/render/DistrictLook.ts`.

The capture runner adds no production debug API and changes no game content. It uses the existing `?probe` interface (`teleport`, `captureHold`, `tick`, and `scene`), a disposable CDP handle to synchronize native visibility and player-centered shadows, and actual Worlds-menu navigation and Return controls for separate scenes. Cameras are scripted review viewpoints, rather than claims about every normal follow-camera view.

## Native pixel review

All nine initial native captures completed with local scenery readiness true, grounded players, empty game-error arrays, no browser error/warning log, and no external or failed HTTP requests. Raw camera positions, player positions, rendering information, and snapshots are preserved in [checks-main.json](../artifacts/handoff-gallery/checks-main.json).

| Capture | What the actual pixels show | Remaining limitation |
| --- | --- | --- |
| [Punjab street neem](../artifacts/handoff-gallery/punjab-street-neem.png) | Young guarded tree, brick guard, pedestrians, cycle shop/pharmacy signs, detailed building fronts. | Tree crowns remain visibly faceted clusters; this is stylized geometry. |
| [Punjab shop signs](../artifacts/handoff-gallery/punjab-shop-signs.png) | Bright bilingual signs, awnings, shop interiors, seated people. | Close framing crops the left sign and a pole partly covers the central sign. The street-neem view supplies a clearer sign example. |
| [Field and bund](../artifacts/handoff-gallery/punjab-field-bund.png) | Plot boundaries, bunds, different soil colors, haystacks, sparse distant trees. | The sampled location/date shows broad bare surfaces rather than dense crop detail; this is not a lush-field showcase. |
| [Kinnow grove](../artifacts/handoff-gallery/kinnow-grove.png) | Low fruit trees with small orange fruit, dirt path, grassy knoll and a distant picnic roof. | Planting is sparse with large open gaps; the grass distribution repeats visibly. |
| [Orchard picnic](../artifacts/handoff-gallery/orchard-picnic.png) | Canopy, posts, table/benches, path and distant grove read clearly. Player is staged off the table at approximately (365, 1336), y=6.24. | This source predates the parent's pending shelter-roof collision work; screenshot presence does not certify roof collision. |
| [Hill station](../artifacts/handoff-gallery/hill-station.png) | Sukh Pahar architecture, temple tower, sloping street, pine silhouettes. | Large plain walls and simple conical pines remain conspicuous. |
| [Canada arrival](../artifacts/handoff-gallery/canada-arrival.png) | Readable Cedar Landing sign, cottage, snowy conifers, shrubs and a mountain backdrop. | Snow ground is broad and uniform; backdrop is intentionally simple. |
| [Canada road and shrubs](../artifacts/handoff-gallery/canada-road-shrubs.png) | Road markings, three house styles, planted shrubs and snowy forest backdrop. | Sparse planting and repeated backdrop trees do not establish a full country environment. |
| [Hangar wide review](../artifacts/handoff-gallery/airfield-hangar.png) and [close evidence](../artifacts/handoff-gallery/airfield-hangar-close.png) | Open hangar, grounded apron player at (635, 1676), roof and readable main entrance sign. | A black rectangle obscures part of the smaller service sign. The original close framing is retained as defect evidence. |

## Separate-world review and shadow-cache observation

Separate-world capture results and actual map-render observer counts are in [checks-alternate.json](../artifacts/handoff-gallery/checks-alternate.json). For each real 3D scene, the runner observes the shadow map's `onAfterRenderObservable` during eight real warm-up frames and twelve further real frames. `refreshRate=0` alone is not treated as proof of caching; the subsequent observed map-render count is the relevant evidence.

Japan's actual `japanSun_shadowMap` rendered twice during warm-up and zero times during the next twelve real frames, with `refreshRate=0`. The street and koi-pond captures were individually inspected. The koi, submerged stones, water surface, pond edge and garden plantings are visible. The street remains a compact authored neighborhood with simple building masses.

China's actual `harborSun_shadowMap` rendered zero times during the eight observed warm-up frames and zero times during the next twelve, with `refreshRate=0`; its initial map had already been cached before observer attachment. This does not measure the initial bake cost. Its street and river captures were individually inspected. The water, bridges and underwater stones are visible, but the river remains an extremely straight channel with sparse banks and basic rounded backdrop hills. Strong building shadows and simple facades remain visible in the street.

Neon and Moon also recorded zero subsequent map renders over twelve real frames. The original [default Neon arrival](../artifacts/handoff-gallery/neon-quay-arrival.png) has a significant camera defect: a cyan foreground portal shape covers roughly 60% of the screen. Its recorded default camera is approximately (0, 4.368, -27.542), looking at (0, 1.45, -20); the return portal is authored at z=-27. This is evidence consistent with portal occlusion, rather than a proven product-code diagnosis. A [second real scripted camera](../artifacts/handoff-gallery/neon-quay.png) shows the actual street clear of that obstruction; it does not repair the arrival camera.

The [Moon outpost](../artifacts/handoff-gallery/moon-outpost.png) was captured after the actual Skip flight control and shows the landing pad, rover, habitats, characters and lunar backdrop. [Pixel Valley](../artifacts/handoff-gallery/pixel-valley.png) is the product's real pixel-canvas world scaled to the 1280×720 viewport, not a 1280×720 internal pixel-art render target. Both were individually inspected.

## Final gallery status

[Open the gallery](../artifacts/handoff-gallery/index.html) to review all 18 original PNGs: 16 representative views and two preserved defect views. The initial nine-view native run, seven-view alternate run, and two-view supplementary review run all completed. Their browser logs and external-request lists are empty. The supplementary camera/engine checks are in [checks-review-airfield-hangar-neon-quay.json](../artifacts/handoff-gallery/checks-review-airfield-hangar-neon-quay.json). Every PNG was inspected through `view_image`; PNG headers confirm all 18 are 1280×720.

All three browser runs used bounded shell timeouts (420s, 420s and 240s), finished normally and closed their browsers. A process check after the last run found no remaining Chromium browser from this runner. No browser/GPU work remains pending.

## Reproduction and deliverables

Run one part at a time, with no competing browser/GPU runs:

```sh
timeout --signal=TERM --kill-after=15s 420s env BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 GALLERY_PART=main node tools/world-review-gallery.mjs http://127.0.0.1:4188/
timeout --signal=TERM --kill-after=15s 420s env BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 GALLERY_PART=alternate node tools/world-review-gallery.mjs http://127.0.0.1:4188/
```

The runner saves each image and check incrementally and closes its own browser on completion or SIGTERM. `GALLERY_SHOTS=airfield-hangar` limits a native run to that view and writes a separate check file. The wider hangar framing is used by the final runner; the original close capture is retained separately. PNGs and check files live under `artifacts/handoff-gallery/`.

The supplementary pass used `GALLERY_PART=review GALLERY_SHOTS=airfield-hangar,neon-quay` to capture both corrected review framings in one real browser session. Initial raw-check rows contain `captureFile` annotations mapping the original close/arrival images to their preserved filenames; camera values and observations are unchanged.

No product source, tests, other existing tools, commits, branches, pushes, or deployments were changed by this review task.

## Addendum: confirmed hangar-sign obstruction cause

The service-hangar black rectangle was diagnosed against the same immutable `ee2ddf6` production build after the gallery pass. Source inspection, a CPU-only Vite SSR/NullEngine reconstruction of the real `Kit.signAt`, and a same-camera browser ablation identify a near-coplanar depth conflict between the printed sign and its own black backing. This is not a hangar-wall intersection, flipped sign face, or unrelated foreground object.

`buildTravelDistrict` places the sign with `kit.signAt('serviceHangar',635,2.4,1697.9,Math.PI,6)`. `Kit.signAt` constructs a black `paint` backing at local z=-0.03..0 and a printed `signs` quad at local z=0.005. The π rotation faces both south toward the actual camera. The generated world-space geometry is:

| Geometry | World-space bounds / orientation |
| --- | --- |
| Printed sign | x=632..638; y=1.74375..3.05625; z=1697.895024414; normal=(0,0,-1); correct front-facing winding |
| Black backing | x=631.96..638.04; y=1.70375..3.09625; z=1697.900024414..1697.930024414 |
| Hangar rear wall's front surface | z=1698 |

The printed face is only 5 mm ahead of the backing. Actual ray picks through black pixel (665,355), with camera eye (634,2.3,1675) looking at (635,2.3,1696), returned the printed face first at distance 22.8951838 m, the backing next at 22.9002013 m, and the wall at 23.0005266 m. The actual streaming mesh names are `world_signs|160:3,10` and `world_paint|160:3,10`. Thus CPU geometry puts the printed face in front, while the rendered backing wins the depth comparison over part of the sign. Both materials initially report `zOffset=0` and `zOffsetUnits=0`.

Four actual same-camera screenshots establish the cause and the minimal successful intervention. Every image below was inspected with `view_image`; these diagnostic images remain in `/tmp` rather than replacing the immutable gallery originals.

| Diagnostic | Result |
| --- | --- |
| `/tmp/hangar-verify-base.png` | Reproduces the original black obstruction. |
| `/tmp/hangar-verify-no-paint.png` | Disabling the actual `world_paint|160:3,10` source mesh removes the panel and reveals the full readable sign. No shadow-list or camera change was made. |
| `/tmp/hangar-verify-zoffset.png` | Restoring the backing and setting the sign material's `zOffset=-2` only partly clears the panel; this is not a complete fix. |
| `/tmp/hangar-verify-facegap.png` | Resetting `zOffset=0` and shifting only the four service-sign vertices by world z=-0.02 clears the obstruction completely while preserving the backing. The face-to-backing gap is now 25 mm. |

The inspected runtime is WebGL 2 / ANGLE Vulkan SwiftShader. At inspection, GL reports 24 depth bits, 8 stencil bits and depth function `LEQUAL` (515); Babylon reports high-precision shaders supported. The camera near/far planes are 0.08/700. These reported values do not establish every intermediate framebuffer format or identify a particular driver's arithmetic issue; the confirmed mechanism is the backing's near-coplanar depth competition, and the geometry-gap ablation establishes a working correction for the reproduced view.

`StaticShadowCells` marks its proxy meshes `layerMask=0` with `metadata.shadowDepthOnly=true`; `EnabledMeshCandidates` also excludes those proxies from color candidates. The observed black pixels correspond to the ordinary painted backing. The ray results and successful face-only displacement do not require changing static-shadow bookkeeping.

**Minimal proposed product change:** in `src/world/Kit.ts`, change `this.sign(key, 0, y, 0.005, width)` to `this.sign(key, 0, y, 0.025, width)` inside `signAt`. This keeps the backing, wall clearance, face orientation and atlas unchanged. The 25 mm gap is verified in the diagnostic page; the product source remains unmodified by this reviewer. The parent should capture the changed final-build hangar view before marking that source fix verified.

Both diagnostic browser runs were bounded to 120 seconds, finished normally, and closed their browsers. The browser/GPU window was released after the second diagnostic. Raw picks are in `/tmp/hangar-diag.json`; engine information and the four changed vertex indices are in `/tmp/hangar-verification.json`. The existing sparse-orchard gallery remains explicitly tied to `ee2ddf6`; later parent vegetation changes are not represented by those earlier PNGs.
