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
  constructor(private scene: Scene, private mats: Materials) {}
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
      const m = b.toMesh(`${name}_${k}`, this.scene, this.mats.get(mat));
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
  const k = new PartKit(scene, mats);
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
    case "bicycle": bicycle(k, B, A, steer); break;
    case "motorcycle": motorcycle(k, B, A, steer); break;
    case "car": car(k, B, A, tilt!, steer, body === "#f0f0ee"); break;
    case "jeep": jeep(k, B, A, tilt!, steer, body === "#f0f0ee"); break;
    case "tractor": tractor(k, B, A, tilt!, steer); break;
    case "truck": truck(k, B, A, tilt!, steer); break;
  }
  void signs;
  const nodes: Record<string, TransformNode> = { body: root, steer };
  wheels.forEach((w, i) => (nodes[`w${i}`] = w));
  const { meshes, paintable } = k.emit(id, nodes);
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

function motorcycle(k: PartKit, B: RGB, A: RGB, steer: TransformNode): void {
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

function car(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode, police: boolean): void {
  const p = (m: MatKey) => k.g("body", m);
  // Small boxy hatchback: lower body, glasshouse with pillars, bumpers.
  p("paint").box(0, 0.68, 0.05, 1.5, 0.5, 3.4, B);
  p("paint").box(0, 0.98, 1.25, 1.44, 0.12, 0.9, B);
  p("paint").box(0, 1.56, -0.3, 1.3, 0.06, 1.75, B);
  for (const [x, z] of [[-0.64, 0.58], [0.64, 0.58], [-0.64, -1.15], [0.64, -1.15], [-0.64, -0.3], [0.64, -0.3]] as const) p("paint").box(x, 1.25, z, 0.06, 0.62, 0.08, B);
  p("glass").quad(new Vector3(0.62, 0.96, 0.75), new Vector3(-0.62, 0.96, 0.75), new Vector3(-0.62, 1.54, 0.52), new Vector3(0.62, 1.54, 0.52), [1, 1, 1]);
  p("glass").quad(new Vector3(-0.62, 0.96, -1.18), new Vector3(0.62, 0.96, -1.18), new Vector3(0.62, 1.54, -1.12), new Vector3(-0.62, 1.54, -1.12), [1, 1, 1]);
  for (const sd of [-1, 1]) {
    const x = sd * 0.65;
    const q = (z0: number, z1: number) => sd > 0
      ? p("glass").quad(new Vector3(x, 0.96, z1), new Vector3(x, 0.96, z0), new Vector3(x, 1.53, z0), new Vector3(x, 1.53, z1), [1, 1, 1])
      : p("glass").quad(new Vector3(x, 0.96, z0), new Vector3(x, 0.96, z1), new Vector3(x, 1.53, z1), new Vector3(x, 1.53, z0), [1, 1, 1]);
    q(-0.26, 0.54);
    q(-1.11, -0.34);
    p("paint").box(sd * 0.76, 0.72, 0.05, 0.02, 0.06, 3.0, A);
    p("dark").box(sd * 0.85, 1.08, 0.62, 0.12, 0.08, 0.04, [1, 1, 1]);
  }
  p("rubber").box(0, 0.5, 1.78, 1.52, 0.18, 0.12, [1, 1, 1]);
  p("rubber").box(0, 0.5, -1.72, 1.52, 0.18, 0.12, [1, 1, 1]);
  p("dark").box(0, 0.75, 1.76, 0.7, 0.14, 0.02, [1, 1, 1]);
  lampPair(p, 0.55, 0.8, 1.74, 0.09, false);
  lampPair(p, 0.6, 0.85, -1.76, 0.07, true);
  p("paint").box(0, 0.58, -1.79, 0.4, 0.11, 0.01, rgb("#f3f3f3"));
  p("matte").box(-0.33, 0.6, -0.15, 0.48, 0.12, 0.5, rgb("#3a2f2a"));
  p("matte").box(0.33, 0.6, -0.15, 0.48, 0.12, 0.5, rgb("#3a2f2a"));
  p("matte").box(0, 0.62, -0.85, 1.2, 0.12, 0.5, rgb("#3a2f2a"));
  p("dark").box(0, 0.98, 0.65, 1.3, 0.1, 0.25, [1, 1, 1]);
  if (police) policeBits(p, 0.9, 0.75, 3.0, 1.59);
  steeringWheel(k, tilt, steer, new Vector3(0.33, 1.02, 0.42), 0.17, -1.15);
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.28, 0.18, rgb("#a9adb1"));
}

