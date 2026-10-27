# Voice clips: who says what, and where it plays

Every file in `public/audio/voice/`. Fill in or correct the **Says** column and
the game can be re-pointed to match — most of it is a one-line change.

Confidence column (texts marked *generation prompt* are the exact prompt the
take was generated from, recovered from the ElevenLabs generation records):
- **generation prompt** — the exact script the take was generated from.
- **script** — the repo pairs this clip with exactly one line of text, so the
  take was generated from that line.
- **verified** — one of the nine takes renamed in commit `6cec2e2`; each was
  matched by waveform (envelope correlation 0.99–1.0) to the original
  ElevenLabs take, whose generation prompt is the text shown. The names are
  correct; only `safari_kanjar` is used in a scene its words do not fit.
- **context** — the clip is tied to a scene but the exact wording was never
  written down.

---

## Named characters

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `bhola_hello` | **Bhola** — owner, Bhole Da Dhaba, Ranggarh | "Oye! Sat Sri Akal ji! [laughs] Hot food waits for no one — go, go, go!" | First greeting, and when he hands you a delivery | generation prompt |
| `bhola_chaura` | **Bhola** | "Oye! Chaure Bazaar jaana ae, mobile lain layi! Mera phone thalle digg ke tutt gaya — screen de sau tukde!" | Start of the first mission | script |
| `bhola_thanks` | **Bhola** | "Wah mere sher! Hun main vi status paavanga!" | When you bring his phone back | script |
| `mobile_shop` | **Mobile-wala** — Hello Mobile Zone, Chaura Bazaar | "Aao ji, aao! Naya model, kamaal da camera! Bhole da phone?…" | Buying the phone | script |
| `gurnam_finally` | **Gurnam** — Gurnam Motor Works | "Finally. Bhola's dal makhani. [sighs happily] The only fuel I trust." | First time you talk to him | generation prompt |
| `pammi_kinnow` | **Pammi** — fruit seller | "Oho! Kinnow from Abohar, sweet as gur! [laughs] And the gossip comes free!" | Her greeting, and her delivery line | generation prompt |
| `masterji_naap` | **Masterji** — tailor | "Naap do vaari lao, kainchi ik vaari!" | Passing his shop | script |
| `sohal_race` | **Sohal** — Sohal Cycle Store | "Ik din tainu gate tak race vich harauna ae!" | Passing his shop | script |
| `mrskaur_chah` | **Mrs. Kaur** — courtyard house | "Aa ja puttar, chah pee ke ja!" | Passing her house | script |
| `gill_vele` | **Gill uncle** — lane house, elder | "Saade vele gali kachi si, par dil pakke si!" | Passing his house | script |
| `chemist_paani` | **Dr. Sehgal** — Sehat Chemist | "Paani peeo ji, garmi bahut ae." | Passing the chemist | script |
| `ustad_swagat` | **Ustad Kartar Pehlwan** — the akhada | "Akhade vich swagat ae, pehlwan! [laughs] Dekhde haan kinna dum ae!" | When you pay ₹20 and the dangal starts | generation prompt |

## Greetings and street chat (any resident)

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `greet_m1` | adult man | "Sat Sri Akal ji! Ki haal ne?" | Walking past | script |
| `greet_young` | young man | "Oye, ki haal aa bai? Chadhdi kala!" | Walking past | script |
| `greet_old` | elder | "Jeonde raho puttar! Sab sukh-saand?" | Walking past | script |
| `greet_f1` | woman | "Sat Sri Akal! Aaj badi jaldi vich ae?" | Walking past | script |
| `greet_f2` | woman | "Haanji, ki gall ae? Theek-thaak?" | Walking past | script |
| `shop_aao` | woman shopkeeper | "Aao bhenji, aao! Ajj sab kujh sasta ae!" | Outside her shop | script |
| `gossip_a` | woman | "Pata ae? Gillan di nooh Canada chali gayi!" | Two women chatting (first half) | script |
| `gossip_b` | woman | "Haaye! Main taan pehlan hi kehndi si!" | Two women chatting (reply) | script |
| `chat_match` | man | "Kal da match vekhya? Saadi team ne phir dil tod ditta!" | Two men chatting | script |
| `chat_petrol` | elder | "Petrol de bhaa vekh! Hun taan saikal hi changi." | An elder chatting | script |

