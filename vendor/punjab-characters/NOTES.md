# Work notes (internal)
## Pending user requests
1. Polish characters further + add NON-SIKH Punjabi characters (Hindu/Muslim/Christian/universal): short-hair men (crop/sidepart/balding),
   head kinds topi/gandhi/pagri (+ 'cap' as police peak cap), facial styles (full/trim/sunnah/stubble/moustache/none),
   extras tilak/sindoor/mangalsutra/cross/kalava/glasses, prop tasbih, dupatta mode 'hijab', clips namaste/salaam/dua,
   OutfitDef.community + facial fields, UI community filter, crowd preset 'mixed', greeting by community.
   Outfit ideas: diwali_kurta, pandit, eid_kurta, imam, pagri_farmer, netaji(gandhi cap), office_casual, street_casual, police_cap,
   church_m, diwali_suit, saree, eid_suit, casual_f, church_f. Polish: shoulder ball smoothing (body.ts ~line 251), finer phulkari stripes (headwear.ts addDupatta).
2. FIX ARMS: abnormal elbow bends + arms passing through body in some motions  DONE (guardArms in animations.ts: swivel search + wrist clamp; audit via tools/audit.py; clip targets fixed)
   Plan: audit all clips (pen/flex/wrist), fix clip defs (e.g. namaste hands too close: tip z .19 -> .26), guardArms() in bakeClips, re-audit, view sheets.
## Tools
 tools/shots.py '<json cfg>' out.png cols  (SCALE env) ; tools/demo_shot.py ; vite dev on :5173 (preview.html harness)
 deliverables: ~/punjab-characters.zip, dist-models/*.glb, docs/*.png, dist/ (static server python http.server :4173)

## STATUS (after 2nd/3rd user requests)
- DONE: arm guard; new head kinds topi/gandhi/pagri; maleHair (crop/sidepart/balding, underCap); facial modes; tilak/sindoor/bindi/mangalsutra/cross/kalava; tasbih prop;
  hijab dupatta; finer phulkari; smooth shoulders (body.ts pts[0]+ball); outfits added (outfits.ts bottom: OUTFITS.push, communityOf, COMMUNITIES, GREETINGS);
  clips namaste/salaam/dua added (animations.ts before '// ---- point').
- TODO: (1) verify female/kids new outfits visually; (2) Character: community + greetClip (use GREETINGS); (3) demo main.ts: community filter chips + greeting by community
  (main.ts ~line 133 bubble for sat_sri_akal, line 160 HOT keys, 171 mb-greet); crowd.ts: favourites for new outfits (~line 82), greeting line ~218, presets incl. 'mixed' Punjab mela;
  (4) re-export GLBs (preview.ts exportGLB), re-render docs/*.png (archetypes, actions, new community sheet), update README, vite build, zip, final answer.
- Test cfg files in /tmp (a1..a4, n1.json, n1b.json) are throwaway. Backup of src before patch: /tmp/src_backup_*
