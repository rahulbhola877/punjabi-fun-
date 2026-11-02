# Integration review candidate

No main push or deployment. Product commit: ee97871. Complete source checkpoint: 1b59a0f50d1763d4d03a41c1e8a5017fe79722a7. The standalone archive was restored without Git prerequisites; all 1,358 tracked blobs match, with none missing. Final tests use that restored source and the existing pinned dependency installation, rather than a fresh network install.

## Verification

- Production build passes. All 60 changed embedded TypeScript sources match. Only the two explicitly disabled outer-world modules are excluded from production; typecheck/native coverage still includes them.
- All seven worlds pass remapped keyboard, controller, map/pause, simultaneous two-thumb movement/look, return and scene-disposal checks. Opening skip/replay and save/reload pass.
- Manual medium/high/ultra preferences retain full 960×540 touch resolution. An explicit 0.8 scale override restores to 100%. The mobile Worlds label, hit target and menu pass at 667×375 without changing settings.
- Five world round-trips, Canada and North Airfield pass. A pre-flight observer proves natural rocket-flight creation/removal/readiness over 6.65 seconds, with zero skip clicks or jump/attack keys. The earlier transient-card polling failure remains preserved.
- Neighbour bells pass 25 actual keyboard/touch, chime, invitation and night-response checks. Native tests cover every authored gate approach, repeated rings, switching neighbours and unrelated NPC preservation.
- The forest mission passes 21 real E/dialogue checks: stages 1→2→3→4→6, native log removal, actual water geometry/depth, shallow wading/ripples, dry feet during a jump, and +3 reputation exactly once.
- Physical roof weather passes 18 actual frames at 1280×720: the last sample has 966 live particles and zero roof leaks; camera shelter is 0.9962 and the ready rain-audio low-pass reaches 1235.5 Hz.
- Opening drone/street/character samples are clear. Independent inspection of all seven final Gurnam frames confirms readable face, torso and gestures. No actors were hidden or moved by the camera repair.
- The explicit pursuit fixture moves real native player/patrol actors 13.83/21.06 metres. Focus pause, natural completion and skipping all three shots preserve money/wanted state. Main wide, patrol cutaway and original failed crossroads views are independently clear. This is staged framing evidence, not an unmodified approach-route claim. Earlier natural-trigger and escaped-before-film traces remain separately labelled.
- Sustained driving passes: 233.27 metres, 1,002 fixed 30 Hz frames, two turns, J/L camera rotation and live traffic/residents at 1280×720. Rendering every fifteenth simulation step is a diagnostic capture cadence, not runtime FPS.
- Final full native suite from restored source passes: 145 files / 606 tests, 226.74 seconds, with all browsers closed. The earlier concurrent-rendering 300-second timeout remains recorded and is not counted as a pass.

The nine supplied reconstruction areas and source-specific evidence are mapped in WORLD_REPAIR.md.

## Unchanged performance guard

The budget tool matches original f3fada9 byte-for-byte: SHA256 6c888f5f56bedd01329144507a29c1a79701a6489d5497a2d6e333bc4d07c588. No UPDATE/rebaseline, hidden quality cut or automatic resolution change was used. All twelve views were measured: nine medium/high/ultra passes and three Low failures. Historical Low explicitly uses 0.7 scale; the other guard presets use 1.0. This is separate from full-resolution functional, gallery and profiling captures.

| Preset / view | Triangles / draws | Guard |
| --- | ---: | --- |
| Low bazaar | 438k / 281 | FAIL |
| Low colony | 275k / 155 | FAIL |
| Low street | 565k / 326 | FAIL |
| Medium bazaar | 946k / 430 | PASS |
| Medium colony | 705k / 269 | PASS |
| Medium street | 1072k / 447 | PASS |
| High bazaar | 1037k / 502 | PASS |
| High colony | 796k / 323 | PASS |
| High street | 1242k / 523 | PASS |
| Ultra bazaar | 1278k / 642 | PASS |
| Ultra colony | 969k / 444 | PASS |
| Ultra street | 1402k / 649 | PASS |

Low failures were inherited. Current colony/street triangle counts are slightly above the preceding recovery's 273k/564k, with unchanged draws. Passing a historical guard does not meet every aspirational goal printed by the tool.

Measured optimization mechanisms include a native 20-car wheel-cache reduction from 9,600 to 1,600 queries over 120 steps; separate native sleeping reduces 8,000 cached queries to zero over 600 steps with zero pose error. Alternating 1,200-step native CPU trials were 590.3→132.5, 409.1→86.0 and 466.0→185.2 ms. These isolate the mechanism, not whole-game FPS. Same-scene static shadow submissions fall from 388 to 312; compact CPU shadow indices fall from 40.64 to 6.77 MB. Actual buffer allocations are distinguished from evaluated-vertex counters.

## Camera-test rationale

A logical look-at midpoint can lie inside a pillar while both real faces are visible. The revised assertion requires unoccluded rays to both faces and their projection inside the camera viewport. It no longer demands an unnecessary particular cut. A separate impossible-face fixture still requires a speaker fallback and correct live tracking. Real building-midpoint and authored Posts roof tests cover the observed scenery blocks. Native PLAYER-capsule and conservative head-volume checks cover the observed turban obstruction while preserving player-face/intro targets, actor pose and visibility. Seven final in-game Gurnam images provide independent pixel acceptance for those bounded states.

## Remaining limits

Three Low guard failures remain. Device FPS, thermal behaviour and most aspirational draw/triangle goals are not established. Pursuit replay 0 partly hides the car's rear behind a roof; replay 1 crops its left edge. Some world art remains a prototype: repeated box architecture, faceted crowns, basic Canadian snow terrain and simple regional hill/channel composition. No finished-country, photorealism, no-weak-world or full-game completion claim is made.

This executor uses ANGLE/SwiftShader; no physical phone/PC GPU validation is available. Reference-image transfer failed here with transport error “download failed”; it was not a policy denial, and the parent inspected the originals. YouTube footage stayed black/loading and was not verified. No paid services or security/secret changes were introduced.

All available original branches were already ancestors of main f3fada9. Missing offline behaviour was reconstructed without overwriting other work. Investigation branches/checkpoints remain preserved. Main publication is held for parent review/authorization.