## Street sellers and touts

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `call_sabzi` | sabzi-wala | "Aaloo lai lo, pyaaz lai lo! Taaze tamatar, sasti bhindi!" | Vegetable carts, both mandis | generation prompt |
| `call_fruit` | fruit-wala | "Kele lai lo, kinnow, mitthe ambh! Chakh ke dekho ji!" (old man) | Fruit carts | generation prompt |
| `call_doodh` | doodh-wala | "Doodh waala aa gaya! Taaza doodh, bhenji!" | Ghanta Ghar chowk, Ludhiana | generation prompt |
| `call_chaat` | chaat-wala | "Gol gappe! Teekhe vi, mitthe vi! Aao ji, aao!" | Chaat carts | generation prompt |
| `call_kabadi` | kabadi-wala | "Kabaadi waala! Purana loha, akhbaar, botlan — vech lo!" | Doing rounds in the mandi | generation prompt |
| `call_auto_gill` | auto-wala | "Gill, Gill, Gill! Gill Road, Gill! Aa jao, baith jao!" (young man) | Auto stands | **verified** |
| `call_auto_ludhiana` | auto-wala | "Ludhiana, Ludhiana, Ludhiana! Bas do sawari hor, chalo chalo!" (loud man) | Ludhiana adda | **verified** |
| `call_bus` | bus conductor | "Jalandhar, Phagwara, Ludhiana! Chhetti chadho, bus chalan lagi ae!" (gruff man) | Bus addas | **verified** |

## Police

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `police_rukk` | constable | "Oye! Rukk ja! Rukk ja, hero!" | First constable to come after you | generation prompt |
| `police_chai` | **Havaldar Balwant** | "Dekh puttar, case bada serious ae… chai-paani da intezaam karo, te gal khatam!" | The bribe dialogue | generation prompt |
| `police_gaddi_rok` | police jeep, on the radio | "Gaddi rok! Side te laa! Oye, sunda nahi?!" (on a loudspeaker, police voice) | When the jeep joins a chase | **verified** |

## Fights, quarrels and road rage

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `panga_bhen` | lafanga / anyone you hit | "Teri bhen di! Mere naal panga?" | A gang picking a fight; hit reactions | script (made this session) |
| `khad_dasda` | anyone you hit | "Khad, tainu dasda haan!" | Blaming both sides of a quarrel; road rage; hit reactions | script (made this session) |
| `ki_ho_gaya` | nosy bystander | "Ki ho gaya ji? Ki ho gaya?" | First onlooker to a quarrel | script (made this session) |
| `rage_andha` | driver you hit | "Oye! Andha ae? Meri gaddi da nuksaan kaun bharega?!" | Road-rage driver | generation prompt |
| `safari_kanjar` | **Safari driver** | "Oye kanjar da puttar! Auto palat ditta! Hun paise nahi dene tere!" — written for the passenger of a tipped-over auto, so "auto palat ditta" does not fit a Safari bump | After you hit the Safari | **verified** |
| `quarrel_kaun` | man in a street quarrel | "Tu jaanda nahi main kaun haan?!" | First line of a non-aunty quarrel | generation prompt |
| `aunty_fight_1` | **aunty** | "Ni kalmuhiye! Tera kutta roz mere boohe agge gand paunda ae!" (woman) | First line of an aunty quarrel | **verified** |
| `aunty_fight_2` | **aunty** | "Chal ni chudail! Pehlan apne vehre di safai kar, phir gall kari!" (woman) | When an aunty quarrel comes to blows | **verified** |
| `fuddu` | anyone | "Oye, fuddu ho gaya ae ki? Akkal ghaah charan gayi ae!" (mocking young man) | Hit reactions | **verified** |
| `lafanga_chai` | lafanga | "Ki dekh reha ae, hero? [laughs] Saanu chai pila!" | A lafanga taunting you | generation prompt |
| `bump_oye` | woman you walked into | "Oye hoye! Dekh ke chala, hero! This is a bazaar, not a racetrack!" (woman) | Barging into an adult woman | generation prompt |
| `sawari_lak` | your auto passenger | "Hai rabba! Mera lakk tutt gaya! Kithe dhyaan ae tera, fuddu?!" (woman) | Rough ride with a fare aboard | **verified** |

---

## Trial batch: 50 new lines (2026-10-24)

Made to hear how the voices and lines sound in the game before the next batch. Each line has two takes in the ElevenLabs flow; take 1 is in `public/audio/voice/`. The clips are on in `voice_map.py` (`trial_*` rows), so they play in the game as soon as the situation comes up.

Voices: A to G, S and the rest were matched by their descriptions in the sheet, because the ElevenLabs voice IDs for A to G were never stored in the repo. If a voice does not sound like the character it stands for, say which one and it will be re-matched. T (aunty) and U (young woman) are new letters.

**Changed after a test run.** Some trial lines could never play, or broke the rule that strangers stay quiet as you walk past, so they were re-targeted (the words and voices did not change). Rows 1 to 8 are now replies to your greeting, because the game only starts a greeting from you. Rows 14 to 23 and 25 are shop call-outs, since shopkeepers already call to passers-by; rows 13 and 24 are weather reactions. Row 41 now comes from the patrol jeep or bike. Rows 26 to 28 are held: a street chat needs its own reply line, and the game plays chats only in fixed pairs.

