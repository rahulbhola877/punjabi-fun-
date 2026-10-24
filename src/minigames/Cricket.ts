import { Mesh, Vector3, type Scene } from "../babylon";
import { randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import type { Crowd, Resident } from "../crowds/Crowd";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { Rng } from "../render/textures";
import { SITES } from "../world/region";

/**
 * Tape-ball cricket in the colony park: one over of six balls, two wickets, a target to chase. The kid bowls,
 * the ball comes at you (one bounce on the paving), and you swing (Q) as it reaches you: the nearer your swing
 * to the moment it arrives, the more it is worth. Miss it and you are bowled; in tape-ball cricket there is no
 * second chance. Hold a direction (A or D) as you swing and a ball that came on that line is hit harder.
 */

export type Speed = "slow" | "medium" | "fast";
export interface Delivery { speed: Speed; /** -1 off, 0 straight, 1 leg. */ line: -1 | 0 | 1; flight: number }

export const FLIGHT: Record<Speed, number> = { slow: 1.55, medium: 1.25, fast: 1.0 };
export const BALLS = 6;
export const WICKETS = 2;
export const TARGET = 16;

/** The six deliveries of an over: a slow one to start, quicker as it goes. */
export function over(rng: Rng): Delivery[] {
  const speeds: Speed[] = ["slow", "slow", "medium", "medium", "fast", "medium"];
  return speeds.map((speed) => ({ speed, line: ([-1, 0, 1] as const)[Math.floor(rng.next() * 3)]!, flight: FLIGHT[speed] }));
}

export type Shot = { kind: "six" | "four" | "two" | "one"; runs: number } | { kind: "miss" } | { kind: "early" };

/**
 * How a swing turns out. `at` is how long after the release the swing came and `d.flight` when the ball arrives;
 * `aim` is the direction held (-1, 0, 1). Pure, so it is tested.
 */
export function judge(at: number, d: Delivery, aim: number): Shot {
  const off = at - d.flight;
  if (off < -0.4) return { kind: "early" };
  const a = Math.abs(off);
  const match = aim !== 0 && aim === d.line;
  if (a <= 0.06) return match || d.speed === "slow" ? { kind: "six", runs: 6 } : { kind: "four", runs: 4 };
  if (a <= 0.13) return match ? { kind: "four", runs: 4 } : { kind: "two", runs: 2 };
  if (a <= 0.22) return { kind: "two", runs: 2 };
  if (a <= 0.32) return { kind: "one", runs: 1 };
  return { kind: "miss" };
}

/** Where the ball is `t` seconds after the release: along the pitch, one bounce, arriving at the batter's waist. */
export function ballAt(t: number, flight: number, from: { x: number; z: number }, to: { x: number; z: number }): { x: number; y: number; z: number } {
  const u = Math.max(0, Math.min(1.25, t / flight));
  const tb = 0.62;
  const y = u < tb ? 1.55 * (1 - (u / tb) ** 2) : 0.95 * Math.pow((u - tb) / (1 - tb), 0.85);
  return { x: from.x + (to.x - from.x) * u, y: Math.max(0.05, y), z: from.z + (to.z - from.z) * u };
}

export function park(): { cx: number; cz: number; hx: number; hz: number } {
  const s = SITES.find((q) => q.id === "santPark0")!;
  return { cx: (s.x0 + s.x1) / 2, cz: (s.z0 + s.z1) / 2, hx: (s.x1 - s.x0) / 2, hz: (s.z1 - s.z0) / 2 };
}

/** The pitch in the park: the batter at one end, the bowler eleven metres off. */
export function pitch(): { bat: { x: number; z: number }; bowl: { x: number; z: number } } {
  const p = park();
  return { bat: { x: p.cx - 5, z: p.cz }, bowl: { x: p.cx + 6, z: p.cz } };
}

export interface CricketHost {
  scene: Scene;
  mats: Materials;
  crowd: Crowd;
  playerPos(): Vector3;
  placePlayer(x: number, z: number, yaw: number): void;
  /** -1, 0 or 1: the sideways direction held right now. */
  aim(): number;
  /** The bat in the batter's hand: shown, and swung. */
  bat(on: boolean): void;
  swing(): void;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  say(text: string): void;
  sting(kind: "small" | "big" | "fail"): void;
  results(title: string, medal: string | null, rows: Array<[string, string]>, buttons: Array<{ label: string; value: string }>): Promise<string>;
  reward(money: number, rep: number): void;
  hud(m: { title: string; lines: string[]; meter?: { label: string; frac: number } } | null): void;
  setFlag(name: string): void;
  persist(reason: string): void;
}

type Phase = "wait" | "flight" | "hit" | "done";

export class CricketGame {
  active = false;
  private host: CricketHost;
  private rng = new Rng(11);
  private plan: Delivery[] = [];
  private ball = 0;
  private runs = 0;
  private out = 0;
  private phase: Phase = "done";
  private t = 0;
  private swingAt: number | null = null;
  private shot: Shot | null = null;
  private ballMesh: Mesh;
  private kids: Resident[] = [];
  private bowler: Resident | null = null;
  private hitDir = { x: 0, z: 0 };
  private hitFrom = { x: 0, y: 0, z: 0 };
  private busy = false;

  constructor(host: CricketHost) {
    this.host = host;
    const g = new GeoBuilder(1);
    g.ellipsoid(0, 0, 0, 0.11, 0.11, 0.11, 8, 5, rgb("#e8d44d"));
    g.torus(0, 0, 0, 0.11, 0.025, 10, 3, rgb("#c62828"));
    this.ballMesh = g.toMesh("cricketBall", host.scene, host.mats.get("paint"));
    this.ballMesh.isPickable = false;
    this.ballMesh.setEnabled(false);
  }

  private kid(id: string, seed: number, x: number, z: number, yaw: number, shirt: string): Resident {
    const look: Appearance = { ...randomAppearance(seed), sex: "m", age: "child", top: "shirt", topColor: shirt, bottom: "pajama", bottomColor: "#37474f", height: 1.4, headwear: "none", beard: "none" };
    return this.host.crowd.spawn({ id, name: "Gali da munda", role: "chatter", look, x, z, yaw, indoor: true });
  }

  start(): void {
    if (this.active) return;
    const h = this.host, p = pitch();
    this.active = true; this.busy = false; this.rng = new Rng(11 + Math.floor(Math.random() * 90));
    this.plan = over(this.rng); this.ball = 0; this.runs = 0; this.out = 0;
    this.bowler = this.kid("ck_bowler", 8400, p.bowl.x, p.bowl.z, -Math.PI / 2, "#e53935");
    this.kids = [
      this.bowler,
      this.kid("ck_field0", 8410, p.bat.x + 4, p.bat.z - 9, Math.PI / 2, "#43a047"),
      this.kid("ck_field1", 8420, p.bowl.x + 3, p.bat.z + 7, -Math.PI / 2, "#1e88e5"),
    ];
    h.placePlayer(p.bat.x, p.bat.z, Math.PI / 2);
    h.bat(true);
    h.toast(`Tape-ball cricket: ${BALLS} gendan, ${WICKETS} out, ${TARGET} run chahide. Gend tuhade kol pahunche, Q naal chakk!`, "info", 6000);
    this.next();
  }

  private next(): void {
    this.phase = "wait"; this.t = 0; this.swingAt = null; this.shot = null;
    this.render();
  }

  private render(extra?: string): void {
    this.host.hud({ title: `Gali cricket · gend ${Math.min(this.ball + 1, BALLS)} of ${BALLS}`, lines: [`${this.runs} run · target ${TARGET}`, `Out: ${this.out} of ${WICKETS}`, extra ?? (this.phase === "wait" ? "Taiyaar ho…" : "Q: chakk!")] });
  }

  /** The attack key: swing. */
  swing(): boolean {
    if (!this.active || this.phase !== "flight" || this.swingAt !== null) return false;
    this.swingAt = this.t;
    this.host.swing();
    return true;
  }

  update(dt: number): void {
    if (!this.active || this.busy) return;
    const p = pitch();
    this.t += dt;
    if (this.phase === "wait") {
      if (this.t > 1.4) {
        this.phase = "flight"; this.t = 0;
        this.bowler?.anim.play("work", 0.7);
        this.ballMesh.setEnabled(true);
        this.render();
      }
      return;
    }
    const d = this.plan[this.ball]!;
    if (this.phase === "flight") {
      const b = ballAt(this.t, d.flight, p.bowl, p.bat);
      this.ballMesh.position.set(b.x, b.y, b.z);
      // The ball gets to the batter: a swing already made is judged; otherwise it goes through to the stumps.
      if (this.t >= d.flight + 0.34 || (this.swingAt !== null && this.t >= this.swingAt + 0.08 && this.swingAt >= d.flight - 0.45)) {
        const aim = this.host.aim();
        const shot = this.swingAt === null ? ({ kind: "miss" } as Shot) : judge(this.swingAt, d, aim);
        void this.resolve(shot, b);
      } else if (this.swingAt !== null && this.swingAt < d.flight - 0.4 && this.t >= d.flight + 0.34) void this.resolve({ kind: "early" }, b);
    } else if (this.phase === "hit") {
      // After a hit the ball goes off down the pitch; a six goes over the wall.
      const s = this.t, v = this.shot && this.shot.kind === "six" ? 11 : this.shot && this.shot.kind === "four" ? 9 : 5;
      const y = this.shot?.kind === "six" ? this.hitFrom.y + 9 * s - 6 * s * s : Math.max(0.1, this.hitFrom.y + 2.5 * s - 6 * s * s);
      this.ballMesh.position.set(this.hitFrom.x + this.hitDir.x * v * s, Math.max(0.1, y), this.hitFrom.z + this.hitDir.z * v * s);
    }
  }

  private async resolve(shot: Shot, at: { x: number; y: number; z: number }): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const h = this.host, d = this.plan[this.ball]!;
    this.shot = shot;
    if (shot.kind === "miss" || shot.kind === "early") {
      this.out++;
      h.sting("fail");
      h.say(shot.kind === "early" ? "Jaldi kar ditti!" : "Bowled!");
      h.toast(shot.kind === "early" ? "🏏 Bahut jaldi chakkeya: bowled!" : "🏏 Bowled! Stumps ud gaye.", "warn", 2500);
      this.ballMesh.position.set(pitch().bat.x - 1.5, 0.2, pitch().bat.z);
    } else {
      this.runs += shot.runs;
      const side = d.line === 0 ? 0 : d.line * 0.5;
      this.hitDir = { x: -0.2, z: side + (this.rng.next() - 0.5) * 0.8 };
      const n = Math.hypot(this.hitDir.x, this.hitDir.z);
      this.hitDir = { x: this.hitDir.x / n, z: this.hitDir.z / n };
      this.hitFrom = at;
      this.phase = "hit"; this.t = 0;
      h.sting(shot.kind === "six" ? "big" : "small");
      const line = shot.kind === "six" ? "Chakka! Gend aunty ji de chhajje te!" : shot.kind === "four" ? "Chauka! Seedha border paar!" : shot.kind === "two" ? "Do run!" : "Ik run, chalo!";
      h.say(line);
      h.toast(`🏏 ${line} (+${shot.runs})`, "money", 2500);
    }
    this.render();
    await new Promise((r) => setTimeout(r, 2200));
    this.ballMesh.setEnabled(false);
    this.ball++;
    this.busy = false;
    if (this.out >= WICKETS || this.ball >= BALLS || this.runs >= TARGET) { await this.finish(); return; }
    this.next();
  }

  private async finish(): Promise<void> {
    this.busy = true;
    const h = this.host, win = this.runs >= TARGET;
    const money = win ? 150 : Math.min(60, this.runs * 4), rep = win ? 3 : 1;
    this.stop();
    h.setFlag("c_cricket");
    h.reward(money, rep);
    h.sting(win ? "big" : "small");
    await h.results("Gali cricket", win ? "gold" : this.runs >= TARGET / 2 ? "silver" : "bronze", [
      ["Run", `${this.runs} (target ${TARGET})`],
      ["Nateeja", win ? "Jit gaye! Gali de heroes!" : "Is vaari nahi bani, par maza aa gaya"],
      ["Inaam", `₹${money} · +${rep} izzat`],
    ], [{ label: "Shabaash", value: "ok" }]);
    h.persist("cricket");
  }

  stop(): void {
    this.active = false; this.phase = "done";
    this.ballMesh.setEnabled(false);
    for (const k of this.kids) this.host.crowd.remove(k);
    this.kids = []; this.bowler = null;
    this.host.bat(false);
    this.host.hud(null);
  }

  /** For the probe. */
  state(): { active: boolean; phase: string; ball: number; t: number; flight: number; runs: number; out: number } {
    return { active: this.active, phase: this.phase, ball: this.ball, t: this.t, flight: this.plan[this.ball]?.flight ?? 0, runs: this.runs, out: this.out };
  }

  dispose(): void { this.stop(); this.ballMesh.dispose(); }
}
