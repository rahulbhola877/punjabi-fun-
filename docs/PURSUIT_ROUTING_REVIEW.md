# Police approach routing review — 2 November 2026

The police's periodic road replan could restart a moving patrol at a waypoint
behind it. The native jeep reproduction stays over 80 m from a stationary
player for 30 simulated seconds despite a connected road and no obstacles.
`AIDriver.routeTo()` now joins the nearest route segment through the existing
`follow()` logic, which buses already use when taking over mid-leg. Police still
replans every two seconds; its current chase target still updates every step.

## Recorded failure and cause

The retained [failed gameplay trace](performance-evidence/failed-braked-pursuit.json)
places the patrol around `(-152,-256)` while the player brakes on G.T. Road near
`(-163,-165.5)`. Its centre is on the six-metre-wide `col_kitchlu3` road, whose
bounds are x `[-158,-152]`. This is not a disconnected or missing-road case.
The actual graph has the 92 m northbound path:

`1633 (-155,-260) → 1634 (-155,-230) → 1635 (-155,-199) → 1636 (-155,-168)`.

Before the change, [routeTo](../src/traffic/AIDriver.ts) called `setNodes()`, which
reset route progress to zero. Its initial-point skip requires more than 60% of
the first leg to have been traversed. The update-time behind-point skip only
applies within 2.2 turning radii. At the first two-second replan in the native
jeep case, the vehicle is approximately `(-154.90,-249.87)`, but the reintroduced
target is `(-156.8,-260)`: about 10.3 m behind it, outside the 7.75 m guard and
only 34% along the 30 m leg. The driver brakes and turns back. Repeated resets
keep it circling instead of continuing north.

The driver considers the circling vehicle moving, so its stationary recovery
does not activate. [Traffic.unjam](../src/traffic/Traffic.ts) also exempts active
police. [Police](../src/combat/Police.ts) loses interest after 34 seconds outside
45 m, consistent with the trace's eventual disappearance. The automatic film
requires a moving, grounded patrol within 8–32 m for 0.3 seconds, so this routing
failure prevents its trigger before cinematic motion begins.

## Bounded native evidence

The temporary probe uses the actual road graph, `Vehicle`, Havok and `AIDriver`,
at 60 Hz for 30 simulated seconds. Both variants retain two-second replans. The
baseline variant reproduces the previous `routeTo` implementation inside the
temporary probe; no production rollback was used. The moving target interpolates
the player positions in the retained gameplay trace. Initial patrol yaw faces
the target; the original trace does not record that patrol's yaw or route index.

| Patrol / target | Previous minimum separation | Fixed minimum separation |
| --- | ---: | ---: |
| Jeep / stationary | 80.312 m | 0.076 m |
| Jeep / recorded moving player | 59.376 m | 0.365 m |
| Motorcycle / stationary | 0.111 m | 0.009 m |
| Motorcycle / recorded moving player | 0.347 m | 0.384 m |

The motorcycle reached the player even before the fix in the unobstructed
fixture, so its particular recorded behaviour is not claimed reproduced.
Removing replans in the previous jeep controller also allowed approach, isolating
the restart problem, but suppressing replans is not the product fix.

A second probe builds the real district collider set, including colony houses,
kerbs and scenery. All four fixed cases enter the 32 m approach range by the
8.02-second sampled observation. That probe completed in 22.24 wall seconds.
Its four minimum separations were 0.072/17.806 m for the jeep and 0.105/8.537 m
for the motorcycle, with stationary/recorded moving targets respectively.

The committed [native regression](../tests/sim/policeApproach.test.ts) uses those
real district colliders for both patrol types and stationary/eastward-moving
targets. It requires the actual film's sustained grounding, speed, vertical
velocity and separation conditions within 15 simulated seconds. It never calls
a cinematic replay hook.

Temporary probe files and raw samples remain in `/tmp/pursuit-routing-probe.test.ts`,
`/tmp/pursuit-routing-{baseline,fixed,district}-probe.json` and corresponding text
logs. The durable regression can be rerun with:

```sh
npm test -- tests/sim/policeApproach.test.ts
```

## Verification scope

TypeScript and `git diff --check` pass. The relevant native run passed **10 test
files / 101 tests** in 183.35 wall seconds: police approach, full bus routes,
both colony/other-road traffic sweeps, distant traffic, vehicle, handling,
balance, stuck recovery, auto and tyre traction. The new real-collider test
reached sustained film readiness at 7.37/7.87 seconds for stationary/moving
jeep targets and 6.58/7.18 seconds for stationary/moving motorcycle targets.

No GPU/browser work was performed for this change. Full natural mission
acceptance, checkpoint pursuit and the new automatic three-shot film still
require the integrated gameplay rerun; native approach success is not presented
as a fresh gameplay clip.
