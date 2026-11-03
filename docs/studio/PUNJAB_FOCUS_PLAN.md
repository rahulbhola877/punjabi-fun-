# Punjab-only next implementation

Status: first Punjab-only candidate implemented; integrated validation and actual gameplay acceptance pending. Preserve this repair checkpoint, the original main and rejected reboot. Use the existing Codex studio setup and bounded file ownership; no new renderer or replacement game. The user requested economical model use and no unnecessary revalidation.

## Retire unrelated playable worlds safely

Root owns `Game.ts`: remove Pixel's static import and the dynamic Japan/China/Neon/Space launches, Worlds/flight destination callbacks, alternate progress callbacks and related active allocations. Keep historical source/assets recoverable; shared assets must not be indiscriminately deleted. Remove unrelated destinations from UI, map, discovery/route lists and branding. Preserve ordinary Punjab Stand travel, cities, forest, ridge and airfield unless later explicitly retired.

Canada is part of the main physical map, not a separate scene. In `world/travelDistrict.ts`, preserve the airfield construction and remove the Canadian construction, winter backdrop/shrubs, houses, rink, trees, props and colliders before Kit batching. Remove five `canadaSet*` roads from `region.ts`; keep the north ridge/airfield links. Remove Canada folk/café registration, fresh `car_canada`/`pickup_canada` spawn locations, map/Places labels and Canada-specific signs. Root must also remove CanadaRink/SnowballRange allocation, update, movement and interaction hooks. Shared Tunyard materials, Punjab water and northern hills remain intact.

Canada bounds are x=940–1450, z=1640–2040; North Airfield is x=350–860, z=1640–1950. Do not shrink the entire north/east rectangular map to remove Canada. Retire the area coherently: removing only its globe button or deleting finished material batches by centre would leave either reachable unrelated content or missing Punjab walls. The generic ground underneath remains; decide its Punjab edge treatment explicitly, without an invisible arbitrary wall.

Before spawning, migrate players and every saved vehicle within retired Canada coordinates to vetted, separated Punjab safe positions. Preserve IDs/type/paint/fuel/ownership, intro/food-job state, money, inventory and relationships. Existing coreRecovery repairs boundary-clamped positions only and does not catch Canada's interior. Migration must be idempotent and must not stack recovered vehicles.

The save schema has no saved active-world discriminator. Alternate progress uses numeric home keys: pixelLanternMask/pixelShrineDone, neonSignalMask/neonRelayDone, japanTeaStage/japanParkStage, chinaStoryStage/chinaFishingComplete, spaceStoryStage/spaceExpeditionStage. Their saves normally retain the main-world player's Punjab position; keep these historical fields inert. Preserve canadaRinkGoals and historical residents. If removing café definitions, retain compatibility for owned canada_biscuit/canada_cocoa items. Existing Bhola, tiffin and passenger destinations are Punjab locations.

Required targeted checks: retired menus/imports/markers absent; Canada interior and boundary save recovery; multiple owned vehicles; idempotence; preserved active jobs/inventory/history; actual Continue onto supported Punjab ground; no retired return/launch path. Run one integrated suite/build after actual product changes, not before every small edit.

## A contained meaningful Punjab arc

Provisional specialist recommendation: **Gali da Cup**, around the existing Sant Nagar park. This is a candidate, not settled new canon or a claimed completed feature. The current six-ball cricket activity lasts about 30 seconds; simply adding dialogue to it is insufficient.

Use a visible local invitation, short batting practice, a fielding/interception-and-return action, and a meaningful rules choice. Ground-only rules use a lower target and restrict boundaries; open boundaries increase scoring and the target, with a recoverable nearby lost-ball incident. A loss offers focused practice and an immediate rematch. Completion changes a named relationship and unlocks rule-specific records/medals and repeatable bowling seeds. Cash alone is weak because the current game uses unlimited money. The 10–15 minute first-play target must be measured, not padded with travel or exposition.

Keep the existing phone errand, chapters and side activities; expose this arc clearly near the starting neighbourhood rather than burying it under a distant marker. Use a static park invitation or existing dialogue ownership; do not borrow Home-owned family actors or roof residents. Root must decide how tracking priority and introductory invitation coexist with the phone objective before implementation.

Minimal boundaries: one small pure mission-state module; validated additive save state; bounded Cricket.ts practice/rules/fielding configuration and typed completion result; root-owned Game integration for admission, objective, dialogue and receipts. Preserve ordinary cricket and the old c_cricket flag, which means played, not won. Existing Cricket.resolve awaits an uncancelled 2.2-second continuation: add attempt cancellation on stop/dispose before attaching quest rewards. Reject/recheck active food/passenger/carry states after dialogue. Persist receipt and consequence before awaiting results; interrupted short rounds restart from the last preparation checkpoint with explicit feedback. Repeated completion must not repeat the first reward.

Acceptance: ordinary-input acquisition, distinct practice/fielding/match actions, both rule consequences, recoverable loss and lost-ball state, remapped keyboard/touch, pause/focus, reload checkpoints, cancellation, once-only completion and replay records. Preserve existing phone/chapter saves. Do not assert fun, duration or device FPS from unit tests.

Alternative candidates are Sohal's local riding qualification or a peaceful branch of Bus-stand Trouble; both have wider course/actor coordination scope. Do not implement all three in parallel.

## Amritsar reference and performance

User permits useful parts/techniques from https://amritsar-golden-light.rahulbhola.chatgpt.site . Its source has not yet been accessed in this pass. Inspect through supported read-only source access and check active work before reuse; do not overwrite that project or claim its assets were reviewed. No source transfer is a prerequisite for the migration work above.

Current Low failures remain inherited; a separate steady High bazaar check also exceeds the old triangle guard. A concrete later target is spatially repartitioning oversized opaque plaster batches by actual geometry position, starting with world_plaster|160:0,0. Kit currently keys cells by frame origin while transformed geometry can be distant. Preserve bounds-aware culling; centre-only culling previously hid nearby walls whose colliders remained. Validate geometry/attribute conservation, shadows, views, submitted triangles and draws before claiming improvement. Vehicle/crowd CPU costs remain profiling hypotheses.

## Candidate implemented 2026-11-03

Three economical workers implemented distinct world/data retirement, save recovery and cup gameplay; root integrated Game/UI/schema, the Punjab Stories HUD, ground locomotion ownership and mobile Play controls. Canada construction/roads/population/fresh spawns and unrelated launch/import/menu paths are removed from production entry. Generic retired terrain remains ordinary Punjab ground; historical code/assets and owned items remain recoverable. Gali da Cup uses the existing park and characters with input-driven batting, fielding, loose-ball recovery, rule records and once-only relationship receipt. The invitation sits at the west entrance (120.8,-24). A small sign/chalk/seating pass uses existing materials. No Amritsar source is claimed reused: authenticated source helper is absent here, and the public URL fetch returned CONNECT HTTP403. That optional access attempt stopped; the original Site was not modified.

Targeted retirement, migration, cup logic/lifecycle and host admission/receipt tests passed. One full integrated suite/build and bounded production browser journey follow on frozen source. No mission duration, fun, hardware FPS or publication claim yet.

The original board blocked the camera and a straight mobile route met its posts. It was relocated and given matching physical backing. Production Chromium touch diagnostics passed portrait and landscape, including real menu scrolling, a held-thumb Pause/Resume and fresh movement. These are software-rendered, accelerated diagnostics, not physical-device performance evidence. The earlier input-driven open-rule cup and Canada save migration passed on the prior product candidate; final source validation remains necessary.
