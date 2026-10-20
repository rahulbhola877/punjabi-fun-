# Deep audit — October 2026

Two passes over the game: one as a developer, with instruments on
(`tools/audit.mjs` walks the player through every kind of place and reports
frame time, draw calls, headcount, stuck traffic and overheard dialogue),
and one as a player, following the actual loop from the title screen to
free roam.

Everything below is measured, not guessed. Numbers come from the probe
snapshot on the production build. The frame rate figures are from a
software renderer in this container and are **not** a player's frame rate —
the numbers worth reading are draw calls, active meshes, 95th-percentile
frame time and the headcounts.

---

## What was broken (now fixed)

### 1. A crash that ate whole frames

`Crowd.pickDestination` picked a random node out of a filtered list without
checking it had any. A child in a sub-graph with no playing field, or a
walker in one with no shop fronts, threw a `TypeError`. That threw out of
`Game.frame()`, so **the rest of that tick's update — traffic, combat,
physics, the lot — never ran**. It fired repeatedly, several times per
second, in the audit log.

This is almost certainly a large part of "traffic seems stuck at places":
the traffic simulation was being skipped. `relocate()` had the same trap.
Both now fall back to any available node.

### 2. Nobody had eyes

Every face in the game was blank between the brows and the nose. The
eyeballs *were* modelled — a white, an iris — but sat at z 0.084 while the
skull's surface at that point is z 0.102. They were a centimetre and a half
inside the head and never drew. Fixed: the eye now stands proud of the
skin, with an iris, a pupil and a lid above it.
(`tools/faceshot.mjs` takes the close-up that shows it.)

### 3. The streets were empty

The worst finding, and the direct cause of "Ludhiana does not even feel
like Ludhiana".

One crowd group held **all 96 of Ludhiana's pedestrians, spread over 400 m
of street**. Standing anywhere in the city you had five people within
sight, and paid the animation, physics and shadow cost of the ninety-one
you could not see. Walking across the district loaded every cell behind
you too: the live headcount climbed past **290 people to show you twenty**.

Measured, before and after:

| Where you are stood | People within 30 m, before | After |
|---|---|---|
| Chaura Bazaar | 3 | 19 |
| A Ludhiana gali | 3 | 18 |
| Ghanta Ghar chowk | 6 | 15 |
| Ludhiana auto adda | 0 | 14 |
| Ludhiana sabzi mandi | 0 | 16 |
| Nawan Shehar bus adda | 0 | 9 |
| Nawan Shehar mandi | 1 | 8 |
| Ranggarh bazaar | 21 | 21 |
| Total people alive | 295 | ~105 |

Three changes did it: district crowds are bucketed into small cells that
load only around the player; bus addas and wholesale mandis got the crowd
that belongs in them (the walk graphs run down the roads *outside* those
yards, so they were empty lots with a tout and nobody to tout at); and a
headcount ceiling evicts the cells behind you instead of letting the total
climb.

### 4. The mobile shop in the first mission was a blank wall

The shopfront facing for north–south streets was inverted, so every shop on
Chaura Bazaar Road and both galis was built facing *into* its block. From
the street you saw the back of the building. Fixed in `region.ts`.

### 5. There was no traffic anywhere, so nothing honked

The crowd fix exposed the same fault one layer down. The traffic budget was
global and the despawn ring was 300 m, so the cars scattered across a
district instead of filling a street. Measured with vehicles within 70 m of
the player: **one to three, everywhere in the world** — the same in Chaura
Bazaar as in a wheat field. With nothing on the street, nothing honked:
0 horns per minute in the bazaar.

The budget is now scaled by the zone's traffic appetite and the ring pulled
in to 200 m (150 for the city autos), so the same number of cars sits in
front of you rather than around the district. Who honks depends on where
they are, too: a flat 8% of drivers left the bazaar silent.

Measured at the Low preset — the lightest one, for weak phones; the higher
presets scale the budget up:

| | vehicles within 70 m | horns/min |
|---|---|---|
| Chaura Bazaar | 1 → 6 | 0 → 9 |
| Ludhiana gali | 2 → 7 | 0 → 9 |
| Ghanta Ghar chowk | 3 → 7 | 3 → 11 |
| Ludhiana adda | 2 → 9 | 0 → 0 |
| G.T. Road | 2 → 3 | 6 → 3 |
| Pind Kotli | 3 → 1 | 6 → 3 |
| Fields | 0 → 0 | 0 → 0 |

