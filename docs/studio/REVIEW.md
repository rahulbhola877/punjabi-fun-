# Original game studio review — 2026-11-03

Status: in progress. This is a Codex adaptation of the attributed studio workflow, not a Claude agent run. The user explicitly changed direction to Codex; Claude Code will not be installed or used, and Claude hooks will not run in this repair checkout.

## Source and preservation

- Original remote baseline inspected: `3e61edc2631ba7692f051a10ff53ac47a7b4b3e0`.
- Repair checkout: `/workspace/punjabi-original-repair`, branch `repair/original-triage-20261103`.
- Interrupted partial NPC edits preserved at `8b1c3edf8597b5f918809b343bce285eb9f00f7b`; its earlier focused-test result was unknown. It is under review now.
- Rejected reboot remains untouched in `/workspace/punjabi-fun-` at `74eeb12aba57e969afe18486f59f53ddbe06ef12`; public game/Site versions are unchanged.
- Upstream template is pinned to `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`, MIT attribution retained. The earlier isolated Claude-template copy is dormant and separate; its two configuration/update-disable checks ran before the user's Codex-only correction. No Claude agents ran.

## Setup availability

`AGENTS.md` loads `docs/studio/CODEX_WORKFLOW.md`. Five Codex specialists have actually been assigned and have begun work. Personal skill installation is blocked by a read-only canonical directory and HTTP 403 on the supported fallback; no globally installed skill is claimed. The repository-local setup is reusable with this checkout and does not require Claude or external hooks.

## Active roles and ownership

| Codex worker | Role and scope | Exclusive output/source |
| --- | --- | --- |
| studio_actor_ownership | AI/gameplay ownership repair | Crowd.ts, Jhagde.ts, roof regression tests, ACTOR_REVIEW.md |
| studio_district_collision | AI/world collision repair | JapanWorld.ts, ChinaWorld.ts, districtActorCollision.ts, district actor tests, DISTRICT_COLLISION_REVIEW.md |
| studio_gameplay_ui_audit | Gameplay/narrative and UI review | GAMEPLAY_UI_REVIEW.md; bounded DistrictControls repair/tests only after causal confirmation |
| studio_graphics_performance | Technical artist/performance audit | GRAPHICS_PERFORMANCE_REVIEW.md; source read-only |
| studio_qa_plan | QA plan and browser regression tooling | QA_PLAN.md, studio-actor-regression.mjs; source read-only |
| Root | Studio lead/integration | Setup, priority ledger, integrated validation, final evidence |

No other upstream role is claimed active. No independent worker owns deployment or Git publication.

## Prioritized current findings

| ID | Severity / priority | Evidence | Acceptance / status |
| --- | --- | --- | --- |
| ACTOR-01 | S2 / P1 | Baseline deterministic test: rooftop kite actor borrowed by street quarrel; moved 2.4 m at roof height | Keep roof/external actor ownership out of street AI, preserve valid street gatherings; repair under way |
| NPC-01 | S2 / P1 | Baseline deterministic Japan/China movement passes through named NPC centres | Reciprocal supported collision with stationary/moving actors and reachable interactions; repair under way |
| NPC-02 | S3 / P1 | Preserved WIP focused regression fails diagonal sliding; blocked walkers also lack full static/actor checks | Finish and review the partial helper; no unvalidated WIP acceptance |
| INPUT-01 | S2 / P1 candidate | Source review: synchronous gamepad resume can re-pause or leak action into gameplay in alternate controls | Deterministic repro requested before repair; not yet a runtime claim |
| PERF-01 | S3 / P2 | Historical unchanged guard had three Low failures; no fresh measurement in this run yet | Preserve budget and quality; inspect workload and report fresh evidence/limits |

## Evidence policy

Earlier baseline assessment: 25 targeted existing tests passed; four diagnostic tests intentionally failed. These do not count as final validation. Final focused tests, full suite, build and bounded browser checks are pending. Tests/build/software rendering will be serialized. Browser fixture positioning must be labelled separately from ordinary-input journeys; screenshots and native-device limitations must accompany appearance/performance claims.
