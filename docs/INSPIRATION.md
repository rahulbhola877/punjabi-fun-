# Inspiration and research: making Ranggarh feel like Punjab

Notes from web research (October 2026), what was applied in the game, and what is still open. Search coverage was
thin on bazaar and dhaba detail, so the open items below need a second, narrower pass before anyone builds on them.

## What the research says

**Village and kothi (courtyard houses)**
- The kothi and haveli are built round a central courtyard, and family life centres on it. The baithak is the shared sitting area. [Homelane blog](https://www.homelane.com/blog/?p=44668), [APP report on South Punjab courtyards](https://www.app.com.pk/?p=1263536).
- Jali (openwork screens) and carved jharokhas (balconies that stretch past the wall) are the signature façade details; jali keeps the sun and rain off. [Wikipedia: Jali](https://en.wikipedia.org/wiki/Jali), [IMP Art](https://imp-art.org/?p=37107).
- Wooden pinjra lattice on doors and the bokharcha bay-window balcony are the mark of a modest Punjabi house. [IMP Art](https://imp-art.org/?p=37107).
- Modern concrete houses without courtyards trap heat; older households move the charpai into the shade of a tree in summer. [APP report](https://www.app.com.pk/?p=1267126).

**Chaupal and village life**
- The chaupal is a communal sitting place where evenings went to smoke and gossip. Women met at the well by day. [Wikipedia: Chaupal](https://en.wikipedia.org/wiki/Chaupal_(public_space)).
- Charpais (rope-strung beds) serve for sitting, sleeping and sun-bathing. The elders are the ones who sit in the shade. [Wikipedia: Chaupal](https://en.wikipedia.org/wiki/Chaupal_(public_space)), [APP report](https://www.app.com.pk/?p=1267126).

**Truck and road art**
- Painted trucks (truck art) carry scenery, flowers and religious figures; Sikh transporters painted their Gurus from the 1940s. Flowers sit along the edges, and mountain or wildlife scenes are favoured on the road. [Wikipedia: Truck art in South Asia](https://en.wikipedia.org/wiki/Truck_art_in_South_Asia), [IPS (2010)](https://www.ipsnews.net/2010/10/pakistan-truck-art-makes-for-moving-canvasses-on-highways/).
- Bright paint is a sign of a well-kept vehicle to the people who hire it. [IPS (2010)](https://www.ipsnews.net/2010/10/pakistan-truck-art-makes-for-moving-canvasses-on-highways/).

**Towns and signage**
- Punjab requires Gurmukhi on top, with any other language beneath it in smaller type, on government and many shop boards (2020 rules). Spelling mistakes on Gurmukhi boards are common. [Tribune](https://www.tribuneindia.com/news/punjab/punjab-government-must-have-its-signboards-in-punjabi-say-new-regulations-45137).
- Ludhiana's real clock tower is the Victoria Memorial Clock Tower, dedicated in October 1906; a 2012 Tribune report said its four clocks had stopped. [Outlook Traveller](https://www.outlooktraveller.com/explore/story/72253/remembering-the-past-in-ludhiana), [Tribune 2012](https://www.tribuneindia.com/2012/20121020/ldh1.htm). The game's Ghanta Ghar is fiction; it should not be named as the real building.

## What was applied

- **Street life, recorded (40 new lines, `v3_*`, three batches).** Elders at the chaupal recall the old evenings, sit on charpais and ask for tea. Aunties gossip about the Sharma family's son going to Canada, a Mercedes, the power cut, and vegetable prices. Elders offer tea and ask the player's name. Two people chatting on the street say the chat lines as they are overheard, and strangers still stay quiet when you walk past (`tests/ludhiana.test.ts`). Batch 2 adds the moments that happen to you: a bump, an auto jolt, a quarrel coming to blows, a colony fight, a Safari driver's complaint, and four greeting replies. Batch 3 adds two drivers after a crash, a man admiring the car you get off, and a lafanga taunting you. Voices G (old man), T (aunty), C (cheerful woman) and the rest as in `docs/VOICE_LINES.md`. One take each. Rows are in `tools/voice_map.py` and `src/audio/voiceMap.json`.
- **Found while wiring them.** Batch 1's chat and talk rows could never play: the street pairs only said their two fixed lines, and `talk` is only used by named dialogue. A pair now falls back to the general chat lines while its own are cooling down, and the talk lines answer your greeting instead.
- **Signage.** The game already puts Gurmukhi first on its boards (`src/render/Signs.ts`), which matches the rule above. No change.
- **Batch 4 (`v4_*`, fifteen takes).** Punches, the petrol pump, the bank counter, two quarrels, two aunties, a driver after a bump, and two police bribes. Each has a speaker test in `tests/ludhiana.test.ts`. None has been heard in play yet. The voices are matched by name, and their IDs are in `docs/VOICE_LINES.md`.
- **Places checked in view mode.** The back of every town building has framed windows: it faces the inside of its block, where people walk past. The civil hospital's back has its wards, the bus stand's benches stand on legs, and the chaupal's matka stands on its stool. The Kotli ground has four lads warming up at its sidelines in the evening, off the court where a match spawns its own players (`src/crowds/countryFolk.ts`, guarded by `tests/folk.test.ts`).

## Tried, and what came of it

- **Live Ghanta Ghar hands** were tried twice. The first attempt (reverted) gave the hands the Ludhiana tower's dial height, 20.9, on the chowk tower, whose dials sit at 15.6, so they floated above the dial. The second attempt (`src/world/ClockHands.ts`) gives each tower its own dial height and set-out distance, removes the static painted hands, and turns the hands with the game clock. Checked in capture mode at 9:00 and 15:30 on the chowk dial. The Ludhiana tower's hands are checked the same way at 9:00; they are cream, since its dial is dark brown.

## Still open, in priority order

1. **More recorded lines** for variety. Batch 4 added fifteen takes for the moments heard most often, at about 50 credits a line. About 11,900 of the 15K credits remain, enough for roughly 230 more lines. Still to cover by place: the dhaba's customers, who have no general lines of their own yet.
2. **Truck art** on the game's trucks: flower borders, a tasselled crown, an eye on the bumper and painted doors are already on the highway truck (`src/vehicles/models.ts`). Still open: a few scenic panels, and a Guru portrait on one Sikh-owned truck per town. Needs a material with a painted atlas.
3. **Chaupal, morning**: the afternoon elders are in place (`src/crowds/countryFolk.ts`, from 3:30 pm, on the charpais under the neem; checked in play mode at 4:30 pm). Their chatting pair had been cut apart by the crowd budget, so it never talked; the pair now comes first in the list and says the general chat lines. Two aunties now talk at the platform from 6 to 10:30 am (checked in play at 8 am: one line plays from the general chat pool, `v3_gossip_05`; the partner's reply is dropped while the first line plays, as street talk is).
4. **Bazaar, second pass**: checked in view mode. The shop boards, the striped awnings, the fruit cart and the street lamps read well, and so does the dhaba from its own street. Still open: the chai kettle and tin-roofed stalls. The survey cameras are in `tools/survey-views.json`.
5. **Jali and jharokha detail**: the colony houses already have jali parapets (`jaaliParapet` in `src/world/houseBuilder.ts`), and jharokhas on some old fronts. Still open: more lattice on the plainer house fronts. Only one colony street has been looked at by eye.
