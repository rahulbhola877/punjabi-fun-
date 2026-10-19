import type { ResidentDef } from "./Crowd";
import { constableLook, randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import { buildStreetWalkGraph, type NavGraph } from "../world/nav";
import { OUTER_BUILDINGS, PLOTS, REHRIS, ROADS, VILLAGE, CITY, TOWN, CANAL, site, type Site } from "../world/region";
import { isOpenGround } from "../world/layout";
import { Rng } from "../render/textures";

/**
 * People outside the bazaar, grouped by area. The game spawns a group when
 * the player comes within its radius and removes it again when they leave,
 * so the whole map can be lived-in without simulating everyone at once.
 */
export interface FolkGroup { id: string; x: number; z: number; radius: number; defs: ResidentDef[] }

const centre = (s: Site) => ({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 });

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
    for (let i = 0; i < 28; i++) {
      const nd = cityGraph.nodes[(i * 13) % cityGraph.nodes.length]!;
      defs.push({ id: id("city"), name: "Resident", role: "walker", look: randomAppearance(2100 + i * 7), x: nd.x, z: nd.z, yaw: 0, graph: cityGraph });
    }
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
  const CRIES: Record<string, string[]> = {
    sabzi: ["Aloo, pyaaz, tamatar — taaze taaze!", "Bhindi le lo, bhenji, ajj hi tod ke liaanda!"],
    fruit: ["Kinnow, kele, ambh — mitthe mitthe!", "Chakh ke dekho, phir lao!"],
    chaat: ["Gol gappe! Teekhe ya mitthe?", "Ik plate hor, bhaji?"],
    ganna: ["Ganne da ras — thanda thanda!", "Nimbu-adrak paa ke, ji!"],
  };
  REHRIS.forEach((r, i) => {
    // Vendor stands at the cart's back (local -Z), facing the road.
    const lx = 0.2, lz = -1.0;
    const x = r.x + lx * Math.cos(r.yaw) + lz * Math.sin(r.yaw), z = r.z - lx * Math.sin(r.yaw) + lz * Math.cos(r.yaw);
    const look = i % 3 ? farmer(5000 + i) : randomAppearance(5000 + i);
    groups.push({ id: `rehri${i}`, x: r.x, z: r.z, radius: 160, defs: [{ id: id("rehri"), name: r.goods === "chaat" ? "Gol-gappe wala" : r.goods === "ganna" ? "Ras wala" : "Rehri wala", role: "keeper", look: { ...look, age: look.age === "child" ? "adult" : look.age }, x, z, yaw: r.yaw, lines: CRIES[r.goods]! }] });
  });

  // ---- People walking along the roadsides: a few every stretch of road.
  for (const r of ROADS) {
    if (r.kind === "track" || r.id.startsWith("ave") || r.id.startsWith("st") || r.id.startsWith("pind")) continue;
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    const a0 = alongX ? r.x0 : r.z0, a1 = alongX ? r.x1 : r.z1;
    for (let a = a0 + 30; a < a1 - 30; a += 110) {
      const mid = a + 55;
      const cx = alongX ? mid : (r.x0 + r.x1) / 2, cz = alongX ? (r.z0 + r.z1) / 2 : mid;
      if (cx > TOWN.x0 - 10 && cx < TOWN.x1 + 10 && cz > TOWN.z0 - 10 && cz < TOWN.z1 + 10) continue;
      if (cz > CANAL.z0 - 20 && cz < CANAL.z1 + 20 && !alongX) continue;
      if (cx > CITY.x0 && cx < CITY.x1 && cz > CITY.z0 && cz < CITY.z1) continue;
      const defs: ResidentDef[] = [];
      for (const side of [-1, 1]) {
        // A shoulder strip 2.5 m wide just off the tarmac.
        const e = side < 0 ? (alongX ? r.z0 : r.x0) - 2.6 : (alongX ? r.z1 : r.x1) + 0.4;
        const w = alongX ? { x0: a, x1: a + 110, z0: e, z1: e + 2.2 } : { x0: e, x1: e + 2.2, z0: a, z1: a + 110 };
        const k = rng.next() < 0.5 ? 2 : 1;
        for (let i = 0; i < k; i++) {
          const px = alongX ? a + 15 + rng.next() * 80 : e + 1.1, pz = alongX ? e + 1.1 : a + 15 + rng.next() * 80;
          if (!isOpenGround(px, pz)) continue;
          const roll = rng.next();
          const look = roll < 0.12 ? nihang(4000 + n) : roll < 0.24 ? schoolKid(4000 + n) : roll < 0.6 ? farmer(4000 + n) : randomAppearance(4000 + n);
          defs.push({ id: id("raahi"), name: roll < 0.12 ? "Nihang Singh" : roll < 0.24 ? "School kid" : "Raahgir", role: "roamer", look, x: px, z: pz, yaw: 0, wander: w, lines: ["Bas aa gayi, bas!", "Garmi bahut ae ajj.", "Pind kinni door ae?", "Dhyaan naal, puttar — trucka waale nahi rukde!"] });
        }
      }
      if (defs.length) groups.push({ id: `road_${r.id}_${Math.round(a)}`, x: cx, z: cz, radius: 190, defs });
    }
  }
  return { groups, cityGraph, villageGraph };
}
