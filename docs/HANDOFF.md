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

- `npx tsc --noEmit -p .` and `npx vitest run` (173 tests; run `npm ci` first in a fresh container). Tools default to port 5173: pass `http://localhost:4173/` as the first argument.
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

## Start here (next session)

- Read `docs/V2_PLAN.md`. Section 12 has every decision and what is still open; section 11.5 has the work packages.
- Open for the user: walk-in houses (decision 6), which trial voice lines to keep (`docs/VOICE_LINES.md`), and music (needs the Suno route or the full ElevenLabs connector; this session cannot make it).
- Next for the agent: finish WP0 (the objective card and key legend, the bus-and-auto teleport stop), then WP1 budgets before any new system. Every preset is over its proposed budget today.
- Do not build the Amritsar chapter yet (the user: "for now leave this").
- The people network is WP2. Vehicle loudspeakers still play with no words on screen (`docs/V2_PLAN.md` section 7, item 8).

## Done in session 13 (2026-10-24): audit, V2 plan, Bullet start, trial voice lines, bubbles

- Audit and V2 plan: `docs/V2_PLAN.md` (`41a2416`).
- The first job starts on the Bullet (`5867687`). `tools/intro-bullet.mjs` plays the start through: talk to Bhola, then Chaura Bazaar with the Bullet at the gate.
- 50 trial voice lines in the game (`6301dda`), 47 of them playing. Some could never play, or broke "strangers stay quiet", so they were re-targeted (see `docs/VOICE_LINES.md`).
- Bhola's bubble for the first job no longer says "Scooter" (`ff61e6a`).
- A bubble and its recording match (`249a03a`): a take shows its own words over the speaker, the player's head included. The T menu and its F1 line are behind `?probe`, so players no longer see them (`249a03a`).
- Checks: typecheck clean, 173 unit tests, smoke test with no errors, the intro script, the Bullet ride, and a greeting and T-key run in both URL modes.

## Done in session 12 (2026-10-23): home that works, no events indoors, Bullet start, graphics

User asks (their words, shortened): random characters were fighting inside his home; give him the Bullet from the start; Medium too slow while High/Ultra fast; High/Ultra too sharp, hurting the eyes; family not interacting, nothing working at home, "dummy things here and there"; starting money ~20K.

