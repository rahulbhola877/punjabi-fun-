# Gedi Multiverse · ਗੇੜੀ ਮਲਟੀਵਰਸ

A playful third-person action-adventure sandbox set in **Ranggarh**, a fictional bazaar town in Indian Punjab.
Built from scratch with **Babylon.js 9**, **TypeScript (strict)**, **Vite** and **Havok** physics.
The game uses procedural art, the owner's Tunyard assets, fonts and recordings documented in
[`docs/ASSETS.md`](docs/ASSETS.md). It runs fully offline once dependencies are installed.

> **Status: evolving prototype** — the walled Ranggarh bazaar (enterable dhaba, workshop, shops) sits in a
> countryside with the G.T. Road, a highway dhaba and petrol pump, the city of
> **Nawan Shehar** (Ghanta Ghar chowk, bus adda, anaj mandi, police chowki, Raj Talkies), **Pind Kotli** village
> (akhada, gurdwara, kabaddi ground), the crowded city of **Ludhiana** down the G.T. Road (Chaura Bazaar, Ghanta Ghar,
> sabzi mandi, auto adda, Deepak Talkies — packed streets, carts on the tarmac and overloaded autos), a canal with
> bridges, a connected outer bypass with a working bus service, farm deras and fields of wheat, sarson, sugarcane and paddy with kisaan at work. Drivable vehicles include a pickup and a light plane; there is AI traffic, street animals, fights, police, street
> quarrels, a dangal, auto-rickshaw rides and 15 delivery destinations. Remaining ideas: [`docs/BACKLOG.md`](docs/BACKLOG.md).

North of the orchard, a road leads to a wayside clean-up activity and a sloped ridge drive, where you can choose to
confront a wild boar and drive it away. North Airfield has an
arcade light plane and a transfer point to a small Canada-inspired district within the same map, with a local street,
residents and a café. An experimental **8.1 km × 8.1 km** generated terrain extension is available in development
with `?probe&outer=1`, but is gated from normal play while its scenery, activities and performance are improved. Its woodland, dunes,
highlands and northland have trails to Forest Camp, Dune Oasis, Highland Lookout and North Camp; this is not a fully
hand-crafted or non-repeating expansion. The forest and northern camp rest activities are experimental too.
At the Canada-inspired district's snowball range, aim the camera and press Q to hit moving targets; the game saves your best score.
Forest Camp and North Camp offer a short rest that restores health and advances the clock.

The airfield also opens separate small destinations: Lantern Valley (pixel art), Neon Quay (toon-style 3D), Sakura
Street (a Japan-inspired neighborhood), Lantern Harbor (a China-inspired riverside district) and Chand Outpost (a lunar
research outpost). These are prototypes with local activities, not complete countries or planets; broader worlds and
additional activities remain works in progress.

## Requirements

- Node.js 20+ (tested with 22.22) and npm 10+
- A desktop browser with WebGL2 and WebAssembly (recent Chrome, Edge or Firefox)

## Commands

| Task | Command |
|---|---|
| Install (pinned versions) | `npm install` |
| Development server | `npm run dev` → http://localhost:5173 |
| Type check (strict) | `npm run typecheck` |
| Unit tests | `npm test` |
| Production build | `npm run build` → `dist/` |
| Preview the production build | `npm run preview` → http://localhost:4173 |
| Automated keyboard playtest (needs a running server) | `npm run playtest -- http://localhost:4173/` |
| Hardware renderer profile (CPU traces, GPU timings, screenshots) | `npm run profile -- http://localhost:4173/` |
| Expanded roads, bridges and vehicle smoke test | `npm run smoke:world -- http://localhost:4173/` |

Renderer measurements, hardware requirements for profiling, and known limits are recorded in [the rendering audit](docs/RENDERING_AUDIT.md).

`.npmrc` sets `legacy-peer-deps=true` because npm 10 crashes resolving vitest's optional peer list; versions are pinned exactly.

### Dependency updates

Dependabot checks npm dependencies daily and opens pull requests for available updates. The Three.js runtime and its
types are grouped because the character kit uses both. Updates are reviewed rather than merged automatically: run the
tests and production build, then check the title screen, gameplay, weather and canal in a browser before merging a
renderer or graphics dependency update. Major versions may need code changes even when the automated checks pass.

## Controls

