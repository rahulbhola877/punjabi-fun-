import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { tunyardBench } from "./tunyardBench";
/** Punjab regional airfield on the continuous map. */
export function buildTravelDistrict(kit: Kit): void {
  const concrete = rgb("#c6c4b9"), white = rgb("#eeeade"), pavement = rgb("#d6d8d6");
  // Taxi apron, narrow access strip and an open 460 m runway. The ground
  // collision beneath these surfaces remains available to wheels and feet.
  kit.frame(635, 1745, 0, 0);
  kit.g("asphalt").box(0, 0.015, 0, 38, 0.03, 150, pavement);
  // Chunk the long runway so a player at either end sees nearby pavement on
  // short draw-distance presets. A single 460 m mesh vanished near its ends.
  for (let i = 0; i < 4; i++) {
    const cx = 380 + (i + 0.5) * 115;
    kit.frame(cx, 1891, 0, 0);
    kit.g("asphalt").box(0, 0.02, 0, 115.1, 0.04, 38, pavement);
    for (let x = -42; x <= 42; x += 28) kit.g("paint").box(x, 0.045, 0, 14, 0.01, 0.6, white);
  }
  // A parking apron gives aircraft a clear, flat place beside the runway.
  kit.frame(440, 1857, 0, 0);
  kit.g("asphalt").box(0, 0.02, 0, 120, 0.04, 30.1, pavement);
  for (const x of [394, 826]) {
    kit.frame(x, 1891, 0, 0);
    for (let z = -12; z <= 12; z += 4) kit.g("paint").box(0, 0.046, z, 8, 0.01, 1.3, white);
  }
  // The counter is outside so it is reachable without colliding with a closed
  // facade; the marker/interaction is managed separately.
  kit.frame(635, 1690, 0, 0);
  kit.g("concrete").box(0, 0.04, 0, 38, 0.08, 28, concrete);
  kit.solid("plaster", 0, 2.6, 8.5, 24, 5.2, 1, rgb("#d6d1c2"));
  kit.solid("plaster", -11.5, 2.6, 0, 1, 5.2, 17, rgb("#d6d1c2"));
  kit.solid("plaster", 11.5, 2.6, 0, 1, 5.2, 17, rgb("#d6d1c2"));
  kit.g("shutter").box(0, 5.3, 0, 25, 0.3, 19, rgb("#78919a"));
  kit.collide(0,5.3,0,25,.3,19);
  kit.solid('wood',-8,.55,3.5,2.8,1.1,.8,rgb('#697578'));
  kit.signAt('serviceHangar',635,2.4,1697.9,Math.PI,6);
  for (const x of [-8, 8]) kit.solid("metal", x, 2.5, -8, 0.24, 5, 0.24, rgb("#526c74"));
  kit.frame(635, 1681, Math.PI, 0);
  kit.sign("northAirfield", 0, 4.2, 0, 10);
  tunyardBench(kit, 626, 0, 1681, 0);
  tunyardBench(kit, 644, 0, 1681, 0);

  kit.world();
}
