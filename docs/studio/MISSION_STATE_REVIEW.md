# Original Punjabi Fun: mission and save repair

Date: 2026-11-03. Role actually run: gameplay/save specialist, using the repository-local Codex studio workflow. This review targets the original Babylon/Havok game. No Claude hooks, new campaign, external publication, push or commit were performed by this specialist.

The isolated before/after source reference is `f0a0b88cdcd8bcbe566712c0b0498dd17adfb75f`; its mission/save files still contain the pre-repair behavior. Other workers' actor, input and renderer changes were preserved. Owned source: `src/missions/Missions.ts`, `src/missions/Rides.ts`, `src/economy/Tiffin.ts`, `src/save/schema.ts`, `src/app/Game.ts`; new focused tests only. Root additionally authorized the one-line day-field migration in `tools/interaction-priority-smoke.mjs`.

## Findings and disposition

| ID | Severity / priority | Original trigger and actual behavior | Expected behavior / repair | Evidence |
| --- | --- | --- | --- | --- |
| MS-01 | S2 / P1 | Collect Mummy ji's prepaid tiffins, then accept Bhola's delivery. Both jobs become active while one carrying prop represents both. | One job owns the hands/vehicle. Admission checks cover both orderings and the intro; Bhola and Mummy ji recheck after awaited acceptance. | Before-source regression fails; repaired unit integration passes. |
| MS-02 | S1 / P1 | Save/reload during a delivery or prepaid tiffin round. Runtime jobs disappear although money, served orders and completed rewards remain saved. | Optional backward-compatible delivery/tiffin snapshots preserve actual remaining work and restore carrying. | Real schema round trips plus real `Game.persist` path tests. Browser Continue journey assigned to root QA. |
| MS-03 | S1 / P1 | Refresh during a completion conversation. Reward/removal checkpoint occurs only after later dialogues/results; intro can save a paid reward while remaining in RETURN. | Mutation, reward, stats, served ledger and removal form a checkpoint before the next awaited screen. | Reload while dialogue Promise is pending; exactly one reward and no reopened stop. |
| MS-04 | S2 / P1 | Pick up twice, or change autos while carrying a passenger. The original passenger has no recorded vehicle owner; another auto can complete its fare. | One passenger and one exact `Vehicle` owner. Invalid/overlapping pickups are rejected; leaving/changing vehicles disposes passenger and releases caster registration. | Before-source passenger checks fail; real Babylon NullEngine passenger tests pass. |
| MS-05 | S1 / P1 | Save & quit during an unsaved passenger ride, or when storage rejects the write. The old implementation proceeds to title. | Refuse unsafe ride saves without touching the checkpoint. Keep pause menu open after any refused/failed save. | Real `Game.persist` and pause-loop tests; both before-source quit checks fail. |

## Actual state contract

- Save key remains `pfs.save`, version remains 3. Historical money, reputation, flags, medals, bests, stats, home, people, vehicles and economy fields retain their existing validation and migration. An optional `activeJob` tagged union is added; missing/null means no repeat job.
- Delivery: `{ kind: "delivery", destId, elapsed, par, limit, condition, routeLen }`. Restoration resolves `destId` against authored destinations, retains the existing timer/bonus limit and damage, and does not pay or restart the job. Expired/spilled restored food fails rather than paying.
- Tiffin: `{ kind: "tiffin", day, hour, stops, condition }`. `stops` is the remaining ordered customer-ID list. Collection already charged for these ingredients; restore never charges again. A live batch now owns its collection `day`. Restore requires that day to match both `save.home.day` and `save.econ.tiffinDay`. The saved hour is installed only after a batch is restored successfully, so lunch pay and expiry use the same checkpoint clock. Existing served IDs are authoritative and cannot be resurrected by a damaged remaining-stops list.
- Structural validation rejects nonfinite/out-of-range timer/condition/day/hour data and unknown tags. Duplicate tiffin IDs are deduplicated; restore removes unknown and already-served customer IDs while preserving valid remaining order. Unknown delivery destinations or inconsistent batch-day ownership cannot produce an invisible carrying owner. Damaged optional job state does not reject historical save progress.
- Carrying is derived from intro RETURN, a live delivery, or a live tiffin batch. On session switch the reusable prop is detached before the previous actor/vehicle is disposed, then attached to the restored owner. Food jobs resume at the existing safe on-foot save position; seat/driving state is not claimed to persist.
- Collection, job start, cancel, failure, spoil, partial handover and completion request checkpoints. Automatic delivery saves are enabled now that the active job can be represented. Awaited UI is outside the completion checkpoint. Stale interaction callbacks retain their original job/batch identity and cannot deliver later work.
- The phone errand still restores from `introStage`; reward and DONE are checkpointed together. Its cosmetic `introCondition` is not serialized and has no reward/failure effect.

