import { Color3, MeshBuilder, Quaternion, StandardMaterial, Vector3, type InstancedMesh, type LinesMesh, type Mesh, type Scene } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import { randomAppearance } from "../characters/appearances";
import { ROOF_SPOTS, type RoofSpot } from "../world/rooftops";
import type { Crowd, Resident } from "./Crowd";

/** Patang colours: one source mesh each, the kites are instances. */
const COLOURS = ["#e53935", "#fdd835", "#1e88e5", "#43a047", "#8e24aa", "#fb8c00", "#f5f5f5"];
/** The wind blows the kites this way (and a little up). */
const WIND = new Vector3(0.78, 0, 0.62).normalize();
/** Roofs flown from, at most, near the player. */
const MAX_FLYERS = 6;
const NEAR = 125, FAR = 160;

interface Flyer {
  spot: RoofSpot;
  r: Resident;
  kite: InstancedMesh | null;
  /** String length, how high it sits (radians above the horizon), sideways sway phase. */
  len: number; elev: number; ph: number;
  pos: Vector3;
  /** A kite fight: pulled towards this point; or cut loose and drifting down. */
  pech: Vector3 | null;
  cut: { t: number; vel: Vector3 } | null;
  /** Seconds before a new kite goes up after losing one. */
  relaunch: number;
}

/**
 * Patang-baazi: on fine days people stand on the colony kothis' roofs flying
 * kites high over the street, strings slanting down to their hands. Now and
 * then two kites close in for a pech; one string is cut ("Bo kata!") and that
 * kite drifts away and falls, and its flyer sends up a new one. Kites are
 * instances of one mesh per colour; all the strings are one line mesh.
 */
export class Kites {
  private src: Mesh[] = [];
  private flyers: Flyer[] = [];
  private lines: LinesMesh | null = null;
  private t = 0;
  private pechT = 18;
  private checkT = 0;
  /** Roofs taken by someone flying (by building id). */
  private onRoof = new Set<string>();

  constructor(private scene: Scene, private crowd: Crowd) {}

  private source(i: number): Mesh {
    let m = this.src[i];
    if (m) return m;
    const g = new GeoBuilder(1);
    const c = rgb(COLOURS[i]!), dark = rgb("#3e2723");
    const top = new Vector3(0, 0.55, 0), right = new Vector3(0.48, 0.08, 0), bot = new Vector3(0, -0.5, 0), left = new Vector3(-0.48, 0.08, 0);
    // Both faces of the paper diamond, the bamboo spine and bow, and a small tail.
    g.quad(top, right, bot, left, c);
    g.quad(top, left, bot, right, c);
    g.boxMinMax(-0.012, -0.5, -0.02, 0.012, 0.55, 0.0, dark);
    g.boxMinMax(-0.47, 0.06, -0.02, 0.47, 0.09, 0.0, dark);
    const tc = rgb(COLOURS[(i + 3) % COLOURS.length]!);
    const t0 = new Vector3(0, -0.48, 0), t1 = new Vector3(0.12, -0.72, 0), t2 = new Vector3(-0.12, -0.72, 0);
    g.quad(t0, t1, t2, t2, tc);
    g.quad(t0, t2, t1, t1, tc);
    const mat = new StandardMaterial(`kiteMat${i}`, this.scene);
    mat.backFaceCulling = false;
    // Thin paper against the sun: seen from below it glows its own colour rather than going dark.
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.emissiveColor = new Color3(0.95, 0.95, 0.95);
    m = g.toMesh(`kite${i}`, this.scene, mat);
    m.isPickable = false;
    m.isVisible = false;
    m.position.y = -100;
    this.src[i] = m;
    return m;
  }

  private launch(f: Flyer, seed: number): void {
    f.kite?.dispose();
    const k = this.source(seed % COLOURS.length).createInstance(`patang_${f.spot.id}_${seed}`);
    k.isPickable = false;
    k.rotationQuaternion = new Quaternion();
    // A touch bigger than a real patang, so it reads against the sky from the street.
    k.scaling.setAll(1.5);
    f.kite = k;
    f.len = 28 + (seed % 7) * 4;
    f.elev = 0.62 + ((seed >> 3) % 5) * 0.06;
    f.cut = null;
    f.pech = null;
    f.pos.copyFrom(this.hand(f));
  }

