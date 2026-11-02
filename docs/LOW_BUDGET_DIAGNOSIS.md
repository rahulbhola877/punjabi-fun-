# Low guard diagnosis

The unchanged Low guard still fails its three historical views. The breach
already exists on original main `f3fada9`; the final recovery's additional Low
cost is approximately 2k colony triangles and 1k street triangles, with no
additional draws in either view. This report does not rebaseline the guard,
change resolution, remove artwork or claim device FPS.

## Baseline provenance and saved measurements

`git blame tools/budget.mjs` identifies **`b4c9aa50`**, October 29, 2026 at
17:14:19 UTC, as the commit that installed the current baseline table. Its
message is “Hill-station buildings and Mall, a depth haze and richer colour.”
The three cameras, Low settings and 6% comparison rule are unchanged. Low
explicitly uses the guard's historical 0.7 resolution scale and no shadows.

| Low view | October 29 baseline | Original main `f3fada9` | Recovery comparison | Final `19843e1` |
| --- | ---: | ---: | ---: | ---: |
| Bazaar | 349k / 236 | 445k / 282 | 438k / 281 | 438k / 281 |
| Colony | 208k / 120 | 273k / 155 | 273k / 155 | 275k / 155 |
| Street | 529k / 292 | 564k / 326 | 564k / 326 | 565k / 326 |

Cells are submitted triangle counts / draw calls, rounded as in the guard.
The original-main and recovery logs note initial NPC timing variation in the
bazaar; its 7k/one-draw change must not be presented as a stable source saving.
Sources: [original main](followup-evidence/budget-original.txt),
[recovery](followup-evidence/budget-followup.txt),
[final Low](performance-evidence/final-budget-low.txt), and
[final matrix/source](performance-evidence/final-budget-runs.json).

The inherited original-main excess over October's table is therefore about
96k/46 draws, 65k/35 draws and 35k/34 draws respectively. The final-versus-recovery
delta is much smaller and does not explain the historical failure.

## Concrete inherited source mechanisms

1. **Visibility changed in `0a8c1cd`.** October's
   [World](../src/world/World.ts) disabled distance-limited static batches by
   distance to their bounding-sphere centre and used a 220 m centre-based Low
   LOD cutoff. `0a8c1cd` changed LOD to `220 + bounding radius` and enablement to
   distance from the nearest point on the batch AABB. A large legacy material
   batch can contain nearby walls and remote geometry at once. The newer rule
   preserves those nearby walls but submits the whole intersecting batch. The
   change predates the recovery and remains covered by
   [the wide-batch visibility regression](../tests/worldVisibility.test.ts).
2. **Local static detail also arrived in `0a8c1cd`.**
   [neighborhoodDetail](../src/world/neighborhoodDetail.ts) adds wall-mounted
   flowerpots, many individual flower-petal ellipsoids, stems, leaves and
   laundry around Sant Nagar. It has no Low/`kit.lean` exclusion. These join
   existing paint/leaf/fabric/metal/wood material chunks. The same commit adds
   the bazaar's [textile display](../src/world/streetTextile.ts).
3. **Tree materials and geometry changed in `f3fada9`.** Broadleaf trees switch
   from separate wood/leaf/alpha-card batches to opaque `lowpolyNature` batches,
   and safeda/pine templates change. This is original-main work, not added by
   the current recovery. A material-group delta must account for removed old
   wood/leaf/plant geometry as well as new `lowpolyNature` geometry.

## Exact inherited draw attribution

Fresh October/main pairs produced these Scene-counter deltas. Each cell is
triangles / draws; positive numbers mean more submissions on original main.

| Component, October → original main | Bazaar | Colony | Street |
| --- | ---: | ---: | ---: |
| Whole frame | +95,528 / +46 | +64,936 / +35 | +34,752 / +34 |
| `world_*` static meshes | +101,826 / +39 | +72,396 / +35 | +127,632 / +48 |
| Skinned people | 0 / 0 | 0 / 0 | −86,452 / −18 |
| Paint material chunks | +55,748 / +3 | +44,512 / +3 | +53,436 / +4 |
| Plaster material chunks | +28,390 / +3 | +23,162 / +3 | +28,674 / +3 |
| Metal material chunks | +9,066 / +3 | +19,102 / +4 | +17,094 / +5 |

