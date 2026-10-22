# Handoff — Punjabi Fun Shun

A note for the next working session. Read this first, then `docs/ARCHITECTURE.md`.

## The project

- Babylon.js 9.28 + TypeScript + Vite + Havok open-world game set in the fictional Ranggarh, Punjab (town), Nawan Shehar (city), Ludhiana (big city district), Pind Kotli (village), farms, G.T. Road.
- Repo `rahulbhola877/punjabi-fun-`. Work on branch `first-mission`; when a change is finished and verified, fast-forward `main` to it (`git push origin HEAD:main`). Vercel deploys `main` to https://punjabi-fun.vercel.app. Every push to `main` also builds the Android APK (`.github/workflows/android.yml`) and attaches it to the `apk-latest` release.
- Another session sometimes works on the same repo: always `git fetch origin first-mission main && git rebase origin/first-mission` before pushing.

## House rules (from the user)

- Commit as `git -c user.name=Rahul -c user.email=rahul@globoff.com commit`, ending messages with the Co-Authored-By / Claude-Session trailer lines the session gives you. No model names in commits or code. No PRs unless asked.
- The user plays on the live site and on Android, so deploy (push to `main`) when a change is done and verified; they asked for that each time.
- The user writes in Hinglish/Punjabi; reply plainly in English, short.
- When the session's context gets to roughly 60%, write an updated handoff here and start a fresh session to continue (the user asked for this to save tokens).

## Verify before you ship

- `npx tsc --noEmit -p .` and `npx vitest run` (144 tests; run `npm ci` first in a fresh container).
- Build: `npx vite build --outDir <scratch>/dist`, serve with `npx vite preview --outDir <scratch>/dist --port 4173 --strictPort` (run in background), then:
  - `node tools/smoke.mjs http://localhost:4173/` — no `errors`.
  - `BASE=http://localhost:4173/ node tools/views.mjs '{"name":"camX,camY,camZ,tx,ty,tz"}'` — screenshot to `tools/out/name.png` (look at it!). `PRE="window.__pfs.weather(true)"` makes it pour (flooded); `EXTRA="&noao"` adds URL params.
  - `node tools/wade.mjs` — rain on, walk dry vs into the Dal Bazaar flood (speed, wade depth).
  - `node tools/events.mjs`, `tools/gg.mjs` (`AT=x,z,yaw` walk + fps/audio log), `tools/snake.mjs`, `tools/prof.mjs` (CPU profile), `tools/audio-chain.mjs`.
  - Debug probe `?probe`: `window.__pfs.teleport(x,z,yaw)`, `.event(name)`, `.weather(on, instant=true)`, `.snapshot()` (has `weather: {rain, wet, flood, wade}`). URL `?rain` = pouring and flooded from the start.
- Don't leave `docs/screenshots/*.png` changed by the tools (`git checkout docs/screenshots`).

## Where things are

- World layout: `src/world/region.ts` (WORLD bounds ±700, TOWN, CITY, VILLAGE, LUDHIANA rects, ROADS, SITES, OUTER_BUILDINGS, PLOTS, DEFECTS, REHRIS), `src/world/layout.ts` (Ranggarh town detail, POIs), `src/world/country.ts` (builds roads/buildings/sites from region data), `src/world/zones.ts` (zone kinds: residential, market, civic, farm, village… and their "life" — crowd, horns, quarrels, ambience bed), `src/world/nav.ts` (road graph for traffic, walk graph), `src/world/buildings.ts`, `street.ts`, `props.ts`, `Kit.ts`.
- People: `src/crowds/Crowd.ts`, `countryFolk.ts`, `Barkers.ts` (street calls/chat). Traffic: `src/traffic/Traffic.ts`, `AIDriver.ts`. Events: `src/combat/Jhagde.ts` (quarrels, colony fights, crashes, road rage, dangal), `Police.ts` (slow heat-based stars), `Posts.ts` (nakas/chowkis). Fast travel: `src/missions/Travel.ts` (check new spots are on open street, not inside a building).
- Audio: `src/audio/Audio.ts` (master bus = one gentle limiter; engines out of earshot stop their sources), `VoiceDirector.ts` + `src/audio/voiceMap.json` from `tools/voice_map.py` (docs/voice-map.xlsx). One voice at a time; 90 s minimum repeat except greetings; residents only voice when visible.
- Graphics: `setupPipeline`/`applyPost` in `src/app/Game.ts` (real device pixel ratio, MSAA + sharpen, colour curves), presets in `src/app/quality.ts`, fog in `src/world/World.ts`.

