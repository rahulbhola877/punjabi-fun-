# Driving frame-pacing investigation — 25 October 2026

The reported stop-start feeling occurs on both computers and phones, including clear roads. Sustained-throttle Havok tests for all 11 vehicle types found no repeated braking on flat ground. In a browser highway run, throttle remained 1, handbrake stayed off, the engine was not stalled, and physical speed rose smoothly, while long render frames caused simulation time to fall behind wall time.

## Fixes

- `isOpenCountry` previously scanned every outer building for each grass sample. Grass regenerates as the camera moves, multiplying that work across thousands of samples. Static 40 m spatial buckets now limit building and road checks to nearby candidates. Exact bounds, padding and overlapping-road priority are preserved; unusually wide road queries retain the full-list fallback.
- The speedometer, driving hints, recovery prompt and interaction prompt no longer rebuild unchanged HTML each frame.
- Canvas dimensions are read once before frame UI writes. Speech bubbles reuse those dimensions instead of forcing layout between individual bubble updates.
- Removed redundant resident Havok bodies. Player and vehicle collision masks already excluded them, and resident movement, ground clearance, vehicle avoidance and combat use scripted state. This eliminates per-step transform/WASM synchronization without removing people or their behavior.
- Corrected the mobile hint: the left stick steers while Gas and Brake / Rev control acceleration.
- Driving probes record throttle, handbrake, grounding, engine stall state and simulated time alongside speed and frame intervals.

## Evidence

Hardware Chrome, NVIDIA RTX 4050 Laptop GPU, WebGL2, High preset, 1280×720; CPU profiler enabled. Each highway sample holds full throttle for 25 seconds after a four-second acceleration warmup, starting at x=100, z=-165.5 heading east. This is a live simulation, so traffic and timing vary. The desktop table measures the spatial-query/HUD fixes before the additional resident-body cleanup.

| Highway measurement | Before | After |
|---|---:|---:|
| Median frame | 64.2 ms | 52.2 ms |
| p95 frame | 134.2 ms | 87.2 ms |
| Frames over 100 ms | 61 | 7 |
| Simulation advance between first/last samples | 22.12 s | 24.68 s |
| Speed drops over 0.5 m/s between frames | 0 | 0 |

The bypass runs encountered traffic collisions and are retained as diagnostic traces, not used as a clear-road braking comparison. Screenshots confirm scenery and the HUD still render. This improves measured hitches; it does not establish a stable 60 fps or performance on every physical phone.

The separate touch-pedal test uses phone emulation (844×390, Low preset) on that same desktop. Before → after removing redundant resident bodies: highway median 76.1 → 49.4 ms, p95 115.9 → 90.9 ms, frames over 100 ms 48 → 11, simulated time 22.98 → 24.50 seconds. Both runs maintained throttle and had no physical speed drops on the highway. The final bypass sample had zero frames over 100 ms and a 30.4 ms median, but encountered traffic. These are emulator results, not physical-phone benchmarks.

All 281 tests across 44 files passed, including sustained acceleration for every vehicle and spatial-query parity at road/building boundaries. TypeScript and the production build passed.

Reproduce with `node tools/drive-profile.mjs [deployment URL]`. `LABEL` names artifacts; `MOBILE=1` selects touch input, an 844×390 phone viewport and Low quality. This uses browser phone emulation on the same desktop hardware, not a physical phone benchmark. Raw frames, CPU traces and screenshots are in ignored `artifacts/profiles/`.
