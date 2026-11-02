# Rebuilt missing-session work — current evidence

Rahul authorized rebuilding rather than waiting for unidentified source on
2026-11-02 02:30 UTC. The available original branch/main history is already
included; [Git provenance](GIT_INTEGRATION_20261102.md) records exact ancestry.
Product checkpoint: `ceb057d98d1bf0143799beea253dad6b94e2fb55`.
No main push or deployment.

| Old-session behavior | Current implementation and test status | Remaining work |
| --- | --- | --- |
| Reject 50% resolution Performance workaround | Existing recovery uses medium workload at renderScale 1; UI describes full clarity. Real optimization is independent of that button. | Fresh browser button/resolution assertion pending. |
| Parked vehicle workload | Existing static support reuse: 9600→1600 native casts over 20 cars/120 steps, zero pose error; moving/driven/pushed/dynamic-support cases bypass immediately. | Sustained device performance, more parked mixtures. |
| Distant vehicles | Existing traffic retirement, distant rider animation culling, resident visual LOD and static scenery visibility remain. | No new distance-based physics suspension is claimed; all live vehicle physics still advances at 60 Hz. Needs a collision-safe scheme and route measurements. |
| Connected Punjab/location trees | Available main already includes whole transformed tree geometry, distinct mango/kikar/neem/shisham proportions, opaque safeda crowns and grounded trunk collision. Recovery keeps it. | Pixel/art acceptance of each location remains open; not represented as recreated lost bytes. |
| Slopes and vehicle alignment | Existing fore/aft contact-height pitch retained. NEW four-wheel banking uses left/right contact heights rather than world-level anti-roll. Native 8.6° bank residual improves from 0.1492 to 0.00165 (~0.1°). | Actual main hill-route and bank captures pending; two/three-wheel assists retained. |
| Dry-bridge water drag | Existing hull buoyancy checks true vertical submersion and native dry-above-canal test passes. NEW flood depth subtracts actual wheel contact height; elevated bridge/house floors remain dry. Player wading and spray use elevation/contact water. | Fresh wet bridge browser traversal pending. |
| Indoor rain / roof shelter | NEW spatial index of authored solid collision; exact yaw/pitch column intersection, streamed ownership/removal, no per-drop Havok raycasts. Rain is retired above roofs; splash origins sit on cover. Native roof matches real Havok across a 49-column grid; open courtyard/lifecycle checks pass. | Actual rain particle/capture check pending. Non-collider purely decorative covers are not included. |
| Signboards | Existing local bundled Punjabi/Latin fonts are awaited before atlas drawing; inset UVs, mipmaps and anisotropic filtering retained. Actual bazaar A/B capture has readable boards. | No exact lost final signboard diff exists; further content/layout decisions require observed defects. |
| Winter details | Existing snowy pines, irregular clusters, continuous distant hill silhouette, snow material and walkable house paths retained. | Canada still has prototype composition/large flat areas; no all-world visual acceptance claim. |
| Shadow simulation/render cost | Same final scene, identical poses: static cells reduce shadow388→312 and total984→908 draws. NEW storage retains a triangle ordinal rather than three duplicated vertex indices, using 16 bits where safe. | Fresh allocated-buffer/index inventory pending; software timing not device FPS. |

The joint pursuit route remains an unresolved software issue: the patrol can
circle an authored road and lose contact before a new three-shot sequence starts.
Unverified spawn/filter experiments are quarantined on
`recovery/pursuit-investigation-a4b1641`. Existing moving film and prior verified
Gurnam/control fixes are retained. No fresh successful pursuit clip is claimed.

The overall task is still an improvement checkpoint, not a finished-game release.
Final full suite, unchanged guard, all-world controls, revised opening samples and
sustained routes are tracked separately with their exact source/check scope.
