import {
  Color3, Color4, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, PointLight, Scene, ShadowGenerator,
  StandardMaterial, Vector3, type AbstractMesh,
} from "../babylon";
import { Materials } from "../render/Materials";
import { SignAtlas } from "../render/Signs";
import { StaticColliderBuilder, type Physics } from "../physics/Physics";
import { Kit } from "./Kit";
import { BUILDINGS } from "./layout";
import { buildBuilding } from "./buildings";
import { dhabaInterior, workshop, type InteriorInfo } from "./interiors";
import { buildStreet } from "./street";
import { buildPolesAndWires, buildProps } from "./props";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import { buildCountry } from "./country";
import { buildTerrainCollider } from "./terrainCollider";
import { Texture } from "../babylon";

export type ShadowQuality = "off" | "low" | "high";

/**
 * Builds and owns the static district: geometry, collision, lighting, sky
 * and small ambient animations (ceiling fans).
 */
export class World {
  mats!: Materials;
  signs!: SignAtlas;
  sun!: DirectionalLight;
  hemi!: HemisphericLight;
  shadows: ShadowGenerator | null = null;
  private fans: Mesh[] = [];
  private staticMeshes: Mesh[] = [];
  private visibility: Array<{ mesh: Mesh; centre: Vector3; distance: number }> = [];
  private visibilityT = 0;
  /** Moving casters (people, vehicles, held items) always cast. */
  private casters: AbstractMesh[] = [];
  /** Scenery casters: only those near the player go into the shadow map. */
  private staticCasters: AbstractMesh[] = [];
  private shadowCentre = new Vector3(1e9, 0, 0);
  treeCount = 0;
  dhaba!: InteriorInfo;
  workshopInfo!: InteriorInfo;
  colliderCount = 0;
  private pointLights: PointLight[] = [];
  /**
   * Base fog density: a light haze that pulls the distance towards the sky colour, so the hills and the snow range sit far
   * away and distant roofs soften. Foreground stays sharp (nothing within 100 m is touched by more than 1 %). Winter fog
   * (dhund) adds to it.
   */
  baseFog = 0.0009;

  constructor(private scene: Scene, private physics: Physics) {}

  build(shadowQuality: ShadowQuality, lean = false): void {
    const scene = this.scene;
    this.mats = new Materials(scene);
    this.mats.init();
    this.signs = new SignAtlas();
    this.signs.build(scene);
    const colliders = new StaticColliderBuilder();
    const kit = new Kit(scene, this.mats, this.signs, colliders);
    kit.lean = lean;

    buildStreet(kit);
    for (const b of BUILDINGS) {
      buildBuilding(kit, b);
      if (b.use === "dhaba") this.dhaba = dhabaInterior(kit, b);
      if (b.use === "workshop") this.workshopInfo = workshop(kit, b);
    }
    buildPolesAndWires(kit);
    buildProps(kit);
    const decor = buildCountry(kit);
    this.staticMeshes = kit.finish();
    this.staticCasters = [...kit.casters];
    this.treeCount = decor.count;
    colliders.build(scene);
    buildTerrainCollider(scene);
    this.colliderCount = colliders.boxes.length;
    void this.physics;

    this.setupLighting(shadowQuality);
    this.buildSky();
    this.buildFans();
    for (const p of [...this.dhaba.lights, ...this.workshopInfo.lights]) {
      const l = new PointLight("interior", p, scene);
      l.diffuse = new Color3(1.0, 0.82, 0.6);
      l.intensity = 9;
      l.range = 11;
      l.specular = new Color3(0.2, 0.2, 0.2);
      this.pointLights.push(l);
    }
  }

  private setupLighting(q: ShadowQuality): void {
    const scene = this.scene;
    scene.clearColor = new Color4(0.78, 0.84, 0.9, 1);
    scene.ambientColor = new Color3(0.25, 0.22, 0.2);
    this.hemi = new HemisphericLight("hemi", new Vector3(0.1, 1, -0.2), scene);
    this.hemi.diffuse = new Color3(0.7, 0.8, 0.98);
    this.hemi.groundColor = new Color3(0.42, 0.33, 0.24);
    this.hemi.intensity = 0.62;
    this.hemi.specular = Color3.Black();
    // Warm late-morning sun from the south-east so façades on both sides get modelling.
    this.sun = new DirectionalLight("sun", new Vector3(-0.45, -0.78, 0.42).normalize(), scene);
    this.sun.position = new Vector3(40, 80, -40);
    this.sun.diffuse = new Color3(1.0, 0.88, 0.7);
    this.sun.intensity = 6.0;
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = this.baseFog;
    scene.fogColor = new Color3(0.86, 0.89, 0.94);
    this.setShadowQuality(q);
    if (location.search.includes("nohemi")) this.hemi.setEnabled(false);
  }

