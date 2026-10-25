import { Mesh, Scene, TransformNode, Vector3 } from "../babylon";
import { GeoBuilder, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { Materials, MatKey } from "../render/Materials";
import type { SignAtlas } from "../render/Signs";
import { SPECS, type VehicleType } from "./specs";

export interface VehicleModel {
  root: TransformNode;
  steer: TransformNode;
  wheels: TransformNode[];
  meshes: Mesh[];
  /** Mesh holding the painted panels, rebuilt on repaint. */
  paintable: Mesh[];
}

/** Collects geometry per (part, material) and emits parented meshes. */
class PartKit {
  private parts = new Map<string, GeoBuilder>();
  constructor(private scene: Scene, private mats: Materials, private signs?: SignAtlas) {}
  g(part: string, mat: MatKey): GeoBuilder {
    const k = `${part}|${mat}`;
    let b = this.parts.get(k);
    if (!b) { b = new GeoBuilder(0.5); this.parts.set(k, b); }
    return b;
  }
  emit(name: string, nodes: Record<string, TransformNode>): { meshes: Mesh[]; paintable: Mesh[] } {
    const meshes: Mesh[] = [];
    const paintable: Mesh[] = [];
    for (const [k, b] of this.parts) {
      if (b.isEmpty()) continue;
      const [part, mat] = k.split("|") as [string, MatKey];
      const m = b.toMesh(`${name}_${k}`, this.scene, mat === "signs" && this.signs ? this.signs.material : this.mats.get(mat));
      m.parent = nodes[part]!;
      m.isPickable = false;
      m.receiveShadows = true;
      meshes.push(m);
      if (mat === "paint" && part === "body") paintable.push(m);
    }
    return { meshes, paintable };
  }
}

const CHROME: RGB = rgb("#d9dde0");
const BLACK: RGB = rgb("#1c1c1c");
const SEAT: RGB = rgb("#3a2a22");

function wheel(k: PartKit, part: string, r: number, width: number, hub: RGB): void {
  // Tyre (torus around local X axis), rim disc and hub.
  k.g(part, "rubber").torus(0, 0, 0, r - 0.055, 0.055, 20, 8, [1, 1, 1], "x");
  k.g(part, "rubber").cylinderX(0, 0, 0, r - 0.06, width * 0.9, 16, [1, 1, 1]);
  k.g(part, "chrome").cylinderX(0, 0, 0, r * 0.55, width * 1.0, 14, hub);
  k.g(part, "metal").cylinderX(0, 0, 0, r * 0.18, width * 1.25, 10, BLACK);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.g(part, "chrome").box(0, Math.sin(a) * r * 0.36, Math.cos(a) * r * 0.36, width * 1.05, 0.02, 0.02, shade(hub, 0.8));
  }
}

export function buildVehicleModel(scene: Scene, mats: Materials, signs: SignAtlas, type: VehicleType, body: string, accent: string, id: string): VehicleModel {
  const spec = SPECS[type];
  const root = new TransformNode(`${id}_vis`, scene);
  const steer = new TransformNode(`${id}_steer`, scene);
  steer.parent = root;
  const wheels: TransformNode[] = spec.wheels.map((w, i) => {
    const n = new TransformNode(`${id}_wheel${i}`, scene);
    n.parent = root;
    n.position.set(w.x, w.y - spec.suspRest, w.z);
    return n;
  });
  const k = new PartKit(scene, mats, signs);
  const B = rgb(body), A = rgb(accent);
  // Steering wheels spin about a tilted column: steer node sits under a tilt node.
  let tilt: TransformNode | null = null;
  if (spec.steerVisual) {
    tilt = new TransformNode(`${id}_column`, scene);
    tilt.parent = root;
    steer.parent = tilt;
  }
  switch (type) {
    case "scooter": scooter(k, B, A, steer, wheels); break;
    case "auto": auto(k, B, A, steer, wheels); break;
    case "erickshaw": erickshaw(k, B, A, steer); break;
    case "bicycle": bicycle(k, B, A, steer); break;
    case "rickshaw": rickshaw(k, B, A, steer); break;
    case "bus": bus(k, B, A, tilt!, steer); break;
    case "motorcycle": motorcycle(k, B, A, steer, body === "#f0f0ee", id.startsWith("bullet")); break;
    case "car": car(k, B, A, tilt!, steer, body === "#f0f0ee"); break;
    case "jeep": jeep(k, B, A, tilt!, steer, body === "#f0f0ee"); break;
    case "tractor": tractor(k, B, A, tilt!, steer); break;
    case "truck": truck(k, B, A, tilt!, steer); break;
  }
  // Readable shared-atlas boards, not blank coloured destination panels.
  const board = (key: string, y: number, z: number, width: number, rear = false) => {
    const uv = signs.get(key), h = width / uv.aspect, g = k.g("body", "signs");
    const side = rear ? -1 : 1;
    const a = g.vertex(side * width / 2, y - h / 2, z, 0, 0, side, uv.u0, uv.v0, [1,1,1]);
    const b = g.vertex(-side * width / 2, y - h / 2, z, 0, 0, side, uv.u1, uv.v0, [1,1,1]);
    const c = g.vertex(-side * width / 2, y + h / 2, z, 0, 0, side, uv.u1, uv.v1, [1,1,1]);
    const d = g.vertex(side * width / 2, y + h / 2, z, 0, 0, side, uv.u0, uv.v1, [1,1,1]);
    g.tri(a,b,c); g.tri(a,c,d);
  };
  if (type === "bus") board(body === "#b8322a" ? "prtcBus" : "roadwaysBus", 3.05, 5.24, 1.7);
  if (type === "truck") board("hornPlease", 1.95, -4.885, 1.9, true);
  const nodes: Record<string, TransformNode> = { body: root, steer };
  wheels.forEach((w, i) => (nodes[`w${i}`] = w));
  const { meshes, paintable } = k.emit(id, nodes);
  // At road distance, wheel spokes are sub-pixel but used to cost three
  // material draws per wheel. Keep the silhouette/rim in one low-poly draw.
  wheels.forEach((node, i) => {
    const parts = meshes.filter(m => m.parent === node);
    const tyre = parts.find(m => m.name.endsWith("|rubber"));
    if (!tyre) return;
    const bounds = tyre.getBoundingInfo().boundingBox;
    const radius = Math.max(bounds.maximum.y, bounds.maximum.z);
    const width = bounds.maximum.x - bounds.minimum.x;
    const centre = (bounds.maximum.x + bounds.minimum.x) / 2;
    const g = new GeoBuilder(1);
    g.cylinderX(centre, 0, 0, radius, width, 10, rgb("#242528"));
    g.cylinderX(centre, 0, 0, radius * 0.52, width + 0.012, 8, rgb("#a9adb1"));
    const low = g.toMesh(`${id}_wheel${i}_distant`, scene, mats.get("matte"));
    low.parent = node;
    low.isPickable = false;
    tyre.addLODLevel(55, low);
    for (const part of parts) if (part !== tyre) part.addLODLevel(55, null);
  });
  return { root, steer, wheels, meshes, paintable };
}

function scooter(k: PartKit, B: RGB, A: RGB, steer: TransformNode, wheels: TransformNode[]): void {
  const p = (m: MatKey) => k.g("body", m);
  // Floorboard with ribbed rubber mat.
  p("paint").box(0, 0.3, 0.12, 0.42, 0.06, 0.7, B);
  for (let z = -0.15; z < 0.42; z += 0.06) p("rubber").box(0, 0.335, z, 0.36, 0.012, 0.03, [1, 1, 1]);
  // Centre tunnel joining floor to the rear cowl.
  p("paint").box(0, 0.4, -0.22, 0.24, 0.2, 0.3, B);
  // Bulbous rear cowl over the engine and rear wheel.
  p("paint").ellipsoid(0, 0.56, -0.5, 0.31, 0.26, 0.5, 18, 10, B, -0.55, 1);
  p("paint").ellipsoid(0, 0.47, -0.92, 0.18, 0.16, 0.12, 10, 6, shade(B, 0.95));
  // Side accent stripe.
  for (const s of [-1, 1]) p("paint").box(s * 0.305, 0.58, -0.45, 0.01, 0.04, 0.7, A);
  // Seat, grab rail and luggage rack.
  p("matte").ellipsoid(0, 0.83, -0.38, 0.17, 0.07, 0.42, 14, 6, SEAT, -0.2, 1);
  p("chrome").tube(new Vector3(-0.15, 0.86, -0.7), new Vector3(-0.15, 0.86, -0.98), 0.012, 6, CHROME);
  p("chrome").tube(new Vector3(0.15, 0.86, -0.7), new Vector3(0.15, 0.86, -0.98), 0.012, 6, CHROME);
  p("chrome").tube(new Vector3(-0.15, 0.86, -0.98), new Vector3(0.15, 0.86, -0.98), 0.012, 6, CHROME);
  for (let x = -0.1; x <= 0.11; x += 0.05) p("chrome").tube(new Vector3(x, 0.86, -0.72), new Vector3(x, 0.86, -0.98), 0.006, 4, CHROME);
  // Tail light and number plate.
  p("emissive").box(0, 0.6, -1.02, 0.12, 0.05, 0.02, [1, 0.2, 0.15]);
  p("paint").box(0, 0.45, -1.0, 0.2, 0.1, 0.01, rgb("#f3f3f3"));
  // Leg shield (apron) rising to the steering head.
  p("paint").ellipsoid(0, 0.66, 0.5, 0.25, 0.4, 0.08, 14, 8, B);
  p("paint").box(0, 0.42, 0.47, 0.44, 0.2, 0.08, B);
  p("chrome").box(0, 0.98, 0.5, 0.06, 0.06, 0.06, CHROME);
  // Kick-stand.
  p("metal").tube(new Vector3(0.12, 0.3, -0.25), new Vector3(0.2, 0.05, -0.32), 0.012, 4, BLACK);

  // Steering assembly: pivot at the head tube, tilted slightly back.
  steer.position.set(0, 0.95, 0.56);
  const s = (m: MatKey) => k.g("steer", m);
  s("paint").cylinder(0, -0.55, 0.05, 0.035, 0.035, 0.6, 8, B);
  // Front mudguard wraps the wheel top.
  s("paint").ellipsoid(0, -0.62, 0.07, 0.11, 0.08, 0.22, 10, 6, B, 0, 1);
  // Headset with round headlamp and speedo.
  s("paint").ellipsoid(0, 0.11, 0.02, 0.16, 0.09, 0.11, 14, 8, B);
  s("chrome").cylinderZ(0, 0.11, 0.12, 0.065, 0.03, 14, CHROME);
  s("emissive").cylinderZ(0, 0.11, 0.137, 0.055, 0.005, 14, [1, 1, 0.9]);
  s("dark").box(0, 0.19, -0.02, 0.08, 0.02, 0.06, [1, 1, 1]);
  // Handlebar with grips and mirrors.
  s("chrome").tube(new Vector3(-0.34, 0.1, -0.03), new Vector3(0.34, 0.1, -0.03), 0.014, 6, CHROME);
  for (const sd of [-1, 1]) {
    s("rubber").cylinderX(sd * 0.3, 0.1, -0.03, 0.02, 0.11, 8, [1, 1, 1]);
    s("chrome").tube(new Vector3(sd * 0.2, 0.12, -0.02), new Vector3(sd * 0.27, 0.36, -0.05), 0.007, 4, CHROME);
    s("chrome").cylinderZ(sd * 0.27, 0.38, -0.05, 0.045, 0.015, 12, CHROME);
  }
  // Wheels: front follows steering in code; both spin.
  void wheels;
  wheel(k, "w0", 0.225, 0.09, rgb("#c7c7c7"));
  wheel(k, "w1", 0.225, 0.09, rgb("#c7c7c7"));
  // Rear wheel mostly hidden by the cowl; add a swingarm.
  k.g("w1", "metal").box(0.08, 0.05, 0.12, 0.03, 0.05, 0.3, BLACK);
}

