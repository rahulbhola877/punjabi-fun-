# Gameplay, narrative, and controls review

Reviewed 2026-11-03. Combined roles actually run: gameplay/narrative reviewer and UI/accessibility reviewer. Initial source baseline: `8b1c3ed`, branch `repair/original-triage-20261103`. This is the original Babylon/Havok game. Other studio workers own roof support and district actor collisions; those changes are outside this report.

The initial pass was source-only. The lead subsequently authorized bounded district controller/touch repairs and a shared-input reserved-key repair, with focused tests. The lead owns browser execution and integrated validation. No claim here that an ordinary full-game journey, physical controller, physical phone, or screen reader was tested.

## Existing game and progression

The game already has an authored progression. `Missions.ts` starts with Bhola's broken phone: meet Bhola, collect his prepaid phone from Hello Mobile Zone in Ludhiana, return it, earn ₹200 and 10 reputation, and unlock repeatable deliveries/workshop access. Legacy intro stages 1/2 map to stage 3. Repeat deliveries have a time limit, food condition, medals, personal bests, payment, and reputation. `Chapters.ts` has three playable chapters built from existing activities and a fourth explicitly marked coming later; it does not lack a story.

Mummy's daily tiffin round, family activities, rides, festivals, cricket, kabaddi, orchard collection, wayside cleaning, forest-water work, gang trouble, and the boar already feed saved flags/stats or chapter steps. `Game.reward`, `repTier`, `showRound`, and `closeChapter` connect rewards to progression. The playable wallet is intentionally unlimited (`Game.free` returns true); this review does not treat unlimited money as a regression or claim finite-money loss from tiffin ingredients.

Canada is part of the main map and retains the main `Input`, `Ui`, `TouchControls`, pause, and save paths. It has its café, residents, snowball best score, and rink goals. The other destinations suspend the main renderer and instantiate `DistrictControls`: Pixel lantern/shrine progress, Neon signals/relay, Japan tea/park-camera errands, China evening/fishing, and Space signal/rover expedition. `airfieldTransfer` saves their progress through `save.home` callbacks and resumes the main renderer in `finally`. These destinations are documented prototypes, not complete countries; no replacement campaign is proposed.

## Prioritized findings

Severity: S2 major broken feature; S3 degradation with workaround. Priority is repair order, not a claim of release readiness.

| ID | Severity / priority | Evidence | State / owner |
| --- | --- | --- | --- |
| UI-01 | S2 / P1 | Actual `DistrictControls` + `Input` deterministic failing tests | Repaired by this worker; focused tests pass; browser validation owned by lead |
| UI-02 | S2 / P1 | Corrected CDP touch events: click-only baseline fails both viewports; helper passes pause/resume in both | Repaired by this worker; lead-run component browser checks pass 4/4 |
| GP-01 | S3 / P2 | Source-proven asymmetric job guard and shared carrying state | Open; gameplay decision/repair owned by lead |
| GP-02 | S3 / P2 | Source-proven active-job state omitted from save/reconstruction | Open; persistence policy needs explicit disposition |
| UI-03 | S3 / P2 | Five dispatched-key regressions fail original source, pass repaired source | Repaired by this worker; Settings browser check remains lead-owned |

### UI-01: Controller resume is processed twice; Return cannot be selected

Trigger on any alternate world: press Start to pause, release it, then press Start, A, or B. Originally `Input.pollGamepad` invoked `onPadMenu` before mapping gameplay buttons. The district callback resumed synchronously. Mapping therefore saw gameplay active, added the same fresh button edge, and `DistrictControls.read` processed it again.

Observed original values from the first three regression cases: Start produced `paused:true`; A produced `paused:false,jump:true`; B produced `paused:false,attack:true`. The original callback also ignored directional navigation and always resumed on A, so the panel's Return button could not be selected with a controller.

Repair: queue menu commands until polling records held buttons, then navigate the active panel and clear input on transfer. Start/A/B no longer leak into gameplay; held buttons remain blocked until released; D-pad/A can choose Return from pause or map. This controller repair itself does not alter `Input.pollGamepad`; the separate UI-03 repair changes binding validation. Acceptance is encoded in `tests/districtControls.test.ts`: resume with all three buttons, hold/release/repress, Return selection in both panels, and blur-pause followed by B resume.

Source: `src/input/Input.ts:233–249`; `src/alternate/DistrictControls.ts` constructor menu callback, `navigateMenu`, and `read`.

### UI-02: A second finger cannot pause while the first finger holds movement

Trigger: hold the district joystick with the left thumb, then press/release Pause with a second finger without releasing the joystick. The original Pause button only listened for `click`. The lead's corrected Chromium CDP comparison, independently read by this reviewer, records `pointerdown` and `pointerup` for the same non-primary touch (`id:3`) on Pause while the primary stick contact remains. Click-only baseline fails at both 667×375 and 390×844; the helper-enabled build pauses and subsequently resumes at zero movement in both, 4/4 checks passing with no page errors. Valid evidence: `artifacts/studio-touch-click-only/checks.json` and `artifacts/studio-touch-valid-fixed/checks.json`, with corresponding screenshots. This reviewer inspected both fixed screenshots: pause text/buttons fit and the Resume focus outline is visible.

