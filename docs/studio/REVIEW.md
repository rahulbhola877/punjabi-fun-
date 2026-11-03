# Original game studio review — 2026-11-03

Status: preserved repair checkpoint; Punjab-only implementation is the next authorized scope. No full-game completion or publication is claimed. This document is the current integration ledger; specialist reports and QA_PLAN retain dated earlier observations and planned checks, which are superseded only by the source-tagged results recorded here. This is a Codex adaptation of the attributed studio workflow, not a Claude agent run. The user explicitly changed direction to Codex; Claude Code will not be installed or used, and Claude hooks will not run in this repair checkout.

## Source and preservation

- Original remote baseline inspected: `3e61edc2631ba7692f051a10ff53ac47a7b4b3e0`.
- Repair checkout: `/workspace/punjabi-original-repair`, branch `repair/original-triage-20261103`.
- Interrupted partial NPC edits preserved at `8b1c3edf8597b5f918809b343bce285eb9f00f7b`; its earlier focused-test result was unknown. It is under review now.
- Rejected reboot remains untouched in `/workspace/punjabi-fun-` at `74eeb12aba57e969afe18486f59f53ddbe06ef12`; public game/Site versions are unchanged.
- Upstream template is pinned to `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`, MIT attribution retained. The earlier isolated Claude-template copy is dormant and separate; its two configuration/update-disable checks ran before the user's Codex-only correction. No Claude agents ran.

## Setup availability

`AGENTS.md` loads `docs/studio/CODEX_WORKFLOW.md`. Six Codex specialists have actually run, with separate implementation and independent review passes. Personal skill installation is blocked by a read-only canonical directory and HTTP 403 on the supported fallback; no globally installed skill is claimed. The repository-local setup is reusable with this checkout and does not require Claude or external hooks.

## Active roles and ownership

| Codex worker | Role and scope | Exclusive output/source |
| --- | --- | --- |
| studio_actor_ownership | AI/gameplay ownership repair | Crowd.ts, Jhagde.ts, roof regression tests, ACTOR_REVIEW.md |
| studio_district_collision | AI/world collision repair | JapanWorld.ts, ChinaWorld.ts, districtActorCollision.ts, district actor tests, DISTRICT_COLLISION_REVIEW.md |
| studio_gameplay_ui_audit | Gameplay/narrative and UI review | Input/remapping and secondary-touch repairs, independent mission review, controls browser tooling |
| studio_graphics_performance | Technical artist/performance audit | Static batching/shadow ownership and Space presentation lifecycle; matched visual review |
| studio_qa_plan | QA plan and browser regression tooling | Actor/save integration tools and evidence; product source read-only |
| studio_mission_state | Missions, persistence and passenger ownership | Missions.ts, Tiffin.ts, Rides.ts, save schema and bounded Game integration |
| Root | Studio lead/integration | Setup, priority ledger, integrated validation, final evidence |

No other upstream role is claimed active. No independent worker owns deployment or Git publication.

## Prioritized findings and evidence

