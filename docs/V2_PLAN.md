# Gedi Route: audit and V2 plan

Audit date 2026-10-24 · branch `first-mission` · commit `015a0b0` at audit time.
Geometry counts were measured in headless Chromium with software rendering. They are real. Frame rates from that setup are not, so none are used here.

**Status, 2026-10-24 (latest): WP4, WP5 and WP6 are done** (WP6 without the Amritsar chapter, which stays deferred). WP4 is:  (fuel, power cuts, signals, rail, post and bank, dispensary, chaupal, seasonal fields on a 48-day calendar, three factories with shift changes and rush-hour traffic), and the 50 new recorded lines are in the game. Next: WP5 to WP7.

**Status, 2026-10-24 (later): WP0 to WP2 are in, and WP3 except recorded music and 150 more lines** (people with names, ties, reputation and hours; shops open and close; the street thins at night; one quarrel per gali per ten minutes; nobody is moved in view; pause-menu people page).

**Status, 2026-10-24:** the first job starts on the Bullet (`5867687`), and 47 of the 50 trial voice lines play in the game (`6301dda`; three are held). A bubble and its recording now match, and the T menu is behind `?probe` (`249a03a`). Decisions 1 to 4, 5 and 7 are answered in section 12. Still open: walk-in houses (6) and music (2), which needs a connector this session does not have.

## 1. The short version

Gedi Route has many working systems: routes, buses, floods, day and night, a family home, processions, a recorded Japji Sahib, and characters that look good up close. What makes it feel bad is not missing features. The systems do not connect into a reason to keep playing, and the world feels silent, generic and scripted.

The five biggest problems:

1. **No goal after the intro.** Deliveries pay roughly ₹30 to ₹500 a job, the only real purchases are paints at ₹120 to ₹250, and the ₹20,000 start means nothing is out of reach.
2. **Nobody lives in the city.** People are interchangeable, walk random paths and stop. Nobody has a shop to open, a school to leave or a home to go to.
3. **Silence.** There is no background music or radio at all. There are 57 switched-on recorded voice lines, and everything else is a text bubble.
4. **Heavy for what you see.** On Medium, High and Ultra a street view draws 1.3 to 1.7 million triangles in 450 to 700 draw calls, and about 4.5 million vertices stay loaded on every preset.
5. **Dummy features.** A petrol pump with no fuel, a "Bus & auto stand" that teleports past the bus system, a street-event menu on the T key, and an intro that sends the player to ride a scooter while the new start gives them their own Bullet.

On the home builder: keep the facade builder and the family home, restructure the facade builder to be cheaper, and move most walk-in interiors to on-demand (section 6).

First steps, one session: fix the intro, hide the sandbox, remove the dummy stops, and start the budget work. Then build the daily loop around the family home (a tiffin business that starts from the kitchen), routines for people, and a radio. The plan is section 11. It needs seven decisions (section 12).

## 2. How this audit was done

- Read the source: 25.8k lines in `src/` outside the kit, plus 3.7k lines of the vendored character kit. Checked the 26 test files (173 tests, all passing) and the roughly 50 dev tools.
- Measured the current build at each quality preset from the same two camera positions: a bazaar street and a colony gali. Counted triangles, draw calls and loaded vertices.
- Looked at screenshots of the home, the bazaar, a colony and the Bullet start.
- Searched the code for each feature a Punjabi player would expect (section 10).
- Not covered: a full playthrough, a real GPU or phone, listening on real speakers, and feedback from other players. Treat the design judgements as a starting point for a playtest.

## 3. The numbers