## Passenger save boundary

An active passenger currently contains scene objects (`BuiltHuman`, animator, parent auto and caster membership). The base save restores the player on foot and deliberately excludes transient traffic vehicles. Reconstructing a ride safely requires a stable saved owning-auto identity (including an explicit policy for transient autos), passenger appearance, destination/fare/comfort/elapsed state, and a restore sequence that creates the auto and seats both driver and exactly one passenger before updates run. This pass does not claim that support.

All writes are refused while a passenger is active, preserving the preceding checkpoint byte-for-byte. Pickup explains that saving pauses; explicit Save and Save & quit show the reason. Refused automatic saves do not repeatedly toast. Save & quit remains in its menu on refusal or storage failure. Drop-off or getting out clears the live owner and checkpoints the resulting progress. Consequently closing the browser during a ride still returns to the previous checkpoint; the passenger and any other changes since that checkpoint are not saved. This limitation is visible rather than silently reported as a successful save.

## Validation and evidence

- [Before-source admission regression](evidence/mission-admission-baseline.txt): 5 failed, 1 passed, 18 unrelated cases skipped. Reproduces tiffin-before-Bhola, both stale acceptance races, expired collection offers, and missing cross-job admission protection.
- [Before-source save/passenger regression](evidence/mission-save-baseline.txt): 5 failed, 3 unrelated cases skipped. Reproduces unsafe ride write, both failed-quit paths, overlapping pickup, and wrong-auto completion. Original files executed in `/tmp/punjabi-mission-baseline-uontpmze`; the working source was never replaced.
- [Repaired focused run](evidence/mission-focused-tests.txt): 4 files, 45 tests passed. Command: `npx vitest run tests/missionState.test.ts tests/missionSaveGuard.test.ts tests/intro.test.ts tests/save.test.ts --maxWorkers=2`. This includes 32 new regressions and the existing 13 intro/save checks. Dialogue interruption, mid-job reload, each tiffin stop, final clearing, cancellation/expiry, corrupt/old saves, day ownership, actual Game save/pause behavior and Babylon passenger cleanup are covered.
- `npx tsc --noEmit` passed after correcting only a private-property type intersection in the new test fixture. `git diff --check` passed.
- A final carry-prop detach was added after the focused log above; the integrated exact-source suite/build and real Save & quit/Continue mesh check remain assigned to root. No final release/build/browser pass is claimed here.
- `tools/interaction-priority-smoke.mjs` now prepares the synthetic one-stop tiffin batch with `day: g.save.home.day ?? 0`. This is a required state-contract migration; its real E/touch callback, reward, served-ledger and bell-priority assertions and thresholds were not changed.

## Remaining evidence and limits

Root QA owns the final integrated suite/build, a production fixture-assisted delivery/tiffin Continue and reload-during-thank-you journey, and any ordinary-input journey. Independent review is in `MISSION_INDEPENDENT_REVIEW.md` when available. The focused controller/schema/NullEngine checks do not establish rendered carrying attachment or production browser storage behavior. No active passenger restoration, campaign replacement, extra economy design or rendering-budget change was introduced.