Every keyboard action can be remapped in **Settings → Keyboard** (saved in your browser).
Free-roam superpowers start enabled in new and existing saves. Press `U` (or tap ⚡) to switch them off or back on;
the choice is saved. With powers on, jump higher, hold jump to glide and use the kick button to dash.

The light plane at the North Airfield uses an arcade flight model. Taxi to the runway, hold forward for throttle,
then hold jump (Space by default) to raise the nose once it has enough speed. Use left/right to turn and sprint
(Shift by default) to lower the nose. On approach, use throttle to keep airspeed and raise the nose if descent
becomes steep; release throttle and use brake after landing. On touch, the plane
shows separate Climb and Descend buttons. Land and stop before leaving the aircraft.

| On foot | |
|---|---|
| `W A S D` or arrow keys | Move (relative to camera) |
| `Shift` | Sprint |
| `Space` | Jump; hold in the air to glide while powers are on |
| `E` or `F` | Talk · shop · pick up · deliver · ride · break up a quarrel |
| `Q` / left click | Punch combo, or fire the equipped pistol |
| `V` | Equip or holster the pistol once acquired |
| `G` / `X` | Power dash; kick when powers are off |
| `U` | Toggle free-roam superpowers (⚡ on touch) |

| Riding / driving | |
|---|---|
| `W` / `S` (or `↑` / `↓`) | Throttle / brake — keep holding brake when stopped to reverse (scooter and auto) |
| `A D` (or `←` / `→`) | Steer |
| `Space` | Handbrake |
| `H` | Horn (people step aside) · bell on a bicycle |
| `E` | Get off (when slow) |
| `R` | Recover a flipped or stuck vehicle |

| Camera & menus | |
|---|---|
| Mouse | Look — click the game view to capture the mouse |
| `I J K L` | Rotate the camera without a mouse |
| `C` | Look behind · mouse wheel: zoom |
| `M` / `Tab` | Map (`+` / `−` or the wheel to zoom from the whole countryside down to the bazaar) |
| `Esc` / `P` | Pause: save, map, settings, controls, quit |
| `F1` | Controls reference |

**Gamepad** (standard layout, e.g. Xbox/PlayStation): left stick move/steer, right stick camera, RT/LT throttle/brake,
A jump/handbrake, X interact, B horn, Y recover, RB sprint, LB look back, Start pause, Back map. The D-pad and A/B
navigate menus.

**Phones and tablets**: a floating joystick on the left half, drag the right half to look, a big ✋ button for the
current action, and gas/brake pedals while riding. Play in landscape; the pause menu has a fullscreen toggle.

Settings (pause menu or title): volumes, mute, mouse sensitivity, invert-Y, keyboard camera speed, shadow quality,
post-processing, resolution scale, driving hints, key remapping and a performance overlay. The game pauses and clears
held keys when the window loses focus. Audio starts on your first click, tap or key press (browser autoplay rules).

Shops along the bazaar sell snacks that give short boosts (speed, tips, warmer food), perks such as a bungee cord
that halves spills, and clothes from Masterji and the textile shop. Bhola, Gurnam and Pammi have recorded voice lines.

## What to do out there

- **Northern Orchard** — start a picking round at the stand, follow the markers to three baskets and return them for ₹120. The round is available once per game day.
- **North Wayside** — begin at the bin, collect the three marked pieces of litter and return them for one reputation point. The area can be cleaned again the next game day.
- **Lantern Valley** — choose the pixel-art destination at the North Airfield transfer point. Walk into five lanterns, interact with the northern shrine, and use the portal or Escape to return. Progress is saved.
- **Neon Quay** — choose the 3D prototype at the North Airfield transfer point. Walk into three signals and interact with the central relay; a friendly fox near the square offers hints. Use the portal or Escape to return. Progress is saved.
- **Sakura Street** — take Aiko's tea to Ken and return for a postcard stamp, or visit the garden and feed the koi. The errand is saved.
- **Lantern Harbor** — help Mei arrange a riverside evening by talking with Lin and Wen, then returning to Mei. Explore the market, bridges and hill path; use the return shelter or Escape to leave. Story progress is saved.
- **Chand Outpost** — visit the small lunar research outpost from North Airfield. A skippable shuttle flight links you to an astronaut body: Space floats in low gravity and Q triggers a short lunar burst (touch buttons are also available). Talk to the pilot, find a power cell, repair the relay and report back for an explorer stamp. Cosmo the fox offers hints; the portal or Escape returns to Ranggarh. Story progress is saved.
- **Deliveries** — Bhola's jobs now go beyond the bazaar walls: the trucker at the highway dhaba, Jarnail Singh's
  dera, the Sarpanch in Pind Kotli, the bus adda, mandi, police chowki, cinema and petrol pump. Longer rides pay more.
