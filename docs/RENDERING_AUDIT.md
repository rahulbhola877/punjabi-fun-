# Rendering, vehicles and district expansion

## Scope and verified fixes

- Fixed WebGPU's missing multi-render-target registration. The deep engine import did not install the extension needed by the SSAO prepass: the original build produced repeated texture errors and no rendered game frames. Both renderers now complete the four-location browser profile. WebGL remains the automatic/default backend pending broader device coverage.
- Recover interrupted WebGPU startup through WebGL; dispose failed engines and clear the startup marker only after a rendered frame. Stop writing that marker every frame.
- Avoid clearing the shadow render list before repopulating it. Babylon observes empty/non-empty transitions and invalidated lighting defines across the scene four times per second. A diagnostic recorded 6,031 light invalidations in 2.5 seconds. Replace the membership in one operation, and leave unchanged lists alone. A regression test uses a real Babylon shadow generator.
- Preserve authored short-distance culling for small facade details when changing quality. Previously the preset expanded these to the full scenery draw distance. Exclude disabled/invisible dynamic shadow casters.
- Stop preserving the WebGL drawing buffer unnecessarily. Add optional GPU timing only in probe mode.
- Add wheel LODs across all eleven vehicle types: distant tyres and rims share a simple mesh; spokes and separate material parts disappear at 55 metres. Geometry/disposal tests cover every model.
- Improve the bus's wheel openings, bevelled roof, mirrors, wipers, roof vents, luggage restraints and readable operator board. Improve truck restraints, fuel tank, guards and rear sign; move rear twin tyres inboard. Details share existing material batches where possible. Operator boards identify the operator; they do not claim to show a live destination.
- Expand playable bounds from 2 × 2 km to 2.4 × 2.4 km (4 to 5.76 km², +44%). A connected four-sided bypass joins G.T. Road, Nehar Road and the extended village link. Road geometry drives navigation, map rendering, field exclusion and bridge generation. Extend the physical ground to match: visual ground alone would let vehicles fall through the new area.
- Add three real bus stops and a scheduled route using the existing passenger/fare system. Add independently timed rail gates at both bypass crossings; traffic responds to the train at its own crossing. Move train spawn/despawn beyond the enlarged boundary.

## Desktop production comparison

Measured on NVIDIA RTX 4050 Laptop GPU, Windows Chrome, hardware ANGLE/D3D11, 1280 × 720, high quality. Baseline is commit `5caae18`, built separately. Both use 12 seconds settling plus six seconds sampling per location, with Chrome's CPU profiler active. Simulation populations and thermal/load conditions vary; these are observed runs, not deterministic benchmark guarantees. No software-renderer numbers are presented as GPU performance.

| Location | Frame median before → after (ms) | Frame p95 before → after (ms) | Render CPU median before → after (ms) |
|---|---:|---:|---:|
| Bazaar | 59.0 → 48.3 | 143.8 → 79.3 | 45.70 → 24.10 |
| Ludhiana | 55.9 → 36.0 | 121.3 → 46.8 | 34.73 → 18.66 |
| Highway | 62.0 → 40.6 | 188.8 → 76.3 | 65.55 → 23.23 |
| North | 16.3 → 17.6 | 36.0 → 25.5 | 11.27 → 11.16 |

Busy-location median frame time fell 18–36%; render CPU time fell 47–65%. North's median was slightly worse while its p95 improved. Final WebGL GPU frame medians were 14.18, 8.43, 14.01 and 4.67 ms respectively. Dense locations remain below 60 fps at high quality on this laptop; this work does not establish universal 60 fps or mobile performance.

WebGPU exposes modern per-pass timestamp queries. The profiler reports main, scene-prepass and shadow timings separately. They are not summed or misrepresented as total GPU frame time; unsupported/unavailable counters are `null`. WebGPU compatibility mode remains enabled because the game shares materials between differently skinned characters. Disabling it blindly is not a safe performance fix.

The measured summaries for both backends are retained in [rendering-measurements.json](rendering-measurements.json). WebGPU rendered all four locations without runtime errors or external requests, but was slower than WebGL in this run; backend availability is not a promise of a speedup.

## Reproduce and inspect

Run `npm ci`, `npm run build`, then `npm run preview`. In another terminal:

```powershell
$env:BACKEND='webgl'
$env:GFX='high'
$env:LABEL='local'
npm run profile -- http://127.0.0.1:4173/
$env:BACKEND='webgpu'
npm run profile -- http://127.0.0.1:4173/
npm run smoke:world -- http://127.0.0.1:4173/
npm run playtest -- http://127.0.0.1:4173/
npm test
```

`BROWSER_PATH` selects Chrome/Edge explicitly; otherwise installed Windows Chrome/Edge or Playwright Chromium is used. Set `SOFTWARE=1` only for a deliberately labelled SwiftShader run. `WARMUP_MS` changes settling time. Profiles go to ignored `artifacts/profiles/`: JSON summaries, screenshots and Chrome `.cpuprofile` files. Load traces in Chrome DevTools Performance. `node tools/material-profile.mjs http://127.0.0.1:4173/` diagnoses material invalidation stacks.

The world smoke test raycasts the expanded roads and bridges, captures vehicle views, and drives a bus and truck on the outer roads with real keyboard input and physics. Browser checks block external requests and fail on runtime errors. Unit coverage checks connected paths, route planning, bridge coverage, per-crossing train timing, renderer recovery, model geometry/disposal and culling/shadow regressions.

Validation: production build/typecheck passed; 42 test files and 260 tests passed. The expanded-world browser smoke test passed with no runtime errors or external requests. Reviewed in-game captures: [bus](screenshots/updated-bus.png), [truck](screenshots/updated-truck.png).

## Remaining limits

The world is still procedural stylised art, not photorealistic vehicle assets. Dense city crowds, active mesh evaluation and geometry remain significant CPU costs. More aggressive character LOD/instancing needs careful animation and interaction validation. Mobile devices, Firefox, Android WebView, prolonged thermal behaviour and a complete journey on every scheduled route have not been certified by this desktop audit. The expansion is a connected district extension, not an endless streamed map.