| # | Clip | Voice | Says | Where it plays | Confidence |
|---|---|---|---|---|---|
| 1 | `trial_meet_01` | A · Karanveer (upbeat) | Sat Sri Akal ji! Sab theek-thaak? | They answer your greeting: an adult man, within 7 m | trial take 1 of 2, not yet heard |
| 2 | `trial_meet_02` | G · Sufi (elder) | Ki haal ae puttar? Chadhdi kala! | They answer your greeting: an old man or woman, within 7 m | trial take 1 of 2, not yet heard |
| 3 | `trial_meet_03` | C · Navjot (cheerful) | Haanji bhenji, kiddan ho? Sab khair ae? | They answer your greeting: an adult woman, within 7 m | trial take 1 of 2, not yet heard |
| 4 | `trial_meet_04` | E · Yatin (playful) | Oye veere, bahut dinaan baad disda! | They answer your greeting: a young man, within 7 m | trial take 1 of 2, not yet heard |
| 5 | `trial_meet_05` | G · Sufi (elder) | Jeonda reh puttar! Aaj bazaar kidhar nu? | They answer your greeting: an old man or woman, within 7 m | trial take 1 of 2, not yet heard |
| 6 | `trial_meet_06` | T · Ritu Rathore (aunty) | Ni, kinne din ho gaye, dikhya nahi! | They answer your greeting: an adult woman, within 7 m | trial take 1 of 2, not yet heard |
| 7 | `trial_meet_07` | S · Saurav (Punjabi shopkeeper) | Aao ji, Sat Sri Akal! Kuchh lainde ho? | They answer your greeting: a male shopkeeper, within 7 m | trial take 1 of 2, not yet heard |
| 8 | `trial_meet_08` | T · Ritu Rathore (aunty) | Kiddan bhenji? Ghar de sab theek? | They answer your greeting: an adult woman, within 7 m | trial take 1 of 2, not yet heard |
| 9 | `trial_meet_09` | A · Karanveer (upbeat) | Sat Sri Akal ji, Waheguru di kirpa ae! | They answer your greeting: an adult man, within 7 m | trial take 1 of 2, not yet heard |
| 10 | `trial_meet_10` | E · Yatin (playful) | Bas ji, chal reha ae. Tu sunao! | They answer your greeting: a young man, within 7 m | trial take 1 of 2, not yet heard |
| 11 | `trial_meet_11` | C · Navjot (cheerful) | Haanji bhenji, sab theek, tusi sunao! | They answer your greeting: an adult woman, within 7 m | trial take 1 of 2, not yet heard |
| 12 | `trial_meet_12` | G · Sufi (elder) | Waheguru mehar kare, bas chal reha ae! | They answer your greeting: an old man or woman, within 7 m | trial take 1 of 2, not yet heard |
| 13 | `trial_pass_01` | B · Rajwinder (firm) | Dhyaan naal, gali vich paani khaloya ae! | The galis are flooded and someone near you reacts: an adult woman, within 18 m | trial take 1 of 2, not yet heard |
| 14 | `trial_pass_02` | C · Navjot (cheerful) | Sabzi da bhaa vekh, ajj taan hosh ud gaye! | You walk past a shop: a female shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 15 | `trial_pass_03` | T · Ritu Rathore (aunty) | Hai Waheguru, eh garmi kadon jaave! | You walk past a shop: a female shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 16 | `trial_pass_04` | A · Karanveer (upbeat) | Petrol vi mehnga, zindagi vi mehngi ho gayi! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 17 | `trial_pass_05` | F · Harjot (loud) | Bijli phir chali gayi! Inverter vi thak gaya! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 18 | `trial_pass_06` | G · Sufi (elder) | Oye, ghar aaiye, chai taiyaar ae! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 19 | `trial_pass_07` | F · Harjot (loud) | Eh sadak taan hamesha tootti rehndi ae, kaun sunda ae! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 20 | `trial_pass_08` | G · Sufi (elder) | Ajj taan kanak da bhaa vadh gaya ae, sun ke dil ghabraaunda! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 21 | `trial_pass_09` | E · Yatin (playful) | Bhai, bike di chain dheeli ae, dhyaan karo! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 22 | `trial_pass_10` | F · Harjot (loud) | Veere, gaddi sambhal ke chala, sadak te bachche vi ne! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 23 | `trial_pass_11` | C · Navjot (cheerful) | Waheguru ji, bachche kithe ne? Dhyaan rakho! | You walk past a shop: a female shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 24 | `trial_pass_12` | B · Rajwinder (firm) | Mausam vi ajeeb ae, subah thand, dopahir garmi! | It starts to pour and someone near you reacts: an adult woman, within 18 m | trial take 1 of 2, not yet heard |
| 25 | `trial_pass_13` | A · Karanveer (upbeat) | Chai pee le, garam garam! Bahut sohni ae! | You walk past a shop: a male shopkeeper, within 9 m | trial take 1 of 2, not yet heard |
| 26 | `trial_chat_01` | A · Karanveer (upbeat) | Oye, Bhola da dhaba mehenga ho gaya ae ajkal! | Held, not in the game yet: you pass two people chatting, an adult man, within 12 m | held: a street chat needs its own reply line |
| 27 | `trial_chat_02` | B · Rajwinder (firm) | Waheguru, mausam kadon badlega? Ik vaari thand aave! | Held, not in the game yet: you pass two people chatting, an adult woman, within 12 m | held: a street chat needs its own reply line |
| 28 | `trial_chat_03` | C · Navjot (cheerful) | Mere munde ne naya phone lia, hun taan udda phirda ae! | Held, not in the game yet: you pass two people chatting, an adult woman, within 12 m | held: a street chat needs its own reply line |
| 29 | `trial_call_01` | A · Karanveer (upbeat) | Chaat, chaat! Teekhi meethi, khaa ke dekho ji! | A seller calls out when you are near: chaat seller, within 18 m | trial take 1 of 2, not yet heard |
| 30 | `trial_call_02` | C · Navjot (cheerful) | Ganne da ras! Taaza, thanda thanda, dus rupay gilaas! | A seller calls out when you are near: fruit seller, within 18 m | trial take 1 of 2, not yet heard |
| 31 | `trial_call_03` | S · Saurav (Punjabi shopkeeper) | Gobhi, matar, aloo! Taaze taaze, sasti sabzi! | A seller calls out when you are near: sabzi seller, within 18 m | trial take 1 of 2, not yet heard |
| 32 | `trial_call_04` | E · Yatin (playful) | Auto! Auto! Ghanta Ghar, Chaura, Gill Road, aa jao! | A seller calls out when you are near: auto-wala, within 20 m | trial take 1 of 2, not yet heard |
| 33 | `trial_call_05` | F · Harjot (loud) | Nawan Shehar, Nawan Shehar! Ik sawari hor, chalo! | A seller calls out when you are near: auto-wala, within 20 m | trial take 1 of 2, not yet heard |
| 34 | `trial_call_06` | U · Pyaari (young woman) | Naya suit, sasta suit! Aao bhenji, aao! | A seller calls out when you are near: a female shopkeeper, within 15 m | trial take 1 of 2, not yet heard |
| 35 | `trial_call_07` | S · Saurav (Punjabi shopkeeper) | Samosa, samosa! Garam samosa, do ke teen! | A seller calls out when you are near: a male shopkeeper, within 15 m | trial take 1 of 2, not yet heard |
| 36 | `trial_call_08` | A · Karanveer (upbeat) | Kulfi! Matka kulfi, kamaal di! Aao ji! | A seller calls out when you are near: a male shopkeeper, within 15 m | trial take 1 of 2, not yet heard |
| 37 | `trial_call_09` | E · Yatin (playful) | Dahi, makhan, lassi! Thandi lassi, pind wali! | A seller calls out when you are near: a male shopkeeper, within 15 m | trial take 1 of 2, not yet heard |
| 38 | `trial_call_10` | E · Yatin (playful) | Aaj da akhbaar, paanch rupay! Taaza, taaza! | A seller calls out when you are near: anyone, within 15 m | trial take 1 of 2, not yet heard |
| 39 | `trial_call_11` | A · Karanveer (upbeat) | Chhole kulche, garma-garam! Ik plate da das rupay! | A seller calls out when you are near: a male shopkeeper, within 15 m | trial take 1 of 2, not yet heard |
| 40 | `trial_call_12` | S · Saurav (Punjabi shopkeeper) | Pakode, pakode! Garam pakode, khatte chutney naal! | A seller calls out when you are near: a male shopkeeper, within 15 m | trial take 1 of 2, not yet heard |
| 41 | `trial_police_01` | D · Ajay (deep, calm) | Gaddi side te laa! Licence te kaagaz dikha! | A police jeep or bike passes on patrol: the jeep or a bike rider, within 25 m | trial take 1 of 2, not yet heard |
| 42 | `trial_police_02` | D · Ajay (deep, calm) | Oye, gaddi ikk pase kar, rasta chhad! | Constables start chasing you: a constable or havaldar, within 20 m | trial take 1 of 2, not yet heard |
| 43 | `trial_police_03` | D · Ajay (deep, calm) | Challo bhai, kaagaz poore nahi, chai-paani karo! | Police catch you (chai-paani): a constable or havaldar, within 8 m | trial take 1 of 2, not yet heard |
| 44 | `trial_police_04` | D · Ajay (deep, calm) | Gaddi rok ke, naam te pata daso! Hun bhajna nahi! | Constables start chasing you: a constable or havaldar, within 20 m | trial take 1 of 2, not yet heard |
| 45 | `trial_police_05` | D · Ajay (deep, calm) | Sarkar di gaddi! Side te ho jao, sunda nahi?! | The police jeep's loudspeaker, chasing you: the jeep loudspeaker, within 30 m | trial take 1 of 2, not yet heard |
| 46 | `trial_police_06` | D · Ajay (deep, calm) | Heroagiri nahi chalegi yahan! Ruk ja! | Constables start chasing you: a constable or havaldar, within 20 m | trial take 1 of 2, not yet heard |
| 47 | `trial_fight_01` | F · Harjot (loud) | Tu mere naal gall na kar, main jaanda haan tenu! | Two men start a street quarrel: an adult man, within 15 m | trial take 1 of 2, not yet heard |
| 48 | `trial_fight_02` | E · Yatin (playful) | Chal aaja, dekh lainde haan ik vaari! | Someone squares up to fight you: a young man, within 12 m | trial take 1 of 2, not yet heard |
| 49 | `trial_fight_03` | T · Ritu Rathore (aunty) | Bas kar ji, saare mohalle da tamasha na banaao! | A bystander comes to watch a quarrel: an adult woman, within 14 m | trial take 1 of 2, not yet heard |
| 50 | `trial_fight_04` | G · Sufi (elder) | Oye, rehan de, ghar jaake gall karo! | A bystander comes to watch a quarrel: an old man or woman, within 14 m | trial take 1 of 2, not yet heard |