Evidence correction: the earlier `artifacts/studio-touch-before` run released the wrong finger and is INVALID defect evidence. Do not use its false checks or earlier displacement logs. Only the corrected comparison above establishes this issue. The harness is `tools/studio-touch-controls-smoke.mjs`; these are real browser touch events against a controls/CSS component, not a rendered-world or physical-phone acceptance run.

Repair: `secondaryTouchClick` supplements native behavior for non-primary touch only. Pause, Map, Resume, Close map, and both menu Return buttons activate after an in-bounds release with at most 12 pixels of movement. Dragging, cancellation, loss of capture, or disabled state cancels activation. Primary mouse/touch and keyboard clicks remain native; a matching compatibility click is consumed to avoid firing twice. It does not activate on pointerdown or suppress pointerdown defaults, allowing menu scrolling/cancellation.

Acceptance achieved in the component browser harness: held-joystick pause in both viewports, release movement, resume without drift. Secondary Map/Close/Return and ordinary mouse/keyboard browser activation remain separate checks; unit cases cover the helper behavior. Unit coverage additionally checks drag-out/back, outside release, pointercancel/lostcapture, disabled buttons, deduplication, and disposal. Cross-browser/hardware touch remains unassessed.

Source: `src/alternate/DistrictControls.ts` button setup; new `src/ui/secondaryTouchClick.ts`; `tests/secondaryTouchClick.test.ts`.

### GP-01: Taking Mummy's tiffins first allows a simultaneous Bhola delivery

Natural source-derived repro: complete the intro; collect Mummy's batch during 10:00–13:00; go to Bhola and accept a delivery. `TiffinRun.collect` rejects an existing Bhola job/ride through `otherJob`, but the reverse path does not check `tiffinRun.batch`: `gatherInteractions` always exposes Bhola, and `Missions.talkBhola`/`startJob` only check their own job/busy state. Both jobs can therefore exist concurrently.

Finishing Bhola's job calls `setCarrying(false)` while Mummy's batch may still have stops. The batch/objective and shared parcel representation no longer agree. This is not a natural-play runtime reproduction and does not establish a permanent progression block. A minimal repair should enforce the already expressed single-job rule in both directions, including races after dialogue acceptance. Acceptance: start each job first and attempt the other; the active route/parcel remain intact, with a useful explanation. No source edits made here.

Source: `src/economy/Tiffin.ts` `collect` (lines 139–163); `src/app/Game.ts` Tiffin host `otherJob` (about 1007) and Bhola interaction (about 3616); `src/missions/Missions.ts` `talkBhola`, `startJob`, `finishJob` (143–207, 272–279).

### GP-02: Save/Continue silently drops an active repeat delivery or tiffin batch

Trigger: accept a repeat delivery or collect a tiffin batch; choose Save game or Save & quit; reload/Continue. `Missions.job` and `TiffinRun.batch` are class-local state, absent from `SaveData`. `Game.persist` writes the save plus player/vehicle locations; `startSession` constructs fresh mission/tiffin systems and restores carrying only for the phone-return intro stage. Completed medals/stats/reputation and alternate story progress survive; the active route, clock/condition, and remaining batch do not.

This state loss is source-proven, but the intended active-job persistence policy is not documented. Existing `docs/TESTING.md` and phase-2 playtest cover saving after delivery completion, not during a job. The pause menu offers Save without explaining the distinction. Choose an explicit policy: persist the active job transactionally, or communicate and deliberately resolve cancellation before saving/quitting. Acceptance must test a partially delivered batch and an active timed delivery, alongside existing completed-progress saves. Avoid describing this as loss of all progress or ingredient money.

Source: `src/missions/Missions.ts:98`; `src/economy/Tiffin.ts:113`; `src/save/schema.ts:27–56`; `src/app/Game.ts` `startSession` (about 901, 984, 1011), `persist` (about 2299), and `pause` (about 2764).

### UI-03: Settings accepts movement keys that still invoke Pause/Help

Trigger: Settings → Keyboard → Move forward → P, then return to gameplay and press P. Settings rejects only Escape. `Input.rebind` removes the chosen code only from `REBINDABLE`; that list excludes pause/help, so P remains both forward and pause. `playingFrame` processes pause before movement. The primary movement key consequently opens pause. F1 similarly remains bound to help in the main game. Saved bindings propagate to later input owners.

The first five tests in `tests/inputBindings.test.ts` failed on the original source using actual key events through `Input`, then passed after repair. `reservedBindingMessage` now supplies a single reservation rule to `Input.rebind` and the Settings explanation/toast. Escape continues to cancel key capture; P/F1 are refused before mutation. Saved pause/help overrides are restored to defaults, and reserved codes are removed only from affected gameplay actions. Valid alternatives are kept; an emptied action recovers its unclaimed defaults without taking another action's custom keys. If all its defaults are occupied, it is visibly `Unassigned`, allowing an explicit remap rather than a new collision. Existing deliberate unbound actions are retained. Tests verify actual movement/action events after rejection, legacy load, and a second input owner. Native Settings focus/feedback still needs browser acceptance.