| ID | Severity / priority | Confirmed defect | Current disposition |
| --- | --- | --- | --- |
| ACTOR-01–05 | S2–S3 / P1 | Street quarrels, avoidance/contact and shift routes could displace roof actors without a support transition | Repaired ownership/height/shift contracts; causal regressions pass. Production roof support/coexistence check passes at e109fca; horn/vehicle browser paths remain not run |
| DIST-1–5 | S2–S3 / P1 | Japan/China actors omitted from player collision; partial WIP lacked reciprocal/swept/static checks and route recovery | Repaired shared motion and bounded walkers; 30 focused tests pass. Final 0401bd4 production stationary/moving-actor checks pass in both districts; original harness failures retained and explained |
| UI-01–03 | S2–S3 / P1 | Gamepad resume leaked/repeated commands; secondary touch could not Pause; reserved menu keys accepted as movement remaps | Fixed with causal tests. Full-world controls passed at e109fca; final 0401bd4 rerun also passes all five alternate worlds, Punjab/Canada, replay/skip and save/Continue. Native pointer-ownership component cases pass 14/14 on final product |
| MS-01–05 | S1–S2 / P1 | Overlapping food jobs; active jobs lost on reload; non-atomic receipts; passenger detached from vehicle identity; failed saves still quit | Repaired ownership, backward-compatible save snapshots, receipt ordering and refusal behavior. Production delivery and tiffin save/reload checks pass at 682d82f, including same-runtime carry mesh/vehicle entry and once-only receipts; ordinary acquisition/travel remains pending |
| MS-COMPAT | S2 / P1 | Independent review found new guards unnecessarily prevented early auto fares and phone collection during a ride | Corrected at e109fca; six added regressions preserve stages 0/3/4, passenger ownership and phone collection |
| GP-01 / IR-01 | S3 / P1 | Lunar batches and later shadow/depth meshes escaped flight visibility ownership | Repaired one-time presentation lifecycle. Natural flight/return passes; later e109fca launch capture closes the missing-shot gap. Reviewed launch/crossing hide outpost, descent/landing restore it; no universal shot-quality claim |
| GP-02 | S3 / P1 | Merged names lost silhouette shadow eligibility and batching could erase layer/visibility behavior | Shared caster policy and property-preserving partitions pass causal regressions; restored shadow cost is not an optimization claim |
| GP-05 | S3 / P2 | High↔Ultra retained the previous allocated AO targets/settings | Recreate AO on quality changes; causal actual-Game test and actual production AO allocation switching pass at full resolution |
| PERF-01 | S3 / P1 | Historical unchanged guard failed three Low views | Fresh unchanged guard pending; no baseline, threshold or resolution change authorized to hide failures |
| ART-01 | S4 / P2 | Regional scenery remains sparse/repetitive and uneven in normal captures | Current Japan/China/Space captures inspected; functional repairs do not imply finished art or complete countries |

## Validation checkpoint

Product source `682d82fadb8657de772c7c194849f476937dc6cb` passed **702 tests across 156 files** and the production build in isolation. The build retains the existing large Space chunk warning. Exact logs and 559-file build hash manifest are under `artifacts/studio/integrated/`.

At that source, production browser navigation passed five alternate-world round trips, natural unskipped Space flight, Canada and North Airfield, with High/renderScale 1. The actor browser's first failure is retained and diagnosed as an invalid staged approach obstructed by another NPC; collision thresholds are unchanged in its corrected fixture. Save tests use explicit persisted-job/position fixtures and actual Continue/E/Save & Quit UI; they are not an ordinary mission acquisition or travel journey.

Final source validation, fresh workload guard, ordinary-input journey and remaining browser results will be appended after the compatibility correction. Unit counts do not establish gameplay quality, phone FPS, physical multitouch/gamepad behavior or audible music quality. Tests/build/software rendering are serialized; no main push or publication has occurred.

## Later integrated checkpoint

Product source `0401bd4cee3b09e3ccd0680a3745d91eacb7305d` passes **718 tests across 156 files** and the production build (`artifacts/studio/pointer-integrated/`). The subsequent `1e124af` commit changes verification tooling only; product sources and unit tests are identical. The build still warns about the large Space chunk. No warning threshold changed.

UI-04 (S2/P1) was found during final review: alternate pointer handlers could cancel another finger's gesture, replace the active stick owner, or reactivate an old held thumb after pause. Ten causal regressions failed before repair. Each stick/look gesture now owns one pointer, and interruptions release/reset both owners. Actual native Chromium touch/capture checks pass **14 cases across two viewports** (`artifacts/studio/acceptance/native-touch/`); this is a component check using real Input/DistrictControls/CSS, not physical-phone or 3D acceptance. Full-world controls are being rerun on this product.

At `e109fca`, the full-world control run passed remapped keyboard, injected gamepad, actual CDP two-thumb movement/look, held-thumb secondary Pause/Resume, controller Start/A resume, maps and returns in all five alternate worlds, plus Punjab/Canada controls and introduction replay/save reload. That run did not test the later UI-04 release cases; its exact scope remains in its raw report.

