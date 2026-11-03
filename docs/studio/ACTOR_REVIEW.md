# Actor ownership and support review — 2026-11-03

Role actually run: AI / gameplay specialist, using the repository-local Codex studio workflow. No Claude runtime, hooks, installation, deployment, push, or commit. Source ownership: `src/crowds/Crowd.ts`, `src/combat/Jhagde.ts`, and new `tests/roofActorOwnership.test.ts`. Other workers' changes were preserved.

## Source and scope

Checkout: `repair/original-triage-20261103`, HEAD `8b1c3ed`, based on `3e61edc`. The HEAD WIP preserves the separate Japan/China collision work; this review did not edit those files. The separate rejected reboot and original assessment evidence were not changed.

Read the real `Crowd`, `Jhagde`, `Kites`, `Processions`, `Gossip`, shift/cast, vehicle-threat producer, and relevant combat ownership paths. The earlier external diagnostic at `/workspace/original-game-assessment-20261103/tests/roofActorOwnership.test.ts` supplied the minimal quarrel repro. New regressions use the real `Crowd.spawn`, fixed simulation, and `Jhagde` selection/handoff code with Babylon NullEngine and a ground-ray stub. They do not establish Havok/world geometry correctness or rendered appearance.

## Findings and repair

| ID | Severity / priority | Evidence and trigger | Repair / status |
| --- | --- | --- | --- |
| ACTOR-01 | S2 / P1 | Reproduced deterministically. `streetFree` accepted a six-metre-high `onRoof`/`kite` keeper. `gatherTamasha` selected it before a nearby eligible walker and assigned horizontal ring movement while ground snapping deliberately preserved roof Y. | Eligibility excludes rooftop/kite, away, shift transit, pole/dhol, non-standing, indoor, contact and already-owned residents. An eligible street walker still joins and moves. Fixed in focused simulation. |
| ACTOR-02 | S2 / P1 | Reproduced deterministically. The public `quarrelBetween` checked only `brain` and could accept a rooftop actor directly. | Apply the same `streetFree` contract to both supplied participants. Positive neighbour quarrel still starts and approaches. Fixed in focused simulation. |
| ACTOR-03 | S2 / P1 | Reproduced deterministically. Stationary player avoidance and vehicle contact used XZ only. A player below displaced the roof actor by about 0.5 m; a vehicle pushed an explicitly owned procession rider to X=1.35 instead of its scripted X≈0.983. Horns also armed roof-walker dodges. | Ambient roof/kite steering stays at its current supported position; explicit brains retain precedence. Horns/vehicle contact exclude roof, kite, indoor, away and non-standing actors. Horizontal avoidance/contact checks also reject height separation above 2 m. Same-level street walkers still dodge and produce bump callbacks. Fixed in focused simulation. |
| ACTOR-04 | S2 / P2 | Reproduced with an explicitly scheduled roof actor. Closing time started a street trip at roof height; an actor born off shift returned at ground Y=0 rather than its saved Y=6. | Roof/kite posts leave only out of nearby view, skip nonexistent street/stair routes, and restore full saved post XYZ on return. Ordinary route departures/returns remain working. Fixed in focused simulation; current dynamic Kites normally despawn at night and do not assign shifts themselves. |
| ACTOR-05 | S3 / P2 | Reproduced deterministically. The XZ neighbour grid let residents on different floors exert avoidance forces on one another. | Ignore cross-floor neighbours/player, retaining same-level avoidance. Fixed in focused simulation. |

The ownership boundary deliberately does **not** reject every `brain` or freeze every `onRoof` actor. `Processions.placeFloat` places its rider each tick and gives it a zero-velocity brain; walkers receive steering brains. Both remain active. A dedicated positive regression also moves a supported actor through its explicit velocity brain.

The roof departure/return branch preserves `post`, resets interpolation and movement state, and never calls the ground-only `place` helper. Newly away actors skip the remainder of their simulation tick. No universal height clamp, removal of street crowds, frame-resolution reduction, or threshold relaxation was used.

## Validation

1. Before edits: `npx vitest run tests/roofActorOwnership.test.ts --maxWorkers=2` — **9/9 new regressions failed** on the original owned source. Failures cover real onlooker selection, public quarrel handoff, player/vehicle/horn displacement, cross-floor avoidance, shift/wake support, and procession rider interference. Raw output: [ACTOR-before.log](evidence/ACTOR-before.log).
2. After repair, with three additional positive movement controls: `npx vitest run tests/roofActorOwnership.test.ts tests/crowdVisibility.test.ts tests/dailyLife.test.ts tests/processions.test.ts tests/rooftops.test.ts --maxWorkers=2` — **5 files, 22 tests passed**, 4.50 s. Includes 12 actor ownership regressions plus 10 existing visibility, daily-life, route and roof-coordinate checks. Raw output: [ACTOR-focused.log](evidence/ACTOR-focused.log).
3. `npm run typecheck` — **failed in a concurrently edited file outside this worker's ownership**: `tests/districtControls.test.ts:62`, TS2345, an `it.each` tuple supplies `[index, label]` while its callback declares only `index`. No diagnostics in the actor-owned source/test. Reported to the studio lead; this is an integration check to rerun after that owner fixes its file. Raw output: [ACTOR-typecheck.log](evidence/ACTOR-typecheck.log).
4. `git diff --check -- src/crowds/Crowd.ts src/combat/Jhagde.ts tests/roofActorOwnership.test.ts` — passed.

No full suite, build, or browser workload was run by this worker. The focused run preceded a type-only rename of the private test adapter's parameter to avoid name shadowing; executable test behavior is unchanged. The subsequent typecheck included that final test source.

## Remaining acceptance and hypotheses

- **Pending browser evidence, not denied:** production game and real-world roof support must be observed after integration. The existing probe exposes `kites()` with flyer `id`, source `roof` XYZ and actor `standing` Y, plus `resident(id)` with actor XZ, brain, away/trip and velocity. Compare those while nearby quarrels run and vehicles/player pass below. Inspect ordinary traffic, crowds and a procession visually. Current deterministic tests intentionally do not claim this browser gate passed.
- The 2 m separation check is a coarse floor filter, not collider overlap or general slope support. Actual ray origin, streamed roof/wall support, hill transitions and rendering interpolation can still have independent defects.
- `Combat.engage` explicitly installs a movement brain without street eligibility. Player attack acquisition already checks vertical difference ≤1.2 m, but scripted combat and rooftop attacks remain separate ownership paths. This repair intentionally preserves explicit brains; it cannot guarantee a roof actor stays bounded after an unrelated system deliberately claims it. No reproduced broad combat fix is claimed.
- `Jhagde.endQuarrel` clears participant/onlooker brains and timers without identity tokens. A cross-system takeover during an active quarrel could lose ownership on release; no causal runtime reproduction was established here, so this was not expanded into an ownership-system rewrite.
- Kites source controls normal night/rain/distance removal; the scheduled-roof tests are defensive contract coverage. They do not prove the normal dynamic flyers were receiving shifts in production.
- The ordinary street crowd and legitimate direct neighbour quarrels pass positive controls. Natural event cadence, escalation, release, gossip lifecycle and complete procession mesh/support coupling still need integrated runtime acceptance.

No sandbox action was denied and no outcome is uncertain. The remaining integration typecheck and browser acceptance are explicit pending gates, not claims that every airborne cause has been fixed.
