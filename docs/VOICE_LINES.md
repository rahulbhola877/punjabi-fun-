# Voice clips: who says what, and where it plays

Every file in `public/audio/voice/`. Fill in or correct the **Says** column and
the game can be re-pointed to match — most of it is a one-line change.

Confidence column:
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
| `bhola_hello` | **Bhola** — owner, Bhole Da Dhaba, Ranggarh | "Sat Sri Akal ji! A new face…" / "Hot food waits for no one!" | First greeting, and when he hands you a delivery | script (2 lines share it) |
| `bhola_chaura` | **Bhola** | "Oye! Chaure Bazaar jaana ae, mobile lain layi! Mera phone thalle digg ke tutt gaya — screen de sau tukde!" | Start of the first mission | script |
| `bhola_thanks` | **Bhola** | "Wah mere sher! Hun main vi status paavanga!" | When you bring his phone back | script |
| `mobile_shop` | **Mobile-wala** — Hello Mobile Zone, Chaura Bazaar | "Aao ji, aao! Naya model, kamaal da camera! Bhole da phone?…" | Buying the phone | script |
| `gurnam_finally` | **Gurnam** — Gurnam Motor Works | "Finally! …" | First time you talk to him | script |
| `pammi_kinnow` | **Pammi** — fruit seller | "Kinnow from Abohar, sweet as gur!" | Her greeting, and her delivery line | script |
| `masterji_naap` | **Masterji** — tailor | "Naap do vaari lao, kainchi ik vaari!" | Passing his shop | script |
| `sohal_race` | **Sohal** — Sohal Cycle Store | "Ik din tainu gate tak race vich harauna ae!" | Passing his shop | script |
| `mrskaur_chah` | **Mrs. Kaur** — courtyard house | "Aa ja puttar, chah pee ke ja!" | Passing her house | script |
| `gill_vele` | **Gill uncle** — lane house, elder | "Saade vele gali kachi si, par dil pakke si!" | Passing his house | script |
| `chemist_paani` | **Dr. Sehgal** — Sehat Chemist | "Paani peeo ji, garmi bahut ae." | Passing the chemist | script |
| `ustad_swagat` | **Ustad Kartar Pehlwan** — the akhada | *(welcome to the dangal — wording unrecorded)* | When you pay ₹20 and the dangal starts | context |

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
| `call_sabzi` | sabzi-wala | "Aaloo lo, pyaaz lo — taaze taaze!" | Vegetable carts, both mandis | script |
| `call_fruit` | fruit-wala | *(one of the fruit cries)* | Fruit carts | context |
| `call_doodh` | doodh-wala | "Doodh le lo ji, doodh!" | Ghanta Ghar chowk, Ludhiana | script |
| `call_chaat` | chaat-wala | *(gol gappe / tikki cry)* | Chaat carts | context |
| `call_kabadi` | kabadi-wala | *(scrap-buyer's call)* | Doing rounds in the mandi | context |
| `call_auto_gill` | auto-wala | "Gill, Gill, Gill! Gill Road, Gill! Aa jao, baith jao!" (young man) | Auto stands | **verified** |
| `call_auto_ludhiana` | auto-wala | "Ludhiana, Ludhiana, Ludhiana! Bas do sawari hor, chalo chalo!" (loud man) | Ludhiana adda | **verified** |
| `call_bus` | bus conductor | "Jalandhar, Phagwara, Ludhiana! Chhetti chadho, bus chalan lagi ae!" (gruff man) | Bus addas | **verified** |

## Police

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `police_rukk` | constable | *("Rukk ja!" — wording unrecorded)* | First constable to come after you | context |
| `police_chai` | **Havaldar Balwant** | *(the chai-paani shakedown)* | The bribe dialogue | context |
| `police_gaddi_rok` | police jeep, on the radio | "Gaddi rok! Side te laa! Oye, sunda nahi?!" (on a loudspeaker, police voice) | When the jeep joins a chase | **verified** |

## Fights, quarrels and road rage

| Clip | Character | Says | Where it plays | Confidence |
|---|---|---|---|---|
| `panga_bhen` | lafanga / anyone you hit | "Teri bhen di! Mere naal panga?" | A gang picking a fight; hit reactions | script (made this session) |
| `khad_dasda` | anyone you hit | "Khad, tainu dasda haan!" | Blaming both sides of a quarrel; road rage; hit reactions | script (made this session) |
| `ki_ho_gaya` | nosy bystander | "Ki ho gaya ji? Ki ho gaya?" | First onlooker to a quarrel | script (made this session) |
| `rage_andha` | driver you hit | *("Oye! Andha ae?!" — wording unrecorded)* | Road-rage driver | context |
| `safari_kanjar` | **Safari driver** | "Oye kanjar da puttar! Auto palat ditta! Hun paise nahi dene tere!" — written for the passenger of a tipped-over auto, so "auto palat ditta" does not fit a Safari bump | After you hit the Safari | **verified** |
| `quarrel_kaun` | man in a street quarrel | *(opening line of a men's quarrel)* | First line of a non-aunty quarrel | context |
| `aunty_fight_1` | **aunty** | **unknown** — opening line of an aunty quarrel | First line of an aunty quarrel | **guessed** |
| `aunty_fight_2` | **aunty** | **unknown** — the point it turns into a scuffle | When an aunty quarrel comes to blows | **guessed** |
| `fuddu` | anyone | "Oye, fuddu ho gaya ae ki? Akkal ghaah charan gayi ae!" (mocking young man) | Hit reactions | **verified** |
| `lafanga_chai` | lafanga | *("Saanu chai pila!" — wording unrecorded)* | A lafanga taunting you | context |
| `bump_oye` | woman you walked into | *("Oye hoye!" — wording unrecorded)* | Barging into an adult woman | context |
| `sawari_lak` | your auto passenger | "Hai rabba! Mera lakk tutt gaya! Kithe dhyaan ae tera, fuddu?!" (woman) | Rough ride with a fare aboard | **verified** |

---

## Two separate reasons a clip sounds wrong

**1. The nine renamed takes are now verified.** `clip_1`–`clip_9` were
renamed in `6cec2e2` without a record of their words; they have since been
matched by waveform to the original takes (whose prompts are known), and every
name was right. The text is filled in above. One mismatch of *use* remains:
`safari_kanjar` says "Auto palat ditta!" but plays after you hit a Safari.

**2. The voice and the speech bubble are chosen independently.** This is a
code fault, not an asset one, and it is most of what "random order" sounds
like. When you punch someone the game picks a bubble from twelve possible
lines and *separately* picks a recording from a pool of three or four, so the
voice almost never matches the words on screen. The same split happens in
quarrels (one clip against five possible topics), in auto touting (two clips
against seven calls) and in police shouts.

The fix is to make the line and its recording one unit: pick the line, play
the clip that belongs to *that* line, and stay silent when the line has no
recording. That needs the **Says** column above filled in first — which is
why it is worth doing.