  private hand(f: Flyer): Vector3 {
    return new Vector3(f.spot.x + WIND.x * 0.4, f.spot.y + 1.45, f.spot.z + WIND.z * 0.4);
  }

  /** Where the kite rides on its string: downwind and up, swaying. */
  private rest(f: Flyer): Vector3 {
    const h = this.hand(f);
    const side = new Vector3(-WIND.z, 0, WIND.x);
    const sway = Math.sin(this.t * 0.55 + f.ph) * 5 + Math.sin(this.t * 1.7 + f.ph * 2) * 1.2;
    const bob = Math.sin(this.t * 0.9 + f.ph * 3) * 2.2;
    const out = f.len * Math.cos(f.elev), up = f.len * Math.sin(f.elev);
    return h.add(WIND.scale(out)).add(side.scale(sway)).add(new Vector3(0, up + bob, 0));
  }

  /** `rain` 0..1: nobody flies in the rain. */
  update(dt: number, player: Vector3, rain: number): void {
    this.t += dt;
    this.checkT -= dt;
    if (this.checkT <= 0) { this.checkT = 1.5; this.manage(player, rain); }
    for (const f of this.flyers) {
      if (!f.kite) { if ((f.relaunch -= dt) <= 0) { this.launch(f, Math.floor(this.t * 7) + f.spot.id.length); this.crowd.say(f.r, "Navi patang chadha ditti!"); } continue; }
      if (f.cut) {
        // Cut loose: drifts off with the wind, tumbling down.
        f.cut.t += dt;
        f.cut.vel.y = Math.max(-2.2, f.cut.vel.y - dt * 0.5);
        f.pos.addInPlace(f.cut.vel.scale(dt));
        if (f.cut.t > 14 || f.pos.y < 1) { f.kite.dispose(); f.kite = null; f.cut = null; f.relaunch = 15 + (f.ph * 10) % 15; continue; }
      } else {
        const want = f.pech ?? this.rest(f);
        f.pos.addInPlace(want.subtract(f.pos).scale(Math.min(1, dt * (f.pech ? 0.6 : 1.4))));
      }
      // Face back along the string, tilted by the sway (the tail hangs down).
      const h = this.hand(f), to = h.subtract(f.pos);
      const yaw = Math.atan2(to.x, to.z), pitch = -0.35;
      const roll = f.cut ? f.cut.t * 3 : Math.sin(this.t * 1.3 + f.ph) * 0.35;
      Quaternion.RotationYawPitchRollToRef(yaw, pitch, roll, f.kite.rotationQuaternion!);
      f.kite.position.copyFrom(f.pos);
    }
    this.fights(dt);
    this.drawStrings();
  }

  /** Start and end flyers on roofs around the player. */
  private manage(player: Vector3, rain: number): void {
    for (const f of [...this.flyers]) {
      const d = Math.hypot(f.spot.x - player.x, f.spot.z - player.z);
      if (d > FAR || rain > 0.25 || !this.crowd.residents.includes(f.r)) this.end(f);
    }
    if (rain > 0.15 || this.flyers.length >= MAX_FLYERS) return;
    // Every fourth or so kothi has someone up there on a fine day, the same ones each time.
    const near = ROOF_SPOTS.filter((s) => !this.onRoof.has(s.id) && hash(s.id) % 4 === 0 && Math.hypot(s.x - player.x, s.z - player.z) < NEAR && Math.hypot(s.x - player.x, s.z - player.z) > 12)
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
    for (const s of near.slice(0, MAX_FLYERS - this.flyers.length)) {
      const seed = hash(s.id);
      const look = randomAppearance(seed % 5000);
      const r = this.crowd.spawn({
        id: `patang_${s.id}`, name: "Patang-baaz", role: "keeper", onRoof: true, kite: true,
        look: look.age === "child" || look.age === "elder" ? { ...look, age: "adult", height: look.sex === "f" ? 1.6 : 1.72 } : look,
        x: s.x, y: s.y, z: s.z, yaw: Math.atan2(WIND.x, WIND.z),
        lines: ["Dor kass ke rakh!", "Aaj taan saari gali di patang kattni ae!", "Dheel de, dheel de!"],
      });
      const f: Flyer = { spot: s, r, kite: null, len: 30, elev: 0.7, ph: (seed % 628) / 100, pos: new Vector3(), pech: null, cut: null, relaunch: 0 };
      this.launch(f, seed);
      f.pos.copyFrom(this.rest(f));
      this.flyers.push(f);
      this.onRoof.add(s.id);
    }
  }