The real roof check at e109fca passed for `patang_gnnH51`: feet at y=3.6 match an actual upward roof ray, XYZ stayed within 0.03m while a supported player moved below and a public quarrel ran about 11.2m away. The screenshot's parapet occludes the flyer's lower legs; ray/XYZ observations supply support evidence. This walk-in roof was already reserved from the old event chooser, so the quarrel is coexistence evidence, while causal borrowing is covered by baseline/fixed unit tests. Horn and vehicle contact were explicitly NOT RUN in this browser fixture.

Doorbell browser checks passed adjacent/repeated/known/night interactions at e109fca. The interaction-priority probe failed before its first gameplay assertion because the receipt repair introduced a local job alias and the old minified-binding regex no longer matched; the parser now handles the actual local snapshot access. Its final 0401bd4 rerun passed all 22 recorded assertions. This was a harness setup failure, not evidence of a delivery priority regression.

Two actor harness failures remain preserved: the first staged walker encountered Aiko before the hero; the second China run legitimately slid around Mei while maintaining the collision radius, then was no longer in interaction range. The corrected script preserves every-sample non-overlap and close-contact assertions, re-approaches via ordinary keys, and then tests interaction. It has not relaxed collision thresholds or teleported the hero.

## Final acceptance in progress

Final product `0401bd4`, verification tooling `1e124af`: native Chromium touch ownership (14 cases), both district stationary/moving-actor integration checks, and actual interaction-priority callbacks all pass. Priority checks use explicit POI/vehicle fixtures and actual E/touch callbacks; they are not 22 independent player journeys. Both actor captures have been inspected: characters remain separated in ground space, but China still has sparse box frontages and repetitive materials. Functional acceptance does not close ART-01. The all-world controls rerun, unchanged four-preset budget and ordinary-input intro journey are still running serially; their final results will be recorded separately.

Recoverable intermediate artifact: `libfile_2c0bebc212c8819184e2d52e0bd1f253`, archive SHA-256 `fd994710c66a78efbe44d0efb96a9da49490ea7720f467b2133e7ca36aa39119`, HEAD `1e124af`. Its incremental Git bundle explicitly requires baseline `3e61edc`; bundle verification passed. It includes completed final-product checks and the current documentation diff, not unfinished acceptance results.

Independent final evidence review found no new deterministic product blocker. Prior-source browser evidence is retained with exact provenance: the 682d82f save lifecycle is unchanged by later early-fare/phone compatibility and pointer repairs; the e109fca rendering/roof systems are unchanged by the final pointer-only product correction. These are supporting results, not falsely relabeled exact-final reruns. Legacy/corrupt-save browser compatibility, roof horn/vehicle interaction, hardware input/audio and device FPS remain not run. Existing Low workload failures remain P1 investigation work, matching the rendering specialist priority; no budget or resolution change is used to close that finding.

Final controls completed at 0401bd4: 26 grouped assertions cover all five alternate worlds, Punjab/Canada, held-thumb secondary Pause/Resume, controller Start/A, remapped keyboard/HUD, maps, scene disposal, introduction replay/skip and save/Continue. The report records actual CDP touch plus injected gamepad state at 960×540/renderScale 1; this is not physical-device validation.

Fresh Low guard at 0401bd4 fails all three historical rows: bazaar 438k triangles / 281 draws / 1.37M vertices; colony 275k / 155 / 1.29M; street 565k / 326 / 1.21M. Triangle/draw counts match the earlier published checkpoint values; no main-world optimization gain is claimed. The largest active groups are paint, plaster and metal building batches. This fixed title-camera guard is not a sustained-drive profile. Low retains the guard's inherited explicit renderScale 0.7; that is not a new product downgrade or full-resolution visual acceptance. Medium currently passes its three original 6% regression rows, while some separate aspirational goals remain exceeded. Full table follows when all presets finish.

## Final bounded verification and scope handoff

Product source remains `0401bd4cee3b09e3ccd0680a3745d91eacb7305d`. Subsequent edits are verification tools and documentation only. The 718-test/156-file suite and production build passed on that exact product. No product edits followed, so those checks were not repeated merely to increase counts.