- **Sawari (auto rides)** — drive an auto-rickshaw to an auto stand (bus adda or outside the bazaar gate) and pick up a
  passenger. Drive smoothly: every pothole costs you comfort and tips.
- **Vehicles** — scooter, auto-rickshaw, bicycle, motorcycle, hatchback car, open jeep, tractor and truck, parked around
  the map (workshop, dhaba, highway, deras, city). Or walk up to a stopped car in traffic and pull the driver out —
  he will not be happy, and someone will call the police.
- **Ladai-jhagde** — `Q` (or left click with the mouse captured, gamepad B, 👊 on touch) throws a punch–punch–*chapet*
  combo. Neighbours argue in the street: step in to break it up (bich-bachaav) or watch it come to shoving. Lafangas
  loiter at the Ghanta Ghar chowk and the bus adda. Bump someone's car and he climbs out to shout at you.
- **Bus-stand trouble** — ask Gurnam about the bus-stand crew, confront the gang and return for payment. The job grants a pistol: `V` equips or holsters it, and `Q` fires toward the camera with a short-range aim assist. Ammunition is limited and more can be bought from Gurnam. Gunfire increases police interest; gang members are knocked out under the game's existing combat rules.
- **Kotli Akhada** — pay Ustad Kartar ₹20 for a three-bout dangal; knock your man down, stay inside the ring.
- **Police** — constables walk the bazaar and city beat, a naka checks traffic where the Bazaar Road meets the G.T.
  Road, and police jeeps do the rounds. Trouble earns stars (🚨★☆☆): the nearest constables come running, or the
  patrol jeep turns on its siren and chases you. When they catch you,
  it always ends the same way: a little *chai-paani* and they go back to their tea. Escape for long enough and they
  give up.