| Measure | Value |
|---|---|
| Source | 25.8k lines in `src/` (excluding kit); kit 3.7k lines in 11 files |
| Largest files | `Game.ts` 2,965 · `country.ts` 1,807 · `Audio.ts` 1,261 · `Jhagde.ts` 909 · `Crowd.ts` 852 |
| Tests | 26 files, 173 tests, all passing |
| Dev tools | about 50 files in `tools/` |
| Voice | 58 recorded clips (57 switched on) · 21 sound effects · **no music track** |
| Download | JS bundle about 2.9 MB (0.8 MB gzipped) · 4.5 MB in `public/` |
| Bazaar street: triangles / draw calls | Low 548k / 176 · Medium 1.28M / 453 · High 1.34M / 503 · Ultra 1.71M / 694 |
| Colony gali: triangles / draw calls | Low 315k / 100 · Medium 987k / 345 · High 1.11M / 406 · Ultra 1.33M / 554 |
| Loaded vertices | 4.4 to 4.5 million on every preset |
| People and vehicles | 46 people and 17 vehicles at the start; 84 and 28 after the smoke-test run |
| Places | about 27 travel places · 19 delivery stops |

The loaded-vertex figure is a count, not a GPU measurement. At roughly 32 to 48 bytes a vertex it would be 150 to 200 MB of GPU memory. That estimate is not measured.

## 4. What works and should stay

- **Map and routes.** Tap a place on the map; a waypoint leads on the minimap and compass and clears on arrival.
- **Weather and day.** Rain, floods in the low galis that drain away, a 36-minute day with the sun's path, the moon and street lamps.
- **Buses on real routes.** Boarding, fares, stops and shelters.
- **Street life.** Gossip circles that boil over, quarrels with onlookers, processions (kirtan, rally, baraat), kites, morning joggers and gurbani at dawn.
- **The family home.** Greetings, meal calls, a TV with sound, a blessing, an errand and a bed. It is the most complete "life" system here and the pattern to copy.
- **Characters up close.** The stocky Jaggi with his dastar and kurta; the walk, run, swim and eating animations.
- **Food, shops and the bag.** Goods you carry and give away; food you eat on the spot.
- **Handling.** Steering and potholes have tests.
- **Foundations.** Save migration, a test suite that passes, and the Medium frame-cap bug (now fixed).

## 5. What makes the game feel bad (ranked)

| # | Problem | Evidence | Severity |
|---|---|---|---|
| 1 | Nothing to aim for after the intro | The "Free roam" card; jobs pay about ₹30 to ₹500 (`payFor`, `Missions.ts`); paints ₹120 to ₹250; start money ₹20,000 | High |
| 2 | The city is not lived in | Generic names ("Neighbour", "Aunty ji", "Uncle ji"); a handful of named contacts; walkers take random graph paths and pause; no schedules | High |
| 3 | Silence | No background track in `Audio.ts`. The music bus carries only shrine, loudspeaker and short sting sounds. 57 switched-on recorded lines | High |
| 4 | Boxy at street level | Colony frames: flat tiled walls, a flat sky, repeated textures. The detail is lost beyond about 40 m | Medium to high |
| 5 | Heavy for what you see | 1.3 to 1.7M triangles and 450 to 700 draw calls on Medium to Ultra; 4.5M vertices always loaded; kit people cost 17 to 40 ms each to build (session 9 note, software rendering) | High on phones |
| 6 | Dummy and half-working features | Section 9 | Medium to high |
| 7 | The intro contradicts the new start | `Missions.ts` lines 116 to 117: "Take the scooter, Bhola's nephew's mint scooter", but the player now starts beside their own Bullet | Medium |
| 8 | The screen is busy | The objective card covers the top centre through the whole intro. The key legend shows for the first minutes and while driving. The inline key icons wrap badly in the card text | Medium |
| 9 | A test menu is one key away | The T key opens street events for every player: "Make it rain", quarrels, gossip, time of day | Medium (decision) |
| 10 | Dialogue reads like a phrasebook | Greeting lines are mostly English: "Have you tried Bhole's lassi? Best in Ranggarh." and "The chowk is under repair again. Every year!" | Medium (authenticity) |
| 11 | Two body systems | The old body for drivers, riders, passengers and far folk (`Traffic.ts`, `Crowd.ts`). The kit for the nearest 10 to 28 people and the player. Visible when they swap | Medium |
| 12 | Pop-in and teleports | Spawns 12 to 48 m away with no fade. Stuck walkers are teleported (`relocate`) and roamers reset to a patch centre. The house guard moves people out by teleport | Medium |
| 13 | Events repeat | Quarrel, gossip, colony fight, aunty quarrel, elders' quarrel, procession, road rage, crash, gang, dangal. Each is good; together they are a random menu with no story reason | Medium |
| 14 | Code and docs drag | `Game.ts` orchestrates everything; `country.ts` builds the whole map in one file; three kit files skip type checks (`@ts-nocheck`); `ARCHITECTURE.md` (77 lines) predates processions, gossip, buses, home, kit and routes; `HANDOFF.md` is 190 lines of session logs | Low to medium (team speed) |

