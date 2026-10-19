import { Mesh, Scene, TransformNode, Vector3 } from "@babylonjs/core";
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
  if (type === "scooter") scooter(k, B, A, steer, wheels);
  else auto(k, B, A, steer, wheels);
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
