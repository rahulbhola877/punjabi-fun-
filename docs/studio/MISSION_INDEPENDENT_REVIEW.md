# Independent mission/save review

Reviewed 2026-11-03 against the uncommitted mission/save changes over `f0a0b88cdcd8bcbe566712c0b0498dd17adfb75f`. Reviewer: the gameplay/UI studio worker, independently reading the mission worker's implementation and tests. No implementation or test files were changed by this review; no browser, full suite, or new focused test run was launched.

**Result: no confirmed source-level blocking defect found in the reviewed patch.** This is a source/test-design approval, conditional on the actual session-lifecycle checks below. The tests do not by themselves establish full-scene restoration or ordinary player acquisition/completion.

## Scope and exact paths reviewed

Read the actual diff and surrounding call paths in `src/app/Game.ts`, `src/missions/Missions.ts`, `src/economy/Tiffin.ts`, `src/missions/Rides.ts`, and `src/save/schema.ts`; cross-checked `Home.update`, `DayNight`, `sessionHour`, `Ledger`, `Player.spawn`, and the shared carry prop. Reviewed `tests/missionState.test.ts`, `tests/missionSaveGuard.test.ts`, and existing intro/save coverage. Also read the recorded baseline failures and focused pass log rather than inferring a pass from the test files alone.

The final reviewed `Game.startSession` includes `rides.end(false)` and `setCarrying(false)` before old vehicles/character visuals are disposed. Those lines matter: the tiffin prop is reusable and may be parented to either an old hand mesh or a vehicle rack.

## State and receipt review

| Contract | Independent assessment |
| --- | --- |
| Bhola/tiffin exclusivity | Both acceptance directions now check other job ownership. Bhola's `startJob` rechecks after dialogue; Mummy's collection rechecks before ingredient charge and validates day/window/customer availability. The phone intro also prevents optional delivery/ride admission. |
| Active delivery restoration | Snapshot includes destination identity, elapsed time, par, warmth-adjusted limit, condition, and route length. Restore resolves the ID against the actual destination list, rejects incompatible intro/other-job state, restores carrying and `lastDest`, and leaves expired deliveries unable to pay. |
| Prepaid tiffin restoration | Snapshot includes batch day, saved hour, ordered remaining IDs, and condition. Restore requires matching home day and served-ledger day, removes unknown/already-served IDs, deduplicates via the schema, preserves remaining order, and does not charge ingredients again. |
| Clock/day | `Game.startSession` changes to the saved tiffin hour only after successful validated restoration. Batch day must already agree with `save.home.day` and `econ.tiffinDay`; it does not silently replace them. `TiffinRun.update` expires a batch when its day changes or its hour reaches 14:30. The real `Home.lastHour` lifecycle is not exercised by the controller fixture; see required checks below. |
| Delivery completion | The active job is cleared, stats/medal/best and reward applied, then checkpointed before the thank-you/results awaits. The callback captures the actual job object; a stale callback cannot complete a replacement job. Expired/empty-condition jobs fail instead of paying. |
| Tiffin completion | The first stop is removed and served/reward/stat state updated before checkpointing; the final stop clears the batch/carry before the dialogue. The callback captures both batch and expected first customer, so an old callback cannot pay the next stop or a new batch. |
| Phone completion | After the first acknowledgement, stage is rechecked; reward and DONE stage are checkpointed together before the final explanatory dialogue. Reload during that latter screen does not re-offer the phone reward. Cosmetic `introCondition` remains unsaved; it affects a line, not the completion reward. |
| Cancel/fail | Bhola abandonment/failure and tiffin abandonment/expiry checkpoint cleared active state. A delayed Bhola cancellation is tied to the job originally offered. |
| Older/damaged saves | `activeJob` is optional. Invalid optional payloads do not invalidate the player's money/history. Unknown destinations cannot create an invisible carry owner. There is a deliberate limitation: schema-rejected payloads normalize to null before Game sees them, so Game's failed-restore toast applies to semantically rejected but structurally valid payloads, not every damaged payload. |

