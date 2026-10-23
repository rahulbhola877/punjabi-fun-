import { BoxParticleEmitter, Color3, Color4, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, PBRMaterial, Scene, StandardMaterial, Vector3 } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { MatKey } from "../render/Materials";
import { FLOOD_ZONES, floodShape } from "./region";
import type { World } from "./World";

/** Materials that darken and turn glossy in the rain, and how glossy (0..1). */
const WETTABLE: Partial<Record<MatKey, number>> = { asphalt: 0.7, paver: 0.6, concrete: 0.55, dirt: 0.35, plaster: 0.25, brick: 0.3, grass: 0.2 };

/**
 * Monsoon weather. Most of the time it is a clear Punjab day; now and then
 * the sky goes grey and it pours. The roads go dark and shiny, thunder rolls,
 * and after a few minutes of heavy rain the badly drained chowks and galis
 * (region.ts FLOOD_ZONES) fill up knee-deep and stay flooded for a while
 * after the rain stops. The planned colonies drain and stay dry.
 */
export class Weather {
  /** Rain falling now (0..1). */
  rain = 0;
  /** How wet the roads are (follows the rain, dries slowly). */
  wet = 0;
  /** How full the waterlogged spots are (rises after a while of heavy rain, drains slowly). */
  flood = 0;
  /** Run the clear/rain cycle by itself (off while a debug or menu choice holds it). */
  auto = true;
  /** Thunder after a lightning flash: `delay` seconds later, `near` for a sharp crack. */
  onThunder: ((delay: number, near: boolean) => void) | null = null;

  private target = 0;
  private next: number;
  private rainPs: ParticleSystem;
  private splashPs: ParticleSystem;
  private sprayPs: ParticleSystem;
  private floodMesh: Mesh;
  private storm: Mesh;
  /** The clear-sky light that rain darkens (the time of day replaces it each frame). */
  base: { sun: number; hemi: number; hemiDiffuse: Color3; fog: Color3; clear: { r: number; g: number; b: number }; cloud: Color3 };
  private matBase = new Map<PBRMaterial, { rough: number; albedo: Color3; k: number }>();
  private flash = 0;
  private thunderT = 12;
  private emitAt = new Vector3();
  private sprayAt = new Vector3();
  private rng = Math.random;

  constructor(private scene: Scene, private world: World, detail: "low" | "high") {
    const cloud = scene.getMaterialByName("cloudMat") as StandardMaterial | null;
    this.base = {
      sun: world.sun.intensity, hemi: world.hemi.intensity, hemiDiffuse: world.hemi.diffuse.clone(),
      fog: scene.fogColor.clone(), clear: scene.clearColor.clone(),
      cloud: cloud?.emissiveColor.clone() ?? Color3.White(),
    };
    for (const [k, gloss] of Object.entries(WETTABLE) as Array<[MatKey, number]>) {
      const m = world.mats.get(k);
      this.matBase.set(m, { rough: m.roughness ?? 1, albedo: m.albedoColor.clone(), k: gloss });
    }
    // First shower a few minutes into the game, then every so often.
    this.next = 180 + Math.random() * 240;

    const streak = new DynamicTexture("rainTex", { width: 8, height: 64 }, scene, false);
    const ctx = streak.getContext() as CanvasRenderingContext2D;
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.9)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(2, 0, 4, 64);
    streak.update();
    streak.hasAlpha = true;