| Gate | Result and exact limit |
| --- | --- |
| Integrated suite / production build | PASS, 718/156 and TypeScript/Vite build; existing large Space chunk warning retained. |
| Final native touch / district actors / priority | PASS, respectively 14 component cases, 34 grouped actor assertions, and 22 fixture callback assertions at 0401bd4. |
| Final rendered controls | PASS, 26 grouped assertions across main Punjab/Canada/five alternates, maps, remaps, actual CDP touch, injected controller, pause/replay/skip and Save/Continue. |
| Save integration | PASS, 53 fixture assertions at 682d82f on unchanged save-lifecycle code; legacy/corrupt-save COMPAT browser cases NOT RUN. |
| Roof / doorbells / settings / world transfers | Supporting production passes at e109fca on unchanged systems, with the earlier limits retained. Roof horn/vehicle contact NOT RUN. |
| Unchanged budget | Raw result: Low three failures; Medium/High/Ultra exit 0. High bazaar's 368k/173 raw sample is invalid as settled-workload acceptance; see the separate diagnostic below. Do not summarize this as a trustworthy 9/12 acceptance. |
| Ordinary introduction | FAILED its bounded wait at the advancing opening cinematic: about 5.9 seconds of game time, no page/game errors, visible Skip. No ordinary phone-errand completion established. |
| Visible-Skip retry | CANCELLED under the latest scope/cost instruction. It recorded visible Escape skip and successful new-game entry before the exact test process group was terminated. The resulting browser-closed error is cancellation evidence, not a newly diagnosed game defect. No completed mission claim. |
| Phase-two delivery harness | Strengthened failure reporting, actual save UI and receipt/reload assertions; syntax checked but NOT RUN because no completed earned phase-one save was produced. |

The single High bazaar sanity diagnostic finished within its 120-second bound. At the identical camera, quality, 960×540 render dimensions and scale 1, its own four-second sample was already 1,029,480 triangles / 499 draws. Twenty-four ordinary frames then rose to **1,112,481 triangles / 508 draws**, stable for the last five samples. Engine draw attribution reconciled every frame. Existing unready effects went from two to zero, while upgraded resident kits grew from 3 to 13 with the same 46 residents. This establishes a cold/settling sampling problem, not solely a shader cause or a speed gain. The settled triangle count exceeds the unchanged High bazaar baseline plus 6% (1,044,100). No baseline, preset, population or render resolution was lowered. Broader steady-state performance remains open.

Raw records: `artifacts/studio/acceptance/execution.json`, `supplemental-execution.json`, all per-gate logs/checks, and the sanity tool's `frames.jsonl`. Only screenshots freshly generated during each ordinary run were retained in its archive subdirectory; stale copied captures were removed using recorded run timestamps. Historical failed fixture attempts remain available and explained.

Latest user direction now removes China, Japan, Canada and other unrelated worlds from the playable original game and focuses meaningful Punjab gameplay. No removal or new gameplay implementation has yet been made in this checkpoint. See `PUNJAB_FOCUS_PLAN.md` for the concrete source and save migration inventory and provisional contained mission arc. The Amritsar Golden Light project has not been accessed or modified; its source/technique review remains pending supported read-only access and coordination.

Per the user's cost instruction, no further duplicate agents or passing-test reruns are scheduled. All current workers have finished their bounded reviews. No main push, deployment, Site change or destructive history operation occurred. The personal/global studio installation remains blocked (read-only `/home/agent/.codex/skills/remote-skills`, supported fallback CONNECT HTTP 403); the repository-local setup is installed and used successfully. This is an access/transport blocker, not a pending Claude installation or a claim that a globally available skill exists.

## Punjab continuation checkpoint — 2026-11-03

The original game is Punjab-only at main `b326ee1` (remote push confirmed; Vercel status pending at time of writing). This is an incremental game, not a completed campaign. Existing out-of-scope code/assets and prior history remain recoverable. The separate rejected reboot was not changed.

Since `e258c96`, the phone challenge receipt was migrated to a save-compatible key: `260de06` passed 25 focused tests and production build, and its Vercel status succeeded. A save still containing the original long key is migrated. A receipt that an older version had already stripped and subsequently overwritten cannot be reconstructed reliably from the remaining save alone.

