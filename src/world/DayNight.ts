import { Color3, Mesh, StandardMaterial, Vector3, type Scene } from "../babylon";
import type { World } from "./World";

/** One moment of the day's light. Colours are linear-ish 0..1 triples. */
interface Key {
  h: number;
  sun: number; sunCol: [number, number, number];
  hemi: number; sky: [number, number, number]; ground: [number, number, number];
  top: [number, number, number]; hor: [number, number, number];
  exposure: number;
  /** Street lamps, tube lights and shop signs: 0 off (daylight), 1 full night glow. */
  lamps: number;
  cloud: [number, number, number];
}

/**
 * The day's light, keyed like an open-world game's time-of-day: a cool blue
 * night under the moon, a short pink-orange dawn, a warm golden morning, a
 * neutral and slightly hazy noon, long golden-hour shadows, a quick dusk when
 * the lamps come on. Kept soft — nothing goes neon or black.
 */
const KEYS: Key[] = [
  { h: 0, sun: 1.1, sunCol: [0.55, 0.65, 0.9], hemi: 0.3, sky: [0.32, 0.4, 0.62], ground: [0.12, 0.12, 0.14], top: [0.04, 0.06, 0.13], hor: [0.12, 0.15, 0.24], exposure: 1.25, lamps: 1, cloud: [0.2, 0.22, 0.3] },
  { h: 4.6, sun: 1.0, sunCol: [0.55, 0.65, 0.9], hemi: 0.3, sky: [0.32, 0.4, 0.62], ground: [0.12, 0.12, 0.14], top: [0.05, 0.07, 0.15], hor: [0.14, 0.17, 0.27], exposure: 1.25, lamps: 1, cloud: [0.22, 0.24, 0.32] },
  { h: 5.6, sun: 1.4, sunCol: [0.95, 0.62, 0.5], hemi: 0.38, sky: [0.55, 0.52, 0.66], ground: [0.22, 0.18, 0.17], top: [0.2, 0.28, 0.48], hor: [0.92, 0.6, 0.48], exposure: 1.15, lamps: 0.6, cloud: [0.9, 0.62, 0.58] },
  { h: 6.6, sun: 3.4, sunCol: [1.0, 0.72, 0.5], hemi: 0.5, sky: [0.7, 0.68, 0.74], ground: [0.36, 0.28, 0.22], top: [0.36, 0.52, 0.74], hor: [0.98, 0.8, 0.62], exposure: 1.05, lamps: 0, cloud: [1.0, 0.86, 0.76] },
  { h: 9, sun: 5.0, sunCol: [1.0, 0.88, 0.72], hemi: 0.6, sky: [0.76, 0.8, 0.88], ground: [0.4, 0.33, 0.26], top: [0.42, 0.6, 0.82], hor: [0.9, 0.88, 0.82], exposure: 1.0, lamps: 0, cloud: [1, 0.98, 0.95] },
  { h: 13, sun: 5.4, sunCol: [1.0, 0.94, 0.84], hemi: 0.62, sky: [0.78, 0.82, 0.88], ground: [0.42, 0.36, 0.3], top: [0.46, 0.63, 0.84], hor: [0.9, 0.9, 0.86], exposure: 0.97, lamps: 0, cloud: [1, 1, 0.98] },
  { h: 16.5, sun: 4.8, sunCol: [1.0, 0.86, 0.66], hemi: 0.58, sky: [0.78, 0.78, 0.82], ground: [0.42, 0.34, 0.26], top: [0.42, 0.58, 0.8], hor: [0.94, 0.86, 0.74], exposure: 1.0, lamps: 0, cloud: [1, 0.95, 0.88] },
  { h: 18, sun: 3.0, sunCol: [1.0, 0.62, 0.36], hemi: 0.46, sky: [0.74, 0.62, 0.62], ground: [0.38, 0.26, 0.2], top: [0.32, 0.42, 0.66], hor: [1.0, 0.64, 0.4], exposure: 1.06, lamps: 0.15, cloud: [1.0, 0.72, 0.56] },
  { h: 19, sun: 1.3, sunCol: [0.9, 0.5, 0.45], hemi: 0.36, sky: [0.5, 0.46, 0.62], ground: [0.2, 0.16, 0.16], top: [0.14, 0.18, 0.38], hor: [0.7, 0.42, 0.42], exposure: 1.15, lamps: 0.8, cloud: [0.62, 0.42, 0.46] },
  { h: 20.2, sun: 1.1, sunCol: [0.55, 0.65, 0.9], hemi: 0.3, sky: [0.32, 0.4, 0.62], ground: [0.12, 0.12, 0.14], top: [0.05, 0.07, 0.15], hor: [0.14, 0.17, 0.27], exposure: 1.25, lamps: 1, cloud: [0.22, 0.24, 0.32] },
  { h: 24, sun: 1.1, sunCol: [0.55, 0.65, 0.9], hemi: 0.3, sky: [0.32, 0.4, 0.62], ground: [0.12, 0.12, 0.14], top: [0.04, 0.06, 0.13], hor: [0.12, 0.15, 0.24], exposure: 1.25, lamps: 1, cloud: [0.2, 0.22, 0.3] },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number, out: Color3) => out.set(lerp(a[0]!, b[0]!, t), lerp(a[1]!, b[1]!, t), lerp(a[2]!, b[2]!, t));

/**
 * Time of day: the sun crosses the southern sky from east to west, the
 * lighting, sky dome, clouds and exposure follow the keyed palette, and the
 * street lamps and tube lights glow after dark (the bloom picks them up). At
 * night the "sun" light is the moon: dim, blue, high in the south.
 */
