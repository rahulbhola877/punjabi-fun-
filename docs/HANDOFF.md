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

## The task now (user's words, 2026-10-22)

"add streets, residential colonies etc too, in urban areas as well as village area. expand map like a city planner and make it vast. find weak areas of game and weak visuals, fix those."

Suggested plan:
1. Map: survey with the minimap/map renderer (`src/ui/MapRenderer.ts`) and top-down `views.mjs` shots. Plan like a city planner: sectors/colonies with a grid of galis off the main roads (e.g. "Model Town", "Guru Nanak Nagar", "Sant Nagar", "Phase 1/2" in Nawan Shehar; mohallas and a phirni ring road around Pind Kotli; more housing along Ludhiana). Add the roads to ROADS (so traffic and nav pick them up), houses as OUTER_BUILDINGS / plots, zone them `residential` in zones.ts so colony fights, aunty quarrels, birds, quiet ambience apply. Consider enlarging WORLD bounds if needed (check terrain, minimap, draw distance, nav graph build time, and performance).
2. Keep performance: watch draw calls (`snapshot().drawCalls`) and fps per area; merge static meshes per chunk; LODs exist in World.ts.
3. Then weak areas/visuals: walk and drive around (views + gg.mjs), note what looks bare or broken (empty fields, flat facades, floating props, stuck spawns, buildings without doors/windows, repetitive colours), fix the worst first. Ambient occlusion on High/Ultra was offered to the user and not yet answered.
4. Ship in steps: commit, deploy, tell the user what changed and where to go see it (T key panel can teleport; add new places to Travel.ts).
