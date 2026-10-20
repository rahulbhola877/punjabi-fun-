"""
Voice map: which clip may be said by whom, when, and from how far away.

  python3 tools/voice_map.py make     -> writes docs/voice-map.xlsx (fill it in) and src/audio/voiceMap.json (defaults)
  python3 tools/voice_map.py import F -> reads a filled-in workbook F and rewrites src/audio/voiceMap.json

The game reads only src/audio/voiceMap.json.
"""
import json, sys
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

VOICES = {
    "A": "jolly man (Bhola's voice)", "B": "dry woman (Gurnam's voice)", "C": "cheerful woman (Pammi's voice)",
    "D": "gruff man (police voice)", "E": "young man (lafanga voice)", "F": "loud man (angry neighbour voice)",
    "G": "old man (Ustad's voice)", "?": "made by the other session", "S": "Punjabi shopkeeper man (Saurav)", "P": "the player, male (Deepak)", "Q": "the player, female (Paaro)", "R": "the player's shout, desi Punjabi (Pind Waali)",
}

# Who codes: named characters (by id) and groups.
WHO = [
    ("bhola", "Bhola Singh — Bhole Da Dhaba, Ranggarh bazaar"), ("cook", "Kaku the cook — dhaba kitchen"),
    ("gurnam", "Gurnam Kaur — mechanic, Gurnam Motor Works"), ("pammi", "Pammi — fruit & sabzi stall"),
    ("masterji", "Masterji — tailor"), ("sohal", "Sohal — Sohal Cycle Store"), ("mrsKaur", "Mrs. Kaur — elderly neighbour, courtyard"),
    ("gill", "Gill uncle — lane house"), ("chemist", "Dr. Sehgal — Sehat Chemist"), ("mobileWala", "Pinka — Hello Mobile Zone, Chaura Bazaar"),
    ("ustad", "Ustad Kartar Pehlwan — Kotli akhada"), ("conductor", "Conductor Bittu — bus adda"), ("munshi", "Munshi Ji — anaj mandi"),
    ("balwant", "Havaldar Balwant — police chowki"), ("ticketwala", "Ticket-wala Raju — Raj Talkies"), ("sukhi", "Sukhi Bhaji — trucker at Sher-e-Punjab dhaba"),
    ("sherOwner", "Sher Singh — Sher-e-Punjab dhaba"), ("sarpanch", "Sarpanch Hardev Singh — Pind Kotli"), ("jarnail", "Jarnail Singh — dera"),
    ("pumpwala", "Pump attendant — petrol pump"),
    ("any-man", "any adult man"), ("young-man", "a young man"), ("any-woman", "any adult woman"), ("any-elder", "any old man or woman"),
    ("shopkeeper-man", "a male shopkeeper"), ("shopkeeper-woman", "a female shopkeeper"), ("aunty", "an aunty (in an aunty quarrel)"),
    ("police", "any constable / havaldar"), ("police-jeep", "the police jeep's loudspeaker"), ("police-bike", "a police motorbike rider"), ("player", "you (the player character)"), ("lafanga", "a lafanga (street tough)"),
    ("auto-wala", "an auto-wala at a stand"), ("bus-conductor", "a bus conductor"), ("sabzi-wala", "sabzi seller"), ("fruit-wala", "fruit seller"),
    ("chaat-wala", "gol-gappe / chaat seller"), ("doodh-wala", "milkman"), ("kabadi-wala", "scrap buyer"),
    ("driver", "a driver you bumped"), ("passenger", "an auto passenger"), ("onlooker", "a bystander watching a fight"), ("anyone", "anyone at all"),
]
WHEN = [
    ("talk", "you talk to them (dialogue box opens)"), ("mission-start", "first mission: Bhola sends you to Chaura Bazaar"),
    ("mission-shop", "first mission: buying the phone"), ("mission-end", "first mission: giving Bhola the phone"),
    ("pass-by", "you walk past them (within the distance)"), ("chat", "you pass two people chatting"), ("street-call", "a seller/tout calls out when you are near"),
    ("bumped", "you walk or drive into them"), ("hit", "you punch or slap them"), ("police-chase", "constables start chasing you"),
    ("police-bribe", "police catch you (chai-paani)"), ("police-jeep", "the police jeep chases you"), ("lafanga-taunt", "a lafanga taunts you"),
    ("gang-fight", "a gang picks a fight with you"), ("quarrel-start", "two men start a street quarrel"), ("quarrel-blows", "a men's quarrel comes to blows"),
    ("aunty-quarrel-start", "two aunties start a quarrel"), ("aunty-quarrel-blows", "an aunty quarrel comes to blows"),
    ("quarrel-onlooker", "a bystander comes to watch a quarrel"), ("blame-both", "you tell both sides they are wrong"),
    ("road-rage", "a driver gets out after you bump his car"), ("safari-hit", "you hit the Safari"), ("auto-tipped", "an overloaded auto tips over"),
    ("ride-jolt", "your auto passenger gets a bad jolt"), ("dangal-start", "the akhada dangal starts"),
    ("fight-start", "someone squares up to fight you"), ("fight-onlooker", "a bystander reacts to your fight"),
    ("meet", "you stop next to someone (your greeting)"), ("meet-reply", "they answer your greeting"),
    ("colony-fight-start", "a group fight starts in a residential colony"), ("colony-fight-blows", "the colony fight comes to blows"),
    ("crash-drivers", "two vehicles crash and the drivers get out"), ("police-patrol", "a police jeep/bike passes on patrol"), ("snake-hit", "you knock a zig-zag snake biker off his bike"),
]