The road-test candidate adds Gurnam's steady or precision Bullet route, actual checkpoint/slow/brake actions, saved checkpoint and same-bike identity, safe on-foot reload/remount, cancellation and once-only turn-in. Planar velocity is used for stop tests. It does not currently impose a hard-impact penalty; the previous impact signal mixed collision and pothole effects, so that unreliable penalty was removed. Unit tests cover save validation, malformed checkpoint rejection, conflicting jobs and reward idempotence. A software Chromium steady run reached checkpoint 3 from acceptance, and an earned-save continuation completed the rest and the Gurnam turn-in. Precision reached checkpoint 2, then two earned-save continuations completed its remaining steps and turn-in. These runs use a positioned bike fixture, accelerated ticks, and some teleports for NPC interaction; neither is a single uninterrupted fresh-player or physical-device journey. Browser records are under `artifacts/studio/bullet-trial/`.

The visible forest-channel grass overlap was removed using shared channel geometry and a narrow footprint exclusion. The before `artifacts/studio/punjab-story-8e4481f/forest/02-branches-cleared.png` and after `artifacts/studio/forest-grass-root/02-branches-cleared.png` were inspected: the channel no longer contains grass tufts and nearby grass remains. The latter run also completed pool/hillside water and native contact checks using teleports and a next-day fixture; it is not a hardware performance test.

`a39ab51` production code passed 816 tests across 174 files and a production build; the later `b326ee1` changes only the browser harness. Full logs: `artifacts/studio/punjab-final-a39ab51/`. No uninterrupted fresh-player road-test run or real-device FPS was measured. Existing Low budget failures remain open. Diagnostic sampling at High on SwiftShader observed 5 sleeping parked vehicles in the bazaar and 5–6 on a drive, with total physics raycasts recorded in `artifacts/studio/parked-sleep-diagnostic/`; this is instrumented update-only evidence, not an optimization gain or FPS claim. Two geometry partition experiments were rejected because they added draws without meaningful triangle reductions.

## Kotli selection release and follow-up (2026-11-03)

Main `4819a0448d65ae92d711beadc9eeb6dc85d0bc4b` adds a practice-to-selection kabaddi story, a captain or raider goal, saved result and one-time Sarpanch reward. The final-raid transition advances only with gameplay time, so pause does not open the result behind the pause screen. Mobile match instructions and the Touch control are separated from wallet shortcuts. Grass is excluded from paved park paths. The published commit passed 866 tests in 178 files and a production build; Vercel reported success. Public-site access from this executor remains blocked by proxy CONNECT 403.

The raider and captain routes were each exercised in software Chromium from an earned practice save, with NPC location fixtures between matches, keyboard movement, and CDP touch attacks. Both achieved their goal, saved the role and reward, avoided a duplicate reward, and paused/resumed the final raid using the visible mobile controls. Raw reports: `artifacts/studio/kotli-selection/pause-browser-retry/2026-11-03T22-03-26.914Z/checks.json` and `artifacts/studio/kotli-selection/captain-browser/2026-11-03T22-11-16.080Z/checks.json`. These are not fresh, uninterrupted physical-phone or touch-only playthroughs. Low-preset bazaar remains at 438,450 triangles and 281 draws in the existing diagnostic; no device FPS improvement is claimed. The follow-up role test harness is preserved at local commit `0f3d149`.

## Kotli team kit and Simran checkpoint (2026-11-03)

Published `0f9342b` extends selection with an optional first-aid kit errand: Sarpanch refers the player to Doctor sahib during dispensary hours, Ustad receives the kit, and the report pays once. The existing doctor and dangal interactions remain available. Focused mission/host tests passed (37 tests), and the exact-source production build passed. In `artifacts/studio/kotli-supplies/2026-11-03T22-29-18.478Z/checks.json`, an earned selection save was continued, the player walked through the clinic gate using keyboard input, and visible mobile Interact was used for the offer, collection, handoff and one-time report. Teleports were used between areas and dialogue choices used pointer input; this is neither an uninterrupted playthrough nor physical-device verification.

Commit `c38bc39` fixes the existing Simran cold-drink errand: acceptance is saved, and handing over the drink, recording completion and paying the reward are saved together. Regression tests reproduced the previous lost-reward checkpoint; 5 focused Home tests and the production build passed. No full browser journey for this errand has been run. No graphics or measured performance gain is claimed for these changes. A proposed spatial-grid allocation optimization produced mixed synthetic timings and was not applied.