- **The road itself** — smooth highway, patched link roads, *tooti-footi* stretches full of potholes, and kacha tracks
  with *chikkad* (mud) that drags at your wheels. Stray dogs chase motorbikes, cats dart across, buffaloes stand in the
  middle of the road and ignore your horn, snake-biker youths weave through traffic, and plenty of drivers never stop
  honking (recorded horns and engines: Maruti beeps, scooter peeps, the auto's nasal horn, Bullet thump, diesel chug).
- **Ludhiana** — the loud one, 700 m west down the G.T. Road. Narrow bazaar galis walled by three- to six-storey
  shopfronts, a cart every few metres, aunties holding court on the footpath, four constables on the beat, and autos
  everywhere — crammed with five or six sawaris, one hanging off the footboard. The tarmac is the worst in the game:
  an overloaded auto that takes a pothole at speed slews sideways, and sometimes goes clean over on its side.
- **Street calls** — the sabzi-wala ("Aaloo lo, pyaaz lo!"), the doodhwala, the kabadi-wala, bus conductors and the
  auto touts barking their routes at the stands — "Gill, Gill, Gill!", "Ludhiana, Ludhiana, Ludhiana!". They only call
  when you are close enough to sell to, one at a time, and each seller then holds his tongue for half a minute, so a
  busy market sounds busy without becoming a wall of noise.
- **Gali jhagde** — two aunties will go at each other over a broken gamla, a bakri's milk or whose kachra is whose,
  insults and all, while the neighbours drift over to form a ring and film it. Break it up with a lassi, listen,
  or tell them both they're wrong and find out what that costs.
- **The black Safari** — bump the wrong jeep and the tinted window comes down: *"Kanjar da put, hun paise nai dene
  tere!"* He does not want your ₹50. He wants an apology.
- **Roadside life** — scooters and autos squeeze through the bazaar, tractors haul trolleys of ganna, toori or bricks,
  doodhwalas ride with milk cans, truckers rest by their trucks at the dhaba and one is stuck with a broken spring on
  the G.T. Road. Rehri-walas sell sabzi, fruit, gol gappe and ganne da ras at the roadside; farmers, nihang singhs and
  school kids walk the shoulders.

## Graphics: Low, Medium, High and Ultra

The game asks once, before the title screen, which to use — and it is in **Settings → Graphics** after that. One
choice moves everything that costs frames or battery: shadow maps, post-processing, **render resolution**, draw
distance, how much traffic, how many autos, animals and street folk are simulated, how many engines may sound at
once, and a frame cap.

| | Low | Medium | High | Ultra |
| --- | --- | --- | --- | --- |
| Shadows / post | off / off | hard / off | soft / on | sharp / on |
| Resolution | 60% | 75% | 100% | 100% |
| Draw distance | 220 m | 320 m | 420 m | 650 m |
| Traffic · autos | 9 · 3 | 13 · 5 | 18 · 7 | 30 · 12 |
| Engines heard | 4 | 5 | 6 | 9 |
| Frame cap | 30 fps | 45 fps | — | — |

Phones and tablets default to **Low**. If your phone gets hot, that is the one to use: the frame cap matters more
than anything else, because a device allowed to render 55 fps and then throttle to 25 runs hotter than one held
steadily at 30. The individual controls below the preset still work — changing the preset resets them.

## Getting about: the stand

The district is 1.4 km across and Ludhiana is a long way west, so the HUD has a **🚌 Stand** button: a bus or shared
auto to any of fifteen famous places — the bazaar gate, Bhola's dhaba, the highway dhaba and pump, the Nawan Shehar
bus adda, chowk, mandi and Raj Talkies, Ludhiana's adda, Ghanta Ghar, Chaura Bazaar and sabzi mandi, Pind Kotli,
the akhada and the gurdwara. You pay a fare by distance. It is refused while a delivery is on the clock, while a
sawari is in your auto, while you are driving, and while the police want a word.

## Introductory mission guide — “Pehla Kamm” (first job)

1. **Meet Bhola** — walk into *Bhole Da Dhaba* (red sign, west side) and press `E` at the cash counter.
   *"Oye! Chaure Bazaar jaana ae, mobile lain layi!"* — his phone has smashed and he wants a new one today.
2. **Take the scooter** — his nephew's mint scooter is parked by the dhaba. Press `E`.
3. **Ride to Chaura Bazaar, Ludhiana** — out of the bazaar's south gate, west along the G.T. Road and into Ludhiana,
   then down Chaura Bazaar Road to *Hello Mobile Zone*. On the way: trucks, overloaded autos, cows sitting in the road,
   and two aunties having it out at the roadside. Stop at the shop and press `E` — Pinka packs the phone.
4. **Bring it back** — ride back to Bhola without dropping it (crashes dent the box) and press `E` at the counter.
5. **Reward** — ₹200 and +10 reputation; Bhola's delivery jobs and Gurnam's workshop upgrades unlock.
6. **Repeatable jobs** — talk to Bhola for delivery orders around the bazaar and, later, out into the district.
   Each has a par time, a food-condition meter, bronze/silver/gold medals and a personal best.
   If the food goes cold or spills, nothing is lost — go back to Bhola for another order.

Steps 6–9 of the full specification (power challenge, vehicle improvement choice, helicopter flight intro) are
Milestone 2–3 items; the workshop shop already provides the "spend a reward on an improvement or cosmetic" loop.

## Project layout

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the feasibility assessment, module map and simulation order.
Test results, performance measurements and known issues are in [`docs/TESTING.md`](docs/TESTING.md).

## Screenshots (actual gameplay, captured by the automated playtests)

Default graphics, 1280×720 (software-rendered in the test container):

| | |
|---|---|
| ![Title](docs/screenshots/hq-01-title.png) | ![Riding the bazaar](docs/screenshots/hq-03-riding-bazaar.png) |
| ![Dhaba interior](docs/screenshots/hq-04-dhaba-interior.png) | ![Talking to Bhola](docs/screenshots/hq-06-bhola-dialogue.png) |
| ![District map](docs/screenshots/hq-07-map.png) | ![Street toward the gate](docs/screenshots/hq-08-street-south.png) |

More (low-graphics test mode, 960×540) in [`docs/screenshots/`](docs/screenshots/): meeting Bhola, carrying the tiffin,
riding to the workshop, Gurnam's dialogue and shop, the delivery HUD with food warmth/condition, the pause menu,
Continue on the title screen and the auto-rickshaw.
