# Interaction-priority review fix

Follow-up to reviewed integration19843e1. No graphics, population, controls preferences, render resolution, budget threshold or main-branch publication changes.

## Behaviour

A valid bell could score below −1 and beat the old delivery score −1. The selector now checks reach first and explicitly returns the first eligible `deliver` action before optional proximity scoring. Missions, daily tiffins and passenger drop-offs already share this action ID. Invalid/out-of-range deliveries do not gain priority; stable order between valid completions is preserved.

Bells retain their proximity preference over nearby bicycles. A second defect was exposed by a bicycle-outline case: dividing the facing dot product by outline reach instead of centre distance could produce facing values above1. Facing now uses the normalized centre direction; custom reach still controls eligibility/proximity. No unconditional bell tier or arbitrary larger delivery score was introduced.

`Game.pickInteraction` delegates to the small pure selector. Regression tests cover the reported bell/delivery score conflict in different orders, passenger completion classification, invalid deliveries, front-bicycle outline reach, ordinary facing/chat scoring and stable ties.

## Evidence

- Old-build browser reproduces the bug: real Missions.deliveryHere and a real gate bell are eligible, but the selected prompt is the bell.
- Corrected source7a3a853 passes22 browser checks. Real E finishes/rewards the mission (deliveries0→1, reputation0→5). Real touch hands over a tiffin and updates stats/ledger (0→1, reputation5→7). The bell remains selected beside a real front bicycle, repeated E rings without entering it or duplicating its answerer. Real auto-stand pickup/drop-off still rewards (rides0→1, reputation7→10).
- The actual bicycle has centre-facing0.99989 versus old outline-facing2.66472, exercising the normalization on native geometry.
- Passenger bells are absent while driving by existing design; this was checked explicitly rather than fabricating a bell/drop-off conflict.
- The delivery/tiffin overlap uses disclosed temporary destination-POI relocation to a real gate and a prepared one-stop tiffin batch. Actual gather/eligibility/selection/callbacks and keyboard/touch input remain intact. Fixtures are restored before browser close.
- An initial partial touch run entered touch mode and cleared its first queued tap. That trace remains saved; the passing retry uses a neutral real touch to enter the mode before tapping the action. No product workaround was added.
- Focused tests:3 files/11 tests pass; typecheck passes. Final production build passes in48.23s; both changed production modules match their embedded source maps.
- Final isolated suite:146 files/611 tests pass in325.22s, with all software browsers closed.

Raw baseline/fixed/partial browser traces, build/source-match and native logs are under performance-evidence/priority-review/. Screenshots accompany the review delta.

## Low budget diagnosis

LOW_BUDGET_DIAGNOSIS.md quantifies the inherited static material/chunk increase, tree-material offsets and actor changes across all three historical/main views. The old centre-only visibility rule hid nearby geometry inside wide batches; reinstating it would hide walls. Its counterfactual is not added to geometry deltas as an independent cause. Domestic flowerpot/laundry/textile detail also increases existing material chunks.

The recovery's exact colony increment is four farm-bund poplars: +1,576 triangles and zero draws inside existing batches. Final street's approximately+1k/zero-draw increment remains unmeasured at individual-chunk level. The diagnostic retains its240s six-row partial run and separately completed24.7s colony row; no further GPU retries were made. Guard/settings are unchanged. Nine medium/high/ultra views pass; all three Low failures remain explicit. No device-FPS or finished-graphics claim.

Main was freshly fetched after validation and remainsf3fada9. The proposed delta stays isolated for parent review; no push/deployment occurred.
