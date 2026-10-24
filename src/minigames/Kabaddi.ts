import { Vector3 } from "../babylon";
import { randomAppearance } from "../characters/appearances";
import type { Appearance } from "../characters/HumanBuilder";
import type { Crowd, Resident } from "../crowds/Crowd";
import { Rng } from "../render/textures";
import { SITES } from "../world/region";

/**
 * A kabaddi match at the village ground, you the raider. A raid: cross the midline into the other half, chant
 * "kabaddi, kabaddi" on one breath (twelve seconds of it), touch as many defenders as you can (Q) and get back
 * across the line. The defenders close in; two of them on you for a moment, or one hanging on to your leg for
 * two seconds, and you are caught. A touch that gets home scores a point each; a catch scores one for them. The
 * other side raids in between (the dice). Best of four raids; the cup on Baisakhi is five, and the defenders are quicker.
 */

export const BREATH = 12;

/** The court: the ground's centre, the circle's radius. The midline is x = cx, running along z. */
export function court(): { cx: number; cz: number; r: number } {
  const k = SITES.find((s) => s.id === "kabaddi")!;
  return { cx: (k.x0 + k.x1) / 2, cz: (k.z0 + k.z1) / 2, r: 11 };
}

export const inEnemyHalf = (x: number, cx: number): boolean => x > cx + 0.15;
export const outOfCourt = (x: number, z: number, c: { cx: number; cz: number; r: number }): boolean => Math.hypot(x - c.cx, z - c.cz) > c.r + 0.8;

export interface Hold { two: number; one: number }
/**
 * Are you held? `dists` are the distances of the defenders still in, in metres. Two within 1.3 m for 0.6 s,
 * or one within 0.9 m for 2 s, is a catch. Pure, so it is tested.
 */
export function stepHold(h: Hold, dists: number[], dt: number): { held: boolean; hold: Hold } {
  const close2 = dists.filter((d) => d < 1.3).length >= 2;
  const close1 = dists.some((d) => d < 0.9);
  const hold = { two: close2 ? h.two + dt : 0, one: close1 ? h.one + dt : Math.max(0, h.one - dt * 2) };
  return { held: hold.two >= 0.6 || hold.one >= 2, hold };
}

/** What the other side scores in its raid: 0 to 2, a little more in the cup. */
export function oppScore(rng: Rng, cup: boolean): number {
  const table = cup ? [0, 1, 1, 2, 2, 3] : [0, 0, 1, 1, 2];
  return table[Math.floor(rng.next() * table.length)]!;
}

export type Result = "win" | "lose" | "draw";
export const resultOf = (you: number, them: number): Result => (you > them ? "win" : you < them ? "lose" : "draw");

export interface KabaddiHost {
  crowd: Crowd;
  playerPos(): Vector3;
  /** Put the player on a spot, facing yaw. */
  placePlayer(x: number, z: number, yaw: number): void;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  /** A bubble over the player's head. */
  chant(text: string): void;
  sting(kind: "small" | "big" | "fail"): void;
  results(title: string, medal: string | null, rows: Array<[string, string]>, buttons: Array<{ label: string; value: string }>): Promise<string>;
  reward(money: number, rep: number): void;
  /** The scoreboard on the side of the screen (null to clear). */
  hud(m: { title: string; lines: string[]; meter?: { label: string; frac: number } } | null): void;
  setFlag(name: string): void;
  persist(reason: string): void;
}

type Phase = "ready" | "raid" | "after" | "done";

interface Def { r: Resident; home: Vector3; out: boolean }

export class KabaddiMatch {
  active = false;
  private phase: Phase = "done";
  private defs: Def[] = [];
  private extras: Resident[] = [];
  private raid = 0;
  private you = 0;
  private them = 0;
  private touched = 0;
  private breath = BREATH;
  private t = 0;
  private hold: Hold = { two: 0, one: 0 };
  private crossed = false;
  private chantT = 0;
  private cup = false;
  private rng = new Rng(97);
  private busy = false;

  constructor(private host: KabaddiHost) {}

  get raids(): number { return this.cup ? 5 : 4; }

  private look(seed: number, shirt: string): Appearance {
    return { ...randomAppearance(seed), sex: "m", age: "adult", top: "vest", vest: "#fafafa", topColor: "#fafafa", bottom: "pajama", bottomColor: shirt, height: 1.74, headwear: "patka", headColor: "#fbc02d", beard: "none" };
  }

