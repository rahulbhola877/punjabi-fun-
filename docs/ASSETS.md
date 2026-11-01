# Asset provenance

The game uses procedural assets, the user's character and Tunyard designs, and the fonts and recordings listed below.
Nothing is downloaded from third parties at runtime (voice clips are served from the game's own `public/` folder).

| Asset | Source | Licence |
|---|---|---|
| Buildings, interiors, props, street furniture, trees, skyline | Procedural geometry, `src/world/*.ts` | Project original |
| Sakura Street teahouse, cherry trees, torii, stone lanterns, raked garden and bamboo | Original Tunyard geometry and 29 baked texture maps from `src/assets/lpBuildings/themed/japan.ts` and `src/assets/japan/{cherryTree,torii,stoneLantern,zenGarden,bambooGrove}.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`; rebuild with `tools/bake-tunyard-japan.mjs` | User-owned designs, authorized by their creator. Static bake; source wind animation is not included. |
| Sakura Street koi | Original Tunyard `lpaKoi` Kohaku and Ogon geometry from `src/assets/lpAnimals/birdsea/fish.ts` at the same commit; rebuilt with `tools/bake-tunyard-koi.mjs`. The source body joints animate the swim; paired fins use the baked pose. | User-owned designs, authorized by their creator |
| Lantern Harbor market stall and paper lantern strings | Original Tunyard geometry and textures from `src/assets/stall.ts` and `src/assets/tropical/paperLanterns.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`; rebuild with `tools/bake-tunyard-china-market.mjs`. | User-owned designs, authorized by their creator |
| Chand Outpost sci-fi scenery | Original Tunyard landing pad, dish, solar array and cryo-pod geometry and maps, from `src/assets/scifi/` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`; reproducible using `tools/bake-tunyard-space.mjs`. Animated parts are held in their baked pose. | User-owned designs, authorized by their creator |
| Chand Outpost rocket | Original Tunyard `ctn-rocket` ship geometry from `src/assets/cartoon/rides/vehicles2.ts` at the same commit, reproducible with `tools/bake-tunyard-rocket.mjs`. The game animates the baked ship as a whole and adds its own exhaust; the source outline shader and part animations are not reproduced. | User-owned design, authorized by its creator |
| Snowy pine trees in the Canada-inspired set | Original Tunyard `src/assets/pine.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`, baked with snow, 10 tiers and 7 branches per whorl; see `tools/bake-tunyard-pine.mjs` | User-owned Tunyard design, authorized by its owner |
| Cottage in the Canada-inspired set | Original Tunyard `src/assets/cottage.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`, with baked shingles and winter palette; see `tools/bake-tunyard-cottage.mjs` | User-owned Tunyard design, authorized by its owner |
| Corner shop in the Canada-inspired district | Original Tunyard `src/assets/city/cornerShop.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`, baked with a two-storey, three-bay configuration; see `tools/bake-tunyard-corner-shop.mjs` | User-owned Tunyard design, authorized by its owner |
| Bungalow in the Canada-inspired district | Original Tunyard `src/assets/lpBuildings/homes/classic.ts` (`lpbBungalow`) at the same commit, including its original low-poly palette; see `tools/bake-tunyard-bungalow.mjs` | User-owned Tunyard design, authorized by its owner |
| Modern house in the Canada-inspired district | Original Tunyard `src/assets/lpBuildings/homes/modern.ts` (`lpbModernVilla`) at the same commit, with garage and no pool; see `tools/bake-tunyard-modern-house.mjs` | User-owned Tunyard design, authorized by its owner |
| Default broadleaf trees and shrubs across the main map | Baked from the user-supplied `lowpoly-lab-viewer.html` using its `LowPoly` asset API: three complete opaque tree variants (394 triangles each) and two Karikomi shrubs (152 triangles each). Exact source SHA-256 and recipes: `src/world/assets/lowpoly-nature-manifest.json`. Rebuild with `node tools/bake-lowpoly-nature.mjs /path/to/lowpoly-lab-viewer.html`. No viewer or second Three.js runtime ships with these assets. | User-supplied asset designs provided for game integration |
| Retained detailed broadleaf and rustic benches, including the Neon Quay bench | Original Tunyard geometry and textures baked from `src/assets/tree.ts` and `src/assets/bench.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b`; regeneration scripts are `tools/bake-tunyard-tree.mjs` and `tools/bake-tunyard-bench.mjs`. Detailed trees remain in Lantern Harbor; main-map default trees use the opaque kit above. | User-owned designs; owner confirmed authorship and authorized their use. |
| Forest boar | Original Tunyard low-poly boar geometry and palette atlases, baked from `src/assets/lowpolyAnimals/boar.ts` at the same commit by `tools/bake-tunyard-boar.mjs`. The neutral pose is retained; Tunyard's idle animation is not included. | User-owned Tunyard asset, authorized by its creator |
| Lantern Valley and Neon Quay prototype worlds | Canvas pixel art in `src/alternate/PixelWorld.ts` and procedural 3D geometry in `src/alternate/NeonWorld.ts`; Neon Quay also uses the Tunyard bench above and the Tunyard Toon Fox (`src/assets/toonAnimals/toonFox.ts`, same commit), baked by `tools/bake-tunyard-fox.mjs` in a static sitting pose without its original idle animation or outline shader | Project original designs, plus the user-owned Tunyard assets |
| Farm windpump and well; rock clusters and fallen logs | Babylon adaptations in `src/world/tunyardLandmarks.ts` and `src/world/tunyardNature.ts`, based on `rahulbhola877/tunyard` commit `4de2d594e9ea54553af1884ac1d2add62058a41b`: `src/assets/farm/windpump.ts`, `src/assets/well.ts`, `src/assets/rocks.ts`, `src/assets/extras/stumpLogs.ts` | User-owned Tunyard designs; the owner confirmed authorship and authorized their use. No separate licence file was found. |
| Meadow grass | `public/tunyard/grass/tuft.png`, rendered from the user's Tunyard `src/assets/grass.ts` at the same commit by `tools/bake-tunyard-grass.mjs`; the second sprite adds painted flowers | User-owned Tunyard asset, authorized by its creator |
| Plaster, brick, wood, shutter, fabric, asphalt, paver, dirt, leaf, concrete textures + normal maps | Procedural canvas painting, `src/render/textures.ts` | Project original |
| Shop signs, menu board, posters, street signs (Gurmukhi + English) | Drawn into an atlas at startup, `src/render/Signs.ts` | Project original text and layout |
| Characters (geometry, skeleton, clothing, faces) | `src/characters/HumanBuilder.ts` | Project original |
| Character animation | Procedural, `src/characters/HumanAnimator.ts` | Project original |
| Vehicle models (scooter, auto, bicycle, motorcycle, car, jeep, tractor + trolley, truck, milk cans), rehri carts | `src/vehicles/models.ts`, `src/world/country.ts` | Project original designs (no real brand) |
| Pickup truck | Original Tunyard pickup body and wheel geometry, baked from `src/assets/cars/pickup.ts` at commit `4de2d594e9ea54553af1884ac1d2add62058a41b` using `tools/bake-tunyard-pickup.mjs`; the game's physics animate its wheels. Doors are baked closed, and some game materials replace Tunyard shaders. | User-owned Tunyard asset, authorized by its creator |
| Light aircraft | Original Tunyard high-wing light-plane geometry, baked from `src/assets/lpVehicles/airsea/planes1.ts` at the same commit using `tools/bake-tunyard-plane.mjs`; the game's flight controller drives the propeller and aircraft. Control surfaces are baked in their neutral pose. | User-owned Tunyard asset, authorized by its creator |
| Voice lines `public/audio/voice/*.mp3` (Bhola, Gurnam, Pammi, "Oye hoye!" bump bark, Havaldar's "Rukk ja!" and "chai-paani", lafanga taunt, quarrel, road-rage driver, Ustad Kartar) | Generated for this project with ElevenLabs text-to-speech (eleven_v4) from original script lines written for the game; stock ElevenLabs library voices | Commercial use per the project owner's ElevenLabs plan |
| Street-call takes `public/audio/voice/call_*.mp3` (sabzi, fruit, doodh, chaat, kabadi, auto touts, bus), `safari_kanjar.mp3`; first-mission lines (`bhola_chaura`, `mobile_shop`, `bhola_thanks`); greetings (`greet_*`, `shop_aao`), street chat (`gossip_a/b`, `chat_match`, `chat_petrol`) character lines (`masterji_naap`, `sohal_race`, `mrskaur_chah`, `gill_vele`, `chemist_paani`) and fight lines (`panga_bhen`, `khad_dasda`, `ki_ho_gaya`) | ElevenLabs text-to-speech (eleven_v4), same as the other voice lines; all clips loudness-normalised to −18 LUFS with −3 dB peak headroom | Same as above |
| Sound effects `public/audio/sfx/*.mp3` (pressure-cooker whistle, dog bark, buffalo moo, cat meow, truck air horn; two takes each of car, scooter/bike, auto-rickshaw and jeep/tractor horns) | Generated with ElevenLabs text-to-sound (eleven_text_to_sound_v2); silence-trimmed and loudness-normalised with ffmpeg | Same as above |
| Engine loops `public/audio/sfx/eng_*.wav` (110cc scooter, 350cc single-cylinder bike, auto-rickshaw, petrol car, diesel tractor/truck) | Generated with ElevenLabs text-to-sound, then cut into seamless crossfaded WAV loops (WAV so the loop has no MP3 padding gap); pitched by rpm at runtime | Same as above |
| Road ambience bed `public/audio/sfx/road_bed_loop.mp3` (a 30 s seamless loop: distant trucks and cars on tarmac, a scooter going by, a far horn, a tractor idling away, wind through fields, crows and a dog far off) | Generated with ElevenLabs Sound Effects v2 (text to sound, duration 30 s, loop on); four takes, the one whose wrap point joins most smoothly is kept. It replaces the synthesised brown wash under the zone filters in `src/audio/Audio.ts` (`swapToRoadLoop`), at the wash's level and never above its peak | Project original |
| Gurbani `public/audio/sfx/gurbani_japji.mp3` (Japji Sahib, opening 30 s: Mool Mantar) | Supplied by the user from archive.org item `02Japji` (https://archive.org/details/02Japji); cut with ffmpeg (0.9–30.9 s, 1.2 s fade in, 3 s fade out, loudness-normalised to −18 LUFS, mono 96 kbps). Played from the gurdwaras' loudspeakers at amrit vela | As provided by the user |
| All other sound (footsteps, impacts, birds, siren, cycle bell, tumbi/dhol stingers; the brown wash under the road bed until it loads; fallback engines and horns while clips load) | WebAudio synthesis, `src/audio/Audio.ts` | Project original |
| Water-entry splash, tyre/gravel/skid contact, Japan/China quiet water and footsteps | Original procedural PCM and WebAudio, `src/audio/physicalSounds.ts`, `VehicleContactAudio.ts`, `RegionalAudio.ts`; driven by water entry, measured vehicle contact/slip, regional player movement and water proximity | Project original. No newly generated ElevenLabs recordings; regional speech remains native text with English translation until actual recordings are available. |
| Font: Baloo Paaji 2 | `@fontsource/baloo-paaji-2` 5.3.0 (bundled woff2) | SIL Open Font License 1.1 |
| Font: Noto Sans Gurmukhi | `@fontsource/noto-sans-gurmukhi` 5.3.0 (bundled woff2) | SIL Open Font License 1.1 |
| Physics engine WASM | `@babylonjs/havok` 1.3.14 (bundled) | MIT |

Names of people, shops and places (Ranggarh, Bhole Da Dhaba, Gurnam Motor Works, etc.) are fictional.

## Street calls without a recording

Vendors and touts declare the take they would like (`callClip` in
`src/crowds/countryFolk.ts`; the list the game probes for is `STREET_CLIPS` in
`src/app/Game.ts`). When the file is not there, `AudioSystem.cry` synthesises
the call instead: a few voiced syllables on a formant filter, pitched and
paced by trade, which reads as a human shout at twenty metres. Dropping an
mp3 into `public/audio/voice/` with the right name replaces it, with no code
change.

## Audio mixing

Everything is summed through one bus into a glue compressor and then a tanh
soft limiter (`Audio.build`). On top of that the mix is budgeted: only the
nearest few engines sound at all (the preset decides how many), one-shots
further away than earshot are dropped before they are built, and there is a
hard cap on concurrent one-shot voices. Without those a jammed chowk clipped
the output — the "fat" sound — rather than simply being loud.

## A note on takes that are too quiet to use

`khad_dasda` was first generated as a "[menacing, low growl]" and came back at
−30 LUFS with 9.5 dB to true peak — reaching the −18 LUFS house level would
have taken 12 dB of limiting, which flattens exactly the menace that made it
worth recording. It was regenerated with a forceful delivery instead. When a
take will not normalise, re-record it rather than squeeze it.