/**
 * Battery e-rickshaw: an open steel frame on three small wheels, a bench
 * facing forward and one facing back, a canvas canopy on thin posts, and
 * the battery box under the seats. Front fork and handlebar steer.
 */
function erickshaw(k: PartKit, B: RGB, A: RGB, steer: TransformNode): void {
  const p = (m: MatKey) => k.g("body", m);
  const FRAME = rgb("#cfd3d6");
  // Floor pan and the low side skirts in body colour.
  p("paint").box(0, 0.42, -0.25, 1.08, 0.08, 2.2, B);
  for (const sd of [-1, 1]) {
    p("paint").box(sd * 0.54, 0.6, -0.55, 0.04, 0.32, 1.5, B);
    p("paint").box(sd * 0.545, 0.78, -0.55, 0.045, 0.05, 1.5, A);
    // Canopy posts and grab rail.
    for (const z of [0.72, -0.25, -1.3]) p("chrome").tube(new Vector3(sd * 0.54, 0.46, z), new Vector3(sd * 0.54, 1.88, z), 0.02, 6, FRAME);
    p("chrome").tube(new Vector3(sd * 0.54, 1.15, 0.72), new Vector3(sd * 0.54, 1.15, -1.3), 0.015, 5, FRAME);
    // Mudguards over the rear wheels.
    p("paint").ellipsoid(sd * 0.52, 0.5, -0.85, 0.1, 0.24, 0.3, 8, 4, A, 0, 1);
  }
  // Nose: a rounded shield with the headlamp, front fork, handlebar.
  p("paint").ellipsoid(0, 0.95, 0.92, 0.32, 0.42, 0.14, 12, 6, B);
  p("chrome").cylinderZ(0, 1.1, 1.04, 0.07, 0.04, 10, CHROME);
  p("emissive").cylinderZ(0, 1.1, 1.065, 0.055, 0.01, 10, [1, 1, 0.9]);
  k.g("steer", "metal").cylinder(0, -0.45, 0, 0.025, 0.025, 0.9, 6, BLACK);
  k.g("steer", "chrome").tube(new Vector3(-0.3, 0.42, -0.05), new Vector3(0.3, 0.42, -0.05), 0.018, 6, CHROME);
  steer.position.set(0, 0.9, 0.95);
  // Benches: driver's seat in front, a forward bench and a rear-facing bench.
  p("matte").box(0, 0.86, 0.5, 0.5, 0.1, 0.4, rgb("#2c2c2c"));
  p("matte").box(0, 0.78, -0.35, 1.0, 0.12, 0.45, rgb("#3b2b25"));
  p("matte").box(0, 1.08, -0.56, 1.0, 0.45, 0.08, rgb("#3b2b25"));
  p("matte").box(0, 0.78, -1.15, 1.0, 0.12, 0.45, rgb("#3b2b25"));
  p("matte").box(0, 1.08, -0.92, 1.0, 0.45, 0.08, rgb("#3b2b25"));
  // Battery box under the benches, footboard at the back.
  p("dark").box(0, 0.6, -0.75, 0.8, 0.28, 1.1, [0.15, 0.15, 0.16]);
  p("metal").box(0, 0.45, -1.42, 1.0, 0.04, 0.28, BLACK);
  // Canvas canopy with a scalloped valance.
  p("fabric").box(0, 1.92, -0.28, 1.2, 0.06, 2.15, A);
  p("fabric").ellipsoid(0, 1.94, -0.28, 0.6, 0.12, 1.08, 10, 4, A, 0, 1);
  for (const sd of [-1, 1]) for (let i = 0; i < 8; i++) p("fabric").box(sd * 0.6, 1.84, 0.72 - i * 0.27, 0.01, 0.12, 0.22, i % 2 ? B : A);
  lampPair(p, 0.4, 0.62, -1.38, 0.05, true);
  // Small wheels with the wheel nodes.
  for (let i = 0; i < 3; i++) wheel(k, `w${i}`, 0.22, 0.12, rgb("#9aa0a6"));
}

function auto(k: PartKit, B: RGB, A: RGB, steer: TransformNode, wheels: TransformNode[]): void {
  const p = (m: MatKey) => k.g("body", m);
  const roofC = rgb("#1d1d1d");
  // Floor pan and lower body (body colour), upper panels (accent).
  p("paint").box(0, 0.36, -0.15, 1.2, 0.12, 2.3, B);
  for (const sd of [-1, 1]) {
    // Rear quarter panels over the rear wheels.
    p("paint").box(sd * 0.6, 0.62, -0.75, 0.06, 0.5, 1.15, B);
    p("paint").box(sd * 0.6, 0.9, -0.75, 0.065, 0.06, 1.15, A);
    // Side grab bars and pillars.
    p("chrome").tube(new Vector3(sd * 0.6, 0.42, 0.62), new Vector3(sd * 0.6, 1.75, 0.55), 0.022, 6, CHROME);
    p("chrome").tube(new Vector3(sd * 0.6, 0.92, -0.18), new Vector3(sd * 0.6, 1.78, -0.18), 0.018, 6, CHROME);
    p("chrome").tube(new Vector3(sd * 0.6, 0.95, -1.32), new Vector3(sd * 0.6, 1.76, -1.32), 0.022, 6, CHROME);
    p("chrome").tube(new Vector3(sd * 0.58, 1.0, -0.15), new Vector3(sd * 0.58, 1.0, 0.45), 0.014, 6, CHROME);
  }
  // Front nose: tapered cowl with the single headlamp — the auto's face.
  p("paint").ellipsoid(0, 0.72, 0.95, 0.42, 0.42, 0.28, 16, 10, B, -0.6, 1);
  p("paint").box(0, 0.52, 0.85, 0.82, 0.32, 0.35, B);
  p("paint").box(0, 0.98, 0.95, 0.66, 0.18, 0.24, A);
  p("chrome").cylinderZ(0, 0.83, 1.22, 0.085, 0.04, 16, CHROME);
  p("emissive").cylinderZ(0, 0.83, 1.24, 0.07, 0.005, 16, [1, 1, 0.92]);
  for (const sd of [-1, 1]) p("emissive").box(sd * 0.28, 0.98, 1.08, 0.08, 0.04, 0.02, [1, 0.6, 0.1]);
  // Windscreen.
  p("glass").quad(new Vector3(0.36, 1.08, 1.0), new Vector3(-0.36, 1.08, 1.0), new Vector3(-0.38, 1.72, 0.7), new Vector3(0.38, 1.72, 0.7), [1, 1, 1]);
  p("glass").quad(new Vector3(-0.36, 1.08, 1.0), new Vector3(0.36, 1.08, 1.0), new Vector3(0.38, 1.72, 0.7), new Vector3(-0.38, 1.72, 0.7), [1, 1, 1]);
  p("paint").tube(new Vector3(-0.38, 1.08, 1.0), new Vector3(-0.4, 1.74, 0.7), 0.025, 6, A);
  p("paint").tube(new Vector3(0.38, 1.08, 1.0), new Vector3(0.4, 1.74, 0.7), 0.025, 6, A);
  // Canopy roof: curved vinyl over a frame.
  const roof = p("matte");
  const segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI, a1 = ((i + 1) / segs) * Math.PI;
    const x0 = -Math.cos(a0) * 0.64, x1 = -Math.cos(a1) * 0.64;
    const y0 = 1.72 + Math.sin(a0) * 0.12, y1 = 1.72 + Math.sin(a1) * 0.12;
    roof.quad(new Vector3(x1, y1, 0.78), new Vector3(x0, y0, 0.78), new Vector3(x0, y0, -1.42), new Vector3(x1, y1, -1.42), roofC);
    roof.quad(new Vector3(x0, y0 - 0.02, 0.78), new Vector3(x1, y1 - 0.02, 0.78), new Vector3(x1, y1 - 0.02, -1.42), new Vector3(x0, y0 - 0.02, -1.42), shade(roofC, 1.6));
  }
  p("paint").box(0, 1.72, 0.79, 1.3, 0.1, 0.04, A);
  // Rear panel (engine compartment) with tail lamps and a painted slogan strip.
  p("paint").box(0, 0.85, -1.38, 1.24, 0.95, 0.12, B);
  p("paint").box(0, 1.25, -1.41, 1.2, 0.18, 0.02, A);
  for (const sd of [-1, 1]) p("emissive").box(sd * 0.45, 0.6, -1.45, 0.12, 0.1, 0.02, [1, 0.15, 0.1]);
  p("paint").box(0, 0.5, -1.45, 0.3, 0.12, 0.01, rgb("#ffd54a"));
  // Rear back-rest of the canopy (dark vinyl).
  p("matte").box(0, 1.45, -1.33, 1.18, 0.55, 0.04, roofC);
  // Passenger bench and driver seat.
  p("matte").box(0, 0.68, -0.6, 1.1, 0.12, 0.5, rgb("#5a1f1f"));
  p("matte").box(0, 0.98, -0.88, 1.1, 0.5, 0.1, rgb("#5a1f1f"));
  p("matte").box(0, 0.72, 0.28, 0.42, 0.1, 0.4, rgb("#3a2a22"));
  p("dark").box(0, 0.55, 0.28, 0.4, 0.3, 0.4, [1, 1, 1]);
  // Partition bar behind the driver.
  p("chrome").tube(new Vector3(-0.58, 1.1, 0.02), new Vector3(0.58, 1.1, 0.02), 0.016, 6, CHROME);
  // Mudguards over the rear wheels.
  for (const sd of [-1, 1]) p("paint").ellipsoid(sd * 0.56, 0.42, -0.95, 0.09, 0.14, 0.26, 10, 6, shade(B, 0.85), 0, 1);

  // Steering: handlebar on a column behind the nose.
  steer.position.set(0, 1.08, 0.72);
  const s = (m: MatKey) => k.g("steer", m);
  s("metal").cylinder(0, -0.2, 0, 0.03, 0.03, 0.22, 8, BLACK);
  s("chrome").tube(new Vector3(-0.32, 0.03, -0.12), new Vector3(0.32, 0.03, -0.12), 0.014, 6, CHROME);
  s("chrome").tube(new Vector3(0, 0.0, 0), new Vector3(0, 0.03, -0.12), 0.016, 6, CHROME);
  for (const sd of [-1, 1]) s("rubber").cylinderX(sd * 0.29, 0.03, -0.12, 0.02, 0.1, 8, [1, 1, 1]);
  void wheels;
  wheel(k, "w0", 0.21, 0.1, rgb("#bdbdbd"));
  wheel(k, "w1", 0.21, 0.1, rgb("#bdbdbd"));
  wheel(k, "w2", 0.21, 0.1, rgb("#bdbdbd"));
  // Front fork rides with the front wheel node.
  k.g("w0", "paint").box(0, 0.2, 0, 0.16, 0.06, 0.06, B);
}