## Tractor sponsorship candidate (2026-11-03)

Candidate `ffbf113` adds an optional Kotli sponsorship following the team-kit story. Players choose a top-three purse goal or a finish-the-lap village goal, then report an attempt-scoped result for a once-only reward. Interrupted/reloaded races return to preparation; normal races remain available. Race HUD and the objective marker now identify the next ordered gate, and ordinary race prize persistence occurs before the results screen. The other racers remain non-colliding visual models on rails.

Focused race, state, host and Kotli tests passed (63 tests); the production build passed. Browser checks `artifacts/studio/kotli-tractor/2026-11-03T22-46-15.253Z/checks.json` and `artifacts/studio/kotli-tractor/2026-11-03T22-46-56.178Z/checks.json` covered both commitments from an earned team-kit save, a visible mobile accelerator moving the tractor, a simulated lap through the debug helper, visible report and no duplicate reward. Teleports were used between areas and the full lap was not manually driven; these checks do not establish complete race drivability or physical-phone performance. The results-panel pointer interception initially observed with a deliberately held render loop cleared once a frame was advanced, so no production input defect was established from that event.

The integrated candidate passed 888 tests across 182 files. A subsequent separate passenger-ride guard test passed in the 35-test Kotli host suite. An independent fixed-step keyboard driver completed the actual four-gate lap in 3:09, placing fourth and reaching the village report state: `artifacts/studio/manual-tractor/2026-11-03T22-55-42.843Z/checks.json`. It used an earned save and teleported before the race, but used W/A/S/D without placement or `raceRun` during the lap. An earlier driver drifted off the road and stalled against a building (`artifacts/studio/manual-tractor/2026-11-03T22-53-30.965Z/`); the corrected centerline route completed. A manually earned top-three purse, continuous travel to/from the race, physical phone, and device FPS remain unverified.

## Dispensary frontage continuation

Starting from remote main `37ddca8`, the street-facing face of the dispensary block was restored. Its omitted face made the spaces between the painted doors transparent; the existing collision and courtyard access were not changed. Matched low-preset software Chromium captures, with the same scripted camera and hour, are `evidence/dispensary-before.png` and `evidence/dispensary-after.png`; both were visually inspected. The capture script logged a generic `TypeError: Failed to fetch` in both runs, so it is visual evidence rather than a clean browser-error acceptance run. The exact changed product source passed 889 tests in 182 files and the production build. No physical-device, FPS, or complete-campaign claim follows from this correction.

## Kotli community notice continuation

After the team kit and sponsored race, Sarpanch asks the player to consult Ustad and choose a dedication for the chaupal notice board. The two choices leave a different persistent notice; reporting pays reputation and warms Sarpanch once. The coach's existing dangal interaction remains available. Story tracking now follows its changing objective instead of installing a fixed waypoint to the initial contact, and the Kotli follow-up offers are exposed when that story is tracked. This is a short epilogue, not a complete campaign.

Landscape and portrait software Chromium fixture runs used a simulated completed selection, kit and race, teleportation between contacts, CDP touch Interact and pointer dialogue. Both dedications were posted, reported once and restored through Continue; the portrait run also exercised changing the tracked story from an existing route. Reports are `evidence/kotli-notice-landscape.json` and `evidence/kotli-notice-portrait.json`, and `evidence/kotli-notice-team.png` is the inspected landscape capture. The first capture revealed mirrored lettering and was corrected; an initial portrait harness froze the frame that hides touch controls under a modal and timed out, then passed after that frame was advanced. These are fixture-based software checks, not an earned uninterrupted journey or physical-device performance evidence. The existing Low workload findings remain open; the posted notice adds one small plane and texture, with no claimed FPS improvement.

The first full suite exposed an outdated assertion that a story selection installed a fixed waypoint; it was updated to assert the live objective and clearing of the old route. The final suite passed 898 tests across 184 files. The only product change after the browser runs was the tracking toast's label, from Sarpanch's name to "Kotli team".