---

## Two separate reasons a clip sounds wrong

**1. The nine renamed takes are now verified.** `clip_1`–`clip_9` were
renamed in `6cec2e2` without a record of their words; they have since been
matched by waveform to the original takes (whose prompts are known), and every
name was right. The text is filled in above. One mismatch of *use* remains:
`safari_kanjar` says "Auto palat ditta!" but plays after you hit a Safari.

**2. The voice and the speech bubble were chosen independently (fixed in `249a03a`).** This was a code fault, not an asset one. A punch, a quarrel, an auto call or a police shout could show one line and play another. Now a take that plays shows its own words: over the speaker's head for residents and for the player, in the toast for an auto passenger, and over the cop for the police naka's jeep. A literal line shows only when no take plays, and then with a generic mumble, not a recording. Still open: vehicle loudspeakers with no words on screen (a patrol jeep at a crash, a police bribe with no officer on foot). Those are audio only, so they have no subtitle.


---

## Session 14: 50 lines for the new systems (`v2_*`)

Generated with ElevenLabs (eleven_v4, one take each, voice letters as above) for the doorbell, power cuts, the
level crossing, the petrol pump, the bank and post counters, junction signals and friends. Each one is in
`tools/voice_map.py` and reaches the game only through the voice map. A man's recording is never said by a
woman and the other way round. `?voicelog` shows why each one played or stayed silent.

