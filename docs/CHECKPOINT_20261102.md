# Recoverable checkpoint — 2026-11-02 02:00 UTC

Product code: `c7260d812d437a44bf0453431cbcf90ba0f8c34c` on
`recovery/profiled-performance-20261101`. No push, main merge or deployment.
The reviewed `9b1a147` branch and remote-main base `f3fada9` remain preserved.
Original offline unpushed bytes remain unavailable.

## Exact completed checks

- The current production build passes typecheck/build. Fourteen changed product
  files exactly match its embedded source-map contents (`c726-built-source-match.json`).
- Full suite at the preceding `9688182` product code: **130 files / 564 tests pass**.
  This includes the parked-wheel optimization, static-shadow batching, camera
  changes, material balance and corrected cube reflection axes. The later pond
  cutout and road-responder changes still need the final full rerun.
- Current focused tests cover road spawn selection, sky faces, cinematic lifetime,
  shadow cells/quality lifecycle and native parked suspension. Their raw log is
  included; this is not represented as a current full-suite result.
- At the performance checkpoint `139413f`, the **unchanged guard passes all nine
  medium/high/ultra views**. All three Low cases still fail, so its overall exit
  remains 1. Thresholds and guard logic are unchanged. See `unchanged-guard.txt`.
- Native 20-car oracle: **9,600 → 1,600 geometry queries, zero pose error**. All
  three alternating native CPU trials improve. Whole-game update timings remain
  mixed; no device-FPS improvement is claimed.
- Natural driving fixture at the performance checkpoint passes **233.23 m / 1,002
  fixed 30 Hz steps**, two road turns, keyboard camera rotation and live streaming
  traffic. Full-resolution 1280×720 captures render every fifteenth simulation
  step because SwiftShader is slow. This is functional traversal, not FPS evidence.
- The current Japan/China visuals have four completed production captures, with
  zero browser errors or external requests. Japan's pond centre ray hits water at
  **0.08 m** and the real bed at **−0.48 m**, with no intervening ground slab.
  Its water normal points upward. Fifteen enabled fish meshes have world bounds
  **−0.2715 to 0.0342 m**, entirely below the water surface.
- Gurnam's real mission acceptance and the three additional speaker positions
  pass their capture checks at `9688182`; the later chase portion fails separately.

## Why pursuit verification is pending

The original browser wait expired under software rendering. A subsequent test
advanced actual gameplay at fixed simulation steps instead of relaxing a wall-time
assertion. Even after the player braked normally, the fallback patrol circled its
field spawn near (−153, −256) for about 30 seconds, never approached the player,
and lost the pursuit. Those failed traces are retained.

The current fix keeps existing road patrols first, then selects a free, connected
road lane for a vehicle responder, preferably behind the camera. It does not
teleport an existing vehicle into a shot. The open-ground fallback remains for
locations with no suitable road candidate. Selector tests and build pass; the
new real pursuit/three-shot film still needs its bounded gameplay rerun. **No
fresh moving-pursuit video is claimed for this checkpoint.**

## Feasible software work still outstanding

1. Rerun the close-pursuit scenario on the new road responder; check shared framing,
   actual movement, skip/repeat/focus loss and restored mission/player state.
2. Complete the final full suite and unchanged guard on the selected final code.
3. Capture the entire revised opening path; the first actual opening samples
   revealed empty rear strips/back-facing introduction, and the current source
   changes the drone composition and derives the intro angle from the hero's yaw.
4. Run the prepared same-scene ABBA shadow comparison and actual DataBuffer memory
   inventory. They are **not yet executed**. Early render medians are diagnostic,
   with different actor poses; they are not clean whole-game speed proof.
5. Diagnose/fix the three inherited Low count failures and rerun final cross-world
   controls/travel checks. The earlier all-world controls evidence remains in the
   reviewed recovery; it is not represented as newly rerun.
6. Art acceptance remains open: streets/landscape composition, Canada, Neon and
   Moon still contain prototype assets. No all-world visual completion or
   photorealism claim is made.

Physical-device GPU/FPS/thermal validation is separately unavailable in this
executor. That limitation does not block the feasible software checks above.

## Inputs and running-state status

No benchmark or browser test was active at the 02:00 UTC checkpoint. The
`gedi-production-districts.txt` and subsequent `gedi-art4-districts.txt` commands
finished; they were not hung. Preview servers remain available for review.

Reference-image preparation succeeded but supported consumer-local transfer
failed with `download failed` (transport, no recorded policy denial). No alternate
route or repeated download was attempted. The parent inspected the originals;
this executor has not pixel-verified those references. YouTube footage remains
unverified. Independent source work continued.

The source bundle is **combined incremental from exact base `f3fada9`**, including
all `4ba70d4` and `9b1a147` recovery work. It does not require a separate recovery
bundle, and is explicitly not a standalone full-history clone.