// ---------------------------------------------------------------- Open-world vehicles

function spokedWheel(k: PartKit, part: string, r: number, width: number, spokes: number, rim: RGB): void {
  k.g(part, "rubber").torus(0, 0, 0, r - 0.03, 0.03, 22, 6, [1, 1, 1], "x");
  k.g(part, "chrome").torus(0, 0, 0, r - 0.065, 0.012, 22, 4, rim, "x");
  k.g(part, "metal").cylinderX(0, 0, 0, 0.04, width * 2, 8, BLACK);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    k.g(part, "chrome").tube(new Vector3(0, 0, 0), new Vector3(0, Math.sin(a) * (r - 0.07), Math.cos(a) * (r - 0.07)), 0.004, 3, CHROME);
  }
}

function bicycle(k: PartKit, B: RGB, A: RGB, steer: TransformNode): void {
  const p = (m: MatKey) => k.g("body", m);
  // Classic roadster: diamond frame, carrier, chain guard.
  const head = new Vector3(0, 0.98, 0.42), seat = new Vector3(0, 0.95, -0.28), bb = new Vector3(0, 0.36, 0.0), rear = new Vector3(0, 0.34, -0.53);
  for (const [a, b] of [[head, seat], [head, bb], [seat, bb], [seat, rear], [bb, rear]] as const) p("paint").tube(a, b, 0.022, 6, B);
  p("matte").ellipsoid(0, 1.0, -0.3, 0.09, 0.04, 0.14, 8, 4, SEAT);
  p("chrome").tube(new Vector3(0, 0.95, -0.28), new Vector3(0, 1.0, -0.3), 0.012, 4, CHROME);
  p("metal").boxMinMax(-0.12, 0.88, -0.75, 0.12, 0.9, -0.35, BLACK);
  p("paint").boxMinMax(0.05, 0.3, -0.5, 0.07, 0.42, 0.05, A);
  p("metal").cylinderX(0.05, 0.36, 0, 0.09, 0.02, 12, BLACK);
  for (const s of [-1, 1]) p("metal").boxMinMax(s * 0.1 - 0.03, 0.2 + (s > 0 ? 0 : 0.28), -0.02, s * 0.1 + 0.03, 0.22 + (s > 0 ? 0 : 0.28), 0.1, BLACK);
  p("paint").ellipsoid(0, 0.7, -0.53, 0.05, 0.05, 0.3, 8, 4, B, 0, 1);
  steer.position.set(0, 0.98, 0.42);
  const s = (m: MatKey) => k.g("steer", m);
  s("paint").tube(new Vector3(0, 0, 0), new Vector3(0, -0.34, 0.11), 0.02, 6, B);
  s("chrome").tube(new Vector3(-0.28, 0.16, -0.08), new Vector3(0.28, 0.16, -0.08), 0.012, 6, CHROME);
  s("chrome").tube(new Vector3(0, 0, 0), new Vector3(0, 0.16, -0.06), 0.014, 6, CHROME);
  for (const sd of [-1, 1]) s("rubber").cylinderX(sd * 0.25, 0.16, -0.08, 0.018, 0.09, 8, [1, 1, 1]);
  s("chrome").cylinderZ(0, 0.02, 0.1, 0.05, 0.05, 10, CHROME);
  s("paint").ellipsoid(0, -0.28, 0.12, 0.05, 0.04, 0.24, 8, 4, B, 0, 1);
  spokedWheel(k, "w0", 0.34, 0.03, 16, CHROME);
  spokedWheel(k, "w1", 0.34, 0.03, 16, CHROME);
}

/**
 * Cycle rickshaw: a roadster front half (saddle, handlebar, one wheel) bolted
 * to a two-wheeled carriage with a raised bench, a footboard and a folding
 * hood. The frame takes the body paint, the hood and cushions the accent.
 */
function rickshaw(k: PartKit, B: RGB, A: RGB, steer: TransformNode): void {
  const p = (m: MatKey) => k.g("body", m);
  // Front frame: head tube to saddle to the carriage, chain stays to the axle.
  const head = new Vector3(0, 1.0, 0.86), saddle = new Vector3(0, 1.02, 0.34), bb = new Vector3(0, 0.42, 0.42), cross = new Vector3(0, 0.7, -0.05);
  for (const [a, b] of [[head, saddle], [head, bb], [saddle, bb], [bb, cross], [saddle, cross]] as const) p("paint").tube(a, b, 0.026, 6, B);
  p("matte").ellipsoid(0, 1.07, 0.32, 0.1, 0.045, 0.15, 8, 4, SEAT);
  p("chrome").tube(saddle, new Vector3(0, 1.06, 0.32), 0.014, 4, CHROME);
  p("metal").cylinderX(0.06, 0.42, 0.42, 0.1, 0.02, 12, BLACK);
  for (const s of [-1, 1]) p("metal").boxMinMax(s * 0.11 - 0.03, 0.2 + (s > 0 ? 0 : 0.42), 0.38, s * 0.11 + 0.03, 0.22 + (s > 0 ? 0 : 0.42), 0.5, BLACK);
  p("paint").boxMinMax(0.05, 0.36, -0.5, 0.08, 0.46, 0.42, A);
  // Carriage: axle beam, the box under the bench, footboard and side rails.
  p("metal").cylinderX(0, 0.34, -0.5, 0.03, 1.0, 8, BLACK);
  p("paint").box(0, 0.62, -0.52, 0.96, 0.34, 0.6, B);
  p("paint").box(0, 0.5, -0.02, 0.86, 0.04, 0.44, B);
  for (const s of [-1, 1]) {
    p("chrome").tube(new Vector3(s * 0.43, 0.52, 0.2), new Vector3(s * 0.48, 0.95, -0.2), 0.014, 5, CHROME);
    p("paint").ellipsoid(s * 0.5, 0.66, -0.5, 0.06, 0.2, 0.3, 8, 4, B, 0, 1);
  }
  // Bench with a cushioned seat and backrest in the accent rexine.
  p("fabric").box(0, 0.86, -0.5, 1.0, 0.14, 0.56, A);
  p("fabric").box(0, 1.17, -0.8, 1.0, 0.5, 0.12, A);
  for (let i = 0; i < 4; i++) p("matte").box(-0.36 + i * 0.24, 1.17, -0.735, 0.02, 0.42, 0.01, shade(A, 0.7));
  // Folding hood: ribs and a canvas half-shell, the back half closed.
  for (const z of [-0.3, -0.62, -0.92]) p("metal").tube(new Vector3(-0.52, 0.95, z), new Vector3(-0.52, 1.72, z - 0.05), 0.012, 4, BLACK);
  for (const z of [-0.3, -0.62, -0.92]) p("metal").tube(new Vector3(0.52, 0.95, z), new Vector3(0.52, 1.72, z - 0.05), 0.012, 4, BLACK);
  p("fabric").ellipsoid(0, 1.6, -0.68, 0.56, 0.24, 0.42, 12, 5, A, 0, 1);
  p("fabric").box(0, 1.33, -0.98, 1.06, 0.6, 0.03, A);
  p("emissive").box(0, 0.62, -0.83, 0.14, 0.04, 0.02, [1, 0.2, 0.15]);
  // Handlebar and fork with a bell and a basket of sorts.
  steer.position.set(0, 1.0, 0.86);
  const s = (m: MatKey) => k.g("steer", m);
  s("paint").tube(new Vector3(0, 0, 0), new Vector3(0, -0.36, 0.12), 0.022, 6, B);
  s("chrome").tube(new Vector3(-0.3, 0.16, -0.1), new Vector3(0.3, 0.16, -0.1), 0.013, 6, CHROME);
  s("chrome").tube(new Vector3(0, 0, 0), new Vector3(0, 0.16, -0.08), 0.015, 6, CHROME);
  for (const sd of [-1, 1]) s("rubber").cylinderX(sd * 0.26, 0.16, -0.1, 0.02, 0.09, 8, [1, 1, 1]);
  s("chrome").cylinder(0.18, 0.17, -0.1, 0.03, 0.03, 0.025, 8, CHROME);
  s("paint").ellipsoid(0, -0.3, 0.13, 0.05, 0.04, 0.24, 8, 4, B, 0, 1);
  for (let i = 0; i < 3; i++) spokedWheel(k, `w${i}`, 0.34, 0.03, 16, CHROME);
}

