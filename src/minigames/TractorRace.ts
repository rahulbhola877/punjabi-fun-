import { Quaternion, type Vector3 } from "../babylon";
import type { VehicleModel } from "../vehicles/models";
import type { Vehicle } from "../vehicles/Vehicle";

/**
 * A tractor race on the kacha tracks: one lap of the loop, from the start line at A round B, C and D and back over A.
 * The grid waits on the stretch before A, and you are at its front, in a real tractor. Three rivals run the loop on
 * rails: they are visuals with no body, so they never block you. The gates at the corners count only in order, so
 * cutting back or going round the wrong way gains nothing. The rules here are pure, and tested (tests/tractorRace.test.ts).
 */

export interface Point { x: number; z: number }

/** The loop's corners in order, from the start line at A: A, then B, C and D, then back over A. */
export const CORNERS: Point[] = [
  { x: -600, z: -400 },
  { x: -300, z: -400 },
  { x: -300, z: -760 },
  { x: -600, z: -760 },
];

const SEGMENTS = CORNERS.map((from, i) => {
  const to = CORNERS[(i + 1) % CORNERS.length]!;
  return { from, to, len: Math.hypot(to.x - from.x, to.z - from.z) };
});

/** One lap, in metres (1320). */
export const LAP = SEGMENTS.reduce((sum, s) => sum + s.len, 0);

/** Where the loop is `d` metres past A (negative: back along the stretch before it), and which way it heads. */
export function loopAt(d: number): { x: number; z: number; yaw: number } {
  let s = ((d % LAP) + LAP) % LAP;
  let seg = SEGMENTS[0]!;
  for (const next of SEGMENTS) {
    seg = next;
    if (s <= next.len) break;
    s -= next.len;
  }
  const t = Math.min(1, s / seg.len), dx = seg.to.x - seg.from.x, dz = seg.to.z - seg.from.z;
  return { x: seg.from.x + dx * t, z: seg.from.z + dz * t, yaw: Math.atan2(dx, dz) };
}

/** The grid: slot 0 is the front, and each slot stands 6 m behind the one before it, short of A. */
export const RIVALS = 3;
export const gridAt = (slot: number) => loopAt(-6 - 6 * slot);

/** Where you wait to start the race: on the verge by the grid, so the walk up to the tractor is short. */
export const START_SPOT: Point = { x: -607, z: -412 };

/** The gates, in order: B, C and D, then A again, which finishes the lap. */
export const GATES: Point[] = [CORNERS[1]!, CORNERS[2]!, CORNERS[3]!, CORNERS[0]!];
/** How close (m) a racer must come to a gate to pass it. */
export const GATE_R = 16;
/** The gate index that means the lap is done. */
export const FINISHED = GATES.length;

/** Advance `gate` (the index of the next gate to pass) for a racer at (x, z). Only the next gate counts. */
export function passGates(gate: number, x: number, z: number): number {
  let g = gate;
  while (g < GATES.length && Math.hypot(x - GATES[g]!.x, z - GATES[g]!.z) < GATE_R) g++;
  return g;
}

/** Metres from a racer to the gate it must pass next (0 once the lap is done). */
export function toNextGate(gate: number, x: number, z: number): number {
  if (gate >= GATES.length) return 0;
  return Math.hypot(x - GATES[gate]!.x, z - GATES[gate]!.z);
}

export interface Racer {
  id: string;
  /** The next gate to pass (FINISHED once the lap is done). */
  gate: number;
  /** Metres to that gate. */
  dist: number;
  /** Seconds into the race when the lap was done, or null. */
  finishAt: number | null;
}

/** The order of the race: finishers by when they finished, then the rest by gates passed, then by how near their next gate is. */
export function standings(racers: Racer[]): Racer[] {
  return [...racers].sort((a, b) => {
    if (a.finishAt !== null || b.finishAt !== null) {
      if (a.finishAt === null) return 1;
      if (b.finishAt === null) return -1;
      return a.finishAt - b.finishAt;
    }
    return a.gate !== b.gate ? b.gate - a.gate : a.dist - b.dist;
  });
}

