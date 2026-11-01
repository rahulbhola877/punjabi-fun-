# Cinematic worlds: recovery handoff

This branch adds shared controls, clearer water and material response, real in-game cinematics, and destination-arrival repairs. It is a reviewable recovery checkpoint, **not full visual or performance acceptance of a finished game**. Japan and China render more work with the new shadows; further optimization is required.

## Source and integration

- Base: remote `main`, `f3fada9ee7ccded22e52c60ae47b4104c1f99531`, fetched 2026-11-01.
- Implementation branch: `recovery/cinematic-worlds-20261101`.
- Saved local branch `work` remains at `16d38ea`; remote main was preserved. Nothing was pushed or deployed.
- Remote implementation heads were inspected. All non-Dependabot implementation heads were ancestors of main; none supplied a recovery commit for the offline session's reported unpushed changes. Those bytes have **not** been recovered or assumed present.
- Reconcile any later recovered optimization, planting, slope, bridge-water-drag and indoor-rain changes before merging this branch. This branch does not claim to validate those unavailable changes.

The handoff archive contains a Git bundle and mailbox patch with this branch's commits, this report, raw measurement/check JSON, representative screenshots, and final test/build logs. Restore into a checkout containing the base commit, then review the branch before integration. The bundle requires that base; it is not a standalone copy of all historical assets.

## Implemented behavior

| Request | Delivered behavior | Acceptance limits |
| --- | --- | --- |
| Consistent controls | All five alternate worlds use saved keyboard bindings, shared controller actions, camera-relative walking and an analog touch stick. Escape/Start pauses; M/Back opens a local controls/pause panel. Return buttons restore the main game and dispose the alternate scene. | Controller checks use a standard browser gamepad mock; touch checks dispatch pointer input to the real stick. Physical devices still need testing. M/Back is not a local map in these destinations. |
| Water and shores | China has a lowered visible river bed, stone bank lining and submerged rocks. Japan has a clear koi pond, lighter bed and submerged pebbles. Both share transparent depth colour, moving normals and broken edge foam. Neon uses a night palette and island-distance shoreline foam. | No full scene planar reflection/refraction pass, underwater gameplay or ocean simulation. Canada has snow/ice treatment, not a newly authored lake. |
| Surface and atmosphere | Scene-owned, shared PBR colour/normal maps at world scale; ACES, sun/sky contrast, fog, environment response and bounded shadow maps in the four 3D alternate worlds. Canada snow gets neutral grain/wind ripple and the rink a separate ice finish. Saved China evening lighting is restored. | Existing geometry and characters remain visibly stylized. Main Punjab is largely the existing base artwork. Pixel retains its intentional 2D art; its controls were integrated. These are compact destinations, not complete countries. |
| Cinematic opening | A real camera drone approach, descent and character introduction at new-game start. Seen state is saved; replay is available from pause. | Opening uses existing city geometry. Longer authored animation, dialogue delivery and editorial polish remain. |
| Interaction and mission cinematics | Gurnam's accepted mission handoff, Japan/China story moments and pond feeding; an actual active police pursuit has a patrol/player camera sequence. | Conversation candidates avoid static physics obstructions and improve subject separation, but visual-only trim/pillars can still occupy the foreground. More authored staging is needed. |
| Safe cinematic lifecycle | Click/touch skip, Escape/Space/Enter and controller A/B/Start; camera restore after natural completion, skip, replacement or disposal. Hosts freeze simulation and clear held input. Gameplay saves mission/reward state outside cinematic callbacks. | Unit tests exercise natural completion and lifetime paths; browser checks emphasize skip/replay/reload and real mission behavior. |
| Useful optimization | More Neon and moon static scenery is spatially batched. Full-resolution balanced graphics replaces the old one-tap 50% render-scale shortcut. Shared maps and bounded selected shadow casters avoid unbounded per-prop resources. | Overall performance acceptance remains open. New shadows and PBR effects increase work and CPU time in the matched comparisons below. No thresholds or timeouts were relaxed to claim an improvement. |
| Reliable travel arrival | Immediate camera/visibility synchronization, destination-specific scenery readiness and two rendered frames before revealing arrival. Failure is bounded and returns to the origin with a retry message. | Waiting for global `scene.isReady()` stalled on unrelated inactive resources, so readiness is scoped to destination scenery. Global readiness can still be false while local visible snow is ready. |

