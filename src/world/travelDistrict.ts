import { Vector3 } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { tunyardBench } from "./tunyardBench";
import { tunyardSnowyPine } from "./tunyardPine";
import { tunyardCottage } from "./tunyardCottage";
import { tunyardBungalow } from "./tunyardBungalow";
import { tunyardModernHouse } from "./tunyardModernHouse";
import { tunyardCornerShop } from "./tunyardCornerShop";
import { tunyardRockCluster } from "./tunyardNature";
import { CANADA_HOMES, CANADA_SET, CANADA_SIDEWALKS, canadaHomeStyle, canadaStreetClearance } from "./travelDistrictLayout";
import { buildWinterBackdrop } from "./winterBackdrop";
import { CANADA_RINK } from "../missions/CanadaRink";

/** A modest regional airfield and a clearly labelled themed arrival set. Both
 * are ordinary parts of this same continuous map. */
export function buildTravelDistrict(kit: Kit): void {
  const concrete = rgb("#c6c4b9"), white = rgb("#eeeade"), dark = rgb("#565d5e"), pavement = rgb("#d6d8d6");
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
  for (const x of [-8, 8]) kit.solid("metal", x, 2.5, -8, 0.24, 5, 0.24, rgb("#526c74"));
  kit.frame(635, 1681, Math.PI, 0);
  kit.sign("northAirfield", 0, 4.2, 0, 10);
  tunyardBench(kit, 626, 0, 1681, 0);
  tunyardBench(kit, 644, 0, 1681, 0);

  // A snowy, small themed set inside the same map. The low fence marks its
  // edge visually; it is not presented as a full separate country or scene.
  const dx = (CANADA_SET.x1 - CANADA_SET.x0) / 4, dz = (CANADA_SET.z1 - CANADA_SET.z0) / 3;
  const snowPoint = (ix: number, iz: number): Vector3 => {
    const x = CANADA_SET.x0 + ix * dx + (ix === 0 ? 25 + 12 * Math.sin(iz * 2) : ix === 4 ? -25 + 12 * Math.sin(iz * 2 + 1) : 0);
    const z = CANADA_SET.z0 + iz * dz + (iz === 0 ? 20 + 12 * Math.sin(ix * 1.7) : iz === 3 ? -20 + 12 * Math.sin(ix * 1.7 + 1) : 0);
    return new Vector3(x, 0.015, z);
  };
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 3; iz++) {
    const points = [snowPoint(ix, iz), snowPoint(ix + 1, iz), snowPoint(ix + 1, iz + 1), snowPoint(ix, iz + 1)];
    const cx = points.reduce((s, p) => s + p.x, 0) / 4, cz = points.reduce((s, p) => s + p.z, 0) / 4;
    kit.frame(cx, cz, 0, 0);
    const p = (i: number) => new Vector3(points[i]!.x - cx, 0.015, points[i]!.z - cz);
    kit.g("snow").quad(p(0), p(1), p(2), p(3), rgb("#e3ebee"));
  }
  // An authored Tunyard cottage and arrival platform facing south.
  kit.frame(1120, 1770, 0, 0);
  const trim = rgb("#e6e1d4");
  kit.g("concrete").box(0, 0.08, -1, 26, 0.16, 20, rgb("#bfc9c7"));
  tunyardCottage(kit, 1120, 0.16, 1770, 2.2, Math.PI);
  kit.frame(1120, 1761.5, Math.PI, 0);
  for (const x of [-5.4, 5.4]) kit.solid("wood", x, 2, 0, 0.18, 4, 0.18, trim);
  kit.sign("canadaSet", 0, 4.1, 0, 10);
  tunyardBench(kit, 1110, 0, 1761.5, 0);
  tunyardBench(kit, 1130, 0, 1761.5, 0);
  // An approach links the transfer point with the arrival platform.
  kit.frame(1115, 1744, 0, 0);
  kit.g("concrete").box(0, 0.018, 0, 6, 0.036, 32, rgb("#d2d4ca"));
  // A connected public street with sidewalks and short paths to homes. The
  // road surfaces themselves are shared with the navigable road graph.
  for (const z of CANADA_SIDEWALKS) {
    kit.frame(1195, z, 0, 0);
    kit.g("concrete").box(0, 0.055, 0, 350, 0.11, 3, rgb("#d3d3c9"));
  }
  kit.frame(1106, 1778, 0, 0);
  kit.g("concrete").box(0, 0.045, 0, 3, 0.09, 58, rgb("#d3d3c9"));
  kit.frame(1107, 1748, 0, 0);
  kit.g("concrete").box(0, 0.045, 0, 4, 0.09, 3, rgb("#d3d3c9"));
  for (const [i, home] of CANADA_HOMES.entries()) {
    const style = canadaHomeStyle(i), scale = home.scale * (style === "bungalow" ? 0.72 : style === "modern" ? 0.55 : 1);
    if (style === "bungalow") tunyardBungalow(kit, home.x, 0, home.z, scale, home.yaw);
    else if (style === "modern") tunyardModernHouse(kit, home.x, 0, home.z, scale, home.yaw);
    else tunyardCottage(kit, home.x, 0, home.z, scale, home.yaw, home.tint, home.roof);
    const north = home.z > 1820, sidewalk = north ? CANADA_SIDEWALKS[1] : CANADA_SIDEWALKS[0];
    const frontage = home.z + (north ? -1 : 1) * (scale * (style === "bungalow" ? 7.2 : style === "modern" ? 10.5 : 3.1) + 0.3);
    kit.frame(home.x, (sidewalk + frontage) / 2, 0, 0);
    kit.g("concrete").box(0, 0.045, 0, 2.2, 0.09, Math.abs(sidewalk - frontage), rgb("#d3d3c9"));
  }
  // Original Tunyard café/shop forms the centre of the small main street.
  tunyardCornerShop(kit, 1130, 0, 1848, Math.PI);
  kit.frame(1130, 1837, 0, 0);
  kit.g("concrete").box(0, 0.045, 0, 3.4, 0.09, 12, rgb("#d3d3c9"));
  // Two short off-street bays leave the sidewalks and traffic lane clear.
  for (const [x, z] of [[1158, 1803], [1223, 1837]] as const) {
    kit.frame(x, z, 0, 0);
    kit.g("asphalt").box(0, 0.05, 0, 6, 0.1, 3, pavement);
  }
  // Clusters of the author's snowy Tunyard conifers frame the arrival clearing
  // without blocking the return point or the cottage.
  for (const [x, z, s, a] of [[995, 1700, 1.2, 0], [1040, 1850, 1.0, 1], [1220, 1810, 1.2, 2], [1370, 1950, 1.0, 3], [1300, 1700, 1.1, 4], [1260, 1920, 1.2, 5], [1010, 1980, 1.1, 2.5], [1410, 1790, 1.0, 0.5], [1080, 1772, 1.2, 0.8], [1156, 1770, 1.1, 2.1], [1084, 1815, 1.2, 1.7], [1164, 1810, 1.0, 3.3], [1091, 1754, 1.1, 1.2], [1074, 1755, 0.9, 2], [1070, 1792, 1.3, 0.2], [1094, 1790, 0.95, 3], [1147, 1754, 1.15, 0.4], [1168, 1752, 0.9, 3.8], [1176, 1791, 1.3, 2.9], [1146, 1795, 0.95, 5.2], [1060, 1832, 1.2, 2.2], [1181, 1830, 1.15, 1.3]] as const) if (!canadaStreetClearance(x, z)) tunyardSnowyPine(kit, x, 0, z, s, a);
  // Irregular groves near the arrival path make a sheltered clearing; the
  // trees stay well away from the transfer point, cottage and walking path.
  for (const [x, z, s, a] of [[1089, 1718, 1.15, 0.3], [1079, 1725, 0.9, 1.7], [1068, 1735, 1.3, 2.4], [1083, 1740, 1.05, 3.2], [1091, 1741, 1.25, 4.1], [1067, 1764, 0.95, 4.8], [1061, 1777, 1.15, 2.3], [1085, 1785, 1.2, 0.6], [1100, 1788, 0.9, 5.3], [1141, 1717, 1.2, 1.4], [1152, 1724, 1.0, 3.1], [1163, 1732, 1.3, 2.0], [1147, 1741, 1.1, 5.6], [1139, 1740, 1.2, 0.1], [1175, 1765, 1.1, 4.2], [1181, 1778, 1.25, 2.6], [1160, 1786, 0.95, 1.4], [1139, 1790, 1.1, 0.9]] as const) if (!canadaStreetClearance(x, z)) tunyardSnowyPine(kit, x, 0, z, s, a);
  // Give the snowball range a recognisable clearing. Trees remain behind the
  // targets and outside the firing lanes so they cannot block a good throw.
  for (const [x, z, s, a] of [[1373, 1726, 1.15, 0.4], [1380, 1731, 0.9, 1.2], [1387, 1734, 1.2, 2.1], [1395, 1732, 1, 3.3], [1403, 1729, 1.15, 4.1], [1410, 1724, 0.95, 5.2], [1370, 1714, 0.9, 2], [1412, 1710, 1.1, 1]] as const) tunyardSnowyPine(kit, x, 0, z, s, a);
  // Timber rails and a coloured throwing line make the activity legible even
  // before the player starts a round. The entrance and targets stay clear.
  const rangeWood = rgb("#876b50"), rangeSnow = rgb("#e5eeee");
  for (const x of [1378, 1402]) {
    kit.frame(x, 1711, 0, 0);
    for (const z of [-8, 0, 8]) kit.solid("wood", 0, 0.65, z, 0.18, 1.3, 0.18, rangeWood);
    kit.g("wood").box(0, 0.85, 0, 0.12, 0.12, 16, rangeWood);
    kit.g("matte").box(0, 0.93, 0, 0.18, 0.05, 16, rangeSnow);
  }
  kit.frame(1390, 1703, 0, 0);
  kit.g("paint").box(0, 0.04, 0, 4, 0.025, 0.18, rgb("#ca6861"));
  // A real, open-access neighborhood ice rink with two goals. The entry in
  // the east boards remains open, and the collision boxes match the boards.
  kit.frame(CANADA_RINK.x, CANADA_RINK.z, 0, 0);
  kit.g("ice").box(0, 0.045, 0, 28, 0.04, 36, rgb("#b8d9df"));
  for (const z of [-9, 0, 9]) kit.g("paint").box(0, 0.071, z, 27.5, 0.012, 0.18, rgb(z === 0 ? "#b55a57" : "#6f9db5"));
  // Painted face-off circles and dots are flat on the ice, not collision.
  const ring = (cx: number, cz: number, radius: number): void => {
    const paint = kit.g("paint"), color = rgb("#b55a57");
    for (let i = 0; i < 32; i++) {
      const a = i * Math.PI * 2 / 32, b = (i + 1) * Math.PI * 2 / 32;
      const p = (angle: number, r: number) => new Vector3(cx + Math.cos(angle) * r, 0.073, cz + Math.sin(angle) * r);
      paint.quad(p(a, radius - 0.07), p(a, radius + 0.07), p(b, radius + 0.07), p(b, radius - 0.07), color);
    }
    paint.box(cx, 0.073, cz, 0.35, 0.01, 0.35, color);
  };
  ring(0, 0, 3); for (const x of [-7, 7]) for (const z of [-12, 12]) ring(x, z, 2.3);
  const boards = rgb("#e8e7dc"), trimRink = rgb("#b94b4d");
  for (const x of [-14, 14]) {
    if (x < 0) kit.solid("plaster", x, 0.55, 0, 0.3, 1.1, 36, boards);
    else for (const z of [-10.5, 10.5]) kit.solid("plaster", x, 0.55, z, 0.3, 1.1, 15, boards);
    for (const z of x < 0 ? [0] : [-10.5, 10.5]) kit.g("paint").box(x, 1.12, z, 0.35, 0.06, x < 0 ? 36 : 15, trimRink);
  }
  for (const z of [-18, 18]) {
    for (const x of [-8.1, 8.1]) {
      kit.solid("plaster", x, 0.55, z, 11.8, 1.1, 0.3, boards);
      kit.g("paint").box(x, 1.12, z, 11.8, 0.06, 0.35, trimRink);
    }
    // The goal frames face into the rink; the puck crosses their open line.
    for (const x of [-2.2, 2.2]) kit.g("metal").box(x, 0.65, z, 0.12, 1.3, 0.12, trimRink);
    kit.g("metal").box(0, 1.3, z, 4.5, 0.12, 0.12, trimRink);
    const back = z + Math.sign(z) * 1.35;
    for (const x of [-2.2, 2.2]) {
      kit.g("metal").box(x, 1.3, (z + back) / 2, 0.08, 0.08, 1.35, trimRink);
      kit.g("metal").box(x, 0.65, back, 0.08, 1.3, 0.08, trimRink);
    }
    kit.g("metal").box(0, 1.3, back, 4.5, 0.08, 0.08, trimRink);
    for (let x = -2; x <= 2; x += 0.5) kit.g("metal").box(x, 0.65, back, 0.025, 1.25, 0.025, boards);
    for (let y = 0.2; y < 1.3; y += 0.25) kit.g("metal").box(0, y, back, 4.4, 0.025, 0.025, boards);
  }
  for (const z of [-1, 1]) kit.g("wood").box(12, 1.25, z, 0.15, 2.5, 0.15, rgb("#685b4d"));
  // A few verge trees are deliberately placed between frontage paths and
  // beyond the pedestrian strips, so walkers and parking remain clear.
  for (const [x, z, s, a] of [[1058, 1802, 1.15, 0.8], [1110, 1802, 1.0, 2.2], [1208, 1802, 1.2, 1.3], [1270, 1802, 0.95, 3.4], [1107, 1838, 1.1, 1.8], [1172, 1838, 0.95, 2.8], [1218, 1838, 1.2, 0.6], [1281, 1838, 1.0, 4.1]] as const) tunyardSnowyPine(kit, x, 0, z, s, a);
  // Individual street lamps and benches create pauses between the houses;
  // their footprints sit behind the sidewalks, away from the marked paths.
  for (const [x, z] of [[1077, 1803.5], [1150, 1836.5], [1218, 1803.5], [1294, 1836.5]] as const) {
    kit.frame(x, z, 0, 0);
    kit.g("metal").cylinder(0, 0, 0, 0.075, 0.075, 3.6, 8, dark);
    kit.g("emissive").box(0, 3.65, 0, 0.45, 0.28, 0.45, rgb("#ffe1a3"));
    kit.collide(0, 1.8, 0, 0.18, 3.6, 0.18);
  }
  tunyardBench(kit, 1105, 0, 1836.8, 0);
  tunyardBench(kit, 1185, 0, 1803.2, Math.PI);
  for (const [x, z, seed] of [[1010, 1820, 31], [1245, 1860, 33], [1330, 1710, 35], [1090, 1734, 37], [1150, 1728, 39]] as const) tunyardRockCluster(kit, x, z, seed, 0);
  // Uneven caps on several rocks and small snow banks add local relief without
  // obstructing the cleared route; the caps sit on their authored rock cores.
  for (const [x, z] of [[1090, 1734], [1150, 1728], [1245, 1860]] as const) {
    kit.frame(x, z, 0, 0);
    kit.g("matte").ellipsoid(0, 1.0, 0, 0.72, 0.16, 0.53, 10, 4, rgb("#e0eceb"));
  }
  // Simple path lights; their posts are outside the walking corridor.
  for (const [x, z] of [[1108, 1738], [1124, 1738], [1108, 1758], [1132, 1758]] as const) {
    kit.frame(x, z, 0, 0);
    kit.g("metal").cylinder(0, 0, 0, 0.06, 0.06, 2.4, 6, dark);
    kit.g("emissive").box(0, 2.45, 0, 0.35, 0.24, 0.35, rgb("#ffe1a3"));
    kit.collide(0, 1.2, 0, 0.15, 2.4, 0.15);
  }
  // A simple red-and-white local landmark near the arrival clearing.
  kit.frame(1092, 1764, 0, 0);
  kit.g("metal").cylinder(0, 0, 0, 0.05, 0.05, 5, 6, dark);
  kit.g("fabric").quad(new Vector3(0, 4.8, 0), new Vector3(2, 4.8, 0), new Vector3(2, 3.8, 0), new Vector3(0, 3.8, 0), rgb("#b63831"));
  kit.collide(0, 2.5, 0, 0.15, 5, 0.15);
  buildWinterBackdrop(kit);
  kit.world();
}