/** Prize money by place, first to fourth (rupees). */
export const PRIZES = [500, 200, 80, 0];
/** Seconds: the countdown before the flag drops, and the most time one lap may take. */
export const COUNTDOWN = 3;
export const TIME_LIMIT = 240;
/** The rivals' speeds on the straights (m/s). You can beat any of them: the tractor tops out at 11 m/s. */
export const RIVAL_SPEEDS = [9.2, 9.8, 10.4];
/** Rivals take the corners at this share of their speed. */
const CORNER_SPEED = 0.7;

/** How much a rival slows for the corner it is at (1 on the straights). */
export function cornerFactor(p: Point): number {
  return CORNERS.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < 14) ? CORNER_SPEED : 1;
}

/** A rival's distance along the loop after `dt` seconds at its speed. */
export function rivalStep(d: number, speed: number, dt: number): number {
  return d + speed * dt * cornerFactor(loopAt(d));
}

/** Seconds as m:ss, for the scoreboard. */
export function clockText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface RaceHost {
  playerPos(): Vector3;
  /** The tractor you are driving, or null when you have got out. */
  driving(): Vehicle | null;
  /** A real tractor at a grid spot, with you in it. */
  gridTractor(x: number, z: number, yaw: number): Vehicle;
  /** Is anything parked or moving within r metres of (x, z)? */
  occupied(x: number, z: number, r: number): boolean;
  /** A rival's tractor: a visual only, with no body. */
  rivalModel(id: string, body: string): VehicleModel;
  /** Take a rival's visual away. */
  dropModel(m: VehicleModel): void;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  hud(m: { title: string; lines: string[] } | null): void;
  sting(kind: "small" | "big" | "fail"): void;
  results(title: string, medal: string | null, rows: Array<[string, string]>, buttons: Array<{ label: string; value: string }>): Promise<string>;
  reward(money: number, rep: number): void;
  persist(reason: string): void;
}

const RIVAL_BODIES = ["#1565c0", "#c62828", "#6d4c41"];
const RIVAL_LANES = [-1.3, 1.3, 0];

interface Rival {
  racer: Racer;
  model: VehicleModel;
  lane: number;
  speed: number;
  /** Metres along the loop from A (negative: still on the grid). */
  d: number;
}

export class TractorRace {
  active = false;
  /** True on the grid until the flag drops: the tractor is held with its handbrake on. */
  holding = false;
  private phase: "count" | "race" | "done" = "done";
  private countdown = 0;
  private clock = 0;
  private tractor: Vehicle | null = null;
  private you: Racer = { id: "you", gate: 0, dist: 0, finishAt: null };
  private rivals: Rival[] = [];

  constructor(private host: RaceHost) {}

  /** Line up the grid and start the countdown. False, with a toast, if the grid is not clear. */
  start(): boolean {
    if (this.active) return false;
    for (let slot = 0; slot <= RIVALS; slot++) {
      const g = gridAt(slot);
      if (this.host.occupied(g.x, g.z, 4)) { this.host.toast("Track te kise di gaddi khadi ae. Pehlan hatao.", "warn", 3000); return false; }
    }
    const front = gridAt(0);
    this.tractor = this.host.gridTractor(front.x, front.z, front.yaw);
    this.you = { id: "you", gate: 0, dist: 0, finishAt: null };
    this.rivals = RIVAL_BODIES.map((body, i) => ({
      racer: { id: `rival${i}`, gate: 0, dist: 0, finishAt: null },
      model: this.host.rivalModel(`rival${i}`, body),
      lane: RIVAL_LANES[i]!,
      speed: RIVAL_SPEEDS[i]!,
      d: -6 - 6 * (i + 1),
    }));
    for (const r of this.rivals) this.place(r);
    this.active = true;
    this.phase = "count";
    this.holding = true;
    this.countdown = COUNTDOWN;
    this.clock = 0;
    this.host.toast("Grid te aa jao. Flag ton pehlan ni chalna!", "info", 3000);
    return true;
  }