## Verification

The complete unit suite passed **125 files / 550 tests** on 2026-11-01 (412.72 seconds, bounded to two workers). Subsequent conversation-composition and saved-evening changes passed targeted tests/typecheck; the final production build also runs TypeScript checking. See [evidence](recovery-evidence/).

Actual Chromium browser flows passed:

- New game opening, Escape skip, pause replay, save/reload without replaying the opening.
- Japan, China, Neon, moon and Pixel: remapped movement, absence of the old hard-coded W action after remapping, pause freeze, controller stick, analog touch stick, return and scene disposal.
- Japan's tea errand, koi feeding, saved story re-entry and return to one main scene; China's story, saved re-entry and return to one main scene.
- Gurnam mission acceptance/pistol flags persisted before the cinematic; Space skip restores play.
- A car crossing a police checkpoint during an active mission triggers a real chase and cinematic; skip retains wanted state and resumes play. The final run reset the checkpoint setup and waited for rendered frames, resolving an earlier nondeterministic test setup.
- Canada through the actual Worlds menu at 1280×720 high quality: nine snow batches enabled, all locally ready when travel finishes. Captured at completed arrival without a later delay hiding culling problems.
- The matched district renderer completed all six views without browser errors or external requests; final source also passed the saved China evening-lighting assertion.

The initial unlimited-concurrency unit run timed out a world-layout test under contention; bounded reruns passed without changing test budgets. An earlier browser run was invalidated by rebuilding production while its old lazy chunks were in use. Final browser runs completed before the final build. Earlier failure artifacts remain local diagnostics and are not included as acceptance captures.

Reproduction (install dependencies first):

```sh
npm run build
npm test -- --maxWorkers=2
# Start npm run preview -- --host 127.0.0.1, then:
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/cinematic-controls-smoke.mjs
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/mission-cinematic-smoke.mjs
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/japan-smoke.mjs http://127.0.0.1:4173/
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/china-smoke.mjs http://127.0.0.1:4173/
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 node tools/travel-visual-smoke.mjs
# Start npm run dev -- --host 127.0.0.1, then:
BROWSER_PATH=/usr/bin/chromium SOFTWARE=1 LABEL=after node tools/district-render-audit.mjs
```

## Measured render work

The baseline is a detached `f3fada9` checkout. Both versions run the actual world modules with identical fixed cameras, broadleaf/cottage/corner-shop/pickup preload, full **1280×720 at scale 1**, and the same system Chromium/SwiftShader renderer. Measurements ran serially, not alongside other browser tests. Four initial frames are discarded; each view gathers at least 20 samples over at least six seconds, bounded at 60 seconds. Draws are per-render deltas; triangles include submitted shadow geometry, not just visible colour-pass geometry. Scene render CPU and pre-render update CPU are instrumented separately. Raw data includes p95, frame intervals and renderer identity.

| Matched view | Draws before → after | Submitted triangles before → after | Median render CPU ms before → after | Median update CPU ms before → after |
| --- | ---: | ---: | ---: | ---: |
| Japan street | 148 → 249 | 101,342 → 249,218 | 4.4 → 8.1 | 0.8 → 1.2 |
| Japan pond | 40 → 141 | 17,310 → 165,186 | 1.5 → 4.3 | 0.7 → 0.8 |
| China street | 233 → 360 | 213,228 → 400,588 | 6.0 → 11.2 | 0.8 → 1.1 |
| China river | 57 → 182 | 53,460 → 238,516 | 2.5 → 5.6 | 0.7 → 1.0 |
| Neon | 195 → 97 | 12,515 → 13,503 | 2.5 → 3.9 | 0.2 → 0.3 |
| Moon | 215 → 205 | 144,249 → 212,679 | 4.4 → 5.7 | 0.8 → 0.5 |