Note on `v2_meet_01` ("tu Gurnam da munda nahi?"): off, because Gurnam is the mechanic, not the hero's father.
It is kept for a later line that names the right relative. `v2_meet_03` is played as overheard women's chat.

| Clip | Voice | Says | Where it plays | Status |
|---|---|---|---|---|
| `v2_bell_01` | T · Ritu Rathore (aunty) | Kaun ae, ji? Ki gal ae? | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_bell_02` | C · Navjot (cheerful) | Haanji, ki chahida? Ruko, aa rahi haan! | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_bell_03` | T · Ritu Rathore (aunty) | Sadde ghar kuj nahi chahida, ji. Shukriya! | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_bell_04` | A · Karanveer (upbeat Malwai man) | Haanji paaji, ki hukam ae? | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_bell_05` | S · Saurav (shopkeeper man) | Kiss nu milna ae, puttar? Andar aa ja! | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_bell_06` | G · Sufi (wise old man) | Oye kaun ae? Zara ruk, buddhe nu uthan de! | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_bell_07` | G · Sufi (wise old man) | Aa gaya puttar? Waheguru, bahut din baad! | You ring a bell of a family that knows yours | in the game |
| `v2_bell_08` | B · Rajwinder (firm Malwai) | Hai, galat ghar aa gaye ho shayad, paaji. | You ring a stranger's bell; whoever answers at the gate | in the game |
| `v2_gate_01` | A · Karanveer (upbeat Malwai man) | Oye, tu aa gaya! Andar aa, chah pee ke jaayi! | You ring a bell of a family that knows yours | in the game |
| `v2_gate_02` | G · Sufi (wise old man) | Haye puttar, bahut vadhia kita jo aa gaya! Mummy ghar ae. | You ring a bell of a family that knows yours | in the game |
| `v2_gate_03` | T · Ritu Rathore (aunty) | Sat Sri Akal ji! Aaj bahut dina baad chakkar laaya ae! | You ring a bell of a family that knows yours | in the game |
| `v2_gate_04` | C · Navjot (cheerful) | Aaja aaja, gate khula ae! Pehchaan liya si tenu! | You ring a bell of a family that knows yours | in the game |
| `v2_night_01` | G · Sufi (wise old man) | Eni raat nu kaun ae? Subah aana, puttar! | Bell rung at night: a voice from a window | in the game |
| `v2_night_02` | T · Ritu Rathore (aunty) | Raat bahut ho gayi, kal aao ji! | Bell rung at night: a voice from a window | in the game |
| `v2_night_03` | F · Harjot (loud man) | Oye! Sab sau gaye ne, subah gal karange! | Bell rung at night: a voice from a window | in the game |
| `v2_siesta_01` | B · Rajwinder (firm Malwai) | Oh ho, dupehar nu sau rahe haan! Baad vich aana. | Bell rung in the afternoon rest hour: a voice from a window | in the game |
| `v2_siesta_02` | T · Ritu Rathore (aunty) | Hai rabba, ajj vi araam nahi! Kaun ae? | Bell rung in the afternoon rest hour: a voice from a window | in the game |
| `v2_cut_01` | C · Navjot (cheerful) | Hai rabba, bijli phir gayi! Inverter laga lo! | The light goes; a neighbour within 20 m grumbles | in the game |
| `v2_cut_02` | A · Karanveer (upbeat Malwai man) | PSPCL walon ne phir kamaal kar ditta! | The light goes; a neighbour within 20 m grumbles | in the game |
| `v2_cut_03` | F · Harjot (loud man) | Roz roz light cut, hun taan hadd ho gayi! | The light goes; a neighbour within 20 m grumbles | in the game |
| `v2_cut_04` | T · Ritu Rathore (aunty) | Mobile da charge vi nahi hoya si, haaye! | The light goes; a neighbour within 20 m grumbles | in the game |
| `v2_cut_05` | G · Sufi (wise old man) | Saade vele taan lalten hundi si, koi fikar nahi! | The light goes; a neighbour within 20 m grumbles | in the game |
| `v2_back_01` | E · Yatin (playful young man) | Aa gayi bijli! Shukar ae Waheguru da! | The light returns; a neighbour cheers | in the game |
| `v2_back_02` | C · Navjot (cheerful) | Light aa gayi! Chalo, tv lagao! | The light returns; a neighbour cheers | in the game |
| `v2_rail_01` | F · Harjot (loud man) | Phatak band ho gaya! Hun das minute! | The level-crossing gates close; someone near the crossing complains | in the game |
| `v2_rail_02` | A · Karanveer (upbeat Malwai man) | Train aa rahi ae, ruko ji, ruko! | The level-crossing gates close; someone near the crossing complains | in the game |
| `v2_rail_03` | T · Ritu Rathore (aunty) | Eh phatak taan roz hi band rehnda ae! | The level-crossing gates close; someone near the crossing complains | in the game |
| `v2_rail_04` | G · Sufi (wise old man) | Saade vele railway line te koi gaddi nahi aundi si. | The level-crossing gates close; someone near the crossing complains | in the game |
| `v2_pump_01` | A · Karanveer (upbeat Malwai man) | Full kar ditta, paaji! Safar mubarak! | The tank is full (Lakhwinder) | in the game |
| `v2_pump_02` | S · Saurav (shopkeeper man) | Petrol, diesel, hawa; sab kujh milda ethe! | You pull up at the petrol pump (Lakhwinder) | in the game |
| `v2_pump_03` | F · Harjot (loud man) | Meter dekh lo ji, zero ton shuru kitta si! | The tank is full (Lakhwinder) | in the game |
| `v2_fuel_p1` | P · Deepak (player, male) | Oye! Tank khaali ho gaya, hun dhakka lagauna painda! | Your tank runs dry (your own voice) | in the game |
| `v2_fuel_p2` | P · Deepak (player, male) | Hai rabba, petrol khatam! Pump kithe ae? | Your tank runs dry (your own voice) | in the game |
| `v2_fuel_q1` | Q · Paaro (player, female) | Hai rabba, tank khaali! Hun ki karaan? | Your tank runs dry (your own voice) | in the game |
| `v2_fuel_q2` | Q · Paaro (player, female) | Oho, petrol khatam! Koi dhakka laga do! | Your tank runs dry (your own voice) | in the game |
| `v2_bank_01` | S · Saurav (shopkeeper man) | Aao ji, Panj Aab Bank vich swagat ae. Ki seva karaan? | You step up to the bank counter (Anand sahib) | in the game |
| `v2_bank_02` | S · Saurav (shopkeeper man) | Paise bank vich rakho, jeb vich nahi, puttar. | You finish at the bank counter (Anand sahib) | in the game |
| `v2_post_01` | G · Sufi (wise old man) | Aao ji, ajj di dak aayi ae tuhadi. | You collect the family's post (Dhillon ji) | in the game |
| `v2_post_02` | G · Sufi (wise old man) | Chitthi aayi ae, Canada ton! Eh lo ji. | You collect the family's post (Dhillon ji) | in the game |
| `v2_signal_01` | F · Harjot (loud man) | Oye lal batti si! Akhan band ne ki?! | You cross a junction on red; a bystander shouts | in the game |
| `v2_signal_02` | E · Yatin (playful young man) | Veere, signal tod ke kitthe chaleya? | You cross a junction on red; a bystander shouts | in the game |
| `v2_signal_03` | B · Rajwinder (firm Malwai) | Hai, hun taan thok dinda ae! Dhyaan naal! | You cross a junction on red; a bystander shouts | in the game |
| `v2_friend_01` | E · Yatin (playful young man) | Oye sher! Kidhar gayab ho gaya si, yaar? | A friend answers your Sat Sri Akal (half the time) | in the game |
| `v2_friend_02` | F · Harjot (loud man) | Chal, chai pee lainde haan, sab kujh daseyo! | A friend answers your Sat Sri Akal (half the time) | in the game |
| `v2_friend_03` | A · Karanveer (upbeat Malwai man) | Yaar, tu taan hun bada banda ban gaya ae! | A friend answers your Sat Sri Akal (half the time) | in the game |
| `v2_friend_04` | B · Rajwinder (firm Malwai) | Tere bina taan gali sooni lagdi si, veere! | A friend answers your Sat Sri Akal (half the time) | in the game |
| `v2_meet_01` | S · Saurav (shopkeeper man) | Ae ki, tu Gurnam da munda nahi? Kinna vadda ho gaya! | They answer your greeting | off: see note |
| `v2_meet_02` | D · Ajay (deep, police voice) | Nava gaddi? Waah, chhakka maar ditta tu taan! | You get off a vehicle; a man near you admires it | in the game |
| `v2_meet_03` | Q · Paaro (player, female) | Bhenji, tuhada puttar taan bade kamaal da ae! | Two women chat (overheard) | in the game |
| `v2_meet_04` | P · Deepak (player, male) | Sat Sri Akal, ji! Kaim ho? Pind vich sab changa? | Your own greeting (male voice) | in the game |