/**
 * Roadways bus: a long two-tone box with a window band, a big flat
 * windscreen, the destination board lit amber over it, two doors on the
 * kerb (left) side and a roof carrier. Frame +Z forward, driver on the right.
 */
function bus(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode): void {
  const p = (m: MatKey) => k.g("body", m);
  const L = 5.2, W = 1.25, GLASS: RGB = [0.62, 0.7, 0.76];
  p("metal").box(0, 0.75, 0, 1.4, 0.3, 9.6, BLACK);
  // Lower body in the livery colour, cream upper band, roof.
  p("paint").box(0, 1.2, 0, 1.8, 1.2, L * 2, B);
  // Recess the underbody between the wheels; the old solid side panel
  // covered the upper halves of all four tyres.
  for (const sd of [-1, 1]) {
    p("paint").box(sd * (W - 0.04), 1.5, 0, 0.08, 0.6, L * 2, B);
    for (const [a, b] of [[-L, -3.15], [-1.85, 2.75], [4.05, L]]) {
      p("paint").box(sd * (W - 0.04), 0.9, (a! + b!) / 2, 0.08, 0.6, b! - a!, B);
      p("paint").box(sd * (W + 0.005), 0.75, (a! + b!) / 2, 0.01, 0.12, b! - a!, rgb("#fdd835"));
    }
  }
  // Upper band: only its top here; the sides are built round the windows.
  p("paint").box(0, 2.3, 0, W * 2, 1.0, L * 2, A, 0b001000);
  loft(p("paint"), [{ z: -L, pts: outline(W, 2.8, 3.36, 0.16, 0.12) }, { z: L, pts: outline(W, 2.8, 3.36, 0.16, 0.12) }], A);
  p("paint").box(0, 3.37, 0, W * 2 - 0.1, 0.04, L * 2 - 0.1, shade(A, 0.85));
  // Dim cabin seen through the open windows.
  p("fabric").box(0, 1.81, 0, W * 2 - 0.1, 0.01, L * 2 - 0.1, [0.42, 0.4, 0.37], 0b001000);
  for (const sd of [-1, 1]) {
    p("paint").box(sd * (W + 0.005), 1.72, 0, 0.01, 0.14, L * 2 - 0.2, shade(B, 0.7));
    const wx = sd * (W - 0.03);
    // Sill and header strips, then the pillars between the windows.
    p("paint").box(wx, 1.875, 0, 0.06, 0.15, L * 2, A);
    p("paint").box(wx, 2.775, 0, 0.06, 0.05, L * 2, A);
    let z0 = -L;
    for (let i = 0; i < 9; i++) {
      const z = -4.4 + i * 1.02;
      // Over the doors (left, rows 1 and 8) the band is solid.
      if (sd < 0 && (i === 8 || i === 1)) continue;
      p("paint").box(wx, 2.35, (z0 + z - 0.43) / 2, 0.06, 0.8, z - 0.43 - z0, A);
      z0 = z + 0.43;
      // Sliding windows: the rear pane pushed open over the front one, a
      // few shut against the dust.
      const shut = (i * 7 + (sd > 0 ? 3 : 0)) % 5 === 0;
      p("glass").box(sd * (W + 0.006), 2.35, shut ? z : z - 0.215, 0.01, 0.8, shut ? 0.86 : 0.43, GLASS, sd > 0 ? 0b100000 : 0b010000);
      p("metal").box(sd * (W + 0.004), 2.35, z, 0.012, 0.03, 0.86, BLACK);
    }
    p("paint").box(wx, 2.35, (z0 + L) / 2, 0.06, 0.8, L - z0, A);
  }
  // Doors on the left: front (behind the front wheel) and rear, open steps.
  for (const z of [4.15, -3.45]) {
    p("dark").box(-W - 0.005, 1.65, z, 0.02, 2.3, 0.86, [0.12, 0.12, 0.13]);
    p("chrome").tube(new Vector3(-W - 0.02, 0.9, z + 0.4), new Vector3(-W - 0.02, 2.6, z + 0.4), 0.02, 5, CHROME);
    p("metal").box(-W + 0.15, 0.62, z, 0.35, 0.06, 0.82, BLACK);
  }
  // Front: flat windscreen, destination board, grille, lamps, bumper.
  p("glass").box(0, 2.25, L + 0.005, W * 2 - 0.2, 1.15, 0.02, GLASS, 0b000010);
  p("metal").box(0, 2.25, L + 0.02, 0.06, 1.15, 0.02, BLACK);
  p("dark").box(0, 3.05, L + 0.01, 1.9, 0.34, 0.02, [0.1, 0.1, 0.1]);
  p("metal").box(0, 1.1, L + 0.02, 1.2, 0.5, 0.03, rgb("#2b2b2b"));
  for (let y = 0.92; y < 1.3; y += 0.08) p("chrome").box(0, y, L + 0.04, 1.15, 0.02, 0.01, CHROME);
  lampPair(p, 0.95, 1.05, L + 0.02, 0.13, false);
  p("metal").box(0, 0.55, L + 0.12, W * 2 + 0.05, 0.22, 0.18, BLACK);
  // Rear: ladder to the roof, lamps, "Punjab Roadways" board colour.
  lampPair(p, 1.0, 0.95, -L - 0.02, 0.09, true);
  p("glass").box(0, 2.45, -L - 0.005, W * 2 - 0.3, 0.7, 0.02, GLASS, 0b000001);
  for (let y = 1.0; y < 3.3; y += 0.3) p("metal").box(0.8, y, -L - 0.08, 0.36, 0.03, 0.03, BLACK);
  for (const sd of [-1, 1]) p("metal").box(0.8 + sd * 0.18, 2.15, -L - 0.08, 0.03, 2.3, 0.03, BLACK);
  // Roof carrier with a few bundles and a trunk.
  for (const sd of [-1, 1]) p("metal").box(sd * 1.1, 3.55, -0.5, 0.04, 0.2, 7.5, BLACK);
  for (let z = -4; z <= 3; z += 1.4) p("metal").box(0, 3.45, z, 2.2, 0.04, 0.04, BLACK);
  p("fabric").box(-0.4, 3.62, -2.2, 1.0, 0.45, 1.1, rgb("#6d4c41"));
  p("fabric").box(0.5, 3.58, 0.6, 0.8, 0.38, 0.9, rgb("#455a64"));
  p("paint").box(-0.3, 3.6, 2.0, 0.9, 0.4, 0.6, rgb("#1565c0"));
  // Mud flaps and wheel arches.
  for (const z of [3.4, -2.5]) for (const sd of [-1, 1]) p("dark").box(sd * (W + 0.01), 1.1, z, 0.02, 0.14, 1.3, [0.08, 0.08, 0.08]);
  // Inside: the tops of the bench backs, seen through the open windows.
  for (let i = 0; i < 8; i++) for (const sd of [-1, 1]) {
    if (sd < 0 && i === 0) continue; // the rear door
    p("fabric").box(sd * 0.68, 1.95, -3.9 + i * 1.02 - 0.24, 0.95, 0.28, 0.08, rgb("#7b2d26"));
  }
  // Dashboard and the big flat steering wheel on the right.
  // Mirror arms and housings, windscreen wipers, roof ventilators and
  // luggage ties share existing body batches rather than adding draw calls.
  for (const sd of [-1, 1]) {
    p("metal").tube(new Vector3(sd * 1.2, 2.65, 4.8), new Vector3(sd * 1.55, 2.65, 5.0), 0.025, 6, BLACK);
    p("metal").box(sd * 1.55, 2.45, 5, 0.16, 0.4, 0.1, BLACK);
    p("glass").box(sd * 1.55, 2.45, 4.94, 0.13, 0.34, 0.012, GLASS);
    p("metal").tube(new Vector3(sd * 0.3, 1.72, 5.24), new Vector3(sd * 0.75, 2.35, 5.24), 0.015, 5, BLACK);
    p("paint").box(sd * 1.262, 1.08, -4.85, 0.015, 0.12, 0.22, rgb("#ffb52b"));
  }
  for (const z of [-2, 1]) {
    p("metal").box(0, 3.41, z, 0.65, 0.06, 0.55, rgb("#737979"));
    for (let j = -2; j <= 2; j++) p("dark").box(j * 0.1, 3.445, z, 0.035, 0.01, 0.42, BLACK);
  }
  for (const z of [-2.2, 0.6, 2]) p("fabric").box(0, 3.86, z, 1.8, 0.025, 0.045, rgb("#c5ae7d"));
  p("dark").box(0, 1.55, 4.9, 2.3, 0.3, 0.5, [0.15, 0.15, 0.16]);
  steeringWheel(k, tilt, steer, new Vector3(0.72, 1.78, 4.62), 0.26, -1.05);
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.52, 0.3, rgb("#c7c7c7"));
}

