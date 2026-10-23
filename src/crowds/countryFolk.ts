import type { ResidentDef } from "./Crowd";
import { constableLook, randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import { buildStreetWalkGraph, type NavGraph } from "../world/nav";
import { OUTER_BUILDINGS, PLOTS, REHRIS, ROADS, VILLAGE, CITY, TOWN, CANAL, site, type Site } from "../world/region";
import { isOpenGround } from "../world/layout";
import { HOME_ID } from "../world/home";
import { colonyLife } from "../world/colonySeats";
import { Rng } from "../render/textures";
import { CITY_SHOPS } from "../world/cityShops";
import { TRADE } from "../missions/Shops";
import { OPEN_HOUSES } from "../world/openHouses";

/**
 * People outside the bazaar, grouped by area. The game spawns a group when
 * the player comes within its radius and removes it again when they leave,
 * so the whole map can be lived-in without simulating everyone at once.
 */
export interface FolkGroup { id: string; x: number; z: number; radius: number; defs: ResidentDef[] }

const centre = (s: Site) => ({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 });

/**
 * Split a district's pedestrians into small, locally-loaded groups.
 *
 * A single group covering all of Ludhiana loaded ninety-six people spread
 * over four hundred metres of street — which is five people within sight of
 * wherever you stood, and the cost of ninety-one you could not see. Bucket
 * them by where they start instead: only the two or three cells around the
 * player load, so the bazaar is packed everywhere you actually are, and the
 * far side of the district costs nothing.
 */
/**
 * Fill a site (a bus adda, a wholesale mandi) with the crowd that belongs to
 * it: people standing about waiting, haggling, loafing. The street-walk
 * graphs run down the roads outside these places, so without this they were
 * open yards with a tout and nobody to tout at.
 */
function siteCrowd(prefix: string, s: Site, n: number, seed: number, make: (i: number, x: number, z: number) => ResidentDef): ResidentDef[] {
  const r = new Rng(seed);
  const out: ResidentDef[] = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const x = r.range(s.x0 + 5, s.x1 - 5), z = r.range(s.z0 + 5, s.z1 - 5);
    if (!isOpenGround(x, z)) continue;
    out.push(make(out.length, x, z));
  }
  void prefix;
  return out;
}

function cellGroups(prefix: string, defs: ResidentDef[], cell = 44, radius = 78): FolkGroup[] {
  const by = new Map<string, ResidentDef[]>();
  for (const d of defs) {
    const key = `${Math.floor(d.x / cell)}:${Math.floor(d.z / cell)}`;
    const list = by.get(key);
    if (list) list.push(d); else by.set(key, [d]);
  }
  const out: FolkGroup[] = [];
  for (const [key, list] of by) {
    const cx = list.reduce((a, d) => a + d.x, 0) / list.length;
    const cz = list.reduce((a, d) => a + d.z, 0) / list.length;
    out.push({ id: `${prefix}_${key.replace(":", "_")}`, x: cx, z: cz, radius, defs: list });
  }
  return out;
}

function farmer(seed: number): Appearance {
  const a = randomAppearance(seed);
  if (a.sex === "f") return { ...a, age: a.age === "child" ? "adult" : a.age, dupatta: a.dupatta ?? "#f2c94c" };
  return { ...a, age: a.age === "child" ? "adult" : a.age, top: "kurta", topColor: ["#f1ece0", "#e9d8a6", "#cfd8dc", "#d7ccc8"][seed % 4]!, bottom: "pajama", bottomColor: "#f1ece0", headwear: seed % 3 ? "turban" : "patka", headColor: ["#f3f3f3", "#ff9800", "#1565c0", "#2e7d32", "#c62828"][seed % 5]!, beard: a.age === "elder" ? "full" : a.beard };
}

/** Nihang Singh: deep-blue chola, tall dumalla, flowing beard. */
function nihang(seed: number): Appearance {
  return { ...randomAppearance(seed), sex: "m", age: seed % 3 ? "adult" : "elder", top: "kurta", topColor: "#1a237e", topTrim: "#ff9800", bottom: "pajama", bottomColor: "#1a237e", headwear: "turban", headColor: seed % 2 ? "#0d47a1" : "#ff8f00", beard: "full", height: 1.85, build: 1.1 };
}

/** Government-school uniform: white shirt, navy trousers/salwar, a patka or plaits. */
function schoolKid(seed: number): Appearance {
  const a = randomAppearance(seed);
  return { ...a, age: "child", height: 1.25 + (seed % 4) * 0.06, top: a.sex === "f" ? "kameez" : "shirt", topColor: "#f5f5f5", bottom: a.sex === "f" ? "salwar" : "trousers", bottomColor: "#1a237e", headwear: a.sex === "m" ? "patka" : "none", headColor: "#1a237e", beard: "none", dupatta: a.sex === "f" ? "#1a237e" : undefined };
}

/** What each kind of cart-wala shouts down the street. */
const CRIES: Record<string, string[]> = {
  sabzi: ["Aaloo lo, pyaaz lo — taaze taaze!", "Aloo, pyaaz, tamatar — sasta sasta!", "Bhindi le lo, bhenji, ajj hi tod ke liaanda!"],
  fruit: ["Kinnow, kele, ambh — mitthe mitthe!", "Chakh ke dekho, phir lao!", "Angoor sau da kilo, lai lo!"],
  chaat: ["Gol gappe! Teekhe ya mitthe?", "Ik plate hor, bhaji?", "Tikki garam garam!"],
  ganna: ["Ganne da ras — thanda thanda!", "Nimbu-adrak paa ke, ji!"],
};