Which is the point of the zoning: the bazaar got louder and busier, the
pind and the fields got quieter, and the budget did not grow.

### 6. The recover key could not help you when you were stuck

Stuck detection required the vehicle to be off the ground, so it only ever
caught one beached on an obstacle. Wedge yourself against a parked rehri or
a handcart — most of how you actually get stuck in a bazaar — and all four
wheels are on the tarmac, so the game decided nothing was wrong: no
"Stuck? Press R" prompt, and R itself refused to act.

Found by watching the playtest shove a parked auto for ten minutes on the
way back from Ludhiana. That auto was its own bug — parked at x -2.9,
squarely on the line anything driving north up the bazaar takes — and is
now at the kerb.

### 7. You could not see how to fight

On a phone, punch shared a button with the horn — on foot the horn icon
quietly became a fist. Nothing on screen said you could fight. There are
now two dedicated buttons on foot, punch and kick, and the kick becomes a
knee in a clinch or a brick swing when you are carrying one.

---

## Where the game stands now

Per-zone, on the production build:

- **Draw calls** 70–420. The heavy spots are the G.T. Road and the dhaba
  (~410), which is the long sight line down the highway, not crowd.
- **95th-percentile frame time** 8–17 ms in almost every zone. No zone is
  structurally expensive.
- **Live residents** capped around 105, 15–21 of them near you in town.
- **Traffic** 9–13 cars, of which 0–5 stopped at any moment (junctions and
  queues — normal).
- **Dialogue** reads as the place it is in: horn complaints at the mandi,
  aunty quarrels in the mohalla, route-calling at the adda, cricket
  arguments in the pind.

---

## What a player is missing

These are design gaps, not bugs. Ranked by how much they cost the player.

### 1. Reputation does nothing

★ reputation is the game's headline progression number. It is displayed in
the HUD, awarded for every delivery, deducted for crimes, and bucketed into
titles — "Newcomer+", "Known face", "Trusted", "Bazaar legend".

**Nothing in the game reads it.** No shop, no job, no character, no
vehicle, no area is gated on it. A player earns stars for an hour and
nothing whatsoever changes. This is the single biggest hole in the
experience: the game asks you to grind a currency it then ignores.

*Fix:* gate something real on each title. Better rates from Bhola. The
workshop selling the good scooter only to a "Known face". An auto-wala who
will not pick you up until you are "Trusted". Constables going easier on a
"Bazaar legend".

### 2. No arc past the intro

The intro is four beats (meet Bhola, take the scooter, buy the phone in
Ludhiana, bring it back) and then the game becomes an endless delivery
loop. There is no second story beat, no rival, no ending, nothing to be
working *towards*.

There is a de-facto completion goal — a gold medal at each of the fifteen
delivery destinations — but the game never tells the player it exists, and
never shows them the list.

*Fix, cheapest first:* a medals screen in the pause menu that shows the
fifteen destinations and what you have scored at each; then a handful of
one-off story jobs that unlock at reputation thresholds.

### 3. Everything but deliveries is undiscoverable

The game contains auto-rickshaw fares, police chases, street fights, the
akhada, intercity travel, brick-fighting, aunty quarrels you can walk into.
The free-roam objective text says: *"Take delivery jobs from Bhola, or
spend your earnings at Gurnam's workshop."* That is all a player is ever
told.

*Fix:* a one-line toast the first time you walk past each activity, and a
short "things to do in Ranggarh" list in the pause menu.

### 4. Fifteen destinations, one verb

Every job is "carry hot food from A to B before it cools". The
destinations, orders and thank-yous are written with real care and the
medal timings vary — but the thing you *do* never changes.

*Fix:* vary the task, not just the address. A fragile order you must not
jolt. A customer who has moved. A delivery into the middle of a quarrel.
One where a lafanga tries to take the tiffin off you.

---

## Running the instruments

```sh
npx vite build --outDir /tmp/dist
npx vite preview --outDir /tmp/dist --port 4173

node tools/audit.mjs    http://localhost:4173/   # per-zone performance and life
node tools/faceshot.mjs http://localhost:4173/   # head modelling close-up
node tools/playtest.mjs http://localhost:4173/   # the mission loop, end to end
node tools/mobiletest.mjs http://localhost:4173/ # phone and tablet layouts
npx vitest run
```