## 6. Do we need the home builder?

"Home builder" can mean three things in the code. My answer for each:

**Facade builder (`src/world/houseBuilder.ts`): keep, and restructure.** It is why the houses read as Punjab houses: chhajja, jaali parapets, balconies, chaukhat doors, Sintex tanks, coolers, AC units, dishes and gate pillars. It is also expensive. HANDOFF records colony triangles going from 0.70M to 0.95M when it was added, about a third more. Its header says everything is batched through the kit, and the file has no instancing, so every window and tank is unique geometry. Fix: thin-instance the repeated pieces (windows, doors, grilles, tanks, coolers, AC units, dishes) from a handful of prototypes, keep the silhouettes at distance, and drop the small parts past about 60 m. Target: the same look at about half the triangles.

**Interior builder (`src/world/interiors.ts`, `houseInterior`): keep the family home, and build the rest on demand.** It is called for all 81 walk-in kothis when the world loads (`country.ts` line 911). Only the family home is a real place. The other houses hold one host who offers chah. Build an interior when the player is within about 40 m, or keep only the home plus eight.

**Home mission (`src/missions/Home.ts`, `HomeTv.ts`): keep, and copy the pattern.** It is the best-built life system here: greetings by name, meal calls, heads that turn, errands, a TV, a bed. Named people in the city should work the same way.

Short answer: yes to a facade builder and to the home. Cut or defer most of the interiors.

## 7. What is not working with people (NPCs)

1. **Two body systems.** Fix: one character pipeline. Use the kit for everyone near, and a cheap silhouette only for far folk. Drivers and riders switch first.
2. **Pop-in and teleports.** Fix: a 0.4 s scale-in or fade for every spawn; relocate only while out of view; stuck walkers re-plan their path rather than teleport.
3. **Brain ownership is by convention.** Each person has one `brain` slot and no owner, and four systems set it (Jhagde, Morning, Processions, Home). The house guard moves anyone inside a plot back out every quarter second. A fighter whose path crosses a gate could be teleported in and out repeatedly. I believe this can happen but have not reproduced it. Fix: plot edges are walls for brains, each brain has an owner, and one director schedules events.
4. **No routines or needs.** Nobody opens a shop at nine, goes to school, comes home at dusk or sits at a dhaba at lunch. Fix: a schedule per role: shops 09:00 to 21:00, school 07:30 to 13:30, offices 09:00 to 18:00, joggers 05:30 to 08:00, dhaba lunch 12:00 to 14:00, chaupal and manjis in the evening.
5. **Identity.** Generic names and only a handful of named contacts. Fix: 30 to 40 named people, each with a home or shop, a voice set, and their own opinion of the player (reputation per person, not one global number).
6. **Traffic is avoidance only.** The code has no signals, stop lines or zebra crossings, so pedestrians and vehicles only steer around each other. Fix: section 8.
7. **Street folk and the house.** Spawns are kept out of plots, but movement is only checked when the guard runs. Fix: covered by item 3.
8. **Voice and words did not match (fixed in `249a03a`).** The speech bubble and the recording were picked separately, so a punch, a quarrel, an auto call or a police shout could show one line and play another. Now a take that plays shows its own words, and a literal line shows only when no take plays. Still open: vehicle loudspeakers (a patrol jeep, a police bribe) play audio with no words on screen. See `docs/VOICE_LINES.md`, fault 2.

