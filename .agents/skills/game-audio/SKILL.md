---
name: game-audio
description: Produce, integrate and audition original spatial game effects, environmental soundscapes and exact-script native-language NPC recordings. Use for vehicle contact, water, scene sound, regional voices, clipping, source leaks and audio performance.
---

# Game audio production

Read `src/audio/Audio.ts`, `VoiceDirector.ts`, `RegionalAudio.ts`, the relevant
scene and `docs/ASSETS.md` before changing sound. Identify the actual player
action, physical surface, locale and listener. Trace the existing event before
making assets: an excellent sample wired to the wrong event is still a bug.

## Establish provider access

Discover available ElevenLabs tools by name and description. Inspect managed
environment status/network readiness when using an API. Use an already
configured connector or SDK; never print secrets or embed keys in frontend
code. An installed package or a previously generated asset does not establish
current ElevenLabs access. Do not claim new audio was generated when the
provider was unavailable. Report the missing capability and continue useful
local work. Existing task authorization governs paid generation; do not add a
second approval requirement merely because this skill is being used.

## Design the audible result

Create a short production sheet with trigger, source position, distance,
surface, variation, duration, loop seam, loudness target, locale (for speech),
expected concurrent sources and exit/cleanup behavior. The design must name
an interaction that exists in the playable build. Prefer a few physical layers
to an indiscriminate background wash. Avoid constant whooshing, repetitive
chirps and cultural music used as a substitute for a believable place.

For vehicles, keep engine, tyre roll, gravel, brake lock-up and collision
separate. Skid comes from measured lateral body velocity under ground
contact, not steering input alone. Suspend contact sound in flight and stop
sources after the player exits. For water, distinguish entry splash, a small
stone hit, flowing water, rain and swimming; a solid impact is not a splash.

`AudioSystem.splash` uses original code-generated samples in
`physicalSounds.ts`. `vehicleContact` uses one bounded contact voice for the
current vehicle. `RegionalAudio` is owned by the Japan/China scene and follows
its real pond/river and player movement. It observes master, effects, ambience
and mute settings; it does not generate or play human speech.

## Regional NPC voices

1. Export current exact scripts with:

   ```sh
   node tools/regional-voice-plan.mjs japan /tmp/japan-voice-plan.json
   node tools/regional-voice-plan.mjs china /tmp/china-voice-plan.json
   ```

   This is an inventory, not generated audio. Each line includes native text,
   translation, locale, speaker, stable ID and script hash. Do not voice the
   translation accidentally. Do not write new placeholder dialogue merely to
   inflate recording counts.
2. Review Japanese/Mandarin wording and pronunciation with a native speaker
   where available. Treat unreviewed translations as unreviewed. Choose a
   permitted library or user-authorized voice that actually supports the
   locale. Keep a character's voice consistent. Never imitate a real actor
   or clone someone from a film without authorization.
3. Generate one small audition batch through the verified ElevenLabs tool
   using its current supported multilingual model and actual parameter
   schema. Include context such as quiet conversational speech, speaker age
   and emotional intent. Avoid exaggerated accent directions. Audition a
   greeting and an emotional story line before recording the entire cast.
4. Save provider outputs in an ignored staging directory, then trim excess
   silence without removing consonants. Match the exact subtitle, language,
   voice, ID and script hash. A line in the wrong language or an extra word
   must be re-recorded, not relabelled. Never pitch-shift a Punjabi recording
   and call it Japanese, Mandarin or Canadian English.
5. Keep a manifest per recording: ID, locale, exact script, speaker, chosen
   voice ID, model, creation date, source/license and reviewed status. Store
   shipped files locally. Loading gameplay must not call ElevenLabs or another
   paid API. Missing regional audio leaves native subtitles and translation;
   it must not fall back to Punjabi or synthetic babble.

## Effects production and mixing

For ElevenLabs Sound Effects, describe the physical source and event, natural
timing, requested duration, perspective, absence of speech/music and whether
the loop must be seamless. Generate a handful of useful variations, audition
them against the action and reject mismatches. A request for a loop is not
proof its seam is clean: inspect/listen across repeated boundaries. Keep
engine loops as gapless WAV or another verified gapless format; effects and
speech may use compressed files when appropriate.

Use ffmpeg to inspect loudness and peak before normalization:

```sh
ffmpeg -hide_banner -i /tmp/take.wav -af loudnorm=I=-18:TP=-3:LRA=9:print_format=json -f null -
```

Use the measured two-pass `loudnorm` parameters for production recordings,
with effect-specific levels chosen in context. Re-record whispery/distorted
takes that would need extreme limiting. Keep headroom for the sum of voices,
engines and ambience. Do not stack saturators or automatic makeup gain.
Maintain `docs/ASSETS.md` provenance for every shipped asset.

## Runtime contract

- Audio starts after a user gesture and respects mute and all volume buses.
- Convert Babylon left-handed world Z consistently for both listener and
  source; cheap equal-power panning is sufficient for distant traffic.
- Cull inaudible sources before decoding/scheduling; cap concurrent voices.
  Stop sources at zero level, rather than keeping dozens alive silently.
- Coalesce frame-driven triggers. A landing or collision sounds once;
  per-frame loops smooth their parameters instead of restarting.
- Pause/scene transfer invalidates pending decodes and cancels transients.
  Input in another scene must not resume the paused main-world context.
- On exit, remove listeners, disconnect nodes, stop scheduled sources and
  close a scene-owned context. Background tabs and locked phones go silent.
- Native voices must match both locale and exact script ID. A generic
  speaker group or named ID cannot bypass locale checks in VoiceDirector.

## Verification and handoff

Run `npx vitest run tests/audioLifecycle.test.ts tests/voice.test.ts
tests/radio.test.ts` and `npm run typecheck`. In the actual browser build,
audition water entry, gravel driving, a real skid, idle/exit, near/far
attenuation and mute. Open Japan/China, press movement and talk keys, return,
and repeat: Punjabi traffic/voices must not revive there or replay stale
sentences on return. Hide/show the page and check silence/resume. Record a
short loopback sample or screen recording when supported and listen for
clipping, bad seams, mechanical repetition and dialogue masking. Tests for
finite PCM and callback lifetimes establish correctness, not production
sound quality. Report what was heard and what still lacks a real recording.