  setShadowQuality(q: ShadowQuality): void {
    this.shadows?.dispose();
    this.shadows = null;
    if (q === "off") return;
    // A single high-resolution map covers the compact district. (Cascaded maps
    // were tried first but mis-handled skinned casters in testing.)
    const sg = new ShadowGenerator(q === "high" ? 4096 : 2048, this.sun);
    sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = q === "high" ? ShadowGenerator.QUALITY_MEDIUM : ShadowGenerator.QUALITY_LOW;
    sg.bias = 0.0015;
    sg.normalBias = 0.015;
    sg.darkness = 0.0;
    // The map is large: the shadow frustum follows the player (see followShadows).
    this.sun.autoUpdateExtends = false;
    this.sun.shadowFrustumSize = q === "high" ? 130 : 110;
    this.sun.shadowMinZ = 1;
    this.sun.shadowMaxZ = 320;
    for (const m of this.casters) sg.addShadowCaster(m, false);
    this.shadows = sg;
    this.shadowCentre.set(1e9, 0, 0);
  }

  /** Change how far the countryside is drawn (phones use less). */
  setDrawDistance(d: number): void {
    this.visibility = [];
    for (const m of this.staticMeshes) {
      if (!m.getLODLevels().length) continue;
      m.removeLODLevel(null);
      // Small facade details keep their authored limit when the view distance changes.
      const authored = m.metadata?.authoredCullDistance as number | undefined;
      const distance = m.metadata?.detailCull && authored ? Math.min(d, authored) : d;
      m.addLODLevel(distance, null);
      this.visibility.push({ mesh: m, centre: m.getBoundingInfo().boundingSphere.centerWorld.clone(), distance });
    }
    this.visibilityT = 0;
    this.scene.fogDensity = this.baseFog;
  }

  get casterCount(): number {
    return this.shadows?.getShadowMap()?.renderList?.length ?? 0;
  }

  addCaster(m: AbstractMesh): void {
    this.casters.push(m);
    this.shadows?.addShadowCaster(m, true);
  }

  removeCaster(m: AbstractMesh): void {
    this.casters = this.casters.filter((c) => c !== m);
    this.shadows?.removeShadowCaster(m, true);
  }