## 8. City planner review

| Element | Now | V2 |
|---|---|---|
| Road hierarchy: good, bad and kacha roads, bus-only roads, colony galis | Working | Keep. Add turn lanes on G.T. Road |
| Junctions: signals and stop lines | Missing | Timed signals at four-way junctions on roads 7 m or wider; police at chowks |
| Pedestrian crossings | Missing | Zebra crossings at schools, markets and bus shelters; a footbridge at Bus Adda |
| Rail | Missing | A line along the south edge with a level crossing: a gate, a queue and a passing train |
| Buses, autos, rickshaws, e-rickshaws | Working | Route numbers on bus fronts; more shelters |
| Fuel | A petrol pump sign and a delivery stop, with no fuel | Dummy. Build a fuel gauge with petrol, diesel and CNG, and a CNG station (the green and yellow auto paint suggests one) |
| Money: bank, ATM, post office | Missing. The only "bank" hits are riverbanks and a power-bank product | Post office, bank and ATM. Cash matters once the bag and the shops matter |
| Health and school | School and hospital exist; no village dispensary | Dispensary in one pind |
| Religion | Gurdwaras and mandirs; no masjid anywhere | One masjid in Ludhiana, shown with care |
| Industry | One brick kiln; no factories | Three factories (cycle parts, hosiery, woollens) with shift changes at 08:00 and 16:00; a mandi with trucks |
| Landmarks | Ghanta Ghar exists; the mela is only a poster | A mela ground for Vaisakhi |
| Farms and seasons | Static fields, no seasons | Crops by month: sarson January to March, wheat harvest in April, paddy transplant in July. Tubewells running. Combines on G.T. Road in April |
| Power and water | Sintex tanks and tubewells exist; a power cut is one line of dialogue | Load-shedding in two districts at set hours; generator sounds |
| Floods and drains | Flood zones that drain away | Keep. Add a municipal drain crew and a sandbag mission |
| Night | Lamps, dhabas, shutters | Dhabas and chaat carts open late; the bazaar shuts; crowd density follows the hour |
| Zones | Residential, market, civic, farm, village, industrial, transport | Keep. Use zone life for the schedules in section 7 |

## 9. Dummy and half-working things (finish or remove)

- **Petrol pump.** A sign, a map stop and a delivery stop, with no fuel. Finish it in V2 or remove the sign.
- **"Bus & auto stand"** in the travel menu teleports the player past the bus system. Make it a real stop with a fare, or remove it.
- **T key street-event menu,** visible to every player. Hide it behind a setting, or label it as a sandbox.
- **Intro stage `PICKUP`** is marked legacy (saves on it resume at RIDE). Delete the stage.
- **"Take the scooter"** in the intro, against the Bullet start. Decide (section 12).
- **Winter fog.** Only a code comment in `World.ts`. Remove the comment, or build seasons.
- **Voice line `gurnam_finally`** is switched off. Record it or delete it.
- **Cricket and kabaddi.** Cricket appears as a ball quarrel line and a TV channel. Kabaddi has a ground. I found no match mechanic for either. Build the match or remove the activity.
- **Sewadar** appears as a clothing look only. Build a sewa job or drop the look.
- **`?probe` debug API** ships in the main bundle. Gate its code behind a development build to make the bundle smaller.
- **Phrasebook dialogue** (section 10). Rewrite.

## 10. What a Punjabi player will expect

