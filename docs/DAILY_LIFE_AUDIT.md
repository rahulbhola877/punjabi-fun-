# Live-deployment follow-up — 25 October 2026

## Changes

- New games start at 09:00. Continuing an old nighttime session starts in daylight; explicit `?hour=` test overrides still work. Daylight dims lamp emission, while nighttime restores it. Children, street vendors, seated neighbours and roof/kite activities have appropriate shifts; explicit night workers and police retain theirs. Cricket/kabaddi require daylight, gossip stops after dark, and new processions stop spawning late at night.
- Every remaining interactive bell belongs to a furnished, visitable home. Gates and doors open with matching physics access, the resident invites the player in, leads them through the doorway, and offers a Punjabi conversation indoors. At 22:00–06:00 the response is irritation or concern in Punjabi, without an invitation. The family home and its two closest neighbours retain their unlocked access. Nonfunctional bell prompts were removed from other facades.
- Wider visitable doorways and corrected porch-pillar colliders prevent invisible obstructions. Speech bubbles wrap and stay inside the screen.
- Police equipment is an explicit model designation, no longer inferred from white paint (which also appeared on a parade jeep). Police drivers use the constable uniform; bus drivers have complete service uniforms. Police and scheduled-service vehicles are unavailable to the ordinary vehicle/jacking interaction.
- A checkpoint order records the approach, stop duration and closest distance. Stopping below 0.5 m/s for a second opens the papers interaction. Passing the checkpoint, retreating, or continuing to drive after the warning produces an immediate wanted star and pursuit. Dismounting clears the pending stop. Adjacent streets outside the checkpoint corridor are not called over.
- Nava Bypass Nagar adds residential streets with three connections to the western bypass, homes, pedestrians and a park. The southern bypass has an anaj mandi, bus adda, six functioning market shops, a refuelling station and a food-serving dhaba. Map route destinations and route r4's new stop make these places reachable. Existing house IDs remain stable.
- Crowd avoidance uses nearby spatial cells instead of scanning every resident. Traffic collects obstacles once per fixed step and uses spatial queries for lane checks. Residents away at home no longer animate or obstruct traffic. Distant static chunks are disabled before Babylon's per-frame world-matrix/LOD/submesh work, with a visibility margin around the existing draw cutoff.

## Browser checks

`npm run smoke:life -- http://127.0.0.1:4173/` exercises the real production build. The probe places the player at each location and seeds old clock/fuel state; interaction, menu choices, walking through the gate/door, and driving past the checkpoint use keyboard input. It checks daytime startup with an old 23:00 clock, the nighttime Punjabi response, daytime invitation, indoor conversation, market and dhaba menus, actual tank refill, and police pursuit. Screenshots and JSON evidence are written to ignored `artifacts/daily-life/`.

The same script accepts the public production URL. It blocks unrelated origins and records runtime errors. It does not certify every home layout or a complete trip on every bus route.

The final local production run passed all acceptance checks, including a real walk into Sant Nagar house `santH142`, shop and dhaba menus, refuelling from 40% to full, unavailable police-vehicle interaction, zero wanted stars after stopping for papers, and an active one-star pursuit after ignoring the next checkpoint order. No runtime errors were recorded. Render captures on both backends were visually reviewed.

## Regression checks

The complete suite passed 267 tests across 43 files, including real-physics vehicle navigation through every colony. After the final stop-threshold adjustment, the focused daily-life, vehicle-model, map and geometry suite passed 33 tests. Production TypeScript/Vite build passed.

## Profiling method

The baseline was captured from `https://punjabi-fun.vercel.app/` at main commit `71966d5`. Both runs use hardware NVIDIA RTX 4050 Laptop GPU, 1280×720, high quality, four fixed viewpoints, 12 seconds settling and six seconds sampling with Chrome's CPU profiler enabled. The follow-up build includes the new homes and districts. Populations, simulation timing and thermal load vary, so results describe observed runs rather than a fixed FPS guarantee. WebGPU is measured separately; it is not compared numerically against the WebGL baseline. Browser artifacts include CPU traces, frame/render-CPU/GPU summaries and screenshots.

| WebGL2 location | Median frame before → after (ms) | Frame p95 before → after (ms) | Median render CPU before → after (ms) |
|---|---:|---:|---:|
| Bazaar | 51.4 → 49.5 | 83.3 → 67.4 | 27.31 → 24.35 |
| Ludhiana | 49.2 → 35.1 | 98.0 → 47.5 | 24.60 → 17.89 |
| Highway | 45.8 → 40.6 | 64.5 → 57.1 | 26.54 → 22.99 |
| North | 20.5 → 19.5 | 29.3 → 33.5 | 12.28 → 11.50 |

The northern p95 regressed despite a lower median; this is not a universal speedup. Bazaar CPU traces no longer show `avoid`, `clearAhead` or `getLOD` among the top 15 sampled functions. Babylon active-mesh evaluation, draw submission, physics and character rendering remain costs. Detailed geometry and functioning crowds have been retained.

WebGPU median frame times were 83.2 / 79.3 / 78.7 / 27.3 ms in the same location order. All four rendered without runtime errors or unrelated requests, with hardware per-pass timestamp measurements. WebGPU is still slower on this machine, and the automatic backend remains WebGL2. Its pass timestamps are not a total GPU frame duration. The measurements do not certify mobile performance, sustained thermal behaviour, Firefox or Android WebView.

Full summaries: [daily-life-measurements.json](daily-life-measurements.json). Reproduce with `LABEL=crowd-after` and `BACKEND=webgl` or `BACKEND=webgpu` environment variables and `npm run profile -- http://127.0.0.1:4173/` (PowerShell uses `$env:LABEL='crowd-after'`, etc.).