function motorcycle(k: PartKit, B: RGB, A: RGB, steer: TransformNode, police = false, classic = false): void {
  const p = (m: MatKey) => k.g("body", m);
  // Thumping 350-style: teardrop tank, long seat, round headlamp, big silencer.
  p("metal").tube(new Vector3(0, 0.95, 0.55), new Vector3(0, 0.5, -0.1), 0.03, 6, BLACK);
  p("metal").tube(new Vector3(0, 0.88, -0.1), new Vector3(0, 0.62, -0.7), 0.025, 6, BLACK);
  p("paint").ellipsoid(0, 0.98, 0.25, 0.17, 0.12, 0.3, 14, 8, B);
  for (const sd of [-1, 1]) p("paint").box(sd * 0.165, 0.99, 0.25, 0.01, 0.05, 0.3, A);
  p("chrome").box(0, 1.07, 0.3, 0.06, 0.02, 0.08, CHROME);
  p("matte").box(0, 0.9, -0.3, 0.3, 0.09, 0.62, SEAT);
  p("metal").box(0, 0.55, 0.05, 0.26, 0.3, 0.42, rgb("#3a3a3c"));
  p("chrome").cylinder(0, 0.55, 0.12, 0.11, 0.1, 0.32, 12, CHROME);
  p("chrome").tube(new Vector3(0.12, 0.55, 0.25), new Vector3(0.2, 0.32, -0.15), 0.035, 8, CHROME);
  p("chrome").cylinderZ(0.2, 0.36, -0.55, 0.06, 0.75, 12, CHROME);
  for (const sd of [-1, 1]) p("paint").box(sd * 0.21, 0.72, -0.2, 0.06, 0.24, 0.32, B);
  p("paint").ellipsoid(0, 0.78, -0.72, 0.13, 0.09, 0.32, 10, 6, B, 0, 1);
  p("emissive").box(0, 0.86, -1.02, 0.12, 0.05, 0.03, [1, 0.2, 0.15]);
  p("paint").box(0, 0.7, -1.04, 0.22, 0.1, 0.01, rgb("#f3f3f3"));
  for (const sd of [-1, 1]) p("metal").box(sd * 0.12, 0.47, -0.45, 0.03, 0.05, 0.5, BLACK);
  if (classic) {
    // The hero's own Bullet: chrome crash guard round the engine, chrome tank
    // badge and gold pinstripes, rubber knee pads, a tool box under the seat
    // and a pillion grab rail.
    const G = rgb("#c9a24a");
    for (const sd of [-1, 1]) {
      p("chrome").tube(new Vector3(sd * 0.05, 0.86, 0.48), new Vector3(sd * 0.27, 0.62, 0.42), 0.018, 6, CHROME);
      p("chrome").tube(new Vector3(sd * 0.27, 0.62, 0.42), new Vector3(sd * 0.26, 0.38, 0.3), 0.018, 6, CHROME);
      p("chrome").tube(new Vector3(sd * 0.26, 0.38, 0.3), new Vector3(sd * 0.12, 0.33, 0.12), 0.018, 6, CHROME);
      p("chrome").ellipsoid(sd * 0.168, 1.0, 0.27, 0.012, 0.045, 0.08, 10, 6, CHROME);
      p("paint").box(sd * 0.171, 0.96, 0.22, 0.004, 0.012, 0.36, G);
      p("rubber").box(sd * 0.16, 0.93, 0.05, 0.02, 0.08, 0.12, [1, 1, 1]);
      p("chrome").tube(new Vector3(sd * 0.16, 0.93, -0.45), new Vector3(sd * 0.15, 0.95, -0.82), 0.012, 6, CHROME);
    }
    p("chrome").tube(new Vector3(-0.15, 0.95, -0.82), new Vector3(0.15, 0.95, -0.82), 0.012, 6, CHROME);
    p("paint").box(0.2, 0.7, -0.38, 0.06, 0.16, 0.22, B);
    p("chrome").box(0.232, 0.7, -0.38, 0.004, 0.1, 0.12, CHROME);
  }
  if (police) {
    // PCR bike: white panniers with the blue stripe, red-blue lamp on a mast.
    for (const sd of [-1, 1]) { p("paint").box(sd * 0.3, 0.72, -0.62, 0.16, 0.3, 0.42, B); p("paint").box(sd * 0.385, 0.74, -0.62, 0.01, 0.07, 0.42, rgb("#1e3a8a")); }
    p("metal").tube(new Vector3(0, 0.9, -0.85), new Vector3(0, 1.45, -0.9), 0.015, 6, BLACK);
    for (const sd of [-1, 1]) p("emissive").box(sd * 0.06, 1.48, -0.9, 0.1, 0.07, 0.08, sd < 0 ? [1, 0.1, 0.1] : [0.15, 0.3, 1]);
  }
  steer.position.set(0, 1.02, 0.6);
  const s = (m: MatKey) => k.g("steer", m);
  for (const sd of [-1, 1]) s("chrome").tube(new Vector3(sd * 0.09, 0, 0.02), new Vector3(sd * 0.08, -0.36, 0.12), 0.022, 6, CHROME);
  s("chrome").tube(new Vector3(-0.36, 0.12, -0.08), new Vector3(0.36, 0.12, -0.08), 0.014, 6, CHROME);
  s("chrome").tube(new Vector3(0, 0, 0), new Vector3(0, 0.12, -0.06), 0.016, 6, CHROME);
  for (const sd of [-1, 1]) s("rubber").cylinderX(sd * 0.32, 0.12, -0.08, 0.02, 0.1, 8, [1, 1, 1]);
  s("chrome").cylinderZ(0, 0.0, 0.12, 0.1, 0.08, 16, CHROME);
  s("emissive").cylinderZ(0, 0.0, 0.165, 0.085, 0.005, 16, [1, 1, 0.9]);
  s("paint").ellipsoid(0, -0.33, 0.14, 0.09, 0.05, 0.26, 8, 4, B, 0, 1);
  wheel(k, "w0", 0.32, 0.1, rgb("#c7c7c7"));
  wheel(k, "w1", 0.32, 0.12, rgb("#c7c7c7"));
}

function steeringWheel(k: PartKit, tilt: TransformNode, steer: TransformNode, pos: Vector3, r: number, tiltX: number): void {
  tilt.position.copyFrom(pos);
  tilt.rotation.x = tiltX;
  const s = (m: MatKey) => k.g("steer", m);
  s("rubber").torus(0, 0, 0, r, 0.022, 18, 6, [1, 1, 1]);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + Math.PI / 2; s("metal").tube(new Vector3(0, 0, 0), new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), 0.012, 4, BLACK); }
  s("metal").cylinder(0, -0.02, 0, 0.05, 0.05, 0.05, 8, BLACK);
  void steer;
}

function lampPair(p: (m: MatKey) => import("../render/GeoBuilder").GeoBuilder, x: number, y: number, z: number, r: number, back: boolean): void {
  for (const sd of [-1, 1]) {
    if (back) p("emissive").box(sd * x, y, z, r * 1.6, r, 0.03, [1, 0.15, 0.1]);
    else { p("chrome").cylinderZ(sd * x, y, z, r, 0.04, 12, CHROME); p("emissive").cylinderZ(sd * x, y, z + 0.022, r * 0.85, 0.005, 12, [1, 1, 0.92]); }
  }
}

function policeBits(p: (m: MatKey) => import("../render/GeoBuilder").GeoBuilder, y: number, hw: number, len: number, roofY: number): void {
  for (const sd of [-1, 1]) p("paint").box(sd * (hw + 0.005), y, 0, 0.01, 0.12, len, rgb("#1e3a8a"));
  for (const sd of [-1, 1]) p("emissive").box(sd * 0.22, roofY + 0.08, 0, 0.36, 0.1, 0.18, sd < 0 ? [1, 0.1, 0.1] : [0.15, 0.3, 1]);
  p("metal").box(0, roofY + 0.02, 0, 0.9, 0.04, 0.22, BLACK);
}

/**
 * Smooth body panels from cross-sections: each station is a closed outline
 * (same point count) at a z; consecutive stations are joined with quads that
 * face outward. Ends are capped. Gives curved bonnets and roofs instead of boxes.
 */
type Station = { z: number; pts: Array<[number, number]> };
function loft(g: import("../render/GeoBuilder").GeoBuilder, st: Station[], c: RGB, caps = true): void {
  const P = (s: Station, i: number) => new Vector3(s.pts[i]![0], s.pts[i]![1], s.z);
  const face = (p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, out: Vector3) => {
    const n = Vector3.Cross(p3.subtract(p0), p1.subtract(p0));
    if (Vector3.Dot(n, out) >= 0) g.quad(p0, p1, p2, p3, c); else g.quad(p0, p3, p2, p1, c);
  };
  for (let k = 0; k + 1 < st.length; k++) {
    const A = st[k]!, B = st[k + 1]!;
    const n = A.pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of A.pts) { cx += x; cy += y; }
    cx /= n; cy /= n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a0 = P(A, i), a1 = P(A, j), b1 = P(B, j), b0 = P(B, i);
      const mid = a0.add(a1).add(b0).add(b1).scale(0.25);
      face(a0, a1, b1, b0, new Vector3(mid.x - cx, mid.y - cy, 0));
    }
  }
  if (!caps) return;
  for (const [s, dir] of [[st[0]!, Math.sign(st[0]!.z - st[1]!.z)], [st[st.length - 1]!, Math.sign(st[st.length - 1]!.z - st[st.length - 2]!.z)]] as const) {
    let cx = 0, cy = 0;
    for (const [x, y] of s.pts) { cx += x; cy += y; }
    cx /= s.pts.length; cy /= s.pts.length;
    const C = new Vector3(cx, cy, s.z);
    for (let i = 0; i < s.pts.length; i++) {
      const a = P(s, i), b = P(s, (i + 1) % s.pts.length);
      face(C, a, b, b, new Vector3(0, 0, dir));
    }
  }
}