| Expectation | In the game now | V2 |
|---|---|---|
| Music everywhere: bhangra, boliyan, Punjabi pop in autos and buses; dhol at a wedding | None | A radio with four stations (decision 2). A wedding band in a baraat |
| Food: sarson da saag and makki di roti, chole kulche, lassi, jalebi, gol gappe, kulfi, chai with patti | Largely there (28 food and goods items) | A seasonal menu; Mummy ji's tiffin; gajar halwa and pinni in winter |
| Gurdwara life: gurbani at dawn, langar, sewa | Gurbani at dawn is there. No langar. Sewa is a look only | A langar hall: sit on the floor, eat free. Sewa as a small job |
| Festivals: Lohri bonfire, Basant kites, Vaisakhi mela, Teeyan swings and boliyan, Diwali, Karva Chauth, Gurpurab | Posters and tips only. Kites and swings exist as scenery | Six festivals on the calendar, each with one set piece and one mission |
| Street sport: tape-ball cricket, kabaddi, gilli-danda, kikli, dangal | Dangal exists. A kabaddi ground. Cricket only in lines | Tape-ball cricket in colony galis; a kabaddi match; gilli-danda in a park |
| Vehicles: Bullet, scooter, jeep, tractor trolley, autos, buses, trucks with "Horn OK Please" | Most present. The "Horn OK Please" art is only on parked trucks | Truck art on moving trucks; tractor rallies |
| Family: shagan at weddings, visits to Mama ji, Bebe ji's pilgrimage | None | A shagan envelope at a wedding; the Amritsar finale (decision 7) |
| Language: Punjabi-first talk, Gurmukhi signs, Hinglish in shops | Signs have Gurmukhi. Talk leans English | A dialogue style guide. A Punjabi reviewer for every new line |
| Architecture: kothis with jaali, chhajja, Sintex tanks, coolers, dishes; haveli in old towns; chaupal in villages | Kothis, yes. No haveli, no chaupal | A haveli quarter in Ranggarh's old bazaar; a village chaupal with cots and cards |
| Respect: faith is never mocked; dastar, gurbani and langar are shown with care | Done so far | A written guideline. Playtest with Punjabi speakers |

## 11. V2 plan

### 11.1 Vision

A Punjabi town that keeps going without you. You ride its routes with your family's tiffin business behind you, and the bazaar, the gali and the gurdwara change with the clock and the calendar.

Pillars:

1. **A daily loop:** wake at home, work the routes, come home, sleep, see the day's summary.
2. **A city with routines and names.**
3. **Sound you can hum:** a radio, festival music, the street by hour.
4. **Budgets are features:** every preset has a measured ceiling.
5. **Nothing dummy:** every prompt does something visible.

### 11.2 The daily loop

| Time | What happens | Where it lives |
|---|---|---|
| 05:30 to 08:45 | Joggers; gurbani at the gurdwara. Wake in bed at 06:30 | Morning, Home |
| 07:00 to 09:30 | Mummy ji calls breakfast. Take the day's tiffin orders | Home (meal calls) |
| 10:00 to 12:00 | Collect the tiffins. Set a route with time windows | Map, routes |
| 12:00 to 13:30 | Lunch rush. Each stop has a window; late means no tip | Jobs |
| 14:00 to 19:00 | Deliveries (dhaba, mobile, cloth, kiryana) and side jobs | Missions |
| 19:00 to 21:30 | News on TV; aarti at the mandir; dinner with the family; festivals | Home, audio |
| 21:30 | "Din di kamai": income, tips, reputation by district | Summary screen |

### 11.3 Careers and money

- **Level 1, tiffin rider:** ten tiffins a day from the kitchen. Tips for on-time delivery.
- **Level 2, courier:** jobs across town (dhaba, mobile, cloth, kiryana), for money and for reputation with people.
- **Level 3, transport:** buy or rent an auto or e-rickshaw and hire a named driver.
- **Level 4, fleet:** a small truck business on G.T. Road, ending in the Amritsar trip.

Money sinks: bike upgrades at Gurnam's workshop; fuel or CNG; tiffin ingredients; shagan; a gurdwara donation (reputation with the community); Simran's school fees; repairs to the family house.

Reputation: by district (Ranggarh, Nawan Shehar, Ludhiana, Pind Kotli) and by named person.

Starting money: decision 1.

