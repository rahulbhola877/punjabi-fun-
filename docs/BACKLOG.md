# Backlog (not yet implemented)

Items below are **not** in the current build and are not advertised in-game.

## Done since Milestone 1
Open world (countryside, city, village, canal, highway), bicycle/motorcycle/car/jeep/tractor/truck, AI traffic,
animals, road defects, fights, police and bribes, quarrels, lafangas, road rage, dangal, auto rides, far deliveries,
gamepad and key rebinding, recorded voice lines and effects. Denser traffic (also through the bazaar), police
patrols and a G.T. Road naka, roadside walkers, rehri vendors, truckers, tractor-trolleys you hitch with Y (the load slides as you brake), cargo three-wheelers, a tractor race on the kacha tracks (one lap, three rivals), a rival chase on the G.T. Road (the driver you bumped comes after you in his car), PRTC and private buses on the country roads (take the wheel when stopped), doodhwalas, recorded
engine loops and horns, a recorded 30 s road ambience loop under the zones, live clock hands on both Ghanta Ghar towers, a ghee laddoo from Mithi Hatti that gives thirty seconds of superpowers (a higher jump, a glide, and a dash on the kick button), and crates and oil drums at the village ground that a kick slides across the ground. Music (Suno) awaits that connector being added.

## Next
- Music: a tumbi/dhol background score (needs the Suno connector, or the full ElevenLabs connector, in Claude settings).
- Jugaad "peter rehra".
- Inside the city: enterable shops and a working cinema interval.
- Kabaddi match activity at the Kotli ground.
- Day–night cycle with street lights; rain that turns tracks to deeper chikkad.
- Rooftop routes.
- Helicopter with helipad and rooftop deliveries.
- Real-GPU performance pass and mobile tuning on devices (measurements so far are from a software renderer).
- `npm run budget` is over its baseline on draw calls and vertices in every preset. The mandi produce does not cause it (it adds about 6k vertices to 4.4M). Re-measure the baseline or trim the geometry, and decide which.
- Art pass, in the order the handoff gives: shop goods on the shelves (the builder is detailed; not yet seen up close), ground cover (grass tufts, verges), walls and roofs without detail, props (charpai, coolers, tubewell), vehicles, and the public buildings still plain (mandir, hospital, school, clock towers, cinema, bus adda, village houses, kothis). Done so far: the mandi's produce heaps, the crates and drums.
- Accessibility review: text size, subtitles and gentle flashes exist; a full pass has not been done.