Source: `src/ui/Ui.ts:738–747`; `src/input/Input.ts:28–30,39–44,201–207`; `src/app/Game.ts:4285–4286`; shared alternate `DistrictControls.read` pause handling.

## Interaction-priority coverage

Current `selectInteraction` explicitly returns an eligible `deliver` candidate before proximity/facing preferences. `Game.gatherInteractions` creates that candidate from actual `Missions.deliveryHere`, `TiffinRun.deliveryHere`, or passenger drop eligibility. Facing uses centre distance, independently of a custom vehicle/bell reach distance. Doorbells remain available at neighboring gates while one visit is active; repeating the same house retains its existing answerer. No new priority defect was established by this review.

Existing `tests/interactionPriority.test.ts` checks eligible/ineligible completion precedence, custom-reach normalization, and ordinary bell/vehicle preference. `tests/sim/doorbell.test.ts` and `tools/doorbell-regression-smoke.mjs` target actual gate/answerer behavior. `tools/interaction-priority-smoke.mjs` uses real callback/input paths but explicitly relocates POIs and prepares a tiffin batch: it does not prove natural overlap of a particular destination and bell, nor ordinary acquisition of the job. Passenger bells are intentionally absent while driving. These distinctions must remain in acceptance claims.

## Short player journey and useful existing harnesses

An actual progression journey to verify with ordinary inputs: New Game/choose look → leave home and meet Bhola → ride to Hello Mobile Zone → collect the phone → return to Bhola → check stage 999 and +10 reputation/₹200 bookkeeping → accept one delivery → reach its destination and hand it over → inspect result/medal → Pause/Save → reload/Continue and verify completed progress. A shorter UI interruption journey after that save: Worlds → Canada → move, open map, pause/resume → Worlds → Japan → movement, pause/controller resume/local map → Return → Continue/saved story check. These are proposed acceptance journeys, not claimed runs.

| Harness | Actual useful coverage | Caveat |
| --- | --- | --- |
| `tools/playtest.mjs` | Keyboard navigation/drive helpers complete phone errand and accept delivery | Hardcoded route coordinates and scooter assumptions need checking against current map; long legs and opening flow; not run here |
| `tools/playtest2.mjs` | Completed delivery, result, save/reload, vehicle behavior | Needs `SEED_SAVE` from phase 1; reload comparison is logged without assertion; catch does not set nonzero exit; inspect result, not exit alone |
| `tools/cinematic-controls-smoke.mjs` | Remaps, movement/map/controller/two-thumb input across main/Canada/five destinations, return/scene disposal, opening/save reload | Two-thumb movement is released before pause; resume is clicked, so it missed UI-01/UI-02 |
| `tools/mission-cinematic-smoke.mjs` | Gurnam acceptance/save before cinematic and actual pursuit integration | Uses stage 999 and teleport fixtures; not phone-errand acquisition/playthrough |
| `tools/worlds-menu-smoke.mjs` | Destination entry/return and transfer lifecycle | Complementary to story completion, not a substitute |
| `tools/canada-life-smoke.mjs` | Canada residents/café saved purchase | Fixture-assisted district check |
| `tools/studio-touch-controls-smoke.mjs` | Real CDP multi-touch on actual district controls/CSS | Lightweight component fixture owned/run by lead |

## Verification and limits

Executed by this worker: first three district controller regressions failed on original source with the values recorded in UI-01. Five reserved-key/legacy-load regressions also failed before the input repair. After all three bounded repairs, `npx vitest run tests/inputBindings.test.ts tests/districtControls.test.ts tests/sharedInput.test.ts tests/secondaryTouchClick.test.ts --maxWorkers=1` passed 21/21 tests across four files. The controller tests use actual `Input`/`DistrictControls` with a minimal DOM/gamepad stub; they do not prove native browser focus or physical gamepad behavior. The corrected lead-run Chromium touch comparison establishes UI-02 as documented above: 2/2 click-only cases fail, 4/4 fixed pause/resume checks pass. The original touch fixture remains invalid evidence. Integrated build/tests and full-world/browser acceptance remain lead-owned.

Not assessed here: a complete ordinary-input campaign run; elapsed-time reward balancing; all festival/calendar combinations; mid-dialogue reload transaction recovery; every alternate activity completion; save-storage denial/quota runtime UX; full keyboard focus trapping and accessible-name audit; screen-reader announcements/contrast/zoom; spoken audio; actual phone/console controllers; GPU/art/performance; roof/collision ownership. The secondary-touch issue is established for the corrected pause component path; other click-only gameplay buttons need their own evidence before asserting a defect. No deployment or external messages were sent.