The write is one serialized save containing both completion receipt and cleared/remaining active work. This eliminates the previous normal reload window between payment and the next UI screen. It does not promise durability when browser storage itself rejects a write: `Game.persist` reports failure, retains in-memory progress, and a subsequent reload can still return to the last successful checkpoint. That limitation is accurately distinct from duplicate payment in a successfully written save.

## Passenger ownership and save refusal

The patch deliberately does not serialize live passengers. `Game.persist` returns false before changing `save.activeJob`, player/vehicle save data, or storage while a passenger ride is active. Pickup explains that saves pause; manual Save and Save & quit explain the concrete recovery actions. Automatic/intermediate save calls do not spam the player. `pause` continues its menu loop on a failed quit save, including storage errors, rather than leaving for title with an unsaved session.

Each ride stores the exact vehicle object. `dropHere`/`dropOff` require that same current vehicle, speed, and destination eligibility. A different auto cannot redeem it. Normal player exit ends the ride synchronously, and update handles other ownership changes. `end` clears `ride` before disposing the passenger and optionally checkpointing, releasing the save guard before completion writes. Successful drop-off calls `end(false)`, applies reward/stats once, then checkpoints once. `startSession` cleans up the previous passenger without writing into the newly selected save.

The NullEngine test actually parents/disposes a passenger model and checks caster ownership, not only a boolean flag. However, tests of the Game save guard use a prototype fixture with UI/player/vehicle dependencies stubbed. Native pause-menu behavior and a real auto exit remain browser acceptance items.

## Evidence read and remaining gates

Recorded worker evidence:

- `docs/studio/evidence/mission-admission-baseline.txt`: five admission/stale-offer regressions fail the pre-patch checkpoint in an isolated checkout.
- `docs/studio/evidence/mission-save-baseline.txt`: five save-refusal/passenger-ownership regressions fail that checkpoint. One earliest failure is the changed `persist` return contract; the file should not be represented as five independent end-to-end save journeys.
- `docs/studio/evidence/mission-focused-tests.txt`: 45 tests pass across four files. This reviewer read the result but did not rerun it. The worker separately reported a passing TypeScript check; integrated final-source checks remain the studio lead's responsibility.

The most material evidence gap is that `missionState.test.ts`'s `session()` helper constructs real controllers/schema, then manually reproduces Game's restoration order and saved-hour assignment. It does not call real `Game.startSession`. `missionSaveGuard.test.ts` calls real `Game.persist` and `pause`, but also does not cover session reconstruction. The following checks are therefore required before claiming the full save lifecycle is accepted:

1. **Same runtime, carrying on foot:** accept a real food job, Save & quit to title, Continue, and verify the carry mesh is alive/attached, the route matches, and the job can complete. This exercises the reusable prop and new character parent.
2. **Same runtime, carrying on a vehicle:** Save & quit from the vehicle, Continue on a safe standing spot with the vehicle retained and the same food state. Inspect that old vehicle disposal did not dispose the reusable prop.
3. **Partial tiffin batch with time:** complete one stop, save near a distinct hour, reload/Continue with a different standalone clock value, and verify `home.day`, `econ.tiffinDay`, restored hour, ordered remaining stops, condition, served IDs, money/stats, and no new ingredient charge. Advance through one real frame to catch interaction with Home/day rollover before declaring success.
4. **Receipt during acknowledgement:** reload after the reward checkpoint while its thank-you/result is still open; completion count and money remain paid once, and no completed stop/job returns. Pure-controller tests cover the logical contract; browser confirms actual UI/integration ordering.
5. **Live passenger:** manual Save and Save & quit retain the old checkpoint and current pause session with visible explanation; Resume, exit the original auto, then save/quit successfully. Complete another ride and verify its reward and passenger removal persist once.

These may be fixture-assisted browser integration checks if ordinary acquisition is too expensive for the validation slot, but that distinction must be explicit. This review does not ask for new campaigns, new passenger serialization, broader save migrations, or unrelated accessibility work.

## Disposition

The original GP-01 asymmetric admission and GP-02 silent active-food-save findings are addressed at the source/controller-test level by this patch. No additional confirmed defect was sent as a blocker. Keep the integration gates above visible until the lead/QA records their outcomes; do not relabel this review as a full gameplay playthrough or successful final build.
