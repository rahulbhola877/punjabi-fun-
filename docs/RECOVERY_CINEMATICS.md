# Cinematic worlds recovery branch

This work starts from remote `main` at `f3fada9ee7ccded22e52c60ae47b4104c1f99531`, fetched on 2026-11-01. The saved local branch `work` remains at `16d38ea`. Implementation is isolated on `recovery/cinematic-worlds-20261101`. Remote heads were inspected; there was no dedicated remote recovery branch for the previous session's reported unpushed fixes. Those unpushed bytes have **not** been recovered or presumed to exist here. Do not merge/push/deploy main until reconciliation with that session is reviewed.

The requested Library references `libfile_8cf8604cb1b08191acd2a99128fe61ae` and `libfile_9fdce1bcb8ac81918ba5cc7475d7618d` each failed through the current Library resolved-reference transfer helper, including one bounded preparation/retry with explicit `/workspace/reference-images` destination. No readable image bytes resulted. Parent reports it inspected those references; this executor has not inspected their pixels. The YouTube page exposed its title but no accessible footage. This work uses actual in-game captures and the user's written direction; it does not claim to reproduce verified footage.

## Implementation under validation

- Shared saved keyboard bindings, standard controller buttons, camera-relative movement, mouse/touch look and pause controls across the five alternate worlds. Main Punjab/Canada retains the existing input owner, with clearing at transitions.
- PBR finish maps and subtle normal relief at world scale; sun/sky contrast, ACES, atmosphere and bounded shadows in the four 3D destinations. Spatially batch more static Neon/moon geometry.
- China river bed carved below an actually transparent, moving-normal water surface; stone bank lining and submerged rocks. Japan pond gets a lighter real bed, submerged stones and the same clear-water treatment. Neon water uses the night palette.
- Canada snow gets neutral grain/wind-ripple shading, and the playable rink gets a dedicated ice material.
- Real-time opening drone approach and character introduction, replay from pause; skippable camera moments at Japan/China story changes and pond feeding, Gurnam's mission handoff, and a real active police pursuit.
- Cinematics own camera/letterbox only. Hosts freeze mission/physics input, restore camera and clear input at release. Mission/reward commits occur in gameplay, not in cutscene callbacks.
- The one-tap performance button now preserves full render resolution; no 50% resolution shortcut.

## Validation evidence

Pending final run. Baseline and comparison tools are `tools/cinematic-worlds-audit.mjs` (real game and world menu) and `tools/district-render-audit.mjs` (isolated actual scene renderer, matched fixed cameras). Artifacts are retained under `artifacts/`; baseline source is a detached checkout at `/workspace/gedi-baseline`.

This cloud executor has Chromium's SwiftShader software renderer, not a hardware GPU. Do not present its frame intervals as device FPS. Scene work counts, actual rendered dimensions, render CPU observations and errors must be reported together. Different camera framing, stochastic crowd populations and compilation warm-up affect measurements. The first baseline menu audit captured images but failed its clean-log condition because the temporary Vite worktree disallowed fonts resolved through the shared dependency symlink; its temporary server allowlist was then corrected. Its original cumulative alternate-world draw counter is also unsuitable for comparison; use per-render draw deltas from the matched scene audit.

## Remaining acceptance work

- Reconcile original offline session's unpushed optimization/planting/bridge/rain fixes if its source is recovered.
- Check the final build, unit suite, real navigation round trips, remaps/touch/controller events, story saves, opening completion/skip/replay/reload and resource disposal.
- Review matched water/streets/Canada images; quantify shader/shadow costs alongside static batching gains.
- Profile on an actual phone and hardware GPU, including thermals and longer journeys.
- Continue authored environment/character detail. These are still compact prototype destinations, not photorealistic complete countries or a finished game.