  /** One frame: the countdown, then the race. */
  update(dt: number): void {
    if (!this.active) return;
    const v = this.host.driving();
    if (!v || v !== this.tractor) { this.stop(); this.host.toast("Race chhad ditti.", "warn", 2500); return; }
    if (this.phase === "count") {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const now = Math.ceil(this.countdown);
      if (now !== before && now > 0) this.host.toast(String(now), "info", 900);
      if (this.countdown <= 0) {
        this.phase = "race";
        this.holding = false;
        this.host.toast("Chalo!", "money", 1500);
        this.host.sting("small");
      }
      this.drawHud();
      return;
    }
    this.clock += dt;
    const p = v.position;
    this.you.gate = passGates(this.you.gate, p.x, p.z);
    this.you.dist = toNextGate(this.you.gate, p.x, p.z);
    if (this.you.gate >= FINISHED) this.you.finishAt = this.clock;
    for (const r of this.rivals) {
      if (r.racer.finishAt === null) r.d = rivalStep(r.d, r.speed, dt);
      this.place(r);
      const at = loopAt(r.d);
      r.racer.gate = passGates(r.racer.gate, at.x, at.z);
      r.racer.dist = toNextGate(r.racer.gate, at.x, at.z);
      if (r.racer.gate >= FINISHED && r.racer.finishAt === null) r.racer.finishAt = this.clock;
    }
    this.drawHud();
    if (this.you.finishAt !== null || this.clock >= TIME_LIMIT) void this.finish();
  }

  /** Put a rival's visual where its place on the loop is, out to its lane. */
  private place(r: Rival): void {
    const at = loopAt(r.d);
    r.model.root.position.set(at.x + r.lane * Math.cos(at.yaw), 0.05, at.z - r.lane * Math.sin(at.yaw));
    r.model.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(at.yaw, 0, 0);
  }

  private racers(): Racer[] {
    return [this.you, ...this.rivals.map((r) => r.racer)];
  }

  private drawHud(): void {
    const all = this.racers();
    const place = standings(all).findIndex((r) => r.id === "you") + 1;
    this.host.hud({ title: "Tractor race · ek chakkar", lines: [`Position ${place} of ${all.length}`, `Samay ${clockText(this.clock)}`] });
  }

  private async finish(): Promise<void> {
    const order = standings(this.racers());
    const place = order.findIndex((r) => r.id === "you") + 1;
    const money = PRIZES[place - 1] ?? 0, rep = place === 1 ? 3 : place === 2 ? 1 : 0;
    const medal = place === 1 ? "gold" : place === 2 ? "silver" : place === 3 ? "bronze" : null;
    const time = this.you.finishAt !== null ? clockText(this.you.finishAt) : "Waqt khatam";
    this.stop();
    this.host.sting(place === 1 ? "big" : place === RIVALS + 1 ? "fail" : "small");
    if (money || rep) this.host.reward(money, rep);
    await this.host.results("Tractor race", medal, [
      ["Position", `${place} of ${order.length}`],
      ["Samay", time],
      ["Inaam", money ? `₹${money}` : "Agli vaari"],
    ], [{ label: "Shabaash", value: "ok" }]);
    this.host.persist("tractorRace");
  }

  /** End it now (the race is over, or you got out). The rivals go; the tractor you drove stays where it is. */
  stop(): void {
    this.active = false;
    this.holding = false;
    this.phase = "done";
    for (const r of this.rivals) this.host.dropModel(r.model);
    this.rivals = [];
    this.tractor = null;
    this.host.hud(null);
  }
}