/** A rounded-box outline: half-width w, from y0 to y1, corner radius r (8 points). */
function outline(w: number, y0: number, y1: number, r: number, topInset = 0): Array<[number, number]> {
  const wt = w - topInset;
  return [[-w + r * 0.6, y0], [-w, y0 + r], [-w, y1 - r], [-wt + r * 0.6, y1], [wt - r * 0.6, y1], [w, y1 - r], [w, y0 + r], [w - r * 0.6, y0]];
}

function car(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode, police: boolean): void {
  const p = (m: MatKey) => k.g("body", m);
  const GLASS: RGB = [0.55, 0.62, 0.68];
  // A Punjab-street hatchback: curved bonnet, raked windscreen, rounded roof,
  // flared arches over the wheels, wrap-round bumpers.
  loft(p("paint"), [
    { z: 1.86, pts: outline(0.6, 0.4, 0.66, 0.14, 0.08) },
    { z: 1.72, pts: outline(0.73, 0.36, 0.78, 0.14, 0.08) },
    { z: 1.3, pts: outline(0.78, 0.34, 0.86, 0.12, 0.06) },
    { z: 0.7, pts: outline(0.79, 0.34, 0.93, 0.12, 0.05) },
    { z: -0.6, pts: outline(0.79, 0.34, 0.96, 0.12, 0.05) },
    { z: -1.55, pts: outline(0.77, 0.36, 0.98, 0.12, 0.06) },
    { z: -1.84, pts: outline(0.7, 0.42, 0.94, 0.14, 0.08) },
  ], B);
  // Greenhouse: tinted glass all round, roof and pillars painted over it.
  loft(p("glass"), [
    { z: 0.72, pts: outline(0.73, 0.92, 0.96, 0.02, 0.0) },
    { z: 0.02, pts: outline(0.71, 0.92, 1.42, 0.08, 0.12) },
    { z: -1.0, pts: outline(0.7, 0.92, 1.41, 0.08, 0.12) },
    { z: -1.68, pts: outline(0.69, 0.92, 1.0, 0.03, 0.02) },
  ], GLASS);
  loft(p("paint"), [
    { z: 0.06, pts: outline(0.6, 1.4, 1.455, 0.02) },
    { z: -0.98, pts: outline(0.59, 1.39, 1.445, 0.02) },
  ], B);
  for (const sd of [-1, 1]) {
    // A, B and C pillars.
    p("paint").tube(new Vector3(sd * 0.72, 0.95, 0.7), new Vector3(sd * 0.6, 1.42, 0.05), 0.035, 5, B);
    p("paint").tube(new Vector3(sd * 0.715, 0.95, -0.42), new Vector3(sd * 0.6, 1.42, -0.42), 0.04, 5, B);
    p("paint").tube(new Vector3(sd * 0.69, 0.97, -1.64), new Vector3(sd * 0.6, 1.41, -0.98), 0.05, 5, B);
    // Wheel-arch flares, door seams, handles, mirrors, side skirt.
    // Dark wheel wells just proud of the tyre, so the wheels sit in arches.
    for (const z of [1.15, -1.15]) p("dark").cylinderX(sd * 0.74, 0.3, z, 0.335, 0.1, 18, [0.06, 0.06, 0.06]);
    p("dark").box(sd * 0.795, 0.66, 0.68, 0.01, 0.56, 0.012, [1, 1, 1]);
    p("dark").box(sd * 0.795, 0.66, -0.42, 0.01, 0.56, 0.012, [1, 1, 1]);
    p("chrome").box(sd * 0.8, 0.82, 0.28, 0.02, 0.03, 0.16, CHROME);
    p("chrome").box(sd * 0.8, 0.82, -0.85, 0.02, 0.03, 0.16, CHROME);
    p("paint").box(sd * 0.85, 0.98, 0.6, 0.12, 0.08, 0.14, B);
    p("glass").box(sd * 0.91, 0.98, 0.6, 0.01, 0.06, 0.11, [0.8, 0.85, 0.9]);
    p("rubber").box(sd * 0.79, 0.38, 0, 0.04, 0.06, 1.5, [1, 1, 1]);
    p("paint").box(sd * 0.796, 0.91, -0.45, 0.01, 0.02, 2.3, A);
  }
  // Bumpers, grille, plates, lights.
  p("rubber").box(0, 0.5, 1.84, 1.5, 0.2, 0.14, [1, 1, 1]);
  p("rubber").box(0, 0.52, -1.82, 1.46, 0.2, 0.14, [1, 1, 1]);
  p("dark").box(0, 0.74, 1.84, 0.62, 0.12, 0.02, [1, 1, 1]);
  for (let x = -0.26; x <= 0.27; x += 0.13) p("chrome").box(x, 0.74, 1.852, 0.02, 0.1, 0.01, CHROME);
  p("paint").box(0, 0.5, 1.916, 0.42, 0.11, 0.01, rgb("#fafafa"));
  p("paint").box(0, 0.62, -1.9, 0.42, 0.11, 0.01, rgb("#fdd835"));
  lampPair(p, 0.52, 0.76, 1.8, 0.09, false);
  lampPair(p, 0.58, 0.82, -1.85, 0.07, true);
  p("emissive").box(0, 1.38, -1.12, 0.3, 0.025, 0.02, [1, 0.15, 0.1]);
  // Interior: seats and the dash, seen through the glass.
  p("matte").box(-0.33, 0.6, -0.15, 0.48, 0.12, 0.5, rgb("#3a2f2a"));
  p("matte").box(0.33, 0.6, -0.15, 0.48, 0.12, 0.5, rgb("#3a2f2a"));
  p("matte").box(-0.33, 0.9, -0.38, 0.48, 0.55, 0.1, rgb("#3a2f2a"));
  p("matte").box(0.33, 0.9, -0.38, 0.48, 0.55, 0.1, rgb("#3a2f2a"));
  p("matte").box(0, 0.62, -0.95, 1.25, 0.12, 0.5, rgb("#3a2f2a"));
  p("dark").box(0, 0.98, 0.62, 1.4, 0.1, 0.25, [1, 1, 1]);
  if (police) policeBits(p, 0.78, 0.8, 3.0, 1.46);
  steeringWheel(k, tilt, steer, new Vector3(0.33, 1.02, 0.42), 0.17, -1.15);
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.28, 0.18, rgb("#a9adb1"));
}