# clip, words, voice, who (codes), when (codes), max distance m, min gap s, on
CLIPS = [
    ("bhola_hello", "Oye! Sat Sri Akal ji! Hot food waits for no one — go, go, go!", "A", "bhola", "talk", 12, 60, "Yes"),
    ("bhola_chaura", "Oye! Chaure Bazaar jaana ae, mobile lain layi! Mera phone thalle digg ke tutt gaya. Scooter chuk te nikal!", "A", "bhola", "mission-start", 15, 0, "Yes"),
    ("bhola_thanks", "Wah mere sher! Hun main vi status paavanga! Eh lai, tera inaam.", "A", "bhola", "mission-end", 15, 0, "Yes"),
    ("mobile_shop", "Aao ji, aao! Naya model, kamaal da camera! Bhole da phone? Eh lo, pack kar ditta!", "E", "mobileWala", "mission-shop", 15, 0, "Yes"),
    ("gurnam_finally", "Finally. Bhola's dal makhani. The only fuel I trust.", "B", "gurnam", "talk", 12, 120, "No"),
    ("pammi_kinnow", "Oho! Kinnow from Abohar, sweet as gur! And the gossip comes free!", "C", "pammi", "pass-by, talk", 8, 120, "Yes"),
    ("masterji_naap", "Naap do vaari lao, kainchi ik vaari! Tera kurta vadda ae, puttar.", "G", "masterji", "pass-by", 6, 120, "Yes"),
    ("sohal_race", "Ik din tainu gate tak race vich harauna ae, dekh layi!", "E", "sohal", "pass-by", 6, 120, "Yes"),
    ("mrskaur_chah", "Aa ja puttar, chah pee ke ja! Bina khaade kithe challeya?", "B", "mrsKaur", "pass-by", 6, 120, "Yes"),
    ("gill_vele", "Saade vele gali kachi si, par dil pakke si!", "G", "gill", "pass-by", 6, 120, "Yes"),
    ("chemist_paani", "Paani peeo ji, garmi bahut ae. Te mirchan ghatt khaao!", "F", "chemist", "pass-by", 6, 120, "Yes"),
    ("ustad_swagat", "Akhade vich swagat ae, pehlwan! Dekhde haan kinna dum ae!", "G", "ustad", "dangal-start", 15, 0, "Yes"),
    ("greet_m1", "Sat Sri Akal ji! Ki haal ne?", "F", "any-man", "meet-reply", 6, 20, "Yes"),
    ("greet_young", "Oye, ki haal aa bai? Chadhdi kala!", "E", "young-man", "meet-reply", 6, 20, "Yes"),
    ("greet_old", "Jeonde raho puttar! Sab sukh-saand?", "G", "any-elder", "meet-reply", 6, 20, "Yes"),
    ("greet_f1", "Sat Sri Akal! Aaj badi jaldi vich ae?", "C", "any-woman", "meet-reply", 6, 20, "Yes"),
    ("greet_f2", "Haanji, ki gall ae? Theek-thaak?", "B", "any-woman", "meet-reply", 6, 20, "Yes"),
    ("shop_aao", "Aao bhenji, aao! Ajj sab kujh sasta ae!", "C", "shopkeeper-woman", "pass-by", 6, 40, "Yes"),
    ("shop_aao_m", "Aao ji, aao! Ki chahida ae? Sab kujh milda ethe!", "S", "shopkeeper-man", "pass-by", 6, 40, "Yes"),
    ("player_ssa_m", "Sat Sri Akal ji! Tusi theek ho?", "P", "player", "meet", 6, 8, "Yes"),
    ("player_sapp", "Oye! Aaya maza, sapp! Hahaha!", "R", "player", "snake-hit", 30, 90, "Yes"),
    ("player_ssa_f", "Sat Sri Akal ji! Tusi theek ho?", "Q", "player-f", "meet", 6, 8, "Yes"),
    ("gossip_a", "Pata ae? Gillan di nooh Canada chali gayi, te munda ethe hi reh gaya!", "C", "any-woman", "chat", 10, 60, "Yes"),
    ("gossip_b", "Haaye! Main taan pehlan hi kehndi si!", "B", "any-woman", "chat", 10, 60, "Yes"),
    ("chat_match", "Kal da match vekhya? Saadi team ne phir dil tod ditta!", "F", "any-man", "chat", 10, 60, "Yes"),
    ("chat_petrol", "Petrol de bhaa vekh! Hun taan saikal hi changi ae.", "G", "any-man, any-elder", "chat", 10, 60, "Yes"),
    ("call_sabzi", "Aaloo lai lo, pyaaz lai lo! Taaze tamatar, sasti bhindi!", "A", "sabzi-wala", "street-call", 18, 40, "Yes"),
    ("call_fruit", "Kele lai lo, kinnow, mitthe ambh! Chakh ke dekho ji!", "G", "fruit-wala", "street-call", 18, 40, "Yes"),
    ("call_chaat", "Gol gappe! Teekhe vi, mitthe vi! Aao ji, aao!", "A", "chaat-wala", "street-call", 18, 40, "Yes"),
    ("call_doodh", "Doodh waala aa gaya! Taaza doodh, bhenji!", "A", "doodh-wala", "street-call", 20, 40, "Yes"),
    ("call_kabadi", "Kabaadi waala! Purana loha, akhbaar, botlan — vech lo!", "D", "kabadi-wala", "street-call", 20, 40, "Yes"),
    ("call_auto_gill", "Gill, Gill, Gill! Gill Road, Gill! Aa jao, baith jao!", "E", "auto-wala", "street-call", 20, 40, "Yes"),
    ("call_auto_ludhiana", "Ludhiana, Ludhiana, Ludhiana! Bas do sawari hor, chalo chalo!", "F", "auto-wala", "street-call", 20, 40, "Yes"),
    ("call_bus", "Jalandhar, Phagwara, Ludhiana! Chhetti chadho, bus chalan lagi ae!", "D", "bus-conductor, conductor", "street-call", 22, 40, "Yes"),
    ("police_rukk", "Oye! Rukk ja! Rukk ja, hero!", "D", "police, police-bike", "police-chase, police-patrol", 30, 25, "Yes"),
    ("police_chai", "Dekh puttar, case bada serious ae… chai-paani da intezaam karo, te gal khatam!", "D", "police, balwant", "police-bribe", 15, 0, "Yes"),
    ("police_gaddi_rok", "Gaddi rok! Side te laa! Oye, sunda nahi?!", "D", "police-jeep, police-bike", "police-jeep, police-patrol", 45, 12, "Yes"),
    ("lafanga_chai", "Ki dekh reha ae, hero? Saanu chai pila!", "E", "lafanga", "lafanga-taunt", 10, 30, "Yes"),
    ("panga_bhen", "Teri bhen di! Mere naal panga?", "?", "lafanga, any-man", "gang-fight, hit, fight-start", 10, 8, "Yes"),
    ("khad_dasda", "Khad, tainu dasda haan!", "?", "any-man, driver", "blame-both, road-rage, hit, fight-start", 10, 8, "Yes"),
    ("ki_ho_gaya", "Ki ho gaya ji? Ki ho gaya?", "?", "onlooker", "quarrel-onlooker, fight-onlooker", 12, 10, "Yes"),
    ("quarrel_kaun", "Tu jaanda nahi main kaun haan?!", "F", "any-man", "quarrel-start, colony-fight-start", 15, 30, "Yes"),
    ("rage_andha", "Oye! Andha ae? Meri gaddi da nuksaan kaun bharega?!", "F", "driver", "road-rage, crash-drivers", 15, 20, "Yes"),
    ("aunty_fight_1", "Ni kalmuhiye! Tera kutta roz mere boohe agge gand paunda ae!", "C", "aunty", "aunty-quarrel-start, colony-fight-start", 15, 30, "Yes"),
    ("aunty_fight_2", "Chal ni chudail! Pehlan apne vehre di safai kar, phir gall kari!", "B", "aunty", "aunty-quarrel-blows, colony-fight-blows", 15, 30, "Yes"),
    ("fuddu", "Oye, fuddu ho gaya ae ki? Akkal ghaah charan gayi ae!", "E", "passenger", "auto-tipped", 30, 6, "Yes"),
    ("bump_oye", "Oye hoye! Dekh ke chala, hero! This is a bazaar, not a racetrack!", "B", "passenger", "auto-tipped", 30, 6, "Yes"),
    ("safari_kanjar", "Oye kanjar da puttar! Auto palat ditta! Hun paise nahi dene tere!", "F", "passenger", "auto-tipped", 30, 6, "Yes"),
    ("sawari_lak", "Hai rabba! Mera lakk tutt gaya! Kithe dhyaan ae tera, fuddu?!", "C", "passenger", "auto-tipped", 30, 6, "Yes"),
]

