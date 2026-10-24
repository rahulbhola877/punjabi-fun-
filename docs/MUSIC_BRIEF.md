# Music brief for Gedi Route

The game already plays: it has a synth radio (four stations) and synth stingers. Anything you drop into
`public/audio/music/` with the names below replaces its synth stand-in the next time the page loads. Nothing else
needs changing; a missing file is simply skipped. Keep everything original (your own or tracks you hold the rights to).

**Format:** MP3 (or I can switch to OGG), stereo, 44.1 kHz, 160 to 192 kbps, about -16 LUFS, no clipping.
Loops (`theme_*`, `loop_*`) must repeat seamlessly: start and end on the beat, no fade.

## Priority 1: the radio (what you hear most; in the Bullet, autos, jeeps and on shop counters)

Two to four tracks per station is plenty, 2 to 4 minutes each. They play one after another and repeat.
No lyrics that need subtitles, or lyrics in Punjabi are fine since the radio carries no on-screen words.

| Files | Station | What it is |
|---|---|---|
| `radio_bhangra_1.mp3` to `_4` | **Punjab Beats** (98.3) | Bhangra, 100 to 115 BPM. Dhol on the chaal, tumbi riff, chimta, a hook you can hum. Cheerful, loud, the sound of a road trip. At least one with a vocal hook. |
| `radio_purane_1.mp3` to `_3` | **Purane Gaane** (91.1) | Old film songs, 70 to 95 BPM, 1960s and 70s feel: strings, tabla on keherwa, a sweet melody, a singer or a humming line. Nostalgic. |
| `radio_gurbani_1.mp3` to `_2` | **Gurbani Radio** (104.0) | Calm kirtan-style: harmonium drone, tabla, a slow devotional melody. Instrumental or wordless vocal (please no real scripture unless you are sure it is right to put it in a game radio). 3 minutes. |
| `radio_talk_1.mp3` to `_2` | **Vividh Bharati** (101.3) | Light instrumental "programme music" for a news-and-cricket station, 2 minutes: a cheerful sitar-and-keys bed that would sit under announcements. |

## Priority 2: the moments

| File | Where | Length | Feel |
|---|---|---|---|
| `theme_title.mp3` | Title screen (loops) | 60 to 90 s | The game's own tune: dhol and tumbi over a warm bass, hopeful, with a small sunrise-over-the-bazaar build. |
| `sting_win.mp3` | A delivery done, a medal | 2 to 3 s | A quick dhol roll and a tumbi flourish. |
| `sting_win_big.mp3` | A gold medal, a chapter done | 4 to 6 s | Bigger: bhangra hit, whoop, held final chord. |
| `sting_fail.mp3` | A failed delivery | 2 s | Gentle sad slide, two falling tumbi notes. Not harsh. |

## Priority 3: later, when the festivals and chapters land

Seamless loops, 30 to 60 s each, instrumental:

`loop_baraat.mp3` (dhol and brass band, 120 BPM) · `loop_nagar_kirtan.mp3` · `loop_lohri.mp3` (dhol, clapping, bonfire cheer) ·
`loop_baisakhi.mp3` (fast bhangra) · `loop_diwali.mp3` (festive, bells) · `loop_chase.mp3` (police chase: driving
percussion, tension, 140 BPM) · `loop_dangal.mp3` (akhada: dhol, drum, shouts) · `loop_night_drive.mp3` (a late-night
road: slow, lonely tumbi and a soft beat) · `loop_cricket_match.mp3`.

## Recorded voice lines

You said I can make 50 more with ElevenLabs. The full list and the voices used are in `docs/VOICE_LINES.md` and
`docs/DIALOGUE_STYLE.md`; new takes go to `public/audio/voice/` with the voice map rebuilt by `tools/voice_map.py`.