function jeep(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode, police: boolean): void {
  const p = (m: MatKey) => k.g("body", m);
  // Open-top Punjab jeep (Thar / Gypsy family): curved bonnet over a tub,
  // flared fenders over chunky tyres, seven-slot grille, roll cage, spare wheel.
  loft(p("paint"), [
    { z: 1.86, pts: outline(0.72, 0.62, 1.12, 0.1, 0.06) },
    { z: 1.7, pts: outline(0.76, 0.58, 1.26, 0.1, 0.07) },
    { z: 0.75, pts: outline(0.78, 0.58, 1.36, 0.1, 0.06) },
    { z: 0.55, pts: outline(0.8, 0.58, 1.3, 0.08, 0.03) },
    { z: -1.7, pts: outline(0.8, 0.6, 1.32, 0.08, 0.03) },
    { z: -1.84, pts: outline(0.76, 0.64, 1.28, 0.1, 0.05) },
  ], B);
  // Tub opening (dark floor seen from above), seats.
  p("dark").box(0, 1.33, -0.62, 1.46, 0.02, 2.2, [0.12, 0.11, 0.1]);
  p("matte").box(0.4, 1.38, -0.32, 0.52, 0.14, 0.5, rgb("#2f2a26"));
  p("matte").box(-0.4, 1.38, -0.32, 0.52, 0.14, 0.5, rgb("#2f2a26"));
  p("matte").box(0.4, 1.7, -0.58, 0.52, 0.6, 0.1, rgb("#2f2a26"));
  p("matte").box(-0.4, 1.7, -0.58, 0.52, 0.6, 0.1, rgb("#2f2a26"));
  p("matte").box(0, 1.4, -1.35, 1.4, 0.14, 0.55, rgb("#2f2a26"));
  // Fenders: flared, slightly lighter, over each wheel.
  for (const sd of [-1, 1]) for (const z of [1.25, -1.15]) {
    loft(p("paint"), [
      { z: z + 0.58, pts: [[sd * 0.76, 0.98], [sd * 0.98, 0.92], [sd * 0.98, 1.0], [sd * 0.76, 1.06]] },
      { z: z + 0.3, pts: [[sd * 0.76, 1.18], [sd * 1.0, 1.14], [sd * 1.0, 1.22], [sd * 0.76, 1.26]] },
      { z: z - 0.3, pts: [[sd * 0.76, 1.18], [sd * 1.0, 1.14], [sd * 1.0, 1.22], [sd * 0.76, 1.26]] },
      { z: z - 0.58, pts: [[sd * 0.76, 0.98], [sd * 0.98, 0.92], [sd * 0.98, 1.0], [sd * 0.76, 1.06]] },
    ], shade(B, 0.85));
    p("dark").cylinderX(sd * 0.8, 0.42, z, 0.48, 0.1, 18, [0.06, 0.06, 0.06]);
  }
  for (const sd of [-1, 1]) {
    p("metal").box(sd * 0.92, 0.55, 0.05, 0.22, 0.05, 1.1, BLACK); // side step
    p("metal").box(sd * 0.81, 1.36, 0.52, 0.03, 0.02, 0.2, BLACK); // door-cut hinge
    p("paint").box(sd * 0.805, 1.18, -0.55, 0.01, 0.06, 2.3, A); // side stripe
  }
  // Grille and lamps, bumpers, bull bar.
  p("dark").box(0, 1.0, 1.875, 1.0, 0.36, 0.02, [1, 1, 1]);
  for (let i = -3; i <= 3; i++) p("paint").box(i * 0.125, 1.0, 1.885, 0.06, 0.3, 0.02, shade(B, 1.08));
  lampPair(p, 0.58, 1.02, 1.87, 0.11, false);
  lampPair(p, 0.66, 1.05, -1.86, 0.08, true);
  p("metal").box(0, 0.68, 1.95, 1.7, 0.16, 0.12, BLACK);
  p("metal").box(0, 0.7, -1.92, 1.66, 0.16, 0.1, BLACK);
  for (const sd of [-1, 1]) p("metal").tube(new Vector3(sd * 0.5, 0.7, 2.0), new Vector3(sd * 0.45, 1.1, 2.02), 0.03, 6, BLACK);
  p("metal").tube(new Vector3(-0.45, 1.1, 2.02), new Vector3(0.45, 1.1, 2.02), 0.03, 6, BLACK);
  p("paint").box(0, 0.68, 2.015, 0.42, 0.11, 0.01, rgb("#fafafa"));
  // Windscreen frame and glass, roll cage.
  p("glass").quad(new Vector3(0.74, 1.38, 0.62), new Vector3(-0.74, 1.38, 0.62), new Vector3(-0.72, 1.86, 0.5), new Vector3(0.72, 1.86, 0.5), [0.75, 0.8, 0.85]);
  p("glass").quad(new Vector3(-0.74, 1.38, 0.62), new Vector3(0.74, 1.38, 0.62), new Vector3(0.72, 1.86, 0.5), new Vector3(-0.72, 1.86, 0.5), [0.75, 0.8, 0.85]);
  for (const sd of [-1, 1]) p("metal").tube(new Vector3(sd * 0.75, 1.36, 0.63), new Vector3(sd * 0.73, 1.88, 0.5), 0.03, 6, BLACK);
  p("metal").tube(new Vector3(-0.73, 1.88, 0.5), new Vector3(0.73, 1.88, 0.5), 0.03, 6, BLACK);
  for (const sd of [-1, 1]) {
    p("metal").tube(new Vector3(sd * 0.74, 1.33, -0.85), new Vector3(sd * 0.72, 2.0, -0.85), 0.035, 6, BLACK);
    p("metal").tube(new Vector3(sd * 0.72, 2.0, -0.85), new Vector3(sd * 0.73, 1.88, 0.5), 0.03, 6, BLACK);
    p("metal").tube(new Vector3(sd * 0.72, 2.0, -0.85), new Vector3(sd * 0.74, 1.35, -1.75), 0.03, 6, BLACK);
  }
  p("metal").tube(new Vector3(-0.72, 2.0, -0.85), new Vector3(0.72, 2.0, -0.85), 0.035, 6, BLACK);
  // Spare wheel on the tail.
  p("rubber").cylinderZ(0, 1.1, -1.98, 0.42, 0.22, 18, [1, 1, 1]);
  p("metal").cylinderZ(0, 1.1, -1.98, 0.22, 0.2, 14, rgb("#6d6f72"));
  if (police) policeBits(p, 1.05, 0.81, 3.2, 1.98);
  steeringWheel(k, tilt, steer, new Vector3(0.4, 1.5, 0.3), 0.19, -1.1);
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.38, 0.26, rgb("#6d6f72"));
}

function tractor(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode): void {
  const p = (m: MatKey) => k.g("body", m);
  // Bonnet over the engine, grille, exhaust stack, big mudguards over the rear wheels.
  p("paint").box(0, 1.2, 0.85, 0.82, 0.62, 1.7, B);
  p("paint").box(0, 1.5, 0.85, 0.78, 0.06, 1.7, shade(B, 1.1));
  p("dark").box(0, 1.15, 1.71, 0.7, 0.5, 0.02, [1, 1, 1]);
  for (let y = 0.95; y < 1.38; y += 0.08) p("chrome").box(0, y, 1.72, 0.66, 0.025, 0.02, CHROME);
  lampPair(p, 0.3, 1.48, 1.72, 0.08, false);
  p("metal").box(0, 0.85, 0.0, 0.7, 0.55, 1.5, rgb("#3c3c3e"));
  p("metal").cylinder(0.32, 1.5, 1.2, 0.05, 0.045, 1.0, 8, BLACK);
  p("metal").cylinder(0.32, 2.5, 1.2, 0.06, 0.07, 0.08, 8, BLACK);
  for (const sd of [-1, 1]) {
    p("paint").ellipsoid(sd * 0.82, 1.2, -0.95, 0.32, 0.65, 0.85, 12, 6, B, 0, 1);
    p("paint").box(sd * 0.55, 1.08, -0.95, 0.12, 0.15, 1.3, A);
    p("metal").box(sd * 0.42, 0.75, -0.6, 0.2, 0.06, 0.4, BLACK);
  }
  p("matte").box(0, 1.5, -0.8, 0.5, 0.1, 0.45, rgb("#2f2a26"));
  p("matte").box(0, 1.78, -1.04, 0.5, 0.45, 0.08, rgb("#2f2a26"));
  p("metal").box(0, 0.8, -1.65, 0.5, 0.2, 0.4, BLACK);
  p("paint").box(0, 1.28, -1.6, 0.42, 0.12, 0.01, A);
  steeringWheel(k, tilt, steer, new Vector3(0, 1.85, -0.25), 0.2, -0.45);
  k.g("steer", "metal").cylinder(0, -0.45, 0, 0.025, 0.025, 0.45, 6, BLACK);
  wheel(k, "w0", 0.42, 0.2, A);
  wheel(k, "w1", 0.42, 0.2, A);
  for (const n of ["w2", "w3"]) {
    k.g(n, "rubber").torus(0, 0, 0, 0.62, 0.13, 24, 8, [1, 1, 1], "x");
    k.g(n, "rubber").cylinderX(0, 0, 0, 0.6, 0.42, 20, [1, 1, 1]);
    // Lugs on the big tyre.
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; k.g(n, "rubber").box(0, Math.sin(a) * 0.74, Math.cos(a) * 0.74, 0.44, 0.06, 0.1, [1, 1, 1]); }
    k.g(n, "paint").cylinderX(0, 0, 0, 0.42, 0.44, 16, A);
    k.g(n, "metal").cylinderX(0, 0, 0, 0.12, 0.5, 10, BLACK);
  }
}