    const n = detail === "low" ? 1400 : 4000;
    const rain = new ParticleSystem("rain", n, scene);
    rain.particleTexture = streak;
    rain.emitter = this.emitAt;
    const box = new BoxParticleEmitter();
    box.minEmitBox = new Vector3(-24, 10, -24);
    box.maxEmitBox = new Vector3(24, 16, 24);
    box.direction1 = new Vector3(0.6, -10, 0.25);
    box.direction2 = new Vector3(1.0, -10, 0.45);
    rain.particleEmitterType = box;
    rain.minEmitPower = 1.9;
    rain.maxEmitPower = 2.3;
    rain.minLifeTime = rain.maxLifeTime = 0.85;
    rain.minSize = 0.045;
    rain.maxSize = 0.06;
    rain.minScaleX = rain.maxScaleX = 0.7;
    rain.minScaleY = rain.maxScaleY = 12;
    // Rain falls nearly straight down: billboards that only turn about the vertical.
    rain.billboardMode = ParticleSystem.BILLBOARDMODE_Y;
    rain.color1 = new Color4(0.82, 0.85, 0.9, 0.5);
    rain.color2 = new Color4(0.75, 0.78, 0.84, 0.38);
    rain.colorDead = new Color4(0.7, 0.74, 0.8, 0);
    rain.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    rain.gravity = Vector3.Zero();
    rain.emitRate = 0;
    rain.updateSpeed = 1 / 60;
    rain.start();
    this.rainPs = rain;

    const dot = new DynamicTexture("splashTex", { width: 16, height: 16 }, scene, false);
    const c2 = dot.getContext() as CanvasRenderingContext2D;
    const g2 = c2.createRadialGradient(8, 8, 0, 8, 8, 8);
    g2.addColorStop(0, "rgba(255,255,255,0.9)");
    g2.addColorStop(1, "rgba(255,255,255,0)");
    c2.fillStyle = g2;
    c2.fillRect(0, 0, 16, 16);
    dot.update();
    dot.hasAlpha = true;
    const splash = new ParticleSystem("splash", detail === "low" ? 200 : 500, scene);
    splash.particleTexture = dot;
    splash.emitter = this.emitAt;
    const sbox = new BoxParticleEmitter();
    sbox.minEmitBox = new Vector3(-14, -0.0, -14);
    sbox.maxEmitBox = new Vector3(14, 0.0, 14);
    sbox.direction1 = new Vector3(-0.3, 1, -0.3);
    sbox.direction2 = new Vector3(0.3, 1.6, 0.3);
    splash.particleEmitterType = sbox;
    splash.minEmitPower = 0.6;
    splash.maxEmitPower = 1.2;
    splash.minLifeTime = 0.12;
    splash.maxLifeTime = 0.25;
    splash.minSize = 0.03;
    splash.maxSize = 0.07;
    splash.color1 = new Color4(0.85, 0.88, 0.9, 0.3);
    splash.color2 = new Color4(0.8, 0.83, 0.86, 0.2);
    splash.colorDead = new Color4(0.8, 0.83, 0.86, 0);
    splash.gravity = new Vector3(0, -9, 0);
    splash.emitRate = 0;
    splash.start();
    this.splashPs = splash;

    // Spray thrown up by a vehicle (or feet) going through standing water.
    const spray = new ParticleSystem("spray", 300, scene);
    spray.particleTexture = dot;
    spray.emitter = this.sprayAt;
    const sp = new BoxParticleEmitter();
    sp.minEmitBox = new Vector3(-0.9, 0, -0.9);
    sp.maxEmitBox = new Vector3(0.9, 0.1, 0.9);
    sp.direction1 = new Vector3(-1.5, 2.5, -1.5);
    sp.direction2 = new Vector3(1.5, 4, 1.5);
    spray.particleEmitterType = sp;
    spray.minEmitPower = 0.5;
    spray.maxEmitPower = 1.1;
    spray.minLifeTime = 0.3;
    spray.maxLifeTime = 0.6;
    spray.minSize = 0.04;
    spray.maxSize = 0.1;
    spray.color1 = new Color4(0.55, 0.5, 0.4, 0.5);
    spray.color2 = new Color4(0.68, 0.65, 0.58, 0.35);
    spray.colorDead = new Color4(0.7, 0.66, 0.58, 0);
    spray.gravity = new Vector3(0, -9.8, 0);
    spray.emitRate = 0;
    spray.start();
    this.sprayPs = spray;