  private end(f: Flyer): void {
    f.kite?.dispose();
    if (this.crowd.residents.includes(f.r)) this.crowd.remove(f.r);
    this.flyers.splice(this.flyers.indexOf(f), 1);
    this.onRoof.delete(f.spot.id);
  }

  /** Pech: two kites in the air close in; after a while one string is cut. */
  private fights(dt: number): void {
    const fighting = this.flyers.filter((f) => f.pech);
    // A partner went home mid-fight: the other just flies on.
    if (fighting.length === 1) { fighting[0]!.pech = null; this.pechT = 15; return; }
    if (fighting.length === 2) {
      this.pechT -= dt;
      if (this.pechT <= 0) {
        const [a, b] = fighting as [Flyer, Flyer];
        const lose = Math.random() < 0.5 ? a : b, win = lose === a ? b : a;
        lose.pech = null; win.pech = null;
        lose.cut = { t: 0, vel: WIND.scale(3.5).add(new Vector3(0, -0.3, 0)) };
        this.crowd.say(win.r, "Bo kata! Wohi kaata!");
        win.r.anim.play("cheer", 2);
        setTimeout(() => { if (this.crowd.residents.includes(lose.r)) this.crowd.say(lose.r, "Oye! Meri patang kat gayi!"); }, 1300);
        this.pechT = 25 + Math.random() * 25;
      }
      return;
    }
    if ((this.pechT -= dt) > 0) return;
    const up = this.flyers.filter((f) => f.kite && !f.cut);
    if (up.length < 2) { this.pechT = 10; return; }
    // The two whose kites are closest go for each other.
    let best: [Flyer, Flyer] | null = null, bd = 90;
    for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) {
      const d = Vector3.Distance(up[i]!.pos, up[j]!.pos);
      if (d < bd) { bd = d; best = [up[i]!, up[j]!]; }
    }
    if (!best) { this.pechT = 10; return; }
    const mid = best[0].pos.add(best[1].pos).scale(0.5);
    best[0].pech = mid.add(new Vector3(0.6, 0.3, 0));
    best[1].pech = mid.add(new Vector3(-0.6, -0.3, 0));
    this.crowd.say(best[0].r, "Pech lavaange? Aaja!");
    this.pechT = 9;
  }

  /** Every string from hand to kite, sagging a little, as one line mesh. */
  private drawStrings(): void {
    const lines: Vector3[][] = [];
    for (const f of this.flyers) {
      if (!f.kite || f.cut) continue;
      const h = this.hand(f), k = f.pos, pts: Vector3[] = [];
      const sag = Vector3.Distance(h, k) * 0.06;
      for (let i = 0; i <= 8; i++) {
        const s = i / 8;
        pts.push(new Vector3(h.x + (k.x - h.x) * s, h.y + (k.y - h.y) * s - Math.sin(Math.PI * s) * sag, h.z + (k.z - h.z) * s));
      }
      lines.push(pts);
    }
    // A fixed number of strings so the updatable mesh keeps its size.
    while (lines.length < MAX_FLYERS) lines.push(Array.from({ length: 9 }, () => new Vector3(0, -100, 0)));
    if (!this.lines) {
      this.lines = MeshBuilder.CreateLineSystem("patangDor", { lines, updatable: true }, this.scene);
      this.lines.color = new Color3(0.92, 0.9, 0.85);
      this.lines.alpha = 0.7;
      this.lines.isPickable = false;
    } else MeshBuilder.CreateLineSystem("patangDor", { lines, instance: this.lines });
  }

  /** For the probe: who is flying, where the kites are. */
  state(): Array<{ id: string; roof: number[]; standing: number; kite: boolean; cut: boolean; pech: boolean; x: number; y: number; z: number }> {
    return this.flyers.map((f) => ({ id: f.r.id, roof: [+f.spot.x.toFixed(1), +f.spot.y.toFixed(2), +f.spot.z.toFixed(1)], standing: +f.r.pos.y.toFixed(2), kite: !!f.kite, cut: !!f.cut, pech: !!f.pech, x: +f.pos.x.toFixed(1), y: +f.pos.y.toFixed(1), z: +f.pos.z.toFixed(1) }));
  }

  /** For the probe: start a pech now. */
  forcePech(): void { this.pechT = 0; for (const f of this.flyers) f.pech = null; }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