/** An adult woman of the "I have opinions about this street" persuasion. */
function aunty(seed: number): Appearance {
  const a = randomAppearance(seed);
  return {
    ...a, sex: "f", age: seed % 4 ? "adult" : "elder", top: "kameez",
    topColor: ["#ad1457", "#00695c", "#6a1b9a", "#ef6c00", "#283593"][seed % 5]!,
    bottom: "salwar", bottomColor: "#f6efe0", dupatta: ["#ffd54f", "#ef9a9a", "#b2dfdb", "#f8bbd0"][seed % 4]!,
    hair: "bun", headwear: "none", beard: "none", height: 1.55 + (seed % 5) * 0.02,
  };
}

/** The routes an auto-wala barks at a stand, called out one word at a time. */
const AUTO_CALLS = [
  "Gill, Gill, Gill!", "Ludhiana, Ludhiana, Ludhiana!", "Jagraon, Jagraon — ik seat!",
  "Chalo bhaiya, ik sawari hor!", "Baith jao ji, auto chaleya!", "Samrala, Samrala — pichhe jagah ae!",
  "Bus adda, bus adda — paanch rupaye!",
];
const BUS_CALLS = [
  "Ludhiana! Jalandhar! Amritsar! Baith jao!", "Chandigarh di bus — turant!",
  "Tikat lao ji, tikat!", "Pichhe sarko, pichhe!",
];
const DOODH_CALLS = ["Doodh le lo ji, doodh!", "Taaza doodh — maakhan wala!", "Doodh-dahi, doodh-dahi!"];
const KABADI_CALLS = ["Kabaaad-i-walaaa!", "Purane akhbaar, botal, loha!", "Raddi de do ji!"];