function jeep(k: PartKit, B: RGB, A: RGB, tilt: TransformNode, steer: TransformNode, police: boolean): void {
  const p = (m: MatKey) => k.g("body", m);
  // Open-top utility jeep: tub, bonnet, roll bar, spare wheel.
  p("paint").box(0, 0.95, 0, 1.62, 0.7, 3.5, B);
  p("dark").box(0, 1.28, -0.45, 1.4, 0.04, 2.1, [1, 1, 1]);
  p("paint").box(0, 1.35, 1.25, 1.5, 0.1, 1.0, B);
  p("dark").box(0, 1.0, 1.76, 1.1, 0.4, 0.02, [1, 1, 1]);
  for (let x = -0.45; x <= 0.46; x += 0.15) p("chrome").box(x, 1.0, 1.77, 0.04, 0.36, 0.02, CHROME);
  lampPair(p, 0.62, 1.05, 1.76, 0.1, false);
  lampPair(p, 0.68, 1.0, -1.76, 0.08, true);
  p("glass").quad(new Vector3(0.75, 1.42, 0.72), new Vector3(-0.75, 1.42, 0.72), new Vector3(-0.75, 1.95, 0.62), new Vector3(0.75, 1.95, 0.62), [1, 1, 1]);
  p("glass").quad(new Vector3(-0.75, 1.42, 0.72), new Vector3(0.75, 1.42, 0.72), new Vector3(0.75, 1.95, 0.62), new Vector3(-0.75, 1.95, 0.62), [1, 1, 1]);
  p("metal").tube(new Vector3(-0.75, 1.42, 0.72), new Vector3(-0.75, 1.96, 0.62), 0.025, 6, BLACK);
  p("metal").tube(new Vector3(0.75, 1.42, 0.72), new Vector3(0.75, 1.96, 0.62), 0.025, 6, BLACK);
  p("metal").tube(new Vector3(-0.75, 1.96, 0.62), new Vector3(0.75, 1.96, 0.62), 0.025, 6, BLACK);
  for (const sd of [-1, 1]) {
    p("metal").tube(new Vector3(sd * 0.74, 1.3, -0.9), new Vector3(sd * 0.74, 2.0, -0.9), 0.035, 6, BLACK);
    p("paint").box(sd * 0.82, 0.62, 1.25, 0.14, 0.06, 0.9, A);
    p("paint").box(sd * 0.82, 0.62, -1.15, 0.14, 0.06, 0.9, A);
  }
  p("metal").tube(new Vector3(-0.74, 2.0, -0.9), new Vector3(0.74, 2.0, -0.9), 0.035, 6, BLACK);
  p("matte").box(0.4, 1.05, -0.35, 0.55, 0.12, 0.5, rgb("#2f2a26"));
  p("matte").box(-0.4, 1.05, -0.35, 0.55, 0.12, 0.5, rgb("#2f2a26"));
  p("matte").box(0, 1.08, -1.25, 1.3, 0.12, 0.6, rgb("#2f2a26"));
  p("rubber").torus(0, 1.05, -1.84, 0.3, 0.1, 16, 6, [1, 1, 1], "x");
  p("rubber").cylinderZ(0, 1.05, -1.84, 0.2, 0.2, 12, [1, 1, 1]);
  if (police) policeBits(p, 0.95, 0.81, 3.2, 1.98);
  steeringWheel(k, tilt, steer, new Vector3(0.4, 1.42, 0.38), 0.19, -1.1);
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.38, 0.24, rgb("#6d6f72"));
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
  p("paint").box(0, 1.6, 1.55, 2.3, 2.1, 0.5, B);
  p("paint").box(0, 1.5, 2.45, 2.25, 1.9, 1.5, B);
  p("paint").box(0, 2.6, 2.35, 2.3, 0.2, 1.7, A);
  p("glass").box(0, 2.05, 3.2, 2.0, 0.75, 0.04, [1, 1, 1], 0b000010);
  for (const sd of [-1, 1]) p("glass").box(sd * 1.13, 2.05, 2.5, 0.02, 0.6, 0.9, [1, 1, 1], sd > 0 ? 0b100000 : 0b010000);
  p("chrome").box(0, 0.95, 3.25, 2.3, 0.35, 0.12, CHROME);
  p("dark").box(0, 1.35, 3.22, 1.4, 0.45, 0.02, [1, 1, 1]);
  lampPair(p, 0.9, 1.35, 3.24, 0.12, false);
  lampPair(p, 1.0, 0.95, -4.86, 0.1, true);
  // Tassels and a painted eye on the bumper — every Punjab truck has them.
  for (let x = -1.0; x <= 1.01; x += 0.25) p("cloth").box(x, 2.82, 3.2, 0.05, 0.22, 0.05, x % 0.5 ? rgb("#e53935") : rgb("#fdd835"));
  for (const sd of [-1, 1]) { p("paint").ellipsoid(sd * 0.6, 0.95, 3.32, 0.12, 0.08, 0.02, 8, 4, rgb("#ffffff")); p("dark").ellipsoid(sd * 0.6, 0.95, 3.34, 0.05, 0.05, 0.01, 6, 3, [1, 1, 1]); }
  for (const sd of [-1, 1]) p("metal").cylinder(sd * 1.0, 0.6, 1.0, 0.25, 0.25, 0.5, 10, rgb("#9e9e9e"));
  p("chrome").cylinder(1.05, 1.6, 1.4, 0.07, 0.07, 1.6, 8, CHROME);
  steeringWheel(k, tilt, steer, new Vector3(0.55, 2.2, 2.85), 0.24, -0.9);
  // Wheels. A loaded Punjab truck runs tall tyres out at the body line, and
  // doubles them on the drive axle — with four narrow wheels tucked under the
  // bed it read as a box floating above the road.
  const HUB = rgb("#8d8d8d");
  for (let i = 0; i < 4; i++) wheel(k, `w${i}`, 0.62, 0.34, HUB);
  // Second tyre outboard on each rear wheel (visual only; the physics keeps
  // its four contact points).
  for (const i of [2, 3]) {
    const sd = i === 2 ? -1 : 1;
    k.g(`w${i}`, "rubber").torus(sd * 0.34, 0, 0, 0.565, 0.055, 20, 8, [1, 1, 1], "x");
    k.g(`w${i}`, "rubber").cylinderX(sd * 0.34, 0, 0, 0.56, 0.3, 16, [1, 1, 1]);
    k.g(`w${i}`, "chrome").cylinderX(sd * 0.5, 0, 0, 0.34, 0.04, 14, HUB);
  }
  // Mudflaps behind the drive axle.
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