export class DayNight {
  /** Hour of the day, 0–24. */
  hour: number;
  /** Game hours per real second (default: a full day in 36 minutes). */
  rate = 24 / (36 * 60);
  /** Rain and the like read the day's base values from here. */
  readonly base = { sun: 5, hemi: 0.6, hemiDiffuse: new Color3(), fog: new Color3(), clear: new Color3(), cloud: new Color3() };
  /** Exposure for the post pipeline. */
  exposure = 1;
  /** 0 by day, 1 at full night (lamps, headlights, lit windows). */
  lamps = 0;
  /** Called whenever the exposure changes noticeably. */
  onExposure: ((e: number) => void) | null = null;
  private skyT = 0;
  private skyY: number[] = [];
  private sky: Mesh | null;
  private lastExp = -1;
  private moon = new Vector3(0.35, -0.8, 0.45).normalize();
  private tmpA = new Color3();
  private tmpB = new Color3();
  private top = new Color3();
  private hor = new Color3();

  constructor(private scene: Scene, private world: World, startHour = 8.5) {
    this.hour = startHour;
    this.sky = scene.getMeshByName("sky") as Mesh | null;
    const pos = this.sky?.getVerticesData("position");
    if (pos) for (let i = 0; i < pos.length; i += 3) this.skyY.push(pos[i + 1]! / 450);
  }

  private key(): { a: Key; b: Key; t: number } {
    const h = ((this.hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1]!.h <= h) i++;
    const a = KEYS[i]!, b = KEYS[i + 1]!;
    const t = (h - a.h) / Math.max(1e-3, b.h - a.h);
    // Ease between keys so the light never visibly "steps".
    return { a, b, t: t * t * (3 - 2 * t) };
  }

  /** Sun (or moon) direction for this hour: rises in the east, highest in the south at noon. */
  private lightDir(out: Vector3): void {
    const h = ((this.hour % 24) + 24) % 24;
    const f = Math.max(0, Math.min(1, (h - 5.8) / 12.8)); // 0 at sunrise, 1 at sunset
    const elev = Math.max(0.1, Math.sin(f * Math.PI)) * 1.15; // ~66° at noon, low at the ends
    // Toward the sun: east (+X) at sunrise, south (-Z) at noon, west at sunset. The light travels the other way.
    const c = Math.cos(elev);
    out.set(-Math.cos(f * Math.PI) * c, -Math.sin(elev), Math.sin(f * Math.PI) * c);
    // Through dusk and dawn the light swings over to the moon (soft, high in the south-west), so shadows never jump.
    const night = h > 12 ? Math.min(1, Math.max(0, (h - 18.4) / 1.2)) : Math.min(1, Math.max(0, (5.9 - h) / 1.2));
    if (night > 0) Vector3.LerpToRef(out, this.moon, night * night * (3 - 2 * night), out);
    out.normalize();
  }


  update(dt: number): void {
    this.hour = (this.hour + dt * this.rate) % 24;
    this.apply(dt);
  }

  /** Jump to an hour (T menu, probe). */
  set(hour: number): void {
    this.hour = ((hour % 24) + 24) % 24;
    this.skyT = 0;
    this.apply(0);
  }

  private apply(dt: number): void {
    const { a, b, t } = this.key();
    const w = this.world, B = this.base;
    B.sun = lerp(a.sun, b.sun, t);
    B.hemi = lerp(a.hemi, b.hemi, t);
    lerp3(a.sky, b.sky, t, B.hemiDiffuse);
    lerp3(a.hor, b.hor, t, B.fog);
    lerp3(a.hor, b.hor, t, B.clear);
    lerp3(a.cloud, b.cloud, t, B.cloud);
    w.sun.intensity = B.sun;
    lerp3(a.sunCol, b.sunCol, t, w.sun.diffuse);
    w.hemi.intensity = B.hemi;
    w.hemi.diffuse.copyFrom(B.hemiDiffuse);
    lerp3(a.ground, b.ground, t, w.hemi.groundColor);
    this.lightDir(w.sun.direction);
    this.scene.clearColor.set(B.clear.r, B.clear.g, B.clear.b, 1);
    this.scene.fogColor.copyFrom(B.fog);
    const cloud = this.scene.getMaterialByName("cloudMat") as StandardMaterial | null;
    if (cloud) cloud.emissiveColor.copyFrom(B.cloud);
    this.lamps = lerp(a.lamps, b.lamps, t);
    // Lamps and tube lights: a normal glow by day, bright enough to bloom at night.
    const em = w.mats.get("emissive");
    em.emissiveIntensity = 1.0 + this.lamps * 2.2;
    this.exposure = lerp(a.exposure, b.exposure, t);
    if (Math.abs(this.exposure - this.lastExp) > 0.005) { this.lastExp = this.exposure; this.onExposure?.(this.exposure); }
    // The sky dome's gradient, recoloured a few times a second.
    this.skyT -= dt;
    if (this.sky && this.skyT <= 0) {
      this.skyT = 0.5;
      lerp3(a.top, b.top, t, this.top);
      lerp3(a.hor, b.hor, t, this.hor);
      const low = this.tmpB.copyFrom(this.hor).scaleInPlace(0.85);
      const cols = new Float32Array(this.skyY.length * 4);
      this.skyY.forEach((y, i) => {
        const c = this.tmpA;
        if (y > 0) Color3.LerpToRef(this.hor, this.top, Math.pow(y, 0.6), c);
        else Color3.LerpToRef(this.hor, low, Math.min(1, -y * 4), c);
        cols[i * 4] = c.r; cols[i * 4 + 1] = c.g; cols[i * 4 + 2] = c.b; cols[i * 4 + 3] = 1;
      });
      this.sky.setVerticesData("color", cols, true);
    }
  }

  /** "08:30" style clock text. */
  get clock(): string {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  get isNight(): boolean {
    return this.lamps > 0.5;
  }
}