## Done in session 7 (2026-10-22)

- **Processions** (`src/crowds/Processions.ts`): nagar kirtan (2 nishanchis, Panj Pyare with kirpans, bibis, palki on a decorated blue tractor-trolley, sangat; harmonium+tabla+chimta synth; "Jo bole so nihaal!"/"Sat Sri Akaal!"), political rally (fictional "Bhullar ji" party, flag green with yellow hoist band and white disc — deliberately NOT striped; open jeep with loudspeakers, neta standing in it; megaphone synth + "Zindabad!"), baraat (2 dholis with dhol prop/arm pose, bhangra gesture dancers, women, dulha with sehra sitting on a GeoBuilder ghodi with walking legs, ghodi-wala; stops 12–18 s every 30–45 s to dance; pulls the player in). Every 6–10 min when not raining, only starting out of camera view; T menu "Nagar kirtan / rally / baraat" starts one 25–70 m away. Routes: `planRoute` on roads ≥7 m, not tracks/highway (`procStep`), left lane offset. Members are crowd residents with a brain steering to formation slots; floats are visual models + ANIMATED physics boxes. Head stops if a vehicle is in the lane ahead; blocked 25 s → ends. End: cleared when unseen (≤60 s). Traffic: `TrafficHost.calm(pos)` → `AIDriver.patient` (no back-out/re-route/unjam while clearAhead<12; Buses stuck timer too); floats are in Game obstacles. Audio: `Audio.procession(kind,pos)` (drum/reed/megaphone). Animator: `pole`, `dhol` inputs, `bhangra` gesture (ResidentDef `pole`, `dhol`). Probe `procession(kind)`, `procs()` (with `held` patient cars), `procEnd()`. Tool `node tools/procession.mjs` (KIND, FOCUS=metres back from head for close-ups, SIDE, UP, AHEAD, WATCH=secs to log held traffic then end and check it recovers). Test tests/processions.test.ts.
- **Walk-in kothis** (`src/world/openHouses.ts` OPEN_HOUSES, 81 kothis: `b.seed % 7 === 3`, w≥7, depth≥10): gate leaves folded open (collider gap), door centred and open (DoorStyle `open`), two steps up the 0.45 plinth; `houseInterior` in interiors.ts builds inner faces, ceiling, colliders (no solid block) and furniture: baithak (sofa set, rug, centre table, TV, showcase, photos, clock, tube light, fan), partition with doorway+curtain, back room (kitchen platform, chulha, LPG cylinder, steel rack, water filter, fridge, Godrej almirah, dining table+4 chairs). Things in shade use the self-lit "interior" material (wood/metal went pitch black). Host `home_<id>` (Aunty ji / Bebe ji, seated, countryFolk `homeHost_*` cells); E "Talk to …" → `visitHome`: chah (eat() with the chai item, +1 rep once per house per session). Camera interior mode inside; `arriveAt` allows teleporting into an open house. Probe `openHouses()` (nearest first, with frame ox/oz/rot/w/dd/yd). Tool `node tools/house.mjs` (AT=x,z, N=index; shots house_gate/in/room/back). Test tests/openHouses.test.ts.
- ElevenLabs clips: asked the user again in chat; no answer yet — not generated.

## Done in session 6 (2026-10-22)

