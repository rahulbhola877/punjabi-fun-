# Codex game studio workflow

## Provenance and adaptation

Adapted on 2026-11-03 from Donchitos' [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios/tree/05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418), pinned commit `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418` (1.2.0). Retain `UPSTREAM_LICENSE.txt` with this adaptation. Source references: `.claude/agents/{technical-director,lead-programmer,qa-lead,qa-tester,game-designer,ai-programmer,ui-programmer,technical-artist,performance-analyst}.md` and `.claude/skills/{team-qa,bug-triage,regression-suite,project-stage-detect}/SKILL.md`.

This setup uses Codex collaboration tools and the game's real npm/browser tooling. It translates role responsibilities, severity versus priority, staged QA, regression mapping and evidence gates. It does not emulate Claude tool grants, model names, slash-command execution, event hooks, update checks or permission modes. No external hook is required. Upstream's approval prompts and engine-specific assumptions are replaced by the current user's authorization and the detected engine. No automatic updates or external downloads occur.

This repository-local setup is available through `AGENTS.md` and these documents. It is not a globally installed personal skill. The personal skill checkout was read-only and the supported fallback returned HTTP 403; the repository-local setup remains usable independently.

## Entry and preservation

1. Inspect status, branch, recent history, active workers and running commands. Preserve WIP before switching scope.
2. Identify the actual product and engine. This repair targets the original Babylon/Havok Punjabi Fun game, not the separate Three r187 reboot.
3. Inventory gameplay entry, missions, saves, actors, worlds, controls, graphics, audio and performance tooling. Existing test counts are not proof of a playable journey.
4. Record scope, immutable baseline, known failures and the active specialist set in `docs/studio/REVIEW.md`.

## Specialist roles

| Role | Responsibility | Required result |
| --- | --- | --- |
| Studio lead / technical director | Scope, architecture, ownership and final integration | Ordered repair plan and honest acceptance ledger |
| Gameplay / narrative reviewer | Actual progression, mission/reward/save contracts, reachable interactions | Reproducible failures and a player journey, without replacing the game's design |
| AI / world reviewer | Actor ownership, support, collisions and world transitions | Minimal causal repros, reciprocal collision and transition cases |
| UI / accessibility reviewer | Keyboard, touch, controller and focus semantics | Context-correct controls with screenshots and interruption cases |
| Technical artist / performance analyst | Material/geometry quality, scene workload and measured bottlenecks | Matched captures and measurements; distinguish software renderer from device FPS |
| QA lead / tester | Independent coverage, regression verification and release gate | Pass/fail/not-run per acceptance item and raw evidence paths |

Use only the specialists needed for the task and available concurrency. Roles may be combined; report the combination. Give each worker an exact destination and exclusive source ownership. Begin broad audits read-only, prioritize evidence-backed defects, then assign bounded repairs. Give independent reviewers raw source/evidence and acceptance criteria, not a prescribed verdict.

## Triage and repair cycle

For each finding, record ID, severity, priority, confidence, source/build, trigger, expected/actual behavior, impact, owner, test and status. Severity describes impact: S1 crash/data loss/progression blocker; S2 major broken feature; S3 degradation with workaround; S4 cosmetic. Priority describes repair order. Distinguish reproduced runtime, deterministic test, source-proven path and hypothesis.

1. Reproduce and isolate the smallest causal defect.
2. State observable acceptance and regression coverage before editing.
3. Repair with minimal changes preserving established interactions and art. Avoid opportunistic rewrites.
4. Run focused tests, independent source review, then integrated suite/build.
5. Exercise actual browser behavior where it matters. Label fixture-driven checks separately from ordinary-input journeys. Inspect pixels for art/camera claims and listen for sound claims.
6. Save a recoverable checkpoint with exact base and evidence. Keep unresolved defects visible; do not label an incomplete review complete.

## Evidence gate

| Change | Evidence required |
| --- | --- |
| Logic or state | Regression that fails the original defect and passes the fix |
| Cross-system behavior | Integration test and relevant browser flow, or explicit blocked browser case |
| UI, camera or appearance | Actual matched screenshots and visual review, not geometry assertions alone |
| Performance | Same route/settings/population, actual workload, renderer/device limitations; unchanged budgets |
| Release | Final exact-source tests/build, remaining-risk ledger, current authorization and remote-state check |

Full test runs and software browser workloads must not compete. Never invent a pass for an interrupted process. Do not change thresholds, hide actors, drop resolution or remove gameplay to obtain a green result. Ship neither a replacement map nor a new campaign under a bug-fix request.

## Current project validation commands

- Focused: `npx vitest run <relevant test files> --maxWorkers=2`.
- Integrated: `npm test -- --maxWorkers=2`, then `npm run build`.
- Browser: inspect the selected `tools/*smoke.mjs` script first, run against the exact production build using the documented URL and `BROWSER_PATH=/usr/bin/chromium SOFTWARE=1` where supported.
- Performance: inspect `tools/budget.mjs` and profiling scripts; preserve baseline/threshold files. Software rendering cannot establish phone or PC FPS.

Choose meaningful checks for the defects and whole-game risk map; do not run every script blindly or equate assertions with independent journeys.
