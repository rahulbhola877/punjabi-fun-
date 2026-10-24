import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";

/** Glowing ground ring + light column + bobbing chevron used for objectives. */
export class Marker {
  root: TransformNode;
  private chevron: Mesh;
  private t = Math.random() * 6;
  constructor(scene: Scene, color: Color3, private mats: Materials) {
    this.root = new TransformNode("marker", scene);
    const mat = new StandardMaterial("markerMat", scene);
    mat.emissiveColor = color;
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.alpha = 0.55;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    const ring = MeshBuilder.CreateTorus("mring", { diameter: 2.2, thickness: 0.12, tessellation: 40 }, scene);
    ring.material = mat;
    ring.parent = this.root;
    ring.position.y = 0.08;
    const beamMat = mat.clone("beamMat");
    beamMat.alpha = 0.16;
    const beam = MeshBuilder.CreateCylinder("mbeam", { diameterTop: 1.6, diameterBottom: 2.1, height: 5, tessellation: 24, cap: Mesh.NO_CAP }, scene);
    beam.material = beamMat;
    beam.parent = this.root;
    beam.position.y = 2.5;
    const g = new GeoBuilder(1);
    const c = [color.r, color.g, color.b] as [number, number, number];
    g.box(0, 0.25, 0, 0.18, 0.5, 0.18, c);
    g.cylinder(0, -0.25, 0, 0.42, 0.0, 0.5, 4, c, true);
    this.chevron = g.toMesh("mchev", scene, mat);
    this.chevron.parent = this.root;
    for (const m of [ring, beam, this.chevron]) { m.isPickable = false; m.applyFog = false; }
    void this.mats;
    void rgb;
  }

  set(pos: Vector3 | null): void {
    this.root.setEnabled(!!pos);
    if (pos) this.root.position.copyFrom(pos);
  }

  update(dt: number): void {
    this.t += dt;
    this.chevron.position.y = 3.0 + Math.sin(this.t * 2.5) * 0.25;
    this.chevron.rotation.y += dt * 1.6;
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}

/** Steel three-tier tiffin carrier (dabba) — the delivery item. */
export function buildTiffin(scene: Scene, mats: Materials): Mesh {
  const g = new GeoBuilder(0.3);
  const s = rgb("#c9ced2"), d = rgb("#8f969b");
  for (let i = 0; i < 3; i++) {
    g.cylinder(0, i * 0.09, 0, 0.09, 0.09, 0.085, 16, s, true);
    g.torus(0, i * 0.09 + 0.085, 0, 0.092, 0.006, 16, 3, d);
  }
  g.cylinder(0, 0.27, 0, 0.07, 0.04, 0.02, 12, s, true);
  for (const x of [-0.1, 0.1]) g.box(x, 0.17, 0, 0.012, 0.34, 0.03, d);
  g.torus(0, 0.34, 0, 0.06, 0.008, 12, 3, d, "x");
  // Red cloth knot on top, as tiffins are often wrapped.
  g.ellipsoid(0, 0.3, 0, 0.05, 0.03, 0.05, 8, 5, rgb("#c0392b"));
  const m = g.toMesh("tiffin", scene, mats.get("chrome"));
  m.isPickable = false;
  return m;
}

/** A dish to hold while eating it (built once per kind, then shown/hidden). */
export function buildFood(scene: Scene, mats: Materials, kind: import("../missions/Shops").FoodProp): Mesh {
  const g = new GeoBuilder(0.3);
  const steel = rgb("#c3c8cc"), leaf = rgb("#6b8f3a");
  switch (kind) {
    case "thali":
      // Steel thali with two katoris, a roti/parantha and a dollop of makhan.
      g.cylinder(0, 0, 0, 0.15, 0.16, 0.02, 16, steel);
      g.cylinder(-0.06, 0.02, 0.05, 0.035, 0.04, 0.03, 10, steel, true, 1, rgb("#c0602a"));
      g.cylinder(0.06, 0.02, 0.05, 0.035, 0.04, 0.03, 10, steel, true, 1, rgb("#e9e3d0"));
      g.cylinder(0, 0.02, -0.05, 0.08, 0.08, 0.012, 14, rgb("#d9a65a"));
      g.ellipsoid(0, 0.035, -0.05, 0.02, 0.012, 0.02, 6, 3, rgb("#f6e7a1"));
      break;
    case "glass":
      g.cylinder(0, 0, 0, 0.035, 0.045, 0.14, 12, steel, true, 1, rgb("#f2ecd8"));
      break;
    case "kulhad":
      g.cylinder(0, 0, 0, 0.03, 0.04, 0.07, 10, rgb("#a4502c"), true, 1, rgb("#b8854f"));
      break;
    case "dona":
      // Leaf bowl with a few round things in it (gol gappe, samosa, tikki).
      g.cylinder(0, 0, 0, 0.05, 0.08, 0.035, 10, leaf, true, 1, rgb("#c9a15b"));
      for (const [x, z] of [[-0.025, 0], [0.025, 0.01], [0, -0.03]] as const) g.ellipsoid(x, 0.045, z, 0.022, 0.018, 0.022, 6, 4, rgb("#d7a24a"));
      break;
    case "jalebi":
      g.box(0, 0, 0, 0.16, 0.005, 0.12, rgb("#efe6cf"));
      for (const [x, z] of [[-0.03, 0], [0.03, 0.01], [0, -0.03]] as const) g.torus(x, 0.012, z, 0.025, 0.007, 10, 4, rgb("#f08a1a"));
      break;
    case "ganna":
      g.cylinder(0, 0, 0, 0.035, 0.045, 0.14, 12, rgb("#cfd6c4"), true, 1, rgb("#9fb04a"));
      break;
    case "kulfi":
      g.cylinder(0, 0, 0, 0.04, 0.03, 0.06, 10, rgb("#a4502c"), true, 1, rgb("#f3e3b0"));
      g.box(0, 0.08, 0, 0.008, 0.06, 0.008, rgb("#d8c6a0"));
      break;
    case "fruit":
      g.ellipsoid(0, 0.04, 0, 0.04, 0.04, 0.04, 8, 5, rgb("#f0a020"));
      break;
  }
  const m = g.toMesh(`food_${kind}`, scene, mats.get("paint"));
  m.isPickable = false;
  return m;
}

/** A cricket bat for the hand: a willow blade with a cane handle, standing up from the grip. */
export function buildBat(scene: Scene, mats: Materials): Mesh {
  const g = new GeoBuilder(0.3);
  g.boxMinMax(-0.055, 0.05, -0.02, 0.055, 0.62, 0.02, rgb("#d9b77a"));
  g.boxMinMax(-0.012, 0.62, -0.012, 0.012, 0.93, 0.012, rgb("#7a5a3a"));
  g.boxMinMax(-0.016, 0.7, -0.016, 0.016, 0.84, 0.016, rgb("#c62828"));
  const m = g.toMesh("bat", scene, mats.get("wood"));
  m.isPickable = false;
  return m;
}