- **No events in houses**: colony fights anchored on any standing resident, and the family at home counted. `ResidentDef.indoor` (family, open-house hosts), `streetFree(r)` in Crowd.ts (no brain, not indoor, not a contact, not inside an open-house plot) used by every Jhagde borrow (quarrels, tamasha onlookers, elder quarrels, colony anchor + ring check, reinforcements); helpers that would land in a plot are skipped; Gossip/Morning reject plots; no automatic quarrel/colony fight while the player is inside a house; `Crowd.keepOut` puts any street person found in a plot back outside the gate (`OpenHouse.plot`, `.out`, `openPlotAt(x,z,pad)`). Tool `tools/homeclear.mjs` (forces 18 events at home, counts intruders). Test in tests/openHouses.test.ts.
- **Home** (src/missions/Home.ts rewritten, `HomeTv.ts` new): greetings by name (`HomeHost.hero()`), family brains keep them seated and set `lookTarget` (talker, TV on the sofa, else the player within 9 m); Mummy ji turns to face you. **Kit heads now turn** (KitHuman.look, neck 0.4 + head 0.6 of lookYaw, applied after the mixer and restored). Meal slots `mealAt`: 7–9.5 breakfast, 13–14.5 lunch, 20–21.5 dinner; Mummy ji calls once per slot (within 35 m), one meal per slot, else "Ask Mummy ji for chah" (2 min cooldown). Sofa: TV plane with a DynamicTexture (news ticker, cricket, songs, Gurbani), camera held on `HOME.sofaShot`/`tvShot` (CameraRig.hold(eye, at, fov)), cuts to the family when someone comments; E = menu change channel / keep watching / get up. Evening news 19–22. Bebe ji: ashirwad ₹50 + 1 rep once a game day. Simran: cold-drink errand (route to keeper_kiryana; give from bag → ₹40 + 2 rep). Bed (interiors.ts `HouseInside.bed`, home.ts `BED`) in the back room: sleep till 06:30 (Ui.fade, health full, +1 rep a night) or rest 2 h by day. Coming home saves (toast). Save field `home` (day, bless, errand, errandDone, mealN, callN, slept). Only ONE E-prompt shows at a time (pickInteraction), so multi-choice spots use a dialogue menu. Tool `tools/home.mjs` walks every interaction; tests/home.test.ts.
- **Start**: new game at `HOME.start` beside the Bullet; the Bullet is now at the kerb (`BIKE_Z` 2.9; it stood on the footpath and rode into a lamp post), old saves' Bullet moved from `HOME.oldBike`. First objective mentions it. Starting money ₹20,000 (flag `purse20k` tops old saves up once). Tool `tools/bullet.mjs` (clears storage, rides down the gali).
- **Follow-up (same session)**: "no sound" — the ambience bed was below ~300 Hz (inaudible on laptop/phone speakers) and the home had only silent bubbles; BEDS cutoffs now 480–1100 Hz, residential/village one-shots (`Audio.update` nextLife: horns, dog, cooker at meals, hawker cry), `Audio.mumble` babble for bubbles without a clip (Game sets `crowd.onLine`, within 14 m, not while a voice plays), `Audio.tv(channel,pos)`. Measure with an analyser hook (see the session's snd2 approach: wrap AudioContext in addInitScript, route destination through an AnalyserNode): home ≈ -35 dB RMS, voices peak ≈ -14 dB. TV texture was upside down (`update(false)`). `perch(spot, thigh)` in home.ts seats people so their knees clear the seat edge (`Spot.front`). Snake bikers only while you ride, spawn behind, give up near house plots; police jeep stops at the gate (`OpenHouse.out`); colony autos spawn ≥40 m out of view. Tool `tools/plotwatch.mjs`.
- **Graphics**: the fps cap skipped frames but advanced the game by one refresh → Low/Medium ran in slow motion at 30 fps; now the running frame gets all the elapsed time. Medium: no cap, renderScale 1 (old 0.85 settings migrated), DPR cap 1.5, faint sharpen 0.12. High/Ultra: sharpen off, DPR cap 2. views.mjs `SETTINGS=json` shoots any preset (e.g. `{"quality":"ultra","post":true,"shadows":"high","renderScale":1}`).

## Done in session 11 (2026-10-23): animations, stocky Jaggi, clothes, steering

- **Tool `tools/kitpose.mjs CLIP [ARCH] [OUTFIT]`**: offline three.js contact sheet of any kit clip (rows = views side/front/q/back/top/left/ql, columns = phases) → `tools/out/kp_<clip>_<arch>.png`. Env BUILD=stocky, COLORS='{"bottom":"#0ff"}', ZOOM, FY (focus height), N, CELL, P0 (first phase), NOGUARD=1, NAME. Seconds per sheet: use it before in-game shots.
- Clips (src/kit/animations.ts): walk arms (elbow bends on the forward swing, ±20 cm wrist arc, curled fingers); jog/run use `runArm` (IK wrist arc hip→chest, palm in, fist); swim = IK crawl (pull under chest, high-elbow recovery); tread sculls in front; drink_chai's free hand rests at the belly.
- **Arm guard fixes** (`guardArm`): step 3 multiplied the stored upper-arm quaternion in place (corrupted every guarded frame); the push loop now scores penetration + 0.5×wrist movement, so hands are not shoved 30 cm away to clear a 2 cm graze.
- Eating (Game.eat): glass/kulhad/kulfi/jalebi/fruit in the right hand with new gesture `drink` (kit `drink_chai`, old body arm lift), thali/dona in the left with `eat`; `stopEating` also ends the gesture (he used to run off in the eating pose).
- **Stocky Jaggi**: `BuildTweak`/`STOCKY` in rig.ts, `CharacterOptions.build`, `KitLook.build` (clip cache keyed by build). Seats still use 0.92×scale (scale = hipsY/0.92, so shorter legs just sit lower).
- Beard (headwear.ts `addBeard`): one shell from the sideburns down the cheeks to a fuller chin replaces two tubes + a loose sideburn stick.
- Clothes (body.ts): the outer garment (waistcoat) scales by the top's looseness (kurta showed through); `HeadCtx.cloth(y)` = top garment surface, the dupatta lies on it; the salwar thigh is clamped inside a long kameez.
- **Steering** (Vehicle.ts): bicycle-model yaw rate capped at 0.85 g (two-wheelers) / 1 g × wetGrip × gripBonus — no more sideways skating at full lock (slip 2–4 m/s → 0.2). Test tests/sim/handling.test.ts (DIAG=1 with `--reporter=verbose` prints pull-away, top speed, stop distance, turn, settle numbers).
- Seen but not fixed: the far-side eyebrow hides under the dastar edge; Simran on the armchair in the home sofa shot looked like she sits on its arm (check `tools/home.mjs`).

## Done in session 10 (2026-10-23): pothole fix, day/night, home & family, Bullet, swimming, mornings

User asks this session (their words, shortened): colours too punchy, day/night like an established game; a home and family where he can go, eat and sit; a Bullet bike; fix walking/hands, eating, running, swimming; potholes leave vehicles glitching; Sardaar character sheet (red dastar, cream kurta rolled sleeves, black vest, blue jeans, brown shoes, stocky); child's legs missing on the armchair; no deadlocks/dead code/glitches; good drive physics; gurdwara near home with gurbani every morning, temples with aarti, morning joggers/brushing/gargling/datun.

- **Pothole glitch** (Vehicle.ts): the pitch assist only damped small tilts, freezing the nose wherever a pothole left it (an auto rode ~2° nose-down for seconds). Small tilts now ease back toward the road's own slope (`groundPitch()` from front/rear wheel hits). Test tests/sim/pothole.test.ts. Tool `tools/pothole.mjs` (TYPE, AT) + probe `driveAt(type,x,z,yaw)`, `ride()`.
- **Colour**: pipeline exposure 1.0, contrast 1.1, saturation +2 with warm highlights/cool shadows (was +32).
- **Day/night** `src/world/DayNight.ts`: keyed palette (night, dawn, morning, noon, golden hour, dusk), sun path E→S→W (south is -Z), moon at night, sky dome vertex colours re-tinted every 0.5 s, clouds, exposure via `onExposure`, `emissive` material brighter at night (lamps bloom). Weather's `base` is DayNight's base, so rain greys on top (storm sky dims at night). 36-min day, hour kept in localStorage `gediroute.hour`, `?hour=N`, probe `hour(h)`, T menu "Time of day", HUD clock chip (Ui.setClock). No kites at night.
- **Home & family** (`src/world/home.ts` HOME = open house `santH149` in Sant Nagar, `src/missions/Home.ts`): Papa ji (sofa), Mummy ji (at the chulha), Bebe ji and Simran (armchairs), kit looks via new `ResidentDef.kitLook`. Greet you on entry; E "Sit with the family" (chat bubbles, heal, "Sleep till morning" 20:00–05:00 → 06:30), E "Eat with the family" at the table (all sit, seated eat clips, Mummy serves, `eatMeal`), ends after 12 s. Player seating: `Game.sitPlayerAt/standPlayerAt` (capsule parked like a vehicle, `homeSeated` makes playerPos/camera use the body). The generic home host is skipped for HOME_ID. Travel menu "Ghar". Probe `home()`, `homeAt()`; tool `tools/home.mjs`.
- **Bullet**: saved vehicle `bullet_ghar` (motorcycle, paint `bullet` black & gold) parked outside the home gate, added to old saves; model extras when the id starts with "bullet" (crash guard, badges, pinstripes, tool box, grab rail); prompt "Ride your Bullet".
- **Sardaar look**: kit outfit `sardaar` (outfits.ts), Jaggi wears it.
- **Clips** (src/kit/animations.ts game additions): `jog` (KitAnimator: walk < 1.55–1.75×walk < jog < run, rates clamped 0.6–1.6, `speedFor('jog'|'run')` nominal 3.6/6.0 m/s × body), sprint stride reduced; `seated_*` variants (talk, eat, laugh, angry, point, wave, sat_sri_akal, salaam, clap, drink_chai) used by KitAnimator when pose is "sit"; `swim` (crawl, `noGuard`), `tread`; `brush`, `gargle`, `stretch`; Gesture `laugh`, `brush`, `gargle`, `stretch`. Test tests/kitClips.test.ts bakes every clip for every body.
- **Swimming**: nehar deepened (CANAL.bedY -2.6, water 1.7 m), a ghat (region.ts GHAT x=45, north bank, steps; a bank tree stood at x=40) below Pind Kotli. Player.swim: floats (feet 1.1 m under), SWIM 1.5 / 2.4 m/s, Jump at the parapet vaults in, Jump within 1.6 m of a bank climbs out; visual root at the surface. Tool `tools/gait.mjs` (AT, RUN, SIDE, EYE, LEAD) side views of the player's cycle. Probe `ray(...)` raycasts static colliders.
- **Worship & mornings**: COLONY_SITES split the Sant Nagar park (south 42 m → `santGurdwara`) and GNN park (south 36 m → `gnnMandir`, new site kind `mandir` + builder `mandir()`). `Audio.shrine(id, "gurbani"|"aarti", pos, level)`: synthesised (no network for recordings here) kirtan with a formant "aa" voice in Bhairav + harmonium + tabla keherwa; aarti with ghanti, manjeera, dholak, harmonium, shankh; horn-speaker filter on the music bus. Levels from `Morning.shrineLevel` (gurbani 4:30–7:45, aarti 6–7 and 18:30–19:15). `src/crowds/Morning.ts`: 5:30–8:45, up to 4/6/8 people near the player: joggers (colony graph or park roamers), brushing / datun / gargling at gates (props on the hand bone of whichever body is drawn), stretching in parks. Probe `morning()`.
- Armchair seats moved back (child's legs were inside the chair).
- Tools note: `tools/crowdkit.mjs` GOTO=idPrefix walks up to someone first.
- After the session-11 hand-off (same day, this session): kit hands have four two-segment fingers growing out of the palm (body.ts); the dastar has a back fall to the nape with dark hair under it (headwear.ts); gurdwaras play a 30 s cut of the user's Japji Sahib recording (public/audio/sfx/gurbani_japji.mp3, docs/ASSETS.md); **routes**: `src/missions/Places.ts` ROUTE_PLACES (Ghar, Bhola, Gurnam, gurdwara, mandir, akhada + travel places), the map (M) has a "Route to…" row and tap-to-route (`Ui.map(..., route)`), pause menu and T menu "Route home"; `Game.waypoint` leads the marker, compass and minimap road route (Missions.routeLength) and clears on arrival (8 m on foot, 14 m riding); probe `routeTo(id)`, `route()`; tool `tools/route.mjs`.

## Done in session 9 (2026-10-23): kit crowd, colony gossip

- **Kit crowd** (Crowd.ts): the nearest people in front of the camera (facing it counts extra) wear a full KitHuman instead of the old body: preset `kitPeople`/`kitRange` (Low 10/24 m, Medium 14/28, High 22/34, Ultra 28/40). Re-chosen every 0.3 s with stickiness (holders get +8 m range and keep the body 4 s while out of view), at most one build every 0.12 s (~17–40 ms each in swiftshader), released bodies pooled by look (≤14). The kit root is a child of the old body's root (so placement, seats, chhatris and procession props keep working); the old mesh is hidden and its animator only ticks the gesture clock (`HumanAnimator.tick`, `gestureLeft`). Gestures reach the kit via a wrapper on `anim.play`. Anyone with a chhatri, kite, pole, dhol, roof spot or an extra child on the root (props) keeps the old body. Seated kit people only move their mouth for gestures (clips are standing ones). `?oldcrowd` = everyone old body. Clips for male/female/uncle/aunty are baked on the loading screen, kids during play.
- `src/crowds/kitLooks.ts` `kitLookFor(id, appearance, police, seated)`: archetype from age/sex, outfit from all communities matched to what they wore (turbans stay Sikh, constables in uniform, keepers adults, no sarees on chairs), their colours where the outfit allows (2/3 of people). Test tests/kitLooks.test.ts.
- **Gossip circles** (`src/crowds/Gossip.ts`): 2–3 circles (Low 2) of 2–4 people within 12–48 m of the player at colony/mohalla walk spots, spawned out of view (or ≥32 m): aunties, uncles, bapu+bebe, lads; bubbles every 2.6–4.4 s with talk gestures, a new `laugh` gesture from listeners. 40% boil over after 18–40 s (player within 35 m) into a Jhagde quarrel (`Jhagde.quarrelBetween`, elder/aunty scripts, staged = removed after). No circles in rain. T menu "Aunties gossiping at the gate" (event `gossip`), probe `gossip()`, snapshot `kit` (on, pool, builds, buildMs).
- Tool `tools/crowdkit.mjs` (AT, LOG=expr, FOCUS=id or kit:<prefix> close-up with DIST/EYE, GOSSIPCAM=1, SHOTS/SI, EXTRA=&oldcrowd). Note: tools only take `gfx=low`; other values show the first-run quality picker and the tool times out.
- Cost on Low in the bazaar: 8 kit people ≈ +5 draws, +17k tris vs `?oldcrowd`.
- Not done yet: traffic drivers/riders and auto passengers are still old bodies; procession members with props stay old.

Older session logs (1 to 8) are in `docs/HISTORY.md`.