    // A grey monsoon sky that fades in over the clear one.
    const storm = MeshBuilder.CreateSphere("stormSky", { diameter: 880, segments: 12, sideOrientation: Mesh.BACKSIDE }, scene);
    const sm = new StandardMaterial("stormMat", scene);
    sm.disableLighting = true;
    sm.emissiveColor = new Color3(0.6, 0.63, 0.67);
    sm.fogEnabled = false;
    sm.alpha = 0;
    storm.material = sm;
    storm.infiniteDistance = true;
    storm.isPickable = false;
    storm.applyFog = false;
    storm.setEnabled(false);
    this.storm = storm;

    // The standing water: one mesh for every flood zone, raised by scaling.
    const g = new GeoBuilder(6);
    for (const f of FLOOD_ZONES) {
      const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, hx = (f.x1 - f.x0) / 2, hz = (f.z1 - f.z0) / 2;
      const col = rgb("#ffffff");
      const mid = g.vertex(cx, f.depth, cz, 0, 1, 0, cx / 6, cz / 6, col);
      const ring: number[] = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const x = cx + hx * Math.sign(ca) * Math.sqrt(Math.abs(ca)), z = cz + hz * Math.sign(sa) * Math.sqrt(Math.abs(sa));
        ring.push(g.vertex(x, f.depth, z, 0, 1, 0, x / 6, z / 6, col));
      }
      for (let i = 0; i < 28; i++) g.tri(mid, ring[i]!, ring[(i + 1) % 28]!);
    }
    // Muddy brown nala water, not the canal's clear green. (A fresh material
    // sharing the canal's ripples: cloning would copy the textures and wait
    // forever for them to "load".)
    const canal = world.mats.get("water");
    const water = new PBRMaterial("floodWater", scene);
    water.bumpTexture = canal.bumpTexture;
    water.albedoColor = new Color3(0.16, 0.125, 0.08);
    water.alpha = 0.88;
    water.metallic = 0;
    water.roughness = 0.06;
    water.environmentIntensity = 0.35;
    water.reflectivityColor = new Color3(0.35, 0.35, 0.33);
    water.environmentBRDFTexture = null;
    // A faint grey sheen of the overcast sky.
    water.emissiveColor = new Color3(0.06, 0.065, 0.07);
    water.maxSimultaneousLights = 6;
    this.floodMesh = g.toMesh("flood", scene, water);
    this.floodMesh.isPickable = false;
    this.floodMesh.receiveShadows = true;
    this.floodMesh.position.y = -0.03;
    this.floodMesh.setEnabled(false);
  }

  get raining(): boolean {
    return this.target > 0;
  }

  /** Start or stop the rain. `instant` jumps straight there, already flooded (debug, screenshots). */
  setRain(on: boolean, instant = false): void {
    this.target = on ? 0.85 + Math.random() * 0.15 : 0;
    this.next = on ? 200 + Math.random() * 160 : 420 + Math.random() * 480;
    if (instant) {
      this.rain = this.target;
      this.wet = on ? 1 : 0;
      this.flood = on ? 1 : 0;
    }
  }

  /** Depth (m) of standing water at a point, 0 where it is dry. */
  floodAt(x: number, z: number): number {
    if (this.flood < 0.02) return 0;
    for (const f of FLOOD_ZONES) {
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      return f.depth * this.flood * floodShape(f, x, z);
    }
    return 0;
  }

  /**
   * Per frame. `mover` is what the player is moving (themselves or their
   * vehicle): it throws up spray when it goes through standing water.
   */
  update(dt: number, cam: Vector3, mover?: { pos: Vector3; speed: number }): void {
    if (this.auto) {
      this.next -= dt;
      if (this.next <= 0) this.setRain(this.target === 0);
    }
    // Clouds roll in over ~20 s, clear over ~40 s; roads dry over a couple of
    // minutes; the low spots fill after a minute of heavy rain and drain slowly.
    this.rain += (this.target - this.rain) * Math.min(1, dt / (this.target > this.rain ? 20 : 40) * 3);
    this.wet += ((this.rain > 0.1 ? 1 : 0) - this.wet) * Math.min(1, dt / (this.rain > 0.1 ? 25 : 120));
    const fill = this.rain > 0.5 ? dt / 70 : -dt / 200;
    this.flood = Math.max(0, Math.min(1, this.flood + fill));

    this.emitAt.set(cam.x, cam.y, cam.z);
    this.emitAt.y = 0;
    const r = this.rain;
    this.rainPs.emitRate = r < 0.03 ? 0 : this.rainPs.getCapacity() * r / 0.85;
    (this.rainPs.particleEmitterType as BoxParticleEmitter).minEmitBox.y = cam.y + 6;
    (this.rainPs.particleEmitterType as BoxParticleEmitter).maxEmitBox.y = cam.y + 12;
    this.splashPs.emitRate = r < 0.2 ? 0 : this.splashPs.getCapacity() * 3 * r;
    this.floodMesh.setEnabled(this.flood > 0.03);
    this.floodMesh.scaling.y = this.flood;

    if (mover && mover.speed > 1.2 && this.floodAt(mover.pos.x, mover.pos.z) > 0.06) {
      this.sprayAt.copyFrom(mover.pos);
      this.sprayAt.y = this.floodAt(mover.pos.x, mover.pos.z) - 0.03;
      this.sprayPs.emitRate = Math.min(220, mover.speed * 16);
    } else this.sprayPs.emitRate = 0;

    // Lightning and thunder in heavy rain.
    if (r > 0.6) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) {
        this.thunderT = 18 + this.rng() * 40;
        const near = this.rng() < 0.3;
        this.flash = near ? 1 : 0.5;
        this.onThunder?.(near ? 0.3 + this.rng() * 0.6 : 1.5 + this.rng() * 3, near);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 6);

    // Grey monsoon light.
    const b = this.base, s = this.scene;
    const lit = Math.max(0.18, Math.min(1, b.hemi / 0.6));
    this.world.sun.intensity = b.sun * (1 - 0.72 * r);
    this.world.hemi.intensity = b.hemi * (1 + 0.15 * r) + this.flash * 1.5;
    Color3.LerpToRef(b.hemiDiffuse, new Color3(0.7, 0.74, 0.8).scaleInPlace(lit), r, this.world.hemi.diffuse);
    const grey = new Color3(0.56, 0.6, 0.64).scaleInPlace(lit);
    Color3.LerpToRef(b.fog, grey, r, s.fogColor);
    s.clearColor.set(b.clear.r + (grey.r - b.clear.r) * r, b.clear.g + (grey.g - b.clear.g) * r, b.clear.b + (grey.b - b.clear.b) * r, 1);
    this.storm.setEnabled(r > 0.01);
    (this.storm.material as StandardMaterial).alpha = Math.min(1, r * 1.15);
    // The storm sky is only as bright as the day behind it (a dark grey at night).
    (this.storm.material as StandardMaterial).emissiveColor.set(0.6 * lit + this.flash * 0.3, 0.63 * lit + this.flash * 0.3, 0.67 * lit + this.flash * 0.3);
    const cloud = s.getMaterialByName("cloudMat") as StandardMaterial | null;
    if (cloud) Color3.LerpToRef(b.cloud, new Color3(0.5, 0.52, 0.56).scaleInPlace(lit), r, cloud.emissiveColor);
    // Wet: darker and glossier.
    const w = this.wet;
    for (const [m, mb] of this.matBase) {
      m.roughness = mb.rough * (1 - mb.k * w);
      m.albedoColor.copyFrom(mb.albedo).scaleToRef(1 - 0.3 * w * mb.k, m.albedoColor);
    }
  }
}