### 11.4 Chapters (the story spine)

- **Chapter 1, "Pehla din"** (about 1 to 2 hours): the family, the Bullet, the first tiffins, meeting Bhola, the first job. Bebe ji's blessing ends the chapter.
- **Chapter 2, "Ludhiana"** (about 3 to 4 hours): city trips, Ghanta Ghar, Pinka's phone shop, the workshop, a traffic jam at the rail crossing, the first auto.
- **Chapter 3, "Mela"** (about 3 to 4 hours): the year's festivals in order: Lohri, Basant, Vaisakhi. Simran's college. A kabaddi cup. A dangal with Ustad Kartar.
- **Chapter 4, "Amritsar"** (about 2 to 3 hours): Bebe ji's pilgrimage to Harmandir Sahib along G.T. Road. Langar and gurbani shown with care.

### 11.5 Work packages, in order

A package is done when its acceptance criteria hold in a playtest, not when the code exists.

**WP0. Quick wins** (one session)
- The intro uses the Bullet (decision 4). Done in `5867687`; `tools/intro-bullet.mjs` plays it through.
- The `PICKUP` stage no longer plays (done in `5867687`; its value stays so old saves load). The T sandbox is hidden from players (decision 5, done in `249a03a`).
- Remove the "Bus & auto stand" teleport, or make it a real stop.
- The objective card shrinks to one line after the first minute. The key legend collapses after 20 seconds.
- Rewrite `ARCHITECTURE.md` for the current systems. Move the session 1 to 8 logs out of `HANDOFF.md`.
- *Acceptance:* a new player finds the Bullet and the first job within three minutes, with no prompt covering the scene.

**WP1. Performance budgets** (two to three sessions)
- Meet the budgets in section 11.6. Thin-instance the house details. Add level of detail. Build interiors on demand. Use one body pipeline. Split code by chapter. Lazy-load the clip sets.
- *Acceptance:* every preset meets its budget on both views. A test measures the budget and fails when it is exceeded. Loaded vertices are down by a third.

**WP2. People with routines** (three to four sessions)
- Schedules per role. 30 to 40 named people. Reputation per person. One event director with a budget and a cooldown per area. Plot edges become walls for brains. Scale-in on spawn. No teleports while anything is visible.
- The people from decision 6: the family, 3 to 4 neighbour families, 4 to 5 shop owners, 4 to 5 families in other areas, and policemen and NPCs. Each one knows him, so each greets him when they meet; the greeting and reply lines are already in the voice map.
- *Acceptance:* at 08:00 the shops open and children walk to school. No quarrel starts inside a house, and none repeats in the same gali within ten minutes. In a 15-minute watch, nobody is teleported while visible.

**WP3. Sound** (two to three sessions)
- A radio in the Bullet and the autos, four stations (decision 2; needs the Suno route or the full ElevenLabs connector, which this session does not have). Street sound by hour and zone. Festival music. A dialogue style guide. About 150 short street lines (decision 3).
- *Acceptance:* a ten-minute drive through the bazaar has music on the radio, horns and calls, and no silent gap longer than 20 seconds. Every spoken line has a subtitle option.

**WP4. City** (three to four sessions)
- Signals and zebra crossings. A post office, a bank and an ATM. Petrol and CNG with fuel gauges. The rail line and level crossing. A village dispensary and chaupal. Seasonal fields. Three factories with shift changes. Power cuts.
- *Acceptance:* a bus, an auto and the Bullet can each cross the rail line. The 16:00 shift change visibly changes the traffic. The fuel gauge drops, and a petrol or CNG stop refills it.

**WP5. Economy and career** (two sessions)
- Price bands. The tiffin business. Reputation by district. The "Din di kamai" summary. Money sinks.
- *Acceptance:* a full day ends with a clear income and a clear reason to play the next day.

**WP6. Chapters and festivals** (three to four sessions)
- Chapters 1 to 4 as missions. Six festivals on the calendar. Tape-ball cricket. A kabaddi match. The Amritsar finale.
- *Acceptance:* a player finishes Chapter 1 in under two hours, and Chapter 4 in one session, with no dead end.