HEAD = ["#", "Clip file", "What it says", "Voice", "Play it? (Yes/No)", "Who says it", "When it plays", "Max distance (m)", "Min gap before repeat (s)", "Your notes"]

def codes(s):
    return [c.strip() for c in str(s or "").replace(";", ",").split(",") if c.strip()]

def is_greet(clip, when):
    """Greetings may repeat on their own short gap; every other clip waits at least 90 s."""
    return bool({"meet", "meet-reply"} & set(when)) or clip.startswith("shop_aao")

def write_json(rows, path="src/audio/voiceMap.json"):
    out = {r[0]: {"on": str(r[7]).strip().lower().startswith("y"), "who": codes(r[3]), "when": codes(r[4]), "maxDist": float(r[5] or 15), "gap": float(r[6] or 0) if is_greet(r[0], codes(r[4])) else max(90.0, float(r[6] or 0)), "greet": is_greet(r[0], codes(r[4])), "say": str(r[1] or ""), "voice": str(r[2] or "?")[:1]} for r in rows}
    with open(path, "w") as f: json.dump(out, f, indent=1, ensure_ascii=False)
    print("wrote", path, len(out), "clips")

def make():
    wb = Workbook()
    ws = wb.active; ws.title = "Voice clips"
    ws.append(HEAD)
    for i, (clip, words, voice, who, when, dist, gap, on) in enumerate(CLIPS, 1):
        ws.append([i, clip, words, f"{voice} — {VOICES[voice]}", on, who, when, dist, gap if is_greet(clip, codes(when)) else max(90, gap), ""])
    widths = [4, 20, 62, 30, 12, 30, 34, 12, 14, 30]
    for i, w in enumerate(widths): ws.column_dimensions[chr(65 + i)].width = w
    hdr = PatternFill("solid", fgColor="E8A33C"); edit = PatternFill("solid", fgColor="FFF6DA")
    for c in ws[1]: c.font = Font(bold=True); c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical="center")
    for row in ws.iter_rows(min_row=2):
        for c in row: c.alignment = Alignment(wrap_text=True, vertical="top")
        for c in row[4:10]: c.fill = edit
    ws.freeze_panes = "C2"
    n = len(CLIPS) + 1
    yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=False); ws.add_data_validation(yn); yn.add(f"E2:E{n}")
    # Who/When accept several codes separated by commas, so the lists are a help, not a lock.
    wv = DataValidation(type="list", formula1=f"Codes!$A$2:$A${len(WHO) + 1}", showErrorMessage=False); ws.add_data_validation(wv); wv.add(f"F2:F{n}")
    tv = DataValidation(type="list", formula1=f"Codes!$C$2:$C${len(WHEN) + 1}", showErrorMessage=False); ws.add_data_validation(tv); tv.add(f"G2:G{n}")
    cs = wb.create_sheet("Codes")
    cs.append(["Who code", "Who it means", "When code", "When it means"])
    for i in range(max(len(WHO), len(WHEN))):
        a = WHO[i] if i < len(WHO) else ("", ""); b = WHEN[i] if i < len(WHEN) else ("", "")
        cs.append([a[0], a[1], b[0], b[1]])
    for c in cs[1]: c.font = Font(bold=True); c.fill = hdr
    for col, w in zip("ABCD", [18, 46, 22, 48]): cs.column_dimensions[col].width = w
    hs = wb.create_sheet("How to fill")
    for line in [
        "Edit only the yellow columns on the 'Voice clips' sheet.",
        "Play it?: No = this clip never plays.",
        "Who says it: one or more codes from the Codes sheet, separated by commas (e.g. 'gill, any-elder').",
        "When it plays: one or more codes from the Codes sheet, separated by commas (e.g. 'pass-by, talk').",
        "Max distance: the clip only plays if that person is within this many metres of you (5-8 for greetings).",
        "Min gap: seconds before the same clip can play again (never less than 90, except greetings).",
        "A clip whose Who does not match the person speaking, or whose When does not match the moment, stays silent.",
        "Named characters (Bhola, Gurnam, Pammi, Masterji, ...) say ONLY clips that list them by name - group codes like any-woman never apply to them.",
        "Afterwards send the file back (or run: python3 tools/voice_map.py import docs/voice-map.xlsx) and the game follows it.",
        "Several clips may share a Who + When; then the game picks one of them without repeating the last.",
        "Voices: several characters share one recorded voice (see the Voice column). Ask for new takes to give someone their own.",
    ]: hs.append([line])
    hs.column_dimensions["A"].width = 120
    wb.save("docs/voice-map.xlsx"); print("wrote docs/voice-map.xlsx")
    write_json([(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]) for c in CLIPS])

def imp(path):
    ws = load_workbook(path, data_only=True)["Voice clips"]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r[1]: continue
        rows.append((r[1], r[2], r[3], r[5], r[6], r[7], r[8], r[4]))
    write_json(rows)

if __name__ == "__main__":
    make() if sys.argv[1:2] == ["make"] else imp(sys.argv[2])