  private steer(r: Resident, to: { x: number; z: number }, dt: number, speed: number): boolean {
    const dx = to.x - r.pos.x, dz = to.z - r.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.2) { r.vel.scaleInPlace(Math.exp(-dt * 8)); return true; }
    r.vel.set((dx / d) * speed, 0, (dz / d) * speed);
    r.facing = Math.atan2(dx, dz);
    return false;
  }

  /** Line up the sides and begin. */
  start(cup: boolean): void {
    if (this.active) return;
    const h = this.host, c = court();
    this.cup = cup; this.active = true; this.raid = 0; this.you = 0; this.them = 0; this.busy = false;
    this.rng = new Rng(cup ? 31 : 97);
    const spots: Array<[number, number]> = [[5.5, -5], [6.5, -1.7], [6.5, 1.7], [5.5, 5]];
    this.defs = spots.map(([dx, dz], i) => {
      const r = h.crowd.spawn({ id: `kb_def${i}`, name: "Kabaddi defender", role: "chatter", look: this.look(8100 + i * 7, "#c62828"), x: c.cx + dx, z: c.cz + dz, yaw: -Math.PI / 2, indoor: true });
      return { r, home: new Vector3(c.cx + dx, 0, c.cz + dz), out: false };
    });
    // Your side's raiders on the edge, and the referee with the whistle.
    for (let i = 0; i < 3; i++) this.extras.push(h.crowd.spawn({ id: `kb_mate${i}`, name: "Teammate", role: "chatter", look: this.look(8200 + i * 5, "#1565c0"), x: c.cx - 6 - i * 0.6, z: c.cz - 7.5 + i * 7, yaw: Math.PI / 2, indoor: true, gesture: "cheer" }));
    this.extras.push(h.crowd.spawn({ id: "kb_ref", name: "Referee", role: "chatter", look: { ...this.look(8300, "#212121"), age: "elder", topColor: "#eceff1", vest: "#eceff1", headColor: "#ffffff" }, x: c.cx + 0.6, z: c.cz + c.r + 1.5, yaw: Math.PI, indoor: true }));
    h.placePlayer(c.cx - 8, c.cz, Math.PI / 2);
    h.toast(cup ? "🏆 Baisakhi kabaddi cup, the final: five raids. Cross the line, chant, touch (Q), come back!" : "Friendly match: four raids. Cross the midline, chant, touch the defenders (Q) and come back!", "info", 6000);
    this.ready();
  }

  private ready(): void {
    const c = court();
    this.raid++;
    this.phase = "ready"; this.t = 0; this.touched = 0; this.crossed = false; this.breath = BREATH; this.hold = { two: 0, one: 0 };
    for (const d of this.defs) { d.out = false; d.r.brain = (r, dt) => { this.steer(r, d.home, dt, 1.6); r.lookTarget = this.host.playerPos().clone(); }; }
    this.host.hud({ title: `Kabaddi · raid ${this.raid} of ${this.raids}`, lines: [`Tusi ${this.you} · Oh ${this.them}`, "Cross the midline"] });
    void c;
  }

  /** The attack key during a raid: a touch, if a defender is within reach. */
  touch(): boolean {
    if (!this.active || this.phase !== "raid") return false;
    const p = this.host.playerPos();
    for (const d of this.defs) {
      if (d.out) continue;
      if (Math.hypot(d.r.pos.x - p.x, d.r.pos.z - p.z) < 1.15) {
        d.out = true; this.touched++;
        d.r.anim.play("startled", 1.2);
        this.host.sting("small");
        this.host.toast(`✋ Touch! ${this.touched} out`, "money", 1500);
        const c = court();
        d.r.brain = (r, dt) => { this.steer(r, { x: c.cx + 8, z: d.home.z * 1.6 }, dt, 1.4); };
        return true;
      }
    }
    return false;
  }

  update(dt: number): void {
    if (!this.active || this.busy) return;
    const p = this.host.playerPos(), c = court();
    this.t += dt;
    if (this.phase === "ready") {
      if (inEnemyHalf(p.x, c.cx)) { this.phase = "raid"; this.t = 0; this.crossed = true; this.host.toast("Kabaddi kabaddi kabaddi!", "info", 1500); }
      else if (this.t > 20) void this.endRaid("late");
      return;
    }
    if (this.phase !== "raid") return;
    const inH = inEnemyHalf(p.x, c.cx);
    // Chanting: a bubble over your head while you hold your breath.
    if (inH) {
      this.breath -= dt;
      if ((this.chantT -= dt) <= 0) { this.chantT = 1.1; this.host.chant("Kabaddi kabaddi kabaddi…"); }
    }
    const live = this.defs.filter((d) => !d.out);
    // The defenders come at you once you are in their half and near.
    for (const d of live) {
      const dist = Math.hypot(d.r.pos.x - p.x, d.r.pos.z - p.z);
      if (inH && dist < 9) d.r.brain = (r, dt2) => { this.steer(r, this.host.playerPos(), dt2, this.cup ? 2.7 : 2.2); };
      else d.r.brain = (r, dt2) => { this.steer(r, d.home, dt2, 1.6); r.lookTarget = this.host.playerPos().clone(); };
    }
    const dists = live.map((d) => Math.hypot(d.r.pos.x - p.x, d.r.pos.z - p.z));
    const held = stepHold(this.hold, inH ? dists : [], dt);
    this.hold = held.hold;
    this.host.hud({
      title: `Kabaddi · raid ${this.raid} of ${this.raids}`,
      lines: [`Tusi ${this.you} · Oh ${this.them}`, inH ? `Touches: ${this.touched}` : "Back over the line!"],
      meter: { label: "Saah (breath)", frac: Math.max(0, this.breath / BREATH) },
    });
    if (held.held) { void this.endRaid("caught"); return; }
    if (this.breath <= 0) { void this.endRaid("breath"); return; }
    if (outOfCourt(p.x, p.z, c)) { void this.endRaid("line"); return; }
    if (this.crossed && !inH && p.x < c.cx - 0.3) void this.endRaid(this.touched > 0 ? "home" : "empty");
  }

  private async endRaid(why: "home" | "empty" | "caught" | "breath" | "line" | "late"): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.phase = "after";
    const h = this.host;
    let line: string;
    if (why === "home") { this.you += this.touched; line = `Wah! Ghar pahunch gaya: ${this.touched} point`; h.sting("big"); }
    else if (why === "empty") { line = "Wapas aa gaya, par kisi nu chhoo nahi saka: koi point nahi"; }
    else { this.them++; line = why === "caught" ? "Pakad liya gaya! Oh nu ik point" : why === "breath" ? "Saah toot gaya! Oh nu ik point" : why === "line" ? "Line ton bahar! Oh nu ik point" : "Waqt nahi lagaya! Oh nu ik point"; h.sting("fail"); }
    h.toast(line, why === "home" ? "money" : "warn", 3500);
    for (const d of this.defs) d.r.brain = (r, dt) => { this.steer(r, d.home, dt, 1.8); };
    await new Promise((res) => setTimeout(res, 1800));
    // The other side raids.
    const opp = oppScore(this.rng, this.cup);
    if (opp) { this.them += opp; h.toast(`Doosri team da raider: ${opp} point`, "warn", 2500); }
    h.hud({ title: `Kabaddi · raid ${this.raid} of ${this.raids}`, lines: [`Tusi ${this.you} · Oh ${this.them}`] });
    await new Promise((res) => setTimeout(res, 1500));
    this.busy = false;
    if (this.raid >= this.raids) { await this.finish(); return; }
    h.placePlayer(court().cx - 8, court().cz, Math.PI / 2);
    this.ready();
  }

  private async finish(): Promise<void> {
    this.busy = true;
    const h = this.host, res = resultOf(this.you, this.them);
    const money = res === "win" ? (this.cup ? 1000 : 200) : res === "draw" ? (this.cup ? 200 : 50) : 0;
    const rep = res === "win" ? (this.cup ? 12 : 3) : res === "draw" ? 1 : 0;
    this.stop();
    if (res === "win") { h.sting("big"); if (this.cup) h.setFlag("c_kabaddi"); }
    if (money || rep) h.reward(money, rep);
    await h.results(this.cup ? "Baisakhi kabaddi cup" : "Kabaddi match", res === "win" ? "gold" : res === "draw" ? "silver" : "bronze", [
      ["Score", `Tusi ${this.you} · Oh ${this.them}`],
      ["Nateeja", res === "win" ? (this.cup ? "Cup tere naam!" : "Tusi jite!") : res === "draw" ? "Barabar rahi" : "Is vaari haar gaye"],
      ["Inaam", money ? `₹${money} · +${rep} izzat` : "Agli vaari"],
    ], [{ label: "Shabaash", value: "ok" }]);
    h.persist("kabaddi");
  }

  /** End it now (the player left, a fight broke out): nothing scored, nothing lost. */
  stop(): void {
    this.active = false; this.phase = "done";
    for (const d of this.defs) this.host.crowd.remove(d.r);
    for (const e of this.extras) this.host.crowd.remove(e);
    this.defs = []; this.extras = [];
    this.host.hud(null);
  }
}
