# Original game studio review — 2026-11-03

Status: in progress. This is a Codex adaptation of the attributed studio workflow, not a Claude agent run. The user explicitly changed direction to Codex; Claude Code will not be installed or used, and Claude hooks will not run in this repair checkout.

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
| ACTOR-01–05 | S2–S3 / P1 | Street quarrels, avoidance/contact and shift routes could displace roof actors without a support transition | Repaired ownership/height/shift contracts; causal regressions pass; actual roof browser evidence pending |
| DIST-1–5 | S2–S3 / P1 | Japan/China actors omitted from player collision; partial WIP lacked reciprocal/swept/static checks and route recovery | Repaired shared motion and bounded walkers; 30 focused tests pass. First browser fixture stopped at unrelated Aiko; revised open-street fixture pending, original failed evidence retained |
| UI-01–03 | S2–S3 / P1 | Gamepad resume leaked/repeated commands; secondary touch could not Pause; reserved menu keys accepted as movement remaps | Fixed with causal tests. Corrected component touch comparison fails click-only baseline and passes 4 fixed assertions; full-world interruption check pending |
| MS-01–05 | S1–S2 / P1 | Overlapping food jobs; active jobs lost on reload; non-atomic receipts; passenger detached from vehicle identity; failed saves still quit | Repaired ownership, backward-compatible save snapshots, receipt ordering and refusal behavior. Production delivery save/reload passes, including same-runtime carry mesh and vehicle entry; tiffin check running |
| MS-COMPAT | S2 / P1 | Independent review found new guards unnecessarily prevented early auto fares and phone collection during a ride | Bounded compatibility correction in progress; original interactions must remain available |
| GP-01 / IR-01 | S3 / P1 | Lunar batches and later shadow/depth meshes escaped flight visibility ownership | Repaired one-time presentation lifecycle. Natural flight/return passes; inspected crossing hides outpost, descent restores it. Launch-specific capture missing; no claim that every shot was pixel-verified |
| GP-02 | S3 / P1 | Merged names lost silhouette shadow eligibility and batching could erase layer/visibility behavior | Shared caster policy and property-preserving partitions pass causal regressions; restored shadow cost is not an optimization claim |
| GP-05 | S3 / P2 | High↔Ultra retained the previous allocated AO targets/settings | Recreate AO on quality changes; causal actual-Game test passes; production preference/AO check pending |
| PERF-01 | S3 / P2 | Historical unchanged guard failed three Low views | Fresh unchanged guard pending; no baseline, threshold or resolution change authorized to hide failures |
| ART-01 | S4 / P2 | Regional scenery remains sparse/repetitive and uneven in normal captures | Current Japan/China/Space captures inspected; functional repairs do not imply finished art or complete countries |

## Validation checkpoint

Product source `682d82fadb8657de772c7c194849f476937dc6cb` passed **702 tests across 156 files** and the production build in isolation. The build retains the existing large Space chunk warning. Exact logs and 559-file build hash manifest are under `artifacts/studio/integrated/`.

At that source, production browser navigation passed five alternate-world round trips, natural unskipped Space flight, Canada and North Airfield, with High/renderScale 1. The actor browser's first failure is retained and diagnosed as an invalid staged approach obstructed by another NPC; collision thresholds are unchanged in its corrected fixture. Save tests use explicit persisted-job/position fixtures and actual Continue/E/Save & Quit UI; they are not an ordinary mission acquisition or travel journey.

Final source validation, fresh workload guard, ordinary-input journey and remaining browser results will be appended after the compatibility correction. Unit counts do not establish gameplay quality, phone FPS, physical multitouch/gamepad behavior or audible music quality. Tests/build/software rendering are serialized; no main push or publication has occurred.