  private buildSky(): void {
    const sky = MeshBuilder.CreateSphere("sky", { diameter: 900, segments: 24, sideOrientation: Mesh.BACKSIDE }, this.scene);
    const pos = sky.getVerticesData("position")!;
    const colors: number[] = [];
    const top = new Color3(0.3, 0.55, 0.92), hor = new Color3(0.86, 0.89, 0.94), low = new Color3(0.8, 0.82, 0.82);
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1]! / 450;
      const c = y > 0 ? Color3.Lerp(hor, top, Math.pow(y, 0.6)) : Color3.Lerp(hor, low, Math.min(1, -y * 4));
      colors.push(c.r, c.g, c.b, 1);
    }
    sky.setVerticesData("color", colors);
    const m = new StandardMaterial("skyMat", this.scene);
    m.disableLighting = true;
    m.emissiveColor = Color3.White();
    m.fogEnabled = false;
    m.backFaceCulling = false;
    sky.material = m;
    sky.useVertexColors = true;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.applyFog = false;
    // Soft painterly clouds as flattened blobs on the dome.
    const cloud = new GeoBuilder(1);
    const cm = new StandardMaterial("cloudMat", this.scene);
    cm.disableLighting = true;
    cm.emissiveColor = new Color3(1, 0.98, 0.95);
    cm.alpha = 0.85;
    cm.fogEnabled = false;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + i * 0.37;
      const r = 300 + (i % 3) * 30;
      const y = 90 + (i % 4) * 22;
      for (let k = 0; k < 4; k++) cloud.ellipsoid(Math.cos(a) * r + k * 14, y + (k % 2) * 4, Math.sin(a) * r + k * 6, 22 - k * 3, 6, 14, 10, 6, rgb("#ffffff"));
    }
    const cmesh = cloud.toMesh("clouds", this.scene, cm);
    cmesh.useVertexColors = false;
    cmesh.isPickable = false;
    cmesh.infiniteDistance = true;
  }

  private buildFans(): void {
    const g = new GeoBuilder(1);
    const c = rgb("#e9e4da");
    g.cylinder(0, -0.05, 0, 0.12, 0.1, 0.12, 12, c);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      // Blades as two-sided quads in a rotated frame.
      const ca = Math.cos(a), sa = Math.sin(a);
      const L = 0.62, W = 0.11;
      const pts = [[0.12, -W / 2], [0.12 + L, -W / 2 - 0.02], [0.12 + L, W / 2 + 0.02], [0.12, W / 2]] as const;
      const P = (x: number, z: number, y: number) => new Vector3(x * ca - z * sa, y, x * sa + z * ca);
      g.quad(P(pts[0][0], pts[0][1], 0), P(pts[1][0], pts[1][1], 0), P(pts[2][0], pts[2][1], 0), P(pts[3][0], pts[3][1], 0), c);
      g.quad(P(pts[3][0], pts[3][1], 0), P(pts[2][0], pts[2][1], 0), P(pts[1][0], pts[1][1], 0), P(pts[0][0], pts[0][1], 0), c);
    }
    const base = g.toMesh("fan", this.scene, this.mats.get("paint"));
    base.isVisible = false;
    for (const p of this.dhaba.fans) {
      const inst = base.clone("fanInst");
      inst.isVisible = true;
      inst.position.copyFrom(p);
      this.fans.push(inst);
    }
  }

  /**
   * Keep the sun's shadow box centred on the player and refresh which
   * scenery chunks cast into it (only nearby ones; distance-checked by bounds).
   */
  followShadows(p: Vector3): void {
    const sg = this.shadows;
    if (!sg) return;
    const dir = this.sun.direction;
    this.sun.position.set(p.x - dir.x * 150, p.y - dir.y * 150, p.z - dir.z * 150);
    // Scenery re-picks when the player has moved 12 m; people and vehicles move, so they re-pick four times a second.
    const moved = Vector3.DistanceSquared(p, this.shadowCentre) >= 12 * 12;
    const now = performance.now();
    if (!moved && now - this.casterRefreshAt < 250) return;
    this.casterRefreshAt = now;
    const R = (this.sun.shadowFrustumSize * 0.75) ** 2;
    if (moved) {
      this.shadowCentre.copyFrom(p);
      this.nearScenery.length = 0;
      for (const m of this.staticCasters) {
        const bs = m.getBoundingInfo().boundingSphere;
        const d = Vector3.DistanceSquared(bs.centerWorld, p) - bs.radiusWorld * bs.radiusWorld;
        if (d < R || bs.radiusWorld > 400) this.nearScenery.push(m);
      }
    }
    // Only people and vehicles inside the shadow box are drawn into it.
    const list = sg.getShadowMap()!.renderList!;
    const next: AbstractMesh[] = [];
    for (const m of this.casters) {
      if (m.isDisposed() || !m.isEnabled() || !m.isVisible) continue;
      const bs = m.getBoundingInfo().boundingSphere;
      if (Vector3.DistanceSquared(bs.centerWorld, p) - bs.radiusWorld * bs.radiusWorld < R) next.push(m);
    }
    next.push(...this.nearScenery);
    // Babylon observes this array. Clearing it then pushing dirties EVERY
    // mesh's lighting defines four times a second, even with identical
    // membership. One splice avoids the intermediate empty shadow map.
    if (list.length !== next.length || next.some((m, i) => list[i] !== m)) list.splice(0, list.length, ...next);
  }
  private casterRefreshAt = 0;
  private nearScenery: AbstractMesh[] = [];

  /** Per-frame cosmetic animation. */
  update(dt: number): void {
    // Far static chunks need no world-matrix, LOD or submesh evaluation. A small margin
    // keeps them enabled before Babylon's exact visual cutoff becomes visible.
    this.visibilityT -= dt;
    if (this.visibilityT <= 0 && this.scene.activeCamera) {
      this.visibilityT = 0.25;
      const camera = this.scene.activeCamera.globalPosition;
      for (const { mesh, centre, distance } of this.visibility) {
        const enabled = Vector3.DistanceSquared(camera, centre) < (distance + 30) ** 2;
        if (mesh.isEnabled() !== enabled) mesh.setEnabled(enabled);
      }
    }
    for (const f of this.fans) f.rotation.y += dt * 9;
    const w = this.mats.get("water");
    const t = w.albedoTexture as Texture | null;
    if (t) { t.vOffset += dt * 0.05; t.uOffset += dt * 0.012; }
    const n = w.bumpTexture as Texture | null;
    if (n) { n.vOffset += dt * 0.08; }
  }

  get drawMeshCount(): number {
    return this.staticMeshes.length;
  }

  dispose(): void {
    this.shadows?.dispose();
    for (const m of this.staticMeshes) m.dispose();
    for (const f of this.fans) f.dispose();
    for (const l of this.pointLights) l.dispose();
    this.mats.dispose();
  }
}
