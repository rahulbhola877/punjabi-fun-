# Unlabelled street-call takes

Nine ElevenLabs takes recovered from an earlier session, before anyone wrote
down which line each one says. They are kept here so they are not lost again.

To put one into the game, rename it into `public/audio/voice/` using one of the
names below and it is picked up automatically on the next load — no code change
needed. Anything missing falls back to the synthesised call in
`src/audio/Audio.ts` (`cry`), so the game is complete either way.

| File name | The line it should say | Used by |
| --- | --- | --- |
| `call_sabzi.mp3` | "Aaloo lo, pyaaz lo — taaze taaze!" | sabzi-walas, vegetable carts |
| `call_doodh.mp3` | "Doodh le lo ji, doodh!" | the doodhwala at the Ludhiana chowk |
| `call_auto_gill.mp3` | "Gill, Gill, Gill!" | auto-walas touting at the stands |
| `call_auto_ludhiana.mp3` | "Ludhiana, Ludhiana, Ludhiana!" | auto-walas at the Ludhiana adda |
| `call_bus.mp3` | "Ludhiana! Jalandhar! Amritsar! Baith jao!" | the bus conductor |
| `safari_kanjar.mp3` | "Kanjar da put, hun paise nai dene tere!" | the Safari driver you bumped |

The list of names the game looks for is `STREET_CLIPS` in `src/app/Game.ts`.
