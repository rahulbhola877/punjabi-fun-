import { Matrix, Mesh, Scene, Vector3 } from "../babylon";
import { GeoBuilder, type RGB } from "../render/GeoBuilder";
import type { Materials, MatKey } from "../render/Materials";
import type { SignAtlas } from "../render/Signs";
import type { StaticColliderBuilder } from "../physics/Physics";
import { Rng } from "../render/textures";

/** Metres per texture repeat for each material. */
const UV_SCALE: Partial<Record<MatKey, number>> = {
  plaster: 2.5, brick: 2, wood: 1.2, shutter: 1.5, fabric: 1, asphalt: 6, paver: 2,
  dirt: 5, leaf: 1.5, concrete: 3, cloth: 0.6, interior: 2.5, crop: 1.2, water: 6, grass: 4,
};

/**
 * Construction kit for procedural scenery. Geometry is written in a local
 * frame (set with `frame`) and batched into one builder per material per
 * spatial chunk. Collision boxes use the same local frame so visuals and
 * physics stay aligned by construction.
 */
export class Kit {
  private builders = new Map<string, GeoBuilder>();
  private m = Matrix.Identity();
  private ox = 0;
  private oz = 0;
  private rotY = 0;
  private chunkKey = "0";
  rng = new Rng(1);
  /** Spatial batching size for new geometry (the open country uses larger chunks). */
  chunkSize = 40;
  /** Hide meshes of the current chunk beyond this camera distance (0 = always drawn). */
  cullDistance = 0;
  private cullFor = new Map<string, number>();
  /** When false, new geometry goes to builders that do not cast shadows. */
  cast = true;
  /** The Low preset: skip small detail (grills, kitchens, charpais, crop rows) to keep the load light. */
  lean = false;
  /** Meshes that should not cast shadows (ground layers). */
  private noShadow = new Set<MatKey>(["asphalt", "paver", "dirt", "concrete", "water", "grass", "glass", "dark", "emissive", "chrome", "sigRed0", "sigAmber0", "sigGreen0", "sigRed1", "sigAmber1", "sigGreen1"]);
  readonly meshes: Mesh[] = [];
  readonly casters: Mesh[] = [];

  constructor(
    readonly scene: Scene,
    readonly mats: Materials,
    readonly signs: SignAtlas,
    readonly colliders: StaticColliderBuilder,
  ) {}

  /** Set the local frame: origin (ox, 0, oz), rotated by rotY about Y. */
  frame(ox: number, oz: number, rotY = 0, oy = 0): void {
    this.ox = ox;
    this.oz = oz;
    this.rotY = rotY;
    this.m = Matrix.RotationY(rotY).multiply(Matrix.Translation(ox, oy, oz));
    this.chunkKey = `${this.chunkSize}:${Math.floor(ox / this.chunkSize)},${Math.floor(oz / this.chunkSize)}`;
  }

  currentRotY(): number {
    return this.rotY;
  }

  /** Place a sign in world space facing direction rotY (local +Z after rotation); restores the frame. */
  signAt(key: string, x: number, y: number, z: number, rotY: number, width: number): void {
    const saved = { ox: this.ox, oz: this.oz, r: this.rotY };
    this.frame(x, z, rotY);
    this.g("paint").boxMinMax(-width / 2 - 0.04, y - width / this.signs.get(key).aspect / 2 - 0.04, -0.03, width / 2 + 0.04, y + width / this.signs.get(key).aspect / 2 + 0.04, 0, [0.05, 0.05, 0.05]);
    this.sign(key, 0, y, 0.005, width);
    this.frame(saved.ox, saved.oz, saved.r);
  }

  world(): void {
    this.frame(0, 0, 0);
  }

  /** Builder for a material in the current chunk, with the current frame applied. */
  g(mat: MatKey): GeoBuilder {
    // Materials that never cast shadows share one builder whatever `cast` says.
    const key = `${mat}|${this.chunkKey}${this.cast || this.noShadow.has(mat) ? "" : "|nc"}`;
    let b = this.builders.get(key);
    if (!b) {
      b = new GeoBuilder(UV_SCALE[mat] ?? 1);
      b.label = key;
      this.builders.set(key, b);
      if (this.cullDistance > 0) this.cullFor.set(key, this.cullDistance);
      // Small facade detail (the non-casting groups) is not drawn beyond about 90 m, or 60 m on Low.
      if (!this.cast && !this.noShadow.has(mat)) this.cullFor.set(key, Math.min(this.cullDistance || 1e9, this.lean ? 60 : 90));
    }
    b.setTransform(this.m);
    return b;
  }

  /** Transform a local point into world space. */
  toWorld(x: number, y: number, z: number): Vector3 {
    return Vector3.TransformCoordinates(new Vector3(x, y, z), this.m);
  }

  /** Local-space collision box (centre + size), rotated with the frame. */
  collide(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, extraRotY = 0, rotX = 0): void {
    const w = this.toWorld(cx, cy, cz);
    this.colliders.add(w.x, w.y, w.z, sx, sy, sz, this.rotY + extraRotY, rotX);
  }

  /** Visual box + matching collision in one call. */
  solid(mat: MatKey, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, c: RGB, faces = 0b111111): void {
    this.g(mat).box(cx, cy, cz, sx, sy, sz, c, faces);
    this.collide(cx, cy, cz, sx, sy, sz);
  }

  /** Sign quad facing local +Z at z, centred at (cx, cy), with given width; height from atlas aspect. */
  sign(key: string, cx: number, cy: number, z: number, width: number): number {
    const uv = this.signs.get(key);
    const h = width / uv.aspect;
    const b = this.g("signs");
    const x0 = cx - width / 2, x1 = cx + width / 2, y0 = cy - h / 2, y1 = cy + h / 2;
    const white: RGB = [1, 1, 1];
    const i0 = b.vertex(x1, y0, z, 0, 0, 1, uv.u0, uv.v0, white);
    const i1 = b.vertex(x0, y0, z, 0, 0, 1, uv.u1, uv.v0, white);
    const i2 = b.vertex(x0, y1, z, 0, 0, 1, uv.u1, uv.v1, white);
    const i3 = b.vertex(x1, y1, z, 0, 0, 1, uv.u0, uv.v1, white);
    // Face +Z (toward viewer standing in front): uv mirrored to read correctly.
    b.tri(i0, i1, i2);
    b.tri(i0, i2, i3);
    return h;
  }

  /** Emit meshes for every non-empty builder. */
  finish(): Mesh[] {
    for (const [key, b] of this.builders) {
      if (b.isEmpty()) continue;
      const [mat] = key.split("|") as [MatKey];
      const mesh = b.toMesh(`world_${key}`, this.scene, mat === "signs" ? this.signs.material : this.mats.get(mat), false, true);
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      const cull = this.cullFor.get(key);
      if (cull) mesh.addLODLevel(cull, null);
      this.meshes.push(mesh);
      if (!this.noShadow.has(mat) && !key.endsWith("|nc")) this.casters.push(mesh);
    }
    this.builders.clear();
    return this.meshes;
  }
}