## v3 street lines: two batches (`v3_*`)

34 takes, one each, ElevenLabs eleven_v3, voice letters as above. Every row is in `tools/voice_map.py`. A line plays
only from a moment the game emits with no list of clips of its own, so each row was checked against the code that
emits its moment:

- **Chat** (`chat`): two people of the same sex talking as you come near on foot or in a slow vehicle. The pair's own
  lines come first (`gossip_a`/`gossip_b`, `chat_match`/`chat_petrol`); while those are cooling down, a general chat
  line fills in (`src/crowds/Barkers.ts`). Mixed pairs keep quiet.
- **Talk** (`talk`) is only for named dialogue. A passer-by answers a greeting instead (`meet-reply`): you say Sat
  Sri Akal, they answer.
- **Moments** (`bumped`, `ride-jolt`, `quarrel-blows`, `colony-fight-blows`, `safari-hit`) come from the game's own
  events as they happen.

`tests/ludhiana.test.ts` checks the pair order, and that each line above finds the speaker it names.

| Clip | Voice | Says | Where it plays | Status |
|---|---|---|---|---|
| `v3_chaupal_01` | G · Sufi (elder) | Pehlan shaam nu chaupal te raunak hundi si, hun koi nahi aunda. | Two old men chatting in the street (chaupal) | in the game |
| `v3_chaupal_02` | G · Sufi (elder) | Sun puttar, gallan karan naal pet nahi bharda! | Two old men chatting in the street (chaupal) | in the game |
| `v3_chaupal_03` | G · Sufi (elder) | Charpai te dhoop sekhde haan, hun chah pila de. | Two old men chatting in the street (chaupal) | in the game |
| `v3_chaupal_04` | G · Sufi (elder) | Saadi umar vich taan bailgaddi si, eh gaddiyan kithon aa gayiyan! | Two old men chatting in the street (chaupal) | in the game |
| `v3_chaupal_05` | G · Sufi (elder) | Mainu kujh na pucho, main taan sab pehlan hi jaanda haan! | Two old men chatting in the street (chaupal) | in the game |
| `v3_gossip_01` | T · Ritu Rathore (aunty) | Ni, Sharma ji da munda vi Canada jaa reha ae, sach! | Two women gossiping in the street | in the game |
| `v3_gossip_02` | T · Ritu Rathore (aunty) | Haaye, ohde ghar Mercedes aayi ae, dekhi ni? | Two women gossiping in the street | in the game |
| `v3_gossip_03` | T · Ritu Rathore (aunty) | Bijli gayi, tv vi band, hun gallan hi karo ni! | Two women gossiping in the street | in the game |
| `v3_gossip_05` | T · Ritu Rathore (aunty) | Mere vale ne aaj sabzi mehngi dasi, sach ni! | Two women gossiping in the street | in the game |
| `v3_pass_e_01` | G · Sufi (elder) | Oye puttar, gaddi dheere chala, bachche ne gali vich! | Two old men chatting, one complaining about a car | in the game |
| `v3_pass_e_02` | G · Sufi (elder) | Eh dhuan kadon ghatt hoega, kaun sunda ae! | Two old men chatting, one complaining about smoke | in the game |
| `v3_pass_e_03` | G · Sufi (elder) | Chal chal, raah chhad, budhe nu langhan de! | Two old men chatting in the street | in the game |
| `v3_pass_w_01` | C · Navjot (cheerful) | Hai rabba, eh dhool, kapde saare mitti ho gaye! | Two women chatting, one complaining about the dust | in the game |
| `v3_pass_w_03` | C · Navjot (cheerful) | Oye, eh rickshaw wala vi raah nahi dekhda! | Two women chatting, one complaining about a rickshaw | in the game |
| `v3_talk_e_01` | G · Sufi (elder) | Puttar, tera naam kiddan? Ikk vaar dass, yaad rakhangey! | You greet an old man: his reply | in the game |
| `v3_talk_e_02` | G · Sufi (elder) | Dhan waheguru, tu ajj ghar aaya te chah pee ke jaa! | You greet an old man: his reply | in the game |
| `v3_bump_01` | F · Harjot (loud man) | Oye! Andha ae ke? Dikhda nahi tainu? | You bump an adult man | in the game |
| `v3_bump_02` | T · Ritu Rathore (aunty) | Hai rabba, mari ja rahi si! Dhyaan naal chala! | You bump an adult woman | in the game |
| `v3_bump_03` | G · Sufi (elder) | Puttar, budhe nu takkar maar ditti! Sharam kar! | You bump an old man or woman | in the game |
| `v3_bump_04` | E · Yatin (playful young man) | Bhai, bike mod ke chala, sadak sadi vi ae! | You bump a young man | in the game |
| `v3_jolt_01` | C · Navjot (cheerful) | Hai rabba, ki khadda ae! Haddi-pasli hil gayi! | Your auto passenger gets a bad jolt | in the game |
| `v3_jolt_02` | A · Karanveer (upbeat Malwai man) | Auto wale, ik vaar dheere chala, main utar jaana! | Your auto passenger gets a bad jolt | in the game |
| `v3_jolt_03` | E · Yatin (playful young man) | Oye, khadde vich gaddi ghusa ke kithe chali?! | Your auto passenger gets a bad jolt | in the game |
| `v3_qblow_01` | F · Harjot (loud man) | Oye hatt ja! Hun haath chal gaye ne! | A men's street quarrel comes to blows | in the game |
| `v3_qblow_02` | E · Yatin (playful young man) | Lo ji, hun taan maar-kutt shuru ho gayi! | A men's street quarrel comes to blows | in the game |
| `v3_qblow_03` | A · Karanveer (upbeat Malwai man) | Chhadd ke, bhai! Mohalle wale aa gaye ne! | A men's street quarrel comes to blows | in the game |
| `v3_cfight_01` | T · Ritu Rathore (aunty) | Bas kar ji, mohalle da naam kharab na kar! | A colony fight comes to blows: an adult woman | in the game |
| `v3_cfight_02` | G · Sufi (elder) | Puttar, ghar jaa ke gall kar, gali vich maar-kutt na! | A colony fight comes to blows: an old man or woman | in the game |
| `v3_safari_01` | F · Harjot (loud man) | Oye! Meri safari nu thok ditta! Hun paisa de! | You hit a Safari: its driver | in the game |
| `v3_safari_02` | E · Yatin (playful young man) | Kanjar da put, gaddi di kadar nahi? Maafi mang! | You hit a Safari: its driver | in the game |
| `v3_talk_g_01` | G · Sufi (elder) | Ki haal ae puttar? Dass, sab khair ae? | You greet an old man: his reply | in the game |
| `v3_talk_g_02` | C · Navjot (cheerful) | Bhenji, ajj bazaar vich bhaddi ae, kiddan ho? | You greet an adult woman: her reply | in the game |
| `v3_talk_g_03` | A · Karanveer (upbeat Malwai man) | Oye veere, kiddan? Chai peeni ae taan dasso! | You greet an adult man: his reply | in the game |
| `v3_talk_g_04` | G · Sufi (elder) | Ki hal chal ae, pind vich sab changa? | You greet an old man: his reply | in the game |

The trial chat rows 26 to 28 (`trial_chat_01` to `03`) can now be switched on, since a pair falls back to the general
chat lines. They stay off until someone has heard them.
