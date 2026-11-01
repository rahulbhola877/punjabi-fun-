import {
  Color3, Color4, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, PointLight, Scene, ShadowGenerator,
  DynamicTexture, StandardMaterial, Vector3, type AbstractMesh, type PhysicsBody,
} from "../babylon";
import { Materials } from "../render/Materials";
import { SignAtlas } from "../render/Signs";
import { StaticColliderBuilder, type Physics } from "../physics/Physics";
import { Kit } from "./Kit";
import { BUILDINGS } from "./layout";
import { buildBuilding } from "./buildings";
import { dhabaInterior, workshop, type InteriorInfo } from "./interiors";
import { buildStreet } from "./street";
import { buildTextileDisplay } from "./streetTextile";
import { buildPolesAndWires, buildProps } from "./props";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import { buildCountry } from "./country";
import { buildTerrainCollider } from "./terrainCollider";
import { orchardCollider } from "./orchard";
import { buildRidgeCollider } from "./ridge";
import { OuterRegions } from "./outerRegions";
import type { RegionAnchor } from "./LazyRegionStreamer";
import { Texture } from "../babylon";
import { OUTER_WORLD_ENABLED } from "../app/config";
import { EnabledMeshCandidates } from "../render/EnabledMeshCandidates";

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
  private clouds: Mesh | null = null;
  private sky: Mesh | null = null;
  private staticColliders: StaticColliderBuilder | null = null;
  private terrainBodies: PhysicsBody[] = [];
  private outerRegions: OuterRegions | null = null;
  private disposed = false;
  private meshCandidates: EnabledMeshCandidates | null = null;
  private staticMeshes: Mesh[] = [];
  private visibility: Array<{ mesh: Mesh; min: Vector3; max: Vector3; distance: number }> = [];
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
    this.disposed = false;
    const scene = this.scene;
    this.mats = new Materials(scene);
    this.mats.init();
    this.signs = new SignAtlas();
    this.signs.build(scene);
    const colliders = new StaticColliderBuilder();
    this.staticColliders = colliders;
    const kit = new Kit(scene, this.mats, this.signs, colliders);
    kit.lean = lean;

    buildStreet(kit);
    for (const b of BUILDINGS) {
      buildBuilding(kit, b);
      if (b.use === "dhaba") this.dhaba = dhabaInterior(kit, b);
      if (b.use === "workshop") this.workshopInfo = workshop(kit, b);
    }
    buildTextileDisplay(kit);
    buildPolesAndWires(kit);
    buildProps(kit);
    const decor = buildCountry(kit);
    this.staticMeshes = kit.finish();
    this.staticCasters = [...kit.casters];
    this.treeCount = decor.count;
    colliders.build(scene);
    this.terrainBodies = [buildTerrainCollider(scene), orchardCollider(scene), buildRidgeCollider(scene)];
    this.colliderCount = colliders.boxes.length;
    void this.physics;

    this.setupLighting(shadowQuality);
    if (OUTER_WORLD_ENABLED) this.outerRegions = new OuterRegions(scene, this.mats, this.signs, {
      loaded: (r) => { this.staticCasters.push(...r.casters); this.shadowCentre.set(1e9, 0, 0); },
      unloading: (r) => {
        const removed = new Set(r.casters);
        this.staticCasters = this.staticCasters.filter((m) => !removed.has(m));
        this.nearScenery = this.nearScenery.filter((m) => !removed.has(m));
        this.shadowCentre.set(1e9, 0, 0);
      },
    });
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
    this.meshCandidates = new EnabledMeshCandidates(scene);
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
      // A batch can span far beyond its chunk key when legacy world-space
      // geometry is appended to it. Both Babylon's LOD and our own toggle
      // must measure conservatively from its bounds, or nearby geometry and
      // walls disappear while their colliders and unrelated details remain.
      const sphere = m.getBoundingInfo().boundingSphere;
      const radius = sphere.radiusWorld;
      const bounds = m.getBoundingInfo().boundingBox;
      m.addLODLevel(distance + radius, null);
      this.visibility.push({ mesh: m, min: bounds.minimumWorld.clone(), max: bounds.maximumWorld.clone(), distance });
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
    this.sky = sky;
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
    // Soft cloud banks on the horizon, merged into one draw call. The painted
    // alpha edge avoids the hard outlines of individual geometric spheres.
    const cloud = new GeoBuilder(1);
    const cm = new StandardMaterial("cloudMat", this.scene);
    cm.disableLighting = true;
    cm.emissiveColor = new Color3(1, 0.98, 0.95);
    const cloudTex = new DynamicTexture("cloudPaint", { width: 512, height: 256 }, this.scene, true);
    const ctx = cloudTex.getContext() as CanvasRenderingContext2D;
    // Overlapping translucent brush dabs produce a loose silhouette and a
    // soft underside. Explicit positions make startup deterministic.
    const dabs = [[256, 169, 198, 50], [119, 163, 83, 48], [173, 125, 85, 63], [242, 105, 84, 74], [306, 128, 91, 60], [373, 146, 88, 48], [424, 172, 50, 30]];
    for (const [x, y, rx, ry] of dabs) {
      ctx.save();
      ctx.translate(x!, y!);
      ctx.scale(rx!, ry!);
      const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
      g.addColorStop(0, "rgba(255,255,255,0.56)");
      g.addColorStop(0.55, "rgba(255,255,255,0.36)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
    cloudTex.hasAlpha = true;
    cloudTex.update(false);
    cm.emissiveTexture = cloudTex;
    cm.opacityTexture = cloudTex;
    cm.backFaceCulling = false;
    cm.fogEnabled = false;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.11 * Math.sin(i * 4.7);
      const r = 320 + (i % 3) * 22, y = 72 + (i % 4) * 19;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const width = 62 + (i % 4) * 12, height = width * 0.36;
      const dx = -Math.sin(a) * width, dz = Math.cos(a) * width;
      cloud.quad(new Vector3(x - dx, y - height, z - dz), new Vector3(x + dx, y - height, z + dz),
        new Vector3(x + dx, y + height, z + dz), new Vector3(x - dx, y + height, z - dz), rgb("#ffffff"), 1, 1);
    }
    const cmesh = cloud.toMesh("clouds", this.scene, cm);
    cmesh.useVertexColors = false;
    cmesh.isPickable = false;
    cmesh.infiniteDistance = true;
    cmesh.applyFog = false;
    this.clouds = cmesh;
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

  /** Travel changes the camera before its next render/global-matrix update.
   * Enable destination batches synchronously so a completed fade never reveals
   * the old culling set over an empty landscape. */
  syncVisibilityAt(camera: Vector3): void {
    this.visibilityT=0.25;
    for (const { mesh, min, max, distance } of this.visibility) {
        // Distance from the camera to the nearest point on the bounding box
        // remains conservative but avoids keeping long thin batches visible
        // merely because their much larger bounding sphere overlaps it.
        const dx = Math.max(min.x - camera.x, 0, camera.x - max.x);
        const dy = Math.max(min.y - camera.y, 0, camera.y - max.y);
        const dz = Math.max(min.z - camera.z, 0, camera.z - max.z);
        const enabled = dx * dx + dy * dy + dz * dz < (distance + 30) ** 2;
        if (mesh.isEnabled() !== enabled) mesh.setEnabled(enabled);
      }
  }

  /** Per-frame cosmetic animation. */
  update(dt: number): void {
    // Far static chunks need no world-matrix, LOD or submesh evaluation. A small margin
    // keeps them enabled before Babylon's exact visual cutoff becomes visible.
    this.visibilityT -= dt;
    if (this.visibilityT <= 0 && this.scene.activeCamera) {
      this.visibilityT = 0.25;
      const camera = this.scene.activeCamera.globalPosition;
      this.syncVisibilityAt(camera);
    }
    for (const f of this.fans) f.rotation.y += dt * 9;
    if (this.clouds) this.clouds.rotation.y += dt * 0.0006;
    const w = this.mats.get("water");
    // The reflected sky follows the current day/night and storm tint, so it
    // does not remain bright blue under an overcast sky or after sunset.
    const sky = this.scene.clearColor;
    w.reflectionColor.set(sky.r, sky.g, sky.b);
    const t = w.albedoTexture as Texture | null;
    if (t) { t.vOffset += dt * 0.05; t.uOffset += dt * 0.012; }
    const n = w.bumpTexture as Texture | null;
    if (n) { n.vOffset += dt * 0.08; }
  }

  get drawMeshCount(): number {
    return this.staticMeshes.length;
  }

  /** Preload before teleport/spawn/remote physics queries; caller supplies all active anchors. */
  preloadOuterRegions(anchors: readonly RegionAnchor[]): void { this.outerRegions?.preload(anchors); }

  /** Keep terrain and its colliders alive for every simulated actor. */
  updateOuterRegions(anchors: readonly RegionAnchor[]): void { this.outerRegions?.update(anchors); }

  get outerRegionCount(): number { return this.outerRegions?.activeCount ?? 0; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.meshCandidates?.dispose();
    this.meshCandidates = null;
    this.outerRegions?.dispose();
    this.outerRegions = null;
    this.shadows?.dispose();
    this.shadows = null;
    this.staticColliders?.dispose();
    this.staticColliders = null;
    for (const body of this.terrainBodies) {
      const shape = body.shape;
      const node = body.transformNode;
      body.dispose();
      shape?.dispose();
      node.dispose();
    }
    this.terrainBodies = [];
    for (const m of this.staticMeshes) m.dispose();
    this.staticMeshes = [];
    for (const f of this.fans) f.dispose();
    this.fans = [];
    this.clouds?.material?.dispose(true, true);
    this.clouds?.dispose();
    this.clouds = null;
    this.sky?.material?.dispose(true, true);
    this.sky?.dispose();
    this.sky = null;
    for (const l of this.pointLights) l.dispose();
    this.pointLights = [];
    this.sun?.dispose();
    this.hemi?.dispose();
    this.signs?.material?.dispose(true, true);
    this.mats?.dispose();
    this.visibility = [];
    this.casters = [];
    this.staticCasters = [];
    this.nearScenery = [];
  }
}