**WP7. Polish and access** (continuous)
- A subtitles toggle. A flash limit on lightning. Text size. A touch-controls check. An Android build check.

### 11.6 Budgets (proposed)

Measured on the same two views. Current bazaar figures: Low 548k triangles and 176 draws; Medium 1.28M and 453; High 1.34M and 503; Ultra 1.71M and 694.

| Preset | Triangles per view | Draw calls | Loaded vertices |
|---|---|---|---|
| Low | 400k or fewer | 150 or fewer | 3.0M or fewer |
| Medium | 700k or fewer | 300 or fewer | 3.5M or fewer |
| High | 900k or fewer | 400 or fewer | 3.5M or fewer |
| Ultra | 1.2M or fewer | 550 or fewer | 4.0M or fewer |

**Measured after the first WP1 pass (2026-10-24)**, on three views (the two above, plus a street view down the bazaar road: `0,1.8,-110,0,1.6,-20`). Triangles include the shadow pass. `npm run budget` repeats it and fails when a number grows more than 6% past this baseline.

| Preset | Bazaar tris (was) | Colony tris (was) | Street tris | Draws (bazaar / colony / street) | Loaded vertices (was 4.4 to 4.5M) |
|---|---|---|---|---|---|
| Low | 361k (548k) | 197k (315k) | 497k | 180 / 109 / 263 | 3.5M |
| Medium | 966k (1.28M) | 673k (987k) | 1.18M | 379 / 251 / 469 | 4.0M |
| High | 1.02M (1.34M) | 785k (1.11M) | 1.28M | 433 / 318 / 537 | 4.0M |
| Ultra | 1.35M (1.71M) | 1.00M (1.33M) | 1.46M | 606 / 446 / 670 | 4.0M |

What changed: tree canopies cost a quarter of what they did (they were a quarter of all triangles); only people and vehicles near the player go into the shadow map; window frames, grills and doors no longer cast shadows and fade beyond about 90 m; potholes, fruit piles, gate lamps and tanks use fewer segments; scenery stores normals and colours as bytes (28 bytes a vertex instead of 48, about 40% less memory for the scenery); the Low preset builds a lean world (no kitchens in visited houses, half the charpais, sparser fields and roadside trees, bare facade grills). The colony view now meets the Medium, High and Ultra goals; Low's bazaar and colony triangles meet theirs.

Still over goal: draws everywhere (the bazaar street has hundreds of small meshes: one per material per 40 m chunk, plus every person and vehicle), loaded vertices, and the street view's triangles. The next steps are fewer draws (merge chunk meshes, instance the repeated facade parts) and building interiors on demand once decision 6 is made.

### 11.7 Process

- **Definition of done** for any feature: it is visible; it does what its prompt says; it makes a sound or a line; it has a stop condition; it is recorded in `HANDOFF.md`.
- **A playtest per chapter:** 15 minutes recorded, with a list of stutters, dead ends and unclear prompts.
- **A Punjabi reviewer** reads every new line.
- **One feature per session at most** while WP1 runs.

### 11.8 What not to do

- Do not add another one-off event (a new festival, another street scene) before the routines exist.
- Do not add transport modes before signals and crossings exist.
- Do not add another detail layer for houses. It was tried in session 2 and cost more than it saved. Instancing is the fix.
- Do not build the Amritsar finale before the daily loop works.

### 11.9 Risks

- **Scope.** The largest risk. Each session has added a system. V2 should add fewer systems and connect the ones that exist.
- **Phones.** The budgets are the mitigation. Test on a mid-range Android before any new feature.
- **Music rights.** Use original or commissioned tracks, or your own recordings. Commercial Punjabi songs need licences.
- **Language and faith.** A Punjabi reviewer for dialogue. A guide for depicting gurbani, langar and the gurdwara with respect.

## 12. Decisions