- **Rain/flood reactions** (item 1 without spending credits — the user was not around to OK ElevenLabs): new `when` codes `rain-start` (3–6 s after a downpour starts, the nearest visible adult reacts) and `flood` (every 45–75 s while the player is in or beside a flooded gali). `Game.rainTalk`. Eight new clips on the voice map, all **on "No"** (not recorded yet): rain_suit, rain_kapde (any-woman), rain_chhatri_aunty (woman/elder), rain_pakode (any-man), flood_mla (elder/man), flood_naali (man), flood_auto_engine, flood_auto_kishti (auto-wala). Until recorded, `VoiceDirector.words(when, r)` gives their words as speech bubbles. To record: model eleven_v4, voices as in the sheet's Voice column (P = 39AekRoBy9NhBCDsDJ7f, others from creative_list_voices to match A/B/C/E/F/G), files to public/audio/voice/<clip>.mp3, flip "No"→"Yes" in tools/voice_map.py, `python3 tools/voice_map.py make`. Tool: `node tools/raintalk.mjs` (AT=-415,-240,3.14 is in the Dal Bazaar flood).
- **Shops with goods**: ItemKind `goods` (Shops.ts `G` = gift goods, `P` = packet snacks with heal). Kiryana (atta, dal, ghee, tel, cheeni, chai patti, biscuit, bhujia, cold drink), mobile accessories, cloth/woollens at real prices. `TRADE` menus by sign key for every signed city/Ludhiana shop (196, `src/world/cityShops.ts` `CITY_SHOPS`: keeper `keeper_<buildingId>` with `shop: true` 2 m inside behind the counter, counter point 0.9 m out on the footpath; Pinka's mobile shop excluded). Keepers streamed per cell (`shopKeep_*` groups in countryFolk). **Bag**: `save.bag` (id→count, validated; old saves get {}), key **B** / 🎒 touch button / help line: snacks are eaten, other goods given to the person in front (≤4.2 m, reaches across a counter) for +rep (cost/150). Speech bubbles hide while a menu is open (`state === "busy"`). Probe: `cityShops()`, `buy(id)`, `bag()`, `openBag()`, `prompt()`; snapshot people have `y`. Tool: `node tools/shopgoods.mjs` (TRADE=cMithai etc.). Tests: tests/shops.test.ts.
- **Kites** (`src/crowds/kites.ts`, `src/world/rooftops.ts` ROOF_SPOTS mirrors kothi() roof geometry): no day/night clock exists, so they fly whenever it is not raining. Up to 6 flyers on kothi roofs (every ~4th kothi by hash, 12–125 m from the player, removed beyond 160 m or in rain), residents with `onRoof` (no ground snapping) and `kite` (arm pose in HumanAnimator). Kites: instances per colour, self-lit (disableLighting + white emissive), scaled 1.5; strings one updatable LineSystem. Pech every 25–50 s (needs game time — slow on swiftshader): "Pech lavaange?", then "Bo kata!" and the cut kite drifts off/falls, relaunch after 15–30 s. Probe `kites()`, `pech()`. Tool: `node tools/kites.mjs` (CAM=x,y,z,tx,ty,tz clones the camera for an overview; e.g. CAM=-150,14,22,-130,23,48 in Guru Nanak Nagar). Test: tests/rooftops.test.ts.
- Note: `tools/mobiletest.mjs` sometimes walks past the auto (fps-dependent) and errors on the pedals step; rerun once.

## Done in session 5 (2026-10-22)

- **Bus polish**: open sliding windows (rear pane pushed over the front one, some shut) with bench backs inside, 3–7 seated sawaris (`Traffic.loadBus`/`busSawari`, free seats in `TrafficCar.busSeats`; the player's seat left z 1.2 stays free), a conductor hanging out of the front door (rider with `pose: "stand"`). Buses never pothole-tip. Shelters near the player (<110 m) get 1–3 waiters (bench or standing; `Buses.update`), who walk to the door of a bus standing there and take a seat; the stop refills after 1–2.5 min. Probe: `__pfs.face(yaw)` swings the camera, `.busWaiters()`, `buses()` has `yaw`. Tool: `node tools/bus-look.mjs` (shots bus_wait, bus_side, bus_door).

- **Food you can eat**: shop item kind `food` (Shops.ts `F(...)`: heal, prop, yum line, optional sprint buff). Dhaba kitchen: aloo parantha, chole bhature, makki-saag, dal makhani thali, lassi, chai; Mithi Hatti: jalebi, samosa, gulab jamun, matka kulfi; kiryana chana; Pammi banana. Carts (`REHRI_FOOD` by goods: chaat = gol gappe/tikki/papdi, ganna = ras, fruit = kela/amrood) get an E interaction on the customer side. Eating (`Game.eat`): menu closes, dish prop (`buildFood` in Markers.ts) in the left hand, `eat` gesture for 4 s, health comes back; running, a fight or a vehicle ends it. Probe: `__pfs.eat(id)`, `.shop(keeper)`, `.eating()`. Tool: `node tools/eat.mjs` (FOOD=id).

- **Dialogue rules** (bug: shop lines out of nowhere on the road): the "shopkeeper-man/woman" voice codes matched every resident with role `keeper` (drivers, havaldars, truck drivers, rehri-walas, nurse…). Now only residents with `shop: true` (the bazaar `keeper_*`). VoiceDirector: `priority(when)` (3 talk/mission/meet, 2 fights/quarrels/events, 1 pass-by/chat/street-call), spacing since the last line (8 s for street talk, 2 s for events), street talk refused while driving >2 m/s or running >6 m/s (`VoiceContext`). Game.speak queues only priority ≥2 lines while a voice plays. `?voicelog` logs why each line played/was refused (`__pfs.voiceLog()`, tool `node tools/voicelog.mjs`). Test: tests/voice.test.ts.
- **Uncle line**: `player_uncle_gitte` ("Oh uncle ji, tuhada dimaag thode gitteyan vich hai ki?", voice P) — when `fight-elder`: 2.6 s after an elder man squares up to a male player (Game onFightStart). Probe `__pfs.fightNearest(elder)`, tool `node tools/uncle.mjs`.
- **Rain folk**: when it rains (>0.3) ~45% of walkers/roamers (hash of id) hold a chhatri (`src/crowds/umbrellas.ts`: one instanced source mesh per colour, mostly black; parented upright on the body, not the hand bone — the bone made it stick out sideways; arm pose `AnimInput.umbrella`); the rest (not elders) walk 1.7× faster (`Crowd.pace`). Tool: `node tools/rainfolk.mjs` (AT=x,z,yaw). Not done yet: running for cover under awnings, kids splashing, vehicles stalling.
- Relayed asks still open (from another session, said to be the user's): more ElevenLabs lines (not generated: needs the user's OK to spend credits).

## Done in session 4 (2026-10-22): working buses

- `src/traffic/busPlan.ts`: each route (BUS_ROUTES in busRoutes.ts) turned into legs out and back; A* via `NavGraph.path(a, b, ok)` (new optional step filter) restricted by `busStep` to roads ≥7 m, no colony galis, no kacha tracks (a junction node can belong to one road while its link runs down a track — the step's midpoint must lie on a bus road). End nodes the bus would pass and come back from are dropped. `legAt`, `legProject`, `stopPoint`.
- `src/traffic/Buses.ts`: runs (r1 has 2 buses, r2/r3 one). Virtual (point moving 8 m/s along the leg, dwelling at stops) until within 170 m of the player, then a real bus via `Traffic.spawnBus` (TrafficCar with `bus: true`; Traffic only steers it, skips despawn/unjam/wander; honks when blocked so animals move). Back to virtual beyond 240 m unless the player is aboard. Dwell 12–15 s; stuck >35 s (20 s with the player) → put back on the route 12 m on. `AIDriver.follow(nodes, end)` joins a route at the nearest piece (important when a bus appears half-way along a leg).
- Game.ts: "Board the bus" at the front door while it stands (fare menu of stops ahead to the end of the line, ₹10 + ₹2/100 m), player sits inside (`busRide`, `sitInBus`, camera mode `bus` = 14 m back), "Get off at <stop>" at any stop, auto get-off at the ticket's stop. Travel menu blocked while aboard. `bus_` ids are TRANSIENT. Map: bus boxes (blue roadways, red PRTC) and 🚏 stop squares. Jhagde crashes/road rage skip buses.
- Shelters (`busShelter` in country.ts) at `shelterSpot`; Pind Kotli stop moved to z=280, Bhangu to x=-585 (were inside houses / on a track).
- Posts.ts: the naka's second constable stands at the road edge — he stood in the lane and traffic queued behind him for ever.
- Tests: `tests/sim/buses.test.ts` (every leg on bus roads; shelters clear of buildings; a real bus drives every leg from the stop and from half-way on the real colliders). Tool: `node tools/bus.mjs` (warps bus_0 near Ranggarh Mor, boards with E, rides to Civil Hospital; screenshots bus_stop/bus_ride/bus_off). Probe: `__pfs.buses()`, `.busWarp(id, leg, back)`, `.board(id)`, `.busRide()`.
- Known/possible follow-ups: a cow *sitting* in the lane never moves for a horn (bus waits, then hops 12 m after 35 s); passengers get off on the lane side, so for the opposite direction the shelter is across the road; no other passengers or conductor figure on the bus yet; the old Travel.ts teleport menu still exists ("Bus & auto stand").

## Done in session 3 (2026-10-22)

- **User rule: no fog.** "keep graphics sharp and clear. no foggy effect. foggy effect can be in winter season only. summer no fog at all." Fog is off (`World.baseFog = 0`, FOGMODE_NONE); rain does not add fog either. A winter season with dhund could use `baseFog` later.
- **Roads by planning** (region.ts `roadCondition`: good = G.T. Road, Model Town, Urban Estate, Sarabha Nagar; bad = Ludhiana, Nehar Road, village galis, Guru Nanak Nagar, Kitchlu Nagar; kacha = tracks; the rest fair). Good roads: dark fresh tarmac, edge lines, no defects. Bad: faded, cracks, crumbled edges, worn centre line, many potholes. Potholes are real holes: the road and ground meshes are cut (`flatHoles` in country.ts) and a bowl (`potholeBowl`) goes ~7–14 cm down; never across other roads, piece ends (`ROAD_SEG`) or ground tiles (`GROUND_TILE`). `surfaceAt(x,z)` gives depth (pothole bowl + small bumps on fair/bad/kacha roads); Vehicle suspension adds it to the ray length so wheels hang into holes and rattle (all vehicles, via Game.spawnVehicle).
- **Rain + waterlogging** (`src/world/Weather.ts`): clear most of the time, a 3–6 min downpour every ~7–15 min (first after 3–7 min), or T menu "Make it rain". Rain streaks/splashes (particles, fewer on Low), grey storm-sky dome, dim sun, wet glossy darker materials, lightning + thunder, rain sound (`Audio.setRain/thunder`). `FLOOD_ZONES` (region.ts: Dal Bazaar Gali, Ghumar Mandi, Chaura Bazaar, Kitchlu Nagar, Guru Nanak Nagar, Nehar Road, Pind di Gali, Bazaar Road, Bus Adda Road) fill knee-deep (≤0.45 m) after ~a minute of heavy rain and drain over ~3 min; one muddy water mesh raised by scaling. Wading slows walking (`wadeMul`), vehicles get water drag (`Vehicle.wade`) and spray; wet roads cut grip (`wetGrip`). Planned colonies stay dry (test). Note: a cloned PBR material never became ready (its textures were re-created) — build new materials and share textures instead.
- **SSAO** on High/Ultra only (`applyPost` in Game.ts, SSAO2 via the pre-pass renderer: ~+5 draws, subtle). `?noao` to compare.

## Done in session 2 (2026-10-22)

- **Cycle rickshaw** (`rickshaw` type: specs.ts, models.ts `rickshaw()`): rideable (pedal, bell), parked `rickshaw_1` (bazaar) and `rickshaw_2` (Guru Nanak Nagar main road); Traffic spawns rickshaws/totos in colony galis (`Traffic.colony`, colony counts as "crowded"; autoTarget floor 0.8 there).
- **Traffic deadlocks fixed** (src/traffic/AIDriver.ts): lane offset fits road width; `CART_ROADS` (region.ts) keeps wide vehicles clear of rehris on the tarmac; narrow-road turns start one turning circle early (`turnR`) at walking pace; pure-pursuit look-ahead steering; wander never picks dead-end stubs, starts the way the vehicle faces (`wander(steps, first)`), brakes for corners only as they come up, skips unreachable points beside it. Pedestrians at the edge of a gali no longer block (`clearAhead` margin).
- **tests/sim/galis.test.ts**: drives AI vehicles through every colony + 60 spots on other roads on the real colliders; fails on any wedged vehicle (was 24+, now 0). Use it after any road/scenery change.
- **Roadways bus** vehicle type `bus` (specs/models) exists but is not used yet. `src/world/busRoutes.ts` (committed, not yet used): BUS_STOPS/BUS_ROUTES plan (Ludhiana Adda – Ranggarh Mor – Civil Hospital – NS Bus Adda; NS Adda – Pind Kotli – Dhaliwal; Ranggarh – Kotli – Bhangu) and `shelterSpot`.
- **House builder** (src/world/houseBuilder.ts, used by kothi(), villageHouse(), cityBuilding()/cityUpper() in country.ts): holedWall (walls around openings, reveals), windowFill, doorFill (panel/steel/darwaza), jaaliParapet, balcony, mumty, sintex, cooler, acUnit, dish, gatePillar, cladding, jharokha, windowRow. Visible tris in a colony ~0.70M→0.95M, ~+13 draws. A separate culled "detail" layer was tried and dropped (cost +50–80 draws for little gain).
- Tools: `tools/at.mjs` (AT=x,z,yaw: start, teleport, log traffic types `type+riders@x,z~speed/clearAhead`, screenshot to tools/out), `tools/ride.mjs` (get on a vehicle at AT and pedal), views.mjs now prints `activeTris`. Snapshot has `trafficTypes`, `drivingType`, `drivingSpeed`.

## Next, in this order (user's latest asks first)

(Roads, rain, SSAO, buses, bus polish, food, dialogue rules, uncle line, chhatris, rain/flood reactions (bubbles), shops with goods + bag, kites, processions, walk-in kothis are done.)

1. Record the eight rain/flood voice clips (see session 6) — only once the user says yes to spending ElevenLabs credits (asked in sessions 6 and 7, no answer).
2. More public buildings: village dispensary, bank/ATM, post office, petrol pump in Ludhiana, a market in Model Town (SITES + builders in country.ts `buildSite`; find free plots; add to Travel.ts; folk in countryFolk). Maybe a kite-flying mini activity for the player on a roof, and interiors for village houses.
3. Rain extras: people without a chhatri run for cover under awnings/doorways/trees, kids splashing in the flood, vehicles stalling in deep water, traffic slowing for floods.
4. Possible procession polish: a bus/car facing the procession head-on in its lane deadlocks until the 25 s give-up (fine but could let people step aside); procession voices are bubbles only.
5. Keep checking: smoke, tests, `?voicelog` + tools/voicelog.mjs for stray lines, galis test for jams, fps/draws.

## Done so far (2026-10-22, session 1 of the map task)

- World is now ±1000 m (`WORLD` in region.ts, `WORLD_BOUNDS` in config.ts, map span 2000 in Game.openMap). Tracks extended; new link road `pindLink` (z=720).
- `src/world/colonies.ts`: the plan. COLONIES = Guru Nanak Nagar, Sant Nagar (Ranggarh), Model Town, Urban Estate (Nawan Shehar), Sarabha Nagar, Kitchlu Nagar (Ludhiana), Pind Kotli phirni + mohallas, new villages Pind Dhaliwal (NE) and Pind Bhangu (NW). Roads go into ROADS, houses (`kothi` style, or `village`) into OUTER_BUILDINGS via `colonyHouses`, parks/toba/gurdwara/kabaddi into SITES. Field cutter ignores colony roads.
- country.ts: `kothi()` house, `colonyDressing` (lamps, neems, manjis/plastic chairs, welcome arches `COLONY_GATES` with signs gGnn…), `toba`, `swings`, `school`, `hospital`, `siteWall`. Narrow galis have no centre line.
- `src/world/colonySeats.ts`: shared walk graph + seat spots per colony (scenery chair and the seated elder line up).
- countryFolk.ts: colony walkers, aunties, elders; school (kids, Masterji, mid-day-meal bibi); hospital (patients, nurse, chowkidar).
- zones.ts: each colony residential / village. Travel.ts: all new places listed.
- Bains Farm moved to x -80..-45 (it was inside Kitchlu Nagar).
- Perf: total verts 1.78M → 2.75M, draw calls in colonies ~450 (bazaar ~500), load time unchanged (~12 s swiftshader).

## The task now (user's words, 2026-10-22, second message)

"add more realistic things and activities which work. some house can have indoor things, add local activities like going on roof and flying kites and such other activities too. think like a real punjabi city planner and have a kind of real kind of city map. streets will have rallies, riksha too. uncle aunties old ones sitting in streets sometimes on chair or manji in rural areas. have real taste of punjab and also real food props which he can eat and try. real shops with realistic things to buy. this city is lacking so many things. study more, add schools, hospitals etc and real working public transport too. keep checking for deadlocks and bugs and keep it clean and fast with good fps"

Still to do, roughly in this order:
1. Cycle rickshaws (and e-rickshaws) in traffic on colony galis and Ludhiana; a rideable one would be great (see `src/vehicles/specs.ts`, Traffic.ts).
2. Working public transport: buses that actually run a route between Bus Adda (Nawan Shehar), Ranggarh gate, Ludhiana adda and the villages, stopping at stops; the player can board (today Travel.ts is a menu teleport).
3. Food you can eat: real items (parantha, lassi, chole bhature, jalebi, samosa, gol gappe, makki di roti–sarson da saag, kulfi) at dhabas, rehris and halwai shops, with an eat interaction that restores health/stamina. Check what the bazaar dhaba already does (Game.ts interactions, `src/missions`).
4. Shops with things to buy (Game.openShop exists for vehicles): kiryana, mithai, cloth, mobile — a buy menu with prices and an effect/inventory.
5. Rooftop life: people on kothi roofs at dusk flying patang (kites in the sky, string), a few on charpais on roofs; kite-fighting mini activity maybe.
6. Street rallies/processions now and then (nagar kirtan, political rally with flags and a loudspeaker jeep, a baraat with dhol) moving along a road and holding traffic — Jhagde.ts events are the model.
7. Some houses with interiors you can walk into (interiors.ts).
8. More public buildings: village schools, dispensary, bank/ATM, post office, petrol pump in Ludhiana, a mall/market in Model Town.
9. Keep checking: smoke test, tools/events.mjs, deadlocks (traffic jams at new junctions: watch `traffic` and stuck vehicles in colonies), fps/draw calls.

## The task now (user's words, 2026-10-22)

"add streets, residential colonies etc too, in urban areas as well as village area. expand map like a city planner and make it vast. find weak areas of game and weak visuals, fix those."

Suggested plan:
1. Map: survey with the minimap/map renderer (`src/ui/MapRenderer.ts`) and top-down `views.mjs` shots. Plan like a city planner: sectors/colonies with a grid of galis off the main roads (e.g. "Model Town", "Guru Nanak Nagar", "Sant Nagar", "Phase 1/2" in Nawan Shehar; mohallas and a phirni ring road around Pind Kotli; more housing along Ludhiana). Add the roads to ROADS (so traffic and nav pick them up), houses as OUTER_BUILDINGS / plots, zone them `residential` in zones.ts so colony fights, aunty quarrels, birds, quiet ambience apply. Consider enlarging WORLD bounds if needed (check terrain, minimap, draw distance, nav graph build time, and performance).
2. Keep performance: watch draw calls (`snapshot().drawCalls`) and fps per area; merge static meshes per chunk; LODs exist in World.ts.
3. Then weak areas/visuals: walk and drive around (views + gg.mjs), note what looks bare or broken (empty fields, flat facades, floating props, stuck spawns, buildings without doors/windows, repetitive colours), fix the worst first. Ambient occlusion on High/Ultra was offered to the user and not yet answered.
4. Ship in steps: commit, deploy, tell the user what changed and where to go see it (T key panel can teleport; add new places to Travel.ts).
