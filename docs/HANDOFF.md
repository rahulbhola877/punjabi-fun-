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

- `npx tsc --noEmit -p .` and `npx vitest run` (119 tests).
- Build: `npx vite build --outDir <scratch>/dist`, serve with `npx vite preview --outDir <scratch>/dist --port 4173 --strictPort` (run in background), then:
  - `node tools/smoke.mjs http://localhost:4173/` — no `errors`.
  - `BASE=http://localhost:4173/ node tools/views.mjs '{"name":"camX,camY,camZ,tx,ty,tz"}'` — screenshot to `tools/out/name.png` (look at it!).
  - `node tools/events.mjs`, `tools/gg.mjs` (`AT=x,z,yaw` walk + fps/audio log), `tools/snake.mjs`, `tools/prof.mjs` (CPU profile), `tools/audio-chain.mjs`.
  - Debug probe `?probe`: `window.__pfs.teleport(x,z,yaw)`, `.event(name)`, `.snapshot()`.
- Don't leave `docs/screenshots/*.png` changed by the tools (`git checkout docs/screenshots`).

## Where things are

- World layout: `src/world/region.ts` (WORLD bounds ±700, TOWN, CITY, VILLAGE, LUDHIANA rects, ROADS, SITES, OUTER_BUILDINGS, PLOTS, DEFECTS, REHRIS), `src/world/layout.ts` (Ranggarh town detail, POIs), `src/world/country.ts` (builds roads/buildings/sites from region data), `src/world/zones.ts` (zone kinds: residential, market, civic, farm, village… and their "life" — crowd, horns, quarrels, ambience bed), `src/world/nav.ts` (road graph for traffic, walk graph), `src/world/buildings.ts`, `street.ts`, `props.ts`, `Kit.ts`.
- People: `src/crowds/Crowd.ts`, `countryFolk.ts`, `Barkers.ts` (street calls/chat). Traffic: `src/traffic/Traffic.ts`, `AIDriver.ts`. Events: `src/combat/Jhagde.ts` (quarrels, colony fights, crashes, road rage, dangal), `Police.ts` (slow heat-based stars), `Posts.ts` (nakas/chowkis). Fast travel: `src/missions/Travel.ts` (check new spots are on open street, not inside a building).
- Audio: `src/audio/Audio.ts` (master bus = one gentle limiter; engines out of earshot stop their sources), `VoiceDirector.ts` + `src/audio/voiceMap.json` from `tools/voice_map.py` (docs/voice-map.xlsx). One voice at a time; 90 s minimum repeat except greetings; residents only voice when visible.
- Graphics: `setupPipeline`/`applyPost` in `src/app/Game.ts` (real device pixel ratio, MSAA + sharpen, colour curves), presets in `src/app/quality.ts`, fog in `src/world/World.ts`.

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