Status as of 2026-10-24. The answers are the user's, shortened.

1. **Starting money:** answered. Keep ₹20,000 ("even big money is fine"). The character can be a businessman or a shop owner. With a big start, the first goal has to come from 11.3 (the courier and tiffin business).
2. **Music:** answered. Original tracks. Not made yet: the ElevenLabs connector in this session cannot make music. It needs the Suno route or the full ElevenLabs connector (`https://api.elevenlabs.io/v1/mcp`). WP3 waits on it.
3. **Voice:** answered. Fifty trial lines first, to hear how they go. They are made (two takes each, take 1 kept) and in the game, placed where they can play (`docs/VOICE_LINES.md`). Next: listen, then say which to keep, re-match or drop. Then the rest of the roughly 150 lines.
4. **Intro vehicle:** answered. The Bullet. Done in code (`5867687`): the start objective and Bhola's line send you on it.
5. **The T key sandbox:** answered and done in `249a03a`. The T menu (street events on demand, rain, time of day, Route home, the naka and the chowki) and its F1 line are behind `?probe`, the way the test scripts open the game. Players do not see them. The map still has "Route to…".
6. **The people who know him:** answered for the design, not built yet. The family home, plus 3 to 4 neighbour families who know the family; 4 to 5 shop owners who know him; and, in other parts of town, 4 to 5 families, some policemen and some NPCs who know him, so a world around him knows him across the map. This is WP2. Still open: walk-in houses. The plan asked whether all 81 are walk-in or only the family home plus eight. To confirm: only the family home, or the neighbours' homes too?
7. **Chapter 4, Amritsar:** deferred ("for now leave this"). Do not build it until the daily loop works.

## Appendix A: Evidence

| Claim | Where |
|---|---|
| Largest file | `src/app/Game.ts` (2,965 lines) |
| No background music | `src/audio/Audio.ts`: the music bus is used only by shrines, loudspeakers and short stings |
| Intro says take the scooter | `src/missions/Missions.ts` lines 116 to 117 |
| Petrol pump is a delivery stop, with no fuel | `src/world/layout.ts` line 163; `src/world/region.ts` line 107; `src/missions/Travel.ts` line 29 |
| "Bus & auto stand" teleport | `src/app/Game.ts` around line 1739 |
| T opens street events for everyone | `src/input/Input.ts` line 31; `tryEvents` in `src/app/Game.ts` |
| Pay formula | `payFor` in `src/missions/Missions.ts` |
| Paint prices | `PAINTS` in `src/vehicles/specs.ts` |
| Old bodies for drivers and riders | `src/traffic/Traffic.ts`; `src/missions/Rides.ts` |
| Teleports | `relocate` in `src/crowds/Crowd.ts` (around line 519); `place` calls at lines 350 and 509 |
| No instancing in the facade builder | `src/world/houseBuilder.ts` (header: "batched through the Kit") |
| Interiors built for every open house | `src/world/country.ts` line 911 |
| Generic greeting lines | `GREET_LINES` in `src/crowds/Crowd.ts` |
| Architecture doc predates later systems | `docs/ARCHITECTURE.md` (77 lines) |
| No traffic signals or crossings | No matches for signal, crossing or zebra in `src/` |

## Appendix B: How to measure again

Run `tools/views.mjs` against a preview build, with `SETTINGS` set to a preset, on these two views:

- Bazaar street: `-12,2,-44,-2,1.5,-44`
- Colony gali: `45,4,-20,62,1.5,-36`

Run `npm run budget` (it prints every preset and view), or read `activeTris` and `draws` from `tools/views.mjs`. Presets:

- Low: `{"quality":"low","post":false,"shadows":"off","renderScale":0.7}`
- Medium: `{"quality":"medium","post":false,"shadows":"low","renderScale":1}`
- High: `{"quality":"high","post":true,"shadows":"low","renderScale":1}`
- Ultra: `{"quality":"ultra","post":true,"shadows":"high","renderScale":1}`