Material rows are subsets of static meshes, not additional totals. Tree material
replacement has offsets: bazaar `lowpolyNature` adds 30,784 triangles while
leaf/plant/wood lose 29,496/11,998/8,408 respectively. Clouds lose 6,692 triangles
in every view without a draw-count change. The street's lower skinned-person
count is consistent with original main adding an 85 m Low resident visual range
where October kept procedural bodies visible to 140 m. Thus its modest net
triangle increase hides a much larger static submission increase.

The largest existing paint-chunk growth is `world_paint|160:0,-1` (+24,288
triangles) and `world_paint|160:0,0` (+13,156), both already drawn in October.
Their source region includes the new Sant Nagar domestic detail. New retained
plaster draws in bazaar are exactly `160:0,0` (10,732), `160:1,-1` (7,728), and
`160:1,0` (9,930), summing to the full +28,390 plaster delta. The first batch's
centre is approximately `(24.5,6.2,380.0)` despite containing nearby geometry:
this is the wide-batch visibility issue, not a claim that its whole geometry
lies nearby.

Applying October's centre-only LOD predicate to the **same current drawn
meshes**, without changing their visibility, identifies 91,632 triangles / 40
draws in bazaar, 77,234 / 39 in colony and 111,882 / 46 in street that it would
reject. This is a mathematical counterfactual, not a rerender or an independent
causal contribution: it overlaps geometry changes, and restoring that rule
would again hide nearby walls. It must not be added to the material deltas.

## Exact recovery-only colony delta

Original-main colony is **273,218 triangles / 155 draws**; final geometry is
**274,794 / 155**. The entire +1,576 difference is in the existing
`world_lowpolyNature` material:

| Existing chunk | Added triangles | Added draws |
| --- | ---: | ---: |
| `world_lowpolyNature|160:0,-2` | 1,182 | 0 |
| `world_lowpolyNature|160:1,-2` | 394 | 0 |

These are four 394-triangle farm-bund poplars added in `ee2ddf6`: all three
source broadleaf variants contain exactly 394 triangles, and the new
[windbreak loop](../src/world/country.ts) places them in these chunks. Both
chunks retain identical bounds and draw/material counts across the pair.
Every other colony group, including actors, is identical. This is added tree
geometry inside existing batches, not an additional pass or actor population.
The stored final street delta is approximately +1k / zero draws; its exact
recovery-only chunk decomposition was not measured within this diagnostic slot.

## Bounded attribution fixture

[low-budget-diagnosis.mjs](../tools/low-budget-diagnosis.mjs) preserves the guard's
three views and settings, waits its four-second title warmup, then freezes
simulation and attributes one real rendered frame through Babylon's actual
draw methods. It records exact mesh/material/submesh draws, triangle counts,
actor skeleton membership, bounds and which current chunks October's old
centre-only LOD would reject. It does not change culling or suppress rendering.

An isolated `git archive b4c9aa50` build completed in 50.27 seconds, served on
4194. It has its own `/tmp` source/output; active branches and main were not
reset or switched. Original-main preview 4174 is verified at `f3fada9`; the final
counted geometry is the immutable candidate on 4193. The nine-page run stopped
at its authorized **240-second cutoff**, preserving all six October/original-main
rows; it did not measure the final cohort. Its interrupted/browser-closed error
is diagnostic termination, not a game error. A separately authorized **one-row,
60-second-bound** final colony run completed in 24.7 seconds. No further GPU
measurement or retry was performed; browsers are closed.

Raw evidence: [six-row partial](performance-evidence/priority-review/low-six-row-partial.json),
[separate final colony](performance-evidence/priority-review/low-final-colony.json),
and [CPU-generated paired decomposition](performance-evidence/priority-review/low-attribution-summary.json).
All seven sampled rows have empty game/page-error arrays. Engine draw attribution
matches the Scene draw counter exactly. It counts one extra six-index draw
outside mesh context, or **two triangles**, in every row compared with
`Scene.getActiveIndices()/3`; this constant cancels in every reported delta.
No specific render-layer identity is inferred for that unattributed call.

The fresh October colony/street measurements reproduce 208,282/120 and
529,042/292. Bazaar is 342,774/235 versus the stored 349k/236, consistent with
the already documented initial actor timing sensitivity; this diagnostic does
not silently replace that stored baseline. The known release limit remains
explicit: Low fails all three guard rows; the other nine preset/view rows pass.
No broader optimization or baseline change is part of this diagnosis.