function truck(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode): void {
  const p = (m: MatKey) => k.g("body", m);
  // Punjab highway truck: painted wooden body with a tarpaulin load, decorated cab.
  p("metal").box(0, 0.75, -0.2, 1.4, 0.3, 8.0, BLACK);
  p("wood").box(0, 1.55, -1.8, 2.4, 1.3, 6.0, B);
  for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) p("paint").box(sd * 1.205, 1.0 + i * 0.22, -1.8, 0.01, 0.1, 5.9, i % 2 ? A : rgb("#1565c0"));
  p("fabric").ellipsoid(0, 2.2, -1.8, 1.18, 0.75, 2.95, 12, 6, rgb("#2e7d32"), 0, 1);
  p("paint").box(0, 1.5, -4.82, 2.4, 1.2, 0.05, A);
  // Painted flowers along the load body, top rail and corner posts.
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = -4.3 + i * 1.0;
      p("paint").ellipsoid(sd * 1.212, 2.0, z, 0.01, 0.17, 0.17, 8, 4, rgb(i % 2 ? "#fdd835" : "#ffffff"));
      p("paint").ellipsoid(sd * 1.218, 2.0, z, 0.01, 0.07, 0.07, 6, 3, rgb("#c62828"));
    }
    p("wood").box(sd * 1.2, 2.24, -1.8, 0.08, 0.08, 6.0, shade(B, 0.8));
    for (const z of [-4.75, 1.15]) p("wood").box(sd * 1.18, 1.65, z, 0.12, 1.3, 0.12, shade(B, 0.8));
  }
  // Rear: "HORN OK PLEASE" board colours and reflectors.
  p("paint").box(0, 1.95, -4.86, 1.9, 0.32, 0.02, rgb("#fdd835"));
  for (const sd of [-1, 1]) p("emissive").box(sd * 0.95, 1.1, -4.87, 0.18, 0.06, 0.02, [1, 0.5, 0.1]);
  // Cab: rounded front corners, the carved and painted "crown" over a split
  // windscreen, painted doors — the Punjab highway look.
  loft(p("paint"), [
    { z: 1.62, pts: outline(1.14, 0.95, 2.55, 0.22, 0.06) },
    { z: 2.9, pts: outline(1.14, 0.95, 2.55, 0.22, 0.06) },
    { z: 3.12, pts: outline(1.1, 0.95, 2.5, 0.3, 0.1) },
    { z: 3.24, pts: outline(1.0, 1.0, 2.4, 0.32, 0.14) },
  ], B);
  p("paint").box(0, 2.58, 2.3, 2.3, 0.06, 1.4, A);
  // Crown: a tall painted peak with domes and a row of tassels.
  loft(p("paint"), [
    { z: 2.95, pts: [[-1.05, 2.5], [-0.85, 3.02], [0.85, 3.02], [1.05, 2.5]] },
    { z: 3.32, pts: [[-1.0, 2.4], [-0.82, 2.95], [0.82, 2.95], [1.0, 2.4]] },
  ], A);
  for (let i = 0; i < 5; i++) {
    const x = -0.64 + i * 0.32;
    p("paint").ellipsoid(x, 3.02, 3.14, 0.1, 0.12, 0.1, 8, 5, i % 2 ? rgb("#1565c0") : rgb("#c62828"), 0, 1);
    p("paint").ellipsoid(x, 2.68, 3.33, 0.09, 0.09, 0.02, 8, 4, rgb("#fdd835"));
  }
  p("chrome").box(0, 2.42, 3.29, 2.0, 0.05, 0.03, CHROME);
  // Split windscreen with a centre pillar, door windows, wipers.
  for (const sd of [-1, 1]) {
    p("glass").box(sd * 0.47, 2.05, 3.245, 0.86, 0.62, 0.03, [0.72, 0.78, 0.84], 0b000010);
    p("glass").box(sd * 1.145, 2.1, 2.55, 0.02, 0.55, 0.8, [0.72, 0.78, 0.84], sd > 0 ? 0b100000 : 0b010000);
    p("metal").tube(new Vector3(sd * 0.25, 1.76, 3.28), new Vector3(sd * 0.55, 2.2, 3.28), 0.012, 4, BLACK);
    // Door: painted panel with a flower, handle, step.
    p("paint").box(sd * 1.15, 1.45, 2.4, 0.01, 0.5, 1.0, A);
    p("paint").ellipsoid(sd * 1.155, 1.45, 2.4, 0.01, 0.16, 0.16, 8, 4, rgb("#fdd835"));
    p("paint").ellipsoid(sd * 1.16, 1.45, 2.4, 0.01, 0.07, 0.07, 6, 3, rgb("#c62828"));
    p("chrome").box(sd * 1.16, 1.8, 2.05, 0.02, 0.03, 0.14, CHROME);
    p("metal").box(sd * 1.1, 0.75, 2.45, 0.25, 0.04, 0.5, BLACK);
    // Mirrors on long arms.
    p("metal").tube(new Vector3(sd * 1.12, 2.3, 3.0), new Vector3(sd * 1.38, 2.25, 3.05), 0.02, 4, BLACK);
    p("dark").box(sd * 1.42, 2.05, 3.05, 0.06, 0.45, 0.2, [1, 1, 1]);
  }
  p("dark").box(0, 2.05, 3.255, 0.08, 0.66, 0.03, [1, 1, 1]);
  p("chrome").box(0, 0.95, 3.3, 2.3, 0.35, 0.14, CHROME);
  p("dark").box(0, 1.38, 3.25, 1.3, 0.42, 0.02, [1, 1, 1]);
  for (let x = -0.55; x <= 0.56; x += 0.11) p("chrome").box(x, 1.38, 3.262, 0.03, 0.38, 0.01, CHROME);
  lampPair(p, 0.9, 1.35, 3.24, 0.12, false);
  lampPair(p, 1.0, 0.95, -4.86, 0.1, true);
  // Tassels and a painted eye on the bumper — every Punjab truck has them.
  for (let x = -0.9; x <= 0.91; x += 0.2) p("cloth").box(x, 2.32, 3.33, 0.04, 0.18, 0.04, Math.round(x * 5) % 2 ? rgb("#e53935") : rgb("#fdd835"));
  for (const sd of [-1, 1]) { p("paint").ellipsoid(sd * 0.6, 0.95, 3.32, 0.12, 0.08, 0.02, 8, 4, rgb("#ffffff")); p("dark").ellipsoid(sd * 0.6, 0.95, 3.34, 0.05, 0.05, 0.01, 6, 3, [1, 1, 1]); }
  for (const sd of [-1, 1]) p("metal").cylinder(sd * 1.0, 0.6, 1.0, 0.25, 0.25, 0.5, 10, rgb("#9e9e9e"));
  p("chrome").cylinder(1.05, 1.6, 1.4, 0.07, 0.07, 1.6, 8, CHROME);
  steeringWheel(k, tilt, steer, new Vector3(0.55, 2.2, 2.85), 0.24, -0.9);
  // Wheels. A loaded Punjab truck runs tall tyres out at the body line, and
  // doubles them on the drive axle — with four narrow wheels tucked under the
  // bed it read as a box floating above the road.
  const HUB = rgb("#8d8d8d");
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.62, 0.34, HUB);
  // Second tyre inboard on each rear wheel (visual only; the physics keeps
  // its four contact points).
  for (const i of [2, 3]) {
    const sd = i === 2 ? -1 : 1;
    k.g(`w${i}`, "rubber").torus(-sd * 0.34, 0, 0, 0.565, 0.055, 20, 8, [1, 1, 1], "x");
    k.g(`w${i}`, "rubber").cylinderX(-sd * 0.34, 0, 0, 0.56, 0.3, 16, [1, 1, 1]);
    k.g(`w${i}`, "chrome").cylinderX(-sd * 0.5, 0, 0, 0.34, 0.04, 14, HUB);
  }
  // Mudflaps behind the drive axle.
  // Load restraint, under-run guards and fuel tank: actual shapes visible
  // from the side and rear, batched with the existing truck materials.
  for (const z of [-4.2, -2.6, -1, 0.6]) {
    for (const sd of [-1, 1]) p("fabric").tube(new Vector3(sd * 1.22, 1.05, z), new Vector3(sd * 0.94, 2.72, z), 0.025, 5, rgb("#c3ad7a"));
    p("fabric").tube(new Vector3(-0.94, 2.72, z), new Vector3(0, 2.96, z), 0.025, 5, rgb("#c3ad7a"));
    p("fabric").tube(new Vector3(0, 2.96, z), new Vector3(0.94, 2.72, z), 0.025, 5, rgb("#c3ad7a"));
  }
  p("metal").box(0, 0.48, -4.8, 2.3, 0.13, 0.14, BLACK);
  for (const sd of [-1, 1]) {
    p("metal").box(sd * 1.15, 0.64, -0.2, 0.06, 0.1, 2.1, BLACK);
    p("paint").box(sd * 0.86, 0.49, -4.88, 0.46, 0.09, 0.02, rgb("#f5c52d"));
  }
  p("metal").box(-0.93, 0.84, 0.2, 0.45, 0.46, 1.1, rgb("#62676a"));
  for (const z of [-0.15, 0.55]) p("chrome").box(-1.17, 0.84, z, 0.025, 0.46, 0.05, CHROME);
  for (const sd of [-1, 1]) p("cloth").box(sd * 1.0, 0.42, -3.35, 0.62, 0.72, 0.03, rgb("#1b1b1b"));
}

export type TrolleyLoad = "sugarcane" | "straw" | "bricks" | "empty";

/**
 * A two-wheeled farm trolley for tractors (visual only; the traffic manager
 * drags it behind the hitch). Origin at the axle; the tongue points to +Z.
 */
export function buildTrolley(scene: Scene, mats: Materials, id: string, load: TrolleyLoad, paint: string): { root: TransformNode; meshes: Mesh[] } {
  const root = new TransformNode(`${id}_trolley`, scene);
  const k = new PartKit(scene, mats);
  const p = (m: MatKey) => k.g("body", m);
  const B = rgb(paint);
  p("metal").box(0, 0.75, 0.2, 1.9, 0.12, 3.6, BLACK);
  p("paint").box(0, 1.15, 0.2, 2.0, 0.7, 3.6, B);
  p("dark").box(0, 1.2, 0.2, 1.8, 0.62, 3.4, [0.55, 0.5, 0.45]);
  for (const sd of [-1, 1]) p("paint").box(sd * 1.005, 1.2, 0.2, 0.01, 0.12, 3.5, rgb("#f6d743"));
  p("metal").box(0, 0.7, 2.55, 0.12, 0.1, 1.3, BLACK);
  p("metal").cylinder(0, 0.62, 3.2, 0.06, 0.06, 0.12, 6, BLACK);
  for (const sd of [-1, 1]) {
    k.g("body", "rubber").torus(sd * 1.05, 0.48, 0, 0.4, 0.09, 18, 6, [1, 1, 1], "x");
    k.g("body", "rubber").cylinderX(sd * 1.05, 0.48, 0, 0.4, 0.22, 14, [1, 1, 1]);
    k.g("body", "metal").cylinderX(sd * 1.05, 0.48, 0, 0.16, 0.26, 8, B);
  }
  if (load === "sugarcane") {
    // Ganna stacked high and sticking out the back, tied down with rope.
    for (let i = 0; i < 14; i++) {
      const x = -0.85 + (i % 7) * 0.28, y = 1.6 + Math.floor(i / 7) * 0.32;
      p("leaf").box(x, y, -0.1, 0.24, 0.3, 4.6, rgb(i % 3 ? "#8a9a4a" : "#6f7d3a"));
    }
    p("leaf").ellipsoid(0, 2.35, -0.1, 1.0, 0.35, 2.2, 10, 5, rgb("#a2b05a"), 0, 1);
  } else if (load === "straw") {
    // Paraali / toori heaped like a haystack under a net.
    p("crop").ellipsoid(0, 1.5, 0.2, 1.25, 1.35, 2.1, 14, 8, rgb("#d8bf6a"), 0, 1);
    p("fabric").box(0, 2.8, 0.2, 0.05, 0.05, 3.8, rgb("#5d4037"));
  } else if (load === "bricks") {
    for (let i = 0; i < 3; i++) p("brick").box(0, 1.5 + i * 0.22, 0.2, 1.7, 0.2, 3.2 - i * 0.4, rgb("#a4523a"));
  }
  const { meshes } = k.emit(id, { body: root });
  return { root, meshes };
}

/** Doodhwala's aluminium milk cans hung either side of a motorcycle's rear seat. */
export function addMilkCans(scene: Scene, mats: Materials, parent: TransformNode, id: string): Mesh[] {
  const k = new PartKit(scene, mats);
  for (const sd of [-1, 1]) for (const dz of [-0.55, -0.85]) {
    k.g("body", "chrome").cylinder(sd * 0.36, 0.72, dz, 0.13, 0.13, 0.5, 10, rgb("#c9ccce"));
    k.g("body", "chrome").cylinder(sd * 0.36, 1.22, dz, 0.07, 0.11, 0.08, 10, rgb("#b0b4b7"));
  }
  k.g("body", "metal").box(0, 1.24, -0.7, 0.9, 0.04, 0.5, BLACK);
  return k.emit(id, { body: parent }).meshes;
}