Neon meshes fall from 250 to 102 and draw submissions by 50.3%. Moon meshes fall from 332 to 277 and draw submissions by 4.7%. These are real batching savings, but neither proves a frame-time improvement with the added effects. Japan/China's new shadow pass substantially increases submissions; a static-shadow strategy, cheaper distant caster geometry and hardware profiling are still needed. China street's after p95 render CPU is 2876.7 ms despite warm-up; this outlier remains in the raw data rather than being hidden. This is a software renderer with compilation/scheduling stalls, **not device FPS or GPU timing**, and the medians do not establish phone playability.

The earlier menu audit's cumulative draw counter was unsuitable for these comparisons; its first baseline server also returned font 403s through a shared dependency symlink. The temporary baseline Vite filesystem allowlist was corrected, and the matched renderer above supersedes those earlier performance numbers. No baseline game-source changes were made.

## Actual game captures

These are unedited rendered frames. The six district pairs use the matched cameras above; Canada captures use the actual travel flow. The opening/mission frames document in-game cameras, not generated storyboards or replacement videos.

| View | Before | After |
| --- | --- | --- |
| Japan street | [image](screenshots/recovery/before-japan.png) | [image](screenshots/recovery/after-japan.png) |
| Koi pond | [image](screenshots/recovery/before-japan-pond.png) | [image](screenshots/recovery/after-japan-pond.png) |
| China street | [image](screenshots/recovery/before-china.png) | [image](screenshots/recovery/after-china.png) |
| China river | [image](screenshots/recovery/before-china-river.png) | [image](screenshots/recovery/after-china-river.png) |
| Neon quay | [image](screenshots/recovery/before-neon.png) | [image](screenshots/recovery/after-neon.png) |
| Moon | [image](screenshots/recovery/before-space.png) | [image](screenshots/recovery/after-space.png) |
| Canada arrival | [image](screenshots/recovery/before-canada.png) | [image](screenshots/recovery/after-canada.png) |

[Opening drone](screenshots/recovery/opening-drone.png), [Gurnam handoff](screenshots/recovery/gurnam-handoff.png), [real police pursuit](screenshots/recovery/police-pursuit.png), [Canada street](screenshots/recovery/canada-street.png).

## Blockers and further work

- **Original source recovery unavailable:** no supplied patch or remote recovery commit contains the reported offline unpushed work. Preserve this branch and reconcile it if that source becomes available; do not overwrite it.
- **Reference downloads failed:** Library references `libfile_8cf8604cb1b08191acd2a99128fe61ae` and `libfile_9fdce1bcb8ac81918ba5cc7475d7618d` failed through the current resolved-reference helper, including one bounded supported retry with explicit local destination `/workspace/reference-images`. No readable bytes resulted, so this executor did not inspect those reference pixels. The parent reports it inspected them; the implementation used that written direction and actual game captures.
- **Video footage unavailable:** the supplied YouTube page exposed metadata but no accessible footage. No claim is made to have watched it.
- **Hardware acceptance pending:** no physical GPU, phone, touch device or controller is available here. Test sustained travel, shader warm-up, frame pacing and thermals on target devices. Large lazy chunks remain (the moon chunk is about 7.3 MB before gzip).
- **Visual/game completion pending:** further character/animation work, authored camera staging, main-world and environment detail, distant geometry/LOD and shadow optimization are needed. Pixel artwork was retained; Canada remains a themed main-map district. The requirement that no world has weak visuals is not yet met or claimed.

There was no automatic-approval denial. Source recovery and reference transfer remain unavailable; device profiling and final integration are pending. No main push, release or deployment was attempted.