export function countryFolk(): { groups: FolkGroup[]; cityGraph: NavGraph; villageGraph: NavGraph } {
  const rng = new Rng(2626);
  const groups: FolkGroup[] = [];
  const shops = OUTER_BUILDINGS.filter((b) => b.style === "city" && b.shop).map((b) => {
    // A point just in front of the shop's open front.
    const f = b.face, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (Math.abs(f) < 0.01) return { x: cx, z: b.z1 + 1.2 };
    if (Math.abs(f - Math.PI) < 0.01) return { x: cx, z: b.z0 - 1.2 };
    if (f < 0) return { x: b.x0 - 1.2, z: cz };
    return { x: b.x1 + 1.2, z: cz };
  });
  const cityGraph = buildStreetWalkGraph(["ave0", "ave1", "ave2", "ave3", "st0", "st1", "st2"], shops);
  const villageGraph = buildStreetWalkGraph(["pindMain", "pindCross"]);
  let n = 0;
  const id = (p: string) => `${p}${n++}`;

  // ---- Farmers working the fields (pairs in some plots, all over the map).
  const farmPlots = PLOTS.filter((_p, i) => i % 9 === 0 && _p.crop !== "fallow");
  for (const p of farmPlots) {
    const defs: ResidentDef[] = [];
    const w = { x0: p.x0 + 2, x1: p.x1 - 2, z0: p.z0 + 2, z1: p.z1 - 2 };
    const k = rng.next() < 0.4 ? 2 : 1;
    for (let i = 0; i < k; i++) {
      defs.push({ id: id("kisaan"), name: "Kisaan", role: "roamer", look: farmer(300 + n), x: (w.x0 + w.x1) / 2 + i * 2, z: (w.z0 + w.z1) / 2, yaw: rng.next() * 6, wander: w, gesture: "work", lines: ["Is vaar fasal changi ae, rabb di mehar!", "Mandi vich bhaa theek mil jaave bas.", "Tubewell di light phir chali gayi!", "Ajj mausam vadhiya ae."] });
    }
    groups.push({ id: `farm_${p.id}`, x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2, radius: 230, defs });
  }

  // ---- Pind Kotli: walkers, a chowk chat, kids at the kabaddi ground.
  {
    const defs: ResidentDef[] = [];
    for (let i = 0; i < 12; i++) {
      const nd = villageGraph.nodes[(i * 7) % villageGraph.nodes.length]!;
      defs.push({ id: id("pind"), name: "Villager", role: "walker", look: farmer(1500 + i * 3), x: nd.x, z: nd.z, yaw: 0, graph: villageGraph });
    }
    defs.push({ id: "sarpanch", name: "Sarpanch Hardev Singh", role: "keeper", contact: true, look: { ...farmer(1600), sex: "m", age: "elder", headwear: "turban", headColor: "#f3f3f3", beard: "full", topColor: "#f5f5f5", vest: "#3e2723", top: "kurta" }, x: -12, z: 318, yaw: 0, lines: ["Pind di panchayat vich sab da swagat ae.", "Naali pakki karvauni ae is saal."] });
    for (const [x, z, y] of [[-16, 316.8, 0], [-14.2, 317, Math.PI]] as const) defs.push({ id: id("pindChat"), name: "Villager", role: "chatter", look: farmer(1700 + n), x, z, yaw: y });
    const kb = site("kabaddi");
    const kw = { x0: kb.x0 + 6, x1: kb.x1 - 6, z0: kb.z0 + 6, z1: kb.z1 - 6 };
    for (let i = 0; i < 6; i++) {
      const look = randomAppearance(1800 + i * 5);
      defs.push({ id: id("kabaddi"), name: "Kabaddi player", role: "roamer", look: { ...look, sex: "m", age: i < 3 ? "child" : "adult", top: "vest", vest: "#fafafa", topColor: "#fafafa", bottom: "pajama", bottomColor: i % 2 ? "#c62828" : "#1565c0", height: i < 3 ? 1.35 : 1.75, headwear: "patka", headColor: "#fbc02d" }, x: (kw.x0 + kw.x1) / 2 + i, z: (kw.z0 + kw.z1) / 2, yaw: 0, wander: kw, gesture: i % 2 ? "cheer" : undefined });
    }
    // Spectators at the akhada.
    for (let i = 0; i < 3; i++) defs.push({ id: id("akhadaFan"), name: "Spectator", role: "seated", look: farmer(1900 + i), x: -53, z: 340 + i * 4, y: 0.45, yaw: Math.PI / 2 });
    groups.push({ id: "village", x: (VILLAGE.x0 + VILLAGE.x1) / 2, z: (VILLAGE.z0 + VILLAGE.z1) / 2, radius: 260, defs });
  }

  // ---- Nawan Shehar: shoppers on the streets, chatter at the chowk, passengers at the bus adda.
  {
    const defs: ResidentDef[] = [];
    const cityWalkers: ResidentDef[] = [];
    for (let i = 0; i < 90; i++) {
      const nd = cityGraph.nodes[(i * 13) % cityGraph.nodes.length]!;
      cityWalkers.push({ id: id("city"), name: "Resident", role: "walker", look: randomAppearance(2100 + i * 7), x: nd.x + rng.range(-2.5, 2.5), z: nd.z + rng.range(-2.5, 2.5), yaw: 0, graph: cityGraph });
    }
    groups.push(...cellGroups("cityWalk", cityWalkers));
    // Constables on the beat around the chowk and the bus adda.
    for (let i = 0; i < 3; i++) {
      const nd = cityGraph.nodes[(i * 41 + 5) % cityGraph.nodes.length]!;
      defs.push({ id: id("cityBeat"), name: "Constable", role: "walker", faction: "police", tough: 1.4, look: constableLook(60 + i), x: nd.x, z: nd.z, yaw: 0, graph: cityGraph, lines: ["Helmet kithe ae?", "Chal, chal, bheed na laao!", "Sab theek-thaak?"] });
    }
    const gg = centre(site("ghantaGhar"));
    for (let i = 0; i < 4; i++) defs.push({ id: id("chowk"), name: "Resident", role: "chatter", look: randomAppearance(2300 + i * 3), x: gg.x - 6 + (i % 2) * 1.2, z: gg.z - 8 + Math.floor(i / 2) * 1.3, yaw: (i % 2) * Math.PI });
    const bus = site("busAdda");
    for (let i = 0; i < 6; i++) defs.push({ id: id("passenger"), name: "Passenger", role: i % 3 ? "seated" : "chatter", look: randomAppearance(2400 + i * 9), x: bus.x0 + 9 + i * 6, z: bus.z1 - 10.2, y: i % 3 ? 0.85 : 0.3, yaw: Math.PI, lines: ["Ludhiana di bus kado aaugi?", "Conductor saab, seat milugi?"] });
    defs.push({ id: "conductor", name: "Conductor Bittu", role: "keeper", contact: true, look: { ...randomAppearance(2500), sex: "m", age: "adult", top: "shirt", topColor: "#90a4ae", bottom: "trousers", bottomColor: "#37474f", headwear: "patka", headColor: "#37474f" }, x: bus.x1 - 18, z: bus.z1 - 3, yaw: Math.PI, lines: ["Ludhiana, Jalandhar, Amritsar — baith jao!", "Tikat? Andar aa ke lao!"] });
    const md = site("mandi");
    const mw = { x0: md.x0 + 8, x1: md.x1 - 8, z0: md.z0 + 30, z1: md.z1 - 6 };
    for (let i = 0; i < 4; i++) defs.push({ id: id("palledar"), name: "Palledar", role: "roamer", look: farmer(2600 + i), x: (mw.x0 + mw.x1) / 2 + i * 3, z: (mw.z0 + mw.z1) / 2, yaw: 0, wander: mw, gesture: "work" });
    defs.push({ id: "munshi", name: "Munshi Ji", role: "keeper", contact: true, look: { ...randomAppearance(2700), sex: "m", age: "elder", top: "kurta", topColor: "#f5f5f5", headwear: "cap", headColor: "#f5f5f5", beard: "mustache" }, x: (md.x0 + md.x1) / 2, z: md.z1 - 4, yaw: 0, lines: ["Kanak di boli kal savere hougi.", "Hisaab-kitaab saaf rakhna puttar."] });
    const th = site("thana");
    defs.push({ id: "balwant", name: "Havaldar Balwant", role: "keeper", contact: true, faction: "police", tough: 1.4, look: { ...randomAppearance(2800), sex: "m", age: "adult", top: "shirt", topColor: "#b59a62", bottom: "trousers", bottomColor: "#a88c58", headwear: "turban", headColor: "#1a237e", beard: "full", build: 1.25 }, x: (th.x0 + th.x1) / 2, z: th.z0 + 14.5, yaw: 0, lines: ["Sab theek-thaak? Koi shikayat?", "Chai da time ho gaya…"] });
    const cn = site("cinema");
    defs.push({ id: "ticketwala", name: "Ticket-wala Raju", role: "keeper", contact: true, look: { ...randomAppearance(2900), sex: "m", age: "adult", top: "shirt", topColor: "#e53935" }, x: (cn.x0 + cn.x1) / 2 - 4, z: cn.z1 - 6, yaw: 0, lines: ["Sardar Superstar — housefull!", "Balcony da tikat? Doguna!"] });
    groups.push({ id: "city", x: (CITY.x0 + CITY.x1) / 2, z: (CITY.z0 + CITY.z1) / 2, radius: 290, defs });
    groups.push(...cellGroups("busAddaCrowd", siteCrowd("busAdda", bus, 26, 7711, (i, x, z) => ({
      id: id("addaWait"), name: "Sawari", role: i % 4 === 0 ? "chatter" : "roamer", look: randomAppearance(7700 + i * 11),
      x, z, yaw: rng.range(-Math.PI, Math.PI), wander: { x0: bus.x0 + 4, x1: bus.x1 - 4, z0: bus.z0 + 4, z1: bus.z1 - 4 },
      lines: ["Bus late ae, hamesha vangu.", "Jalandhar wali aa gayi?", "Tikat khidki te lambi line ae."],
    }))));
    groups.push(...cellGroups("mandiCrowd", siteCrowd("mandi", md, 20, 7712, (i, x, z) => ({
      id: id("mandiFolk"), name: i % 3 === 0 ? "Aadhti" : "Kisan", role: i % 3 === 0 ? "chatter" : "roamer",
      look: farmer(7600 + i * 7), x, z, yaw: rng.range(-Math.PI, Math.PI),
      wander: { x0: md.x0 + 4, x1: md.x1 - 4, z0: md.z0 + 4, z1: md.z1 - 4 }, gesture: i % 4 === 1 ? "work" : undefined,
      lines: ["Boli kinni lagi aj?", "Namii zyada ae, rate girega.", "Tarazu sahi tol, bhai."],
    }))));
  }

  // ---- Ludhiana: the loud one. Pavements full, autos touting at the adda,
  // vendors on the tarmac, aunties holding court outside their shops.
  {
    const ludhShops = OUTER_BUILDINGS.filter((b) => b.id.startsWith("ludh") && b.shop).map((b) => {
      const f = b.face, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (Math.abs(f) < 0.01) return { x: cx, z: b.z1 + 1.2 };
      if (Math.abs(f - Math.PI) < 0.01) return { x: cx, z: b.z0 - 1.2 };
      if (f < 0) return { x: b.x0 - 1.2, z: cz };
      return { x: b.x1 + 1.2, z: cz };
    });
    const ludhGraph = buildStreetWalkGraph(["ludhA0", "ludhA1", "ludhA2", "ludhS0", "ludhS1", "ludhS2", "ludhG0", "ludhG1"], ludhShops);
    const defs: ResidentDef[] = [];
    // Shoppers, shoulder to shoulder. Weighted onto the bazaar streets and
    // the two galis rather than spread evenly: a crowd is only a crowd where
    // it is concentrated, and the outer avenues should feel like the way in.
    const BAZAAR_STREETS = new Set(["ludhS1", "ludhS2", "ludhG0", "ludhG1"]);
    const inner = ludhGraph.nodes.filter((nd) => nd.kind === "walk" && BAZAAR_STREETS.has(nd.tag ?? ""));
    const outer = ludhGraph.nodes.filter((nd) => nd.kind === "walk" && !BAZAAR_STREETS.has(nd.tag ?? ""));
    // Streamed per cell (see cellGroups), so the headcount here is the
    // district total, not what is live at once.
    const walkers: ResidentDef[] = [];
    for (let i = 0; i < 190; i++) {
      const pool = (i % 4 === 3 && outer.length) || !inner.length ? outer : inner;
      const nd = pool[(i * 7) % pool.length]!;
      const roll = rng.next();
      const look = roll < 0.3 ? aunty(6000 + i * 3) : roll < 0.45 ? schoolKid(6000 + i * 3) : randomAppearance(6000 + i * 7);
      // Spread them along the footpath rather than stacking on the waypoint.
      walkers.push({ id: id("ludh"), name: "Shehri", role: "walker", look, x: nd.x + rng.range(-2.5, 2.5), z: nd.z + rng.range(-2.5, 2.5), yaw: 0, graph: ludhGraph });
    }
    groups.push(...cellGroups("ludhWalk", walkers));
    // Four constables on the beat — this is a chowki town.
    for (let i = 0; i < 4; i++) {
      const nd = ludhGraph.nodes[(i * 37 + 9) % ludhGraph.nodes.length]!;
      defs.push({ id: id("ludhBeat"), name: "Constable", role: "walker", faction: "police", tough: 1.4, look: constableLook(120 + i), x: nd.x, z: nd.z, yaw: 0, graph: ludhGraph, lines: ["Gaddi side te lao!", "Bheed na laao ji!", "Helmet kithe ae?"] });
    }
    // The auto adda: touts calling their routes at the top of their lungs.
    const adda = site("ludhAdda");
    for (let i = 0; i < 5; i++) {
      defs.push({
        id: id("autowala"), name: "Auto-wala", role: "keeper",
        look: { ...randomAppearance(6200 + i * 5), sex: "m", age: "adult", top: "shirt", topColor: ["#8d6e63", "#455a64", "#6d4c41"][i % 3]!, headwear: i % 2 ? "patka" : "cap", headColor: "#37474f" },
        x: adda.x0 + 12 + i * 9, z: adda.z1 - 7, yaw: Math.PI,
        callKind: "auto", calls: AUTO_CALLS, lines: AUTO_CALLS, callClip: "call_auto_gill|call_auto_ludhiana",
      });
    }
    defs.push({
      id: id("conductor"), name: "Conductor", role: "keeper",
      look: { ...randomAppearance(6250), sex: "m", age: "adult", top: "shirt", topColor: "#90a4ae", bottom: "trousers", bottomColor: "#37474f" },
      x: adda.x1 - 14, z: adda.z1 - 4, yaw: Math.PI, callKind: "bus", calls: BUS_CALLS, lines: BUS_CALLS, callClip: "call_bus",
    });
    // Sabzi mandi: sellers behind their heaps, and the kabadi-wala doing rounds.
    const md = site("ludhMandi");
    const mw = { x0: md.x0 + 8, x1: md.x1 - 8, z0: md.z0 + 8, z1: md.z1 - 8 };
    for (let i = 0; i < 6; i++) {
      defs.push({
        id: id("sabziwala"), name: "Sabzi wala", role: "keeper", look: farmer(6300 + i * 3),
        x: mw.x0 + 6 + i * 11, z: mw.z0 + 6 + (i % 2) * 9, yaw: 0,
        callKind: "sabzi", calls: CRIES.sabzi!, lines: CRIES.sabzi!, callClip: "call_sabzi",
      });
    }
    defs.push({
      id: id("kabadi"), name: "Kabadi wala", role: "roamer", look: { ...randomAppearance(6350), sex: "m", age: "adult" },
      x: (mw.x0 + mw.x1) / 2, z: mw.z1 - 3, yaw: 0, wander: mw, callKind: "kabadi", calls: KABADI_CALLS, lines: KABADI_CALLS, callClip: "call_kabadi",
    });
    // The doodhwala at the chowk with his cans.
    const gh = centre(site("ludhGhanta"));
    defs.push({
      id: id("doodhwala"), name: "Doodh wala", role: "keeper",
      look: { ...farmer(6400), sex: "m", age: "adult", top: "vest", vest: "#f5f5f5", topColor: "#f5f5f5" },
      x: gh.x + 7, z: gh.z - 9, yaw: -Math.PI / 2, callKind: "doodh", calls: DOODH_CALLS, lines: DOODH_CALLS, callClip: "call_doodh",
    });
    // Aunties outside the shops, mid-opinion. Jhagde picks quarrels from here.
    // Picked off the footpath graph so nobody ends up standing inside a shop.
    const auntySpots = ludhGraph.nodes.filter((n) => n.kind === "walk" && isOpenGround(n.x, n.z));
    for (let i = 0; i < 4 && auntySpots.length; i++) {
      const nd = auntySpots[(i * 29 + 3) % auntySpots.length]!;
      for (const [dx, dz, face] of [[0, 0, 0], [0.65, 0.75, Math.PI]] as const) {
        if (!isOpenGround(nd.x + dx, nd.z + dz)) continue;
        defs.push({
          id: id("aunty"), name: "Aunty ji", role: "chatter", look: aunty(6500 + defs.length),
          x: nd.x + dx, z: nd.z + dz, yaw: face,
          lines: ["Suno ji, ajj doodh phir khatta si!", "Oh di nuuh kal phir shehar gayi si…", "Saadi gali vich kachra kaun suttda ae?"],
        });
      }
    }
    // The fixed cast (shopkeepers, touts, sellers, constables, aunties) stays
    // one district-wide group: they belong to particular spots, and there are
    // few enough of them to keep loaded.
    groups.push(...cellGroups("ludhPlace", defs, 70, 150));
    groups.push(...cellGroups("ludhAddaCrowd", siteCrowd("ludhAdda", adda, 30, 7721, (i, x, z) => ({
      id: id("ludhWait"), name: "Sawari", role: i % 4 === 0 ? "chatter" : "roamer", look: randomAppearance(7800 + i * 9),
      x, z, yaw: rng.range(-Math.PI, Math.PI), wander: { x0: adda.x0 + 4, x1: adda.x1 - 4, z0: adda.z0 + 4, z1: adda.z1 - 4 },
      lines: ["Gill wala auto kithe khada?", "Sharing vich jaana, bhai.", "Kinne paise lavega?"],
    }))));
    groups.push(...cellGroups("ludhMandiCrowd", siteCrowd("ludhMandi", md, 24, 7722, (i, x, z) => ({
      id: id("ludhMandiFolk"), name: i % 3 === 0 ? "Aadhti" : "Grahak", role: i % 3 === 0 ? "chatter" : "roamer",
      look: i % 2 ? aunty(7900 + i * 5) : farmer(7900 + i * 5), x, z, yaw: rng.range(-Math.PI, Math.PI),
      wander: { x0: md.x0 + 4, x1: md.x1 - 4, z0: md.z0 + 4, z1: md.z1 - 4 }, gesture: i % 5 === 1 ? "work" : undefined,
      lines: ["Bhindi taazi ae?", "Thoda kam karo ji.", "Do kilo tol do."],
    }))));
  }

  // ---- Auto stands elsewhere: a tout and a waiting sawari at each.
  for (const [sx, sz, sy] of [[458, -80, Math.PI], [0, -88, 0]] as const) {
    // Stand on whichever side of the stand is actually clear.
    const spot = ([[3, 2], [-3, 2], [3, -2], [-3, -2], [0, 4]] as const)
      .map(([dx, dz]) => ({ x: sx + dx, z: sz + dz }))
      .filter((q) => isOpenGround(q.x, q.z));
    if (spot.length < 2) continue;
    groups.push({
      id: `autostand_${sx}`, x: sx, z: sz, radius: 170, defs: [
        { id: id("autowala"), name: "Auto-wala", role: "keeper", look: { ...randomAppearance(6600 + Math.abs(sx)), sex: "m", age: "adult", top: "shirt", topColor: "#8d6e63", headwear: "patka", headColor: "#37474f" }, x: spot[0]!.x, z: spot[0]!.z, yaw: sy, callKind: "auto", calls: AUTO_CALLS, lines: AUTO_CALLS, callClip: "call_auto_gill|call_auto_ludhiana" },
        { id: id("sawari"), name: "Sawari", role: "chatter", look: aunty(6650 + Math.abs(sx)), x: spot[1]!.x, z: spot[1]!.z, yaw: sy + Math.PI, lines: ["Kinne lavoge bhaiya?", "Meter naal chalo ji."] },
      ],
    });
  }

  // ---- Highway dhaba and petrol pump.
  {
    const s = site("sherDhaba"), c = centre(s);
    const defs: ResidentDef[] = [];
    const truckers = [[62, -191], [71, -191], [80, -184], [89, -184], [71, -184]] as const;
    truckers.forEach(([x, z], i) => defs.push({ id: id("trucker"), name: "Trucker", role: "seated", look: { ...farmer(3100 + i), sex: "m", age: "adult" }, x, z, y: 0.45, yaw: rng.next() * 6, lines: ["Amritsar ton Delhi, bina rukke!", "Ethe di daal — wah!"] }));
    defs[0]!.id = "sukhi";
    defs[0]!.name = "Sukhi Bhaji (trucker)";
    defs[0]!.contact = true;
    defs.push({ id: "sherOwner", name: "Sher Singh", role: "keeper", look: { ...farmer(3200), sex: "m", age: "adult", build: 1.3, apron: "#e0d6c0" }, x: c.x, z: s.z0 + 9, yaw: 0, lines: ["Tandoori parantha, makhan naal?", "Truckan waaleyan da pakka adda!"] });
    const pp = site("petrol");
    defs.push({ id: "pumpwala", name: "Pump attendant", role: "keeper", contact: true, look: { ...randomAppearance(3300), sex: "m", age: "adult", top: "shirt", topColor: "#1b8a5a", headwear: "cap", headColor: "#f6d743" }, x: (pp.x0 + pp.x1) / 2 - 5, z: (pp.z0 + pp.z1) / 2 + 3, yaw: 0, lines: ["Kinne da paava? Full tank?", "Hawa muft ae ji!"] });
    // Truck drivers by their parked trucks: one checks a tyre, two share a bidi-break chat.
    defs.push({ id: id("trucker"), name: "Truck driver", role: "keeper", look: { ...farmer(3150), sex: "m", age: "adult", headwear: "patka", headColor: "#ff9800" }, x: 96.8, z: -179.5, yaw: Math.PI / 2, gesture: "work", lines: ["Tyre di hawa ghatt ae…", "Raat nu Jammu pahunchna ae!"] });
    defs.push({ id: id("trucker"), name: "Truck driver", role: "chatter", look: { ...farmer(3160), sex: "m", age: "adult" }, x: 65.2, z: -174.4, yaw: Math.PI, lines: ["Ludhiane ton maal chukkna ae.", "Naka te phir rok liya si!"] });
    defs.push({ id: id("trucker"), name: "Cleaner", role: "chatter", look: { ...randomAppearance(3170), sex: "m", age: "adult", top: "vest", vest: "#eeeeee", topColor: "#eeeeee" }, x: 65.2, z: -175.7, yaw: 0, lines: ["Ustaad ji, chah peeni ae?"] });
    groups.push({ id: "highway", x: c.x + 30, z: c.z, radius: 240, defs });
  }

  // ---- A truck broken down on the G.T. Road shoulder: driver under it, helper flagging traffic.
  {
    const defs: ResidentDef[] = [];
    defs.push({ id: id("breakdown"), name: "Truck driver", role: "keeper", look: { ...farmer(3180), sex: "m", age: "adult", top: "vest", vest: "#f5f5f5", topColor: "#f5f5f5" }, x: -146.4, z: -170.9, yaw: -Math.PI / 2, gesture: "work", lines: ["Kamaani tutt gayi! Mistri kithe milu?", "Jack ditta, bhaji? Rabb tera bhala kare."] });
    defs.push({ id: id("breakdown"), name: "Truck cleaner", role: "keeper", look: { ...randomAppearance(3190), sex: "m", age: "adult" }, x: -157.5, z: -171.0, yaw: Math.PI / 2, gesture: "argue", lines: ["Side ho ke langho ji!", "Patthar rakh ditte ne, dhyaan naal!"] });
    groups.push({ id: "breakdown", x: -150, z: -168, radius: 200, defs });
  }

  // ---- Deras: a farm family each, and Jarnail Singh (a delivery customer).
  for (const sid of ["deraW", "deraSW", "deraNE", "deraNW", "deraSE"]) {
    const s = site(sid), c = centre(s);
    const defs: ResidentDef[] = [];
    const w = { x0: s.x0 + 4, x1: s.x1 - 4, z0: s.z0 + 4, z1: s.z1 - 14 };
    defs.push({ id: sid === "deraW" ? "jarnail" : id("dera"), name: sid === "deraW" ? "Jarnail Singh" : "Farmer", role: sid === "deraW" ? "keeper" : "roamer", contact: sid === "deraW", look: farmer(3500 + n), x: c.x - 6, z: c.z - 4, yaw: 0, wander: w, lines: ["Aao ji, lassi peeo!", "Tractor di service karvauni ae."] });
    defs.push({ id: id("dera"), name: "Farmer", role: "roamer", look: farmer(3600 + n), x: c.x + 2, z: c.z - 6, yaw: 0, wander: w, gesture: "work" });
    groups.push({ id: sid, x: c.x, z: c.z, radius: 220, defs });
  }
  // ---- Police naka on the G.T. Road where the Bazaar Road joins it.
  {
    const defs: ResidentDef[] = [];
    const L = ["Kaagaz dikhao ji.", "Naka laggeya ae, dheere!", "Kithon aa rahe ho?"];
    defs.push({ id: id("naka"), name: "Havaldar (naka)", role: "keeper", faction: "police", tough: 1.4, look: constableLook(80), x: 9, z: -151.2, yaw: Math.PI, lines: L });
    defs.push({ id: id("naka"), name: "Constable (naka)", role: "keeper", faction: "police", tough: 1.4, look: constableLook(81), x: 12.5, z: -151.6, yaw: -2.6, lines: L });
    defs.push({ id: id("naka"), name: "Constable (naka)", role: "keeper", faction: "police", tough: 1.4, look: constableLook(82), x: -9, z: -168.8, yaw: 0.3, lines: L });
    groups.push({ id: "naka", x: 0, z: -160, radius: 200, defs });
  }

  // ---- Rehri-walas behind their carts.
  const CALL_KIND: Record<string, "sabzi" | "fruit" | "chaat"> = { sabzi: "sabzi", fruit: "fruit", chaat: "chaat", ganna: "fruit" };
  REHRIS.forEach((r, i) => {
    // Vendor stands at the cart's back (local -Z), facing the road.
    const lx = 0.2, lz = -1.0;
    const x = r.x + lx * Math.cos(r.yaw) + lz * Math.sin(r.yaw), z = r.z - lx * Math.sin(r.yaw) + lz * Math.cos(r.yaw);
    const look = i % 3 ? farmer(5000 + i) : randomAppearance(5000 + i);
    const defs: ResidentDef[] = [{
      id: id("rehri"), name: r.goods === "chaat" ? "Gol-gappe wala" : r.goods === "ganna" ? "Ras wala" : "Rehri wala",
      role: "keeper", look: { ...look, age: look.age === "child" ? "adult" : look.age }, x, z, yaw: r.yaw,
      lines: CRIES[r.goods]!, callKind: CALL_KIND[r.goods], calls: CRIES[r.goods]!, callClip: r.goods === "sabzi" ? "call_sabzi" : r.goods === "fruit" ? "call_fruit" : r.goods === "chaat" ? "call_chaat" : undefined,
    }];
    // Carts in the crowded streets have a customer or two haggling at them.
    if (i % 3 === 0) {
      // On the cart's customer side, but only where there is pavement for them.
      const cx = r.x + Math.sin(r.yaw) * 1.5, cz = r.z + Math.cos(r.yaw) * 1.5;
      if (isOpenGround(cx, cz)) {
        defs.push({ id: id("grahak"), name: "Customer", role: "chatter", look: aunty(5500 + i), x: cx, z: cz, yaw: r.yaw + Math.PI, lines: ["Bhaiya, mehnga laga reha ae!", "Thoda dhania muft paa do."] });
      }
    }
    groups.push({ id: `rehri${i}`, x: r.x, z: r.z, radius: 160, defs });
  });

  // ---- Colonies and village mohallas: people walking the galis, aunties at
  // the gates, elders on a charpai or a plastic chair outside the house.
  const colonyRoads = new Set<string>();
  for (const { colony: c, graph: g, walks, seats } of colonyLife()) {
    c.roads.forEach((r) => colonyRoads.add(r.id));
    colonyRoads.delete("pindMain"); colonyRoads.delete("pindCross");
    if (!walks.length) continue;
    const village = c.kind === "village";
    const walkers: ResidentDef[] = [];
    const nw = Math.min(70, Math.round(walks.length / 3));
    for (let i = 0; i < nw; i++) {
      const nd = walks[(i * 11 + 3) % walks.length]!;
      const roll = rng.next();
      const look = village ? (roll < 0.35 ? aunty(8000 + i * 3) : roll < 0.5 ? schoolKid(8000 + i) : farmer(8000 + i * 5)) : roll < 0.35 ? aunty(8000 + i * 3) : roll < 0.55 ? schoolKid(8000 + i) : randomAppearance(8000 + i * 7);
      walkers.push({ id: id(c.id), name: village ? "Villager" : "Resident", role: "walker", look, x: nd.x, z: nd.z, yaw: 0, graph: g });
    }
    groups.push(...cellGroups(`${c.id}Walk`, walkers));
    const sit: ResidentDef[] = [];
    seats.forEach((st, i) => {
      // Bapu ji / bebe ji on the manji (a plastic chair in a colony), watching the gali.
      const elder = { ...(i % 2 === 0 ? farmer(8500 + i) : aunty(8500 + i)), age: "elder" as const };
      sit.push({ id: id("elder"), name: elder.sex === "f" ? "Bebe ji" : "Bapu ji", role: "seated", look: elder, x: st.x, z: st.z, y: village ? 0.45 : 0.42, yaw: st.yaw, lines: ["Puttar, kithon aaya?", "Saade vele ethe khet hunde si.", "Rotti kha ke jaayi!", "Dhyaan naal chalaya kar gaddi!"] });
    });
    for (let i = 0; i < Math.min(5, walks.length / 15); i++) {
      const nd = walks[(i * 53 + 29) % walks.length]!;
      if (!isOpenGround(nd.x + 0.7, nd.z + 0.7)) continue;
      for (const [dx, dz, face] of [[0, 0, 0.8], [0.7, 0.7, 0.8 + Math.PI]] as const) {
        sit.push({ id: id("aunty"), name: "Aunty ji", role: "chatter", look: aunty(8600 + i * 2 + dx), x: nd.x + dx, z: nd.z + dz, yaw: face, lines: ["Sharma ji di kudi vekhi?", "Kal phir light gayi si!", "Kaam wali ajj phir nahi aayi."] });
      }
    }
    groups.push(...cellGroups(`${c.id}Sit`, sit, 60, 90));
  }

  // ---- The government school: kids in uniform in the ground, Masterji keeping an eye.
  {
    const s = site("school"), c = centre(s);
    const w = { x0: s.x0 + 16, x1: s.x1 - 6, z0: s.z0 + 13, z1: s.z1 - 16 };
    const defs: ResidentDef[] = [];
    for (let i = 0; i < 14; i++) {
      defs.push({ id: id("student"), name: "School kid", role: "roamer", look: schoolKid(9000 + i * 7), x: rng.range(w.x0, w.x1), z: rng.range(w.z0, w.z1), yaw: rng.next() * 6, wander: w, gesture: i % 4 === 0 ? "cheer" : undefined, lines: ["Masterji aa gaye!", "Recess kado hougi?", "Homework nahi kitta…"] });
    }
    defs.push({ id: id("teacher"), name: "Masterji", role: "keeper", look: { ...randomAppearance(9100), sex: "m", age: "elder", top: "shirt", topColor: "#eeeeee", bottom: "trousers", bottomColor: "#5d4037", headwear: "turban", headColor: "#1565c0", beard: "full" }, x: c.x + 2, z: c.z - 2, yaw: 0, lines: ["Line vich khade ho jao!", "Pahada sunao — do dooni chaar!", "Kal maapeyan nu lai ke aayi."] });
    defs.push({ id: id("cook"), name: "Mid-day meal bibi", role: "keeper", look: aunty(9110), x: s.x1 - 9, z: s.z0 + 10, yaw: Math.PI, gesture: "work", lines: ["Daal-chawal tayyar ne, thaali lao!"] });
    groups.push({ id: "school", x: c.x, z: c.z, radius: 150, defs });
  }
  // ---- Civil hospital: patients waiting outside OPD, a nurse, the chowkidar at the gate.
  {
    const s = site("hospital"), c = centre(s);
    const defs: ResidentDef[] = [];
    for (let i = 0; i < 7; i++) {
      defs.push({ id: id("patient"), name: "Mareez", role: i < 4 ? "seated" : "chatter", look: i % 2 ? aunty(9200 + i) : farmer(9200 + i), x: s.x0 + 9.4 + i * 2, z: s.z0 + 23.6 + (i < 4 ? 0 : 1.6), y: i < 4 ? 0.48 : 0, yaw: i < 4 ? 0 : Math.PI, lines: ["Parchi kitthon bandi ae?", "Doctor saab kado aunge?", "Do ghante ho gaye line vich!"] });
    }
    defs.push({ id: id("nurse"), name: "Sister ji", role: "keeper", look: { ...aunty(9300), age: "adult", topColor: "#f5f5f5", bottomColor: "#f5f5f5", dupatta: "#f5f5f5" }, x: c.x - 1, z: s.z0 + 26, yaw: 0, lines: ["Line vich aao ji, ik ik karke.", "Emergency? Andar lai aao!"] });
    defs.push({ id: id("guard"), name: "Chowkidar", role: "keeper", look: { ...randomAppearance(9310), sex: "m", age: "elder", top: "shirt", topColor: "#5d6b4f", headwear: "cap", headColor: "#5d6b4f" }, x: c.x + 7, z: s.z1 - 2, yaw: Math.PI, lines: ["Gaddi baahar khadi karo ji!"] });
    groups.push({ id: "hospital", x: c.x, z: c.z, radius: 150, defs });
  }

  // ---- People walking along the roadsides: a few every stretch of road.
  for (const r of ROADS) {
    if (r.kind === "track" || r.id.startsWith("ave") || r.id.startsWith("st") || r.id.startsWith("pind") || colonyRoads.has(r.id)) continue;
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
    // A group every 70 m rather than every 110: the G.T. Road and the link
    // roads should never look empty between two villages.
    for (let a = a0 + 24; a < a1 - 30; a += 70) {
      const mid = a + 35;
      const cx = alongX ? mid : (r.x0 + r.x1) / 2, cz = alongX ? (r.z0 + r.z1) / 2 : mid;
      if (cx > TOWN.x0 - 10 && cx < TOWN.x1 + 10 && cz > TOWN.z0 - 10 && cz < TOWN.z1 + 10) continue;
      if (cz > CANAL.z0 - 20 && cz < CANAL.z1 + 20 && !alongX) continue;
      if (cx > CITY.x0 && cx < CITY.x1 && cz > CITY.z0 && cz < CITY.z1) continue;
      const defs: ResidentDef[] = [];
      for (const side of [-1, 1]) {
        // A shoulder strip 2.5 m wide just off the tarmac.
        const e = side < 0 ? (alongX ? r.z0 : r.x0) - 2.6 : (alongX ? r.z1 : r.x1) + 0.4;
        const w = alongX ? { x0: a, x1: a + 70, z0: e, z1: e + 2.2 } : { x0: e, x1: e + 2.2, z0: a, z1: a + 70 };
        const k = rng.int(2, 4);
        for (let i = 0; i < k; i++) {
          const px = alongX ? a + 8 + rng.next() * 55 : e + 1.1, pz = alongX ? e + 1.1 : a + 8 + rng.next() * 55;
          if (!isOpenGround(px, pz)) continue;
          const roll = rng.next();
          const look = roll < 0.12 ? nihang(4000 + n) : roll < 0.24 ? schoolKid(4000 + n) : roll < 0.6 ? farmer(4000 + n) : randomAppearance(4000 + n);
          defs.push({ id: id("raahi"), name: roll < 0.12 ? "Nihang Singh" : roll < 0.24 ? "School kid" : "Raahgir", role: "roamer", look, x: px, z: pz, yaw: 0, wander: w, lines: ["Bas aa gayi, bas!", "Garmi bahut ae ajj.", "Pind kinni door ae?", "Dhyaan naal, puttar — trucka waale nahi rukde!"] });
        }
      }
      if (defs.length) groups.push({ id: `road_${r.id}_${Math.round(a)}`, x: cx, z: cz, radius: 190, defs });
    }
  }
  // ---- Someone behind the counter of every signed city shop (you can buy from them).
  groups.push(...cellGroups("shopKeep", CITY_SHOPS.map((c, i) => {
    const look = randomAppearance(12000 + i * 13);
    // A child's look grown up: adult height too, or they vanish behind the counter.
    const adult = look.age === "child" ? { ...look, age: "adult" as const, height: look.sex === "f" ? 1.6 : 1.72 } : look;
    return { id: c.keeper, name: "Shopkeeper", role: "keeper" as const, shop: true, look: adult, x: c.x, z: c.z, yaw: c.yaw, lines: [TRADE[c.trade]!.greeting] };
  }), 44, 60));
  // ---- Someone at home on the sofa in every open house (offers you chah).
  // (Not in the hero's own house: his family lives there, see missions/Home.ts.)
  groups.push(...cellGroups("homeHost", OPEN_HOUSES.filter((h) => h.id !== HOME_ID).map((h, i) => {
    const elder = i % 3 === 0;
    const look = i % 2 ? aunty(15000 + i * 7) : { ...aunty(15000 + i * 7), age: elder ? "elder" as const : "adult" as const };
    return { id: `home_${h.id}`, name: elder ? "Bebe ji" : "Aunty ji", role: "seated" as const, indoor: true, look, x: h.host.x, z: h.host.z, y: h.host.y, yaw: h.host.yaw, lines: ["Aao puttar, baitho!", "Chah peeyoge?"] };
  }), 44, 60));
  return { groups, cityGraph, villageGraph };
}
