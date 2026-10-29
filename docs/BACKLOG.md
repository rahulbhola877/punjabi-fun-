# Backlog (not yet implemented)

Items below are **not** in the current build and are not advertised in-game.

## Done since Milestone 1
Open world (countryside, city, village, canal, highway), bicycle/motorcycle/car/jeep/tractor/truck, AI traffic,
animals, road defects, fights, police and bribes, quarrels, lafangas, road rage, dangal, auto rides, far deliveries,
gamepad and key rebinding, recorded voice lines and effects. Denser traffic (also through the bazaar), police
patrols and a G.T. Road naka, roadside walkers, rehri vendors, truckers, tractor-trolleys you hitch with Y (the load slides as you brake), cargo three-wheelers, a tractor race on the kacha tracks (one lap, three rivals), a rival chase on the G.T. Road (the driver you bumped comes after you in his car), PRTC and private buses on the country roads (take the wheel when stopped), doodhwalas, recorded
engine loops and horns, a recorded 30 s road ambience loop under the zones, live clock hands on both Ghanta Ghar towers, a ghee laddoo from Mithi Hatti that gives thirty seconds of superpowers (a higher jump, a glide, and a dash on the kick button), and crates and oil drums at the village ground that a kick slides across the ground. Two new towns on the fields: Naya Sheher east of the bypass (a mandir, a park, a bus adda, a petrol pump, a dhaba and a school) and Dhandra south-east (a gurdwara, a mandi, a kabaddi ground and a school), with the map running east to 1500 m. Music (Suno) awaits that connector being added.

## Next
- Music: a tumbi/dhol background score (needs the Suno connector, or the full ElevenLabs connector, in Claude settings).
- Jugaad "peter rehra".
- Inside the city: enterable shops and a working cinema interval.
- Kabaddi match activity at the Kotli ground.
- Day–night cycle with street lights; rain that turns tracks to deeper chikkad.
- Rooftop routes.
- Helicopter with helipad and rooftop deliveries.
- Real-GPU performance pass and mobile tuning on devices (measurements so far are from a software renderer).
- `npm run budget` is over its baseline on draw calls and vertices in every preset. The mandi produce does not cause it (it adds about 6k vertices to 4.4M). The whole world is loaded in every view, so the count follows world size: at the bazaar view, plaster is 670k vertices, plants 536k, paint 517k, metal 508k, leaf cards 339k. Re-measure the baseline (it is from 24 October) or trim the geometry, and decide which.
- Art pass, in the order the handoff gives: shop goods on the shelves (the builder is detailed; not yet seen up close), ground cover (grass tufts, verges), walls and roofs without detail, props (charpai, coolers, tubewell), vehicles, and the public buildings still plain (mandir, hospital, school, clock towers, cinema, bus adda, village houses, kothis). Done so far: the mandi's produce heaps, the crates and drums, the school, hospital and factory site walls (plinth, coping, piers), and the cinema's upper windows. The clock tower already reads well. Not yet looked at closely: charpai, cooler and tubewell props, the vehicles, the bus adda's walls and the village houses.
- Accessibility review: text size, subtitles and gentle flashes exist; a full pass has not been done.
