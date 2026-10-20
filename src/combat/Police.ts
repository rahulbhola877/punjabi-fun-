import { Vector3 } from "../babylon";
import type { Crowd, Resident, ResidentDef } from "../crowds/Crowd";
import type { Combat } from "./Combat";
import type { Traffic, TrafficCar } from "../traffic/Traffic";
import { constableLook } from "../characters/appearances";
import { Rng } from "../render/textures";

/**
 * Police interest ("wanted" stars, 0–3). Trouble makes the local constables
 * come looking — on foot, or in their jeep when you are driving. They never
 * actually book anyone: once they catch you, a little "chai-paani" changes
 * hands and they go back to their tea. Escaping for long enough cools it down.
 */

export interface PoliceHost {
  crowd: Crowd;
  combat: Combat;
  traffic: Traffic;
  /** Player feet on foot, or the vehicle position. */
  playerPos(): Vector3;
  playerDriving(): { speed: number } | null;
  money(): number;
  pay(amount: number): void;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
  toast(msg: string, kind?: "info" | "warn" | "money"): void;
  /** A free spot on open ground near a point (or null). */
  openSpot(x: number, z: number, minR: number, maxR: number): { x: number; z: number } | null;
  siren(on: boolean, pos: Vector3): void;
  voice(name: string, pos: Vector3): void;
  busy(): boolean;
}

const SHOUTS = ["Oye! Rukk ja!", "Pakdo isnu!", "Bhajj na, puttar!", "Kithe chaleya hero?", "Fuddu ho gia ae? Rukk!"];

export class Police {
  stars = 0;
  private cool = 0;
  private sinceSeen = 0;
  private cooldownCrime = new Map<string, number>();
  private officers: Resident[] = [];
  /** Officers who were already on duty nearby (they go back to their post, not home). */
  private onDuty = new Set<Resident>();
  private jeep: TrafficCar | null = null;
  private catching = false;
  private rng = new Rng(100);
  private n = 0;
  private lastRepathT = 0;
  /** Total bribes this session (also saved in stats by the game). */
  paid = 0;

  constructor(private host: PoliceHost) {}

  get chasing(): boolean {
    return this.stars > 0 && (this.officers.length > 0 || !!this.jeep);
  }

  /** Report trouble. `kind` rate-limits repeats of the same sort. */
  crime(kind: string, stars: number): void {
    const now = performance.now() / 1000;
    if ((this.cooldownCrime.get(kind) ?? -99) > now - 8) return;
    this.cooldownCrime.set(kind, now);
    const before = this.stars;
    this.stars = Math.min(3, this.stars + stars);
    this.sinceSeen = 0;
    this.cool = 0;
    if (this.stars > before) this.host.toast(this.stars === 1 ? "🚨 Someone called the police!" : `🚨 Police interest: ${"★".repeat(this.stars)}`, "warn");
  }

  isOfficer(r: Resident): boolean {
    return this.officers.includes(r);
  }

  private spawnOfficer(x: number, z: number): Resident {
    const id = `police${this.n++}`;
    const look = constableLook(this.n);
    const def: ResidentDef = { id, name: "Havaldar", role: "keeper", look, x, z, yaw: 0, faction: "police", tough: 1.4 };
    const r = this.host.crowd.spawn(def);
    this.host.combat.engage(r, { side: "foe", target: "player", speed: 4.4 + this.stars * 0.35, moves: ["lathi", "shove"] });
    this.officers.push(r);
    return r;
  }

  fixedUpdate(dt: number): void {
    const p = this.host.playerPos();
    const driving = this.host.playerDriving();
    // Driving like a maniac past a patrol is its own invitation.
    if (driving && driving.speed > 13) {
      const near = this.host.traffic.nearestPatrol(p, 28);
      if (near) this.crime("rash", 1);
    }
    if (this.stars <= 0) {
      this.standDown();
      return;
    }
    // Officers whose area was unloaded are gone.
    this.officers = this.officers.filter((o) => this.host.crowd.residents.includes(o));
    // Keep the right units on the case: constables on duty nearby answer first.
    if (!driving) {
      const want = Math.min(3, this.stars + (this.stars >= 2 ? 1 : 0));
      if (this.officers.length < want) {
        const duty = this.host.crowd.residents.find((r) => r.faction === "police" && !this.officers.includes(r) && r.pose !== "down" && Math.hypot(r.pos.x - p.x, r.pos.z - p.z) < 70);
        if (duty) {
          this.onDuty.add(duty);
          this.officers.push(duty);
          this.host.combat.engage(duty, { side: "foe", target: "player", cool: 0, speed: 4.4 + this.stars * 0.35, moves: ["lathi", "shove"] });
          this.host.crowd.say(duty, this.rng.pick(SHOUTS));
          if (this.officers.length === 1) this.host.voice("police_rukk", duty.pos);
        }
      }
      if (this.officers.length < want) {
        const at = this.jeep && Vector3.Distance(this.jeep.v.position, p) < 40 ? { x: this.jeep.v.position.x + 2, z: this.jeep.v.position.z } : this.host.openSpot(p.x, p.z, 28, 42);
        if (at) {
          const r = this.spawnOfficer(at.x, at.z);
          this.host.crowd.say(r, this.rng.pick(SHOUTS));
          if (this.officers.length === 1) this.host.voice("police_rukk", r.pos);
        }
      }
    } else if (!this.jeep) {
      const n = this.host.traffic;
      // A patrol jeep nearby takes the call; otherwise one comes from out of sight.
      const patrol = n.nearestPatrol(p, 220);
      if (patrol) {
        patrol.police = true;
        patrol.ai.aggression = 1.25;
        this.jeep = patrol;
      } else {
        const spot = this.host.openSpot(p.x, p.z, 70, 110);
        if (spot) this.jeep = n.spawnPolice(spot.x, spot.z, Math.atan2(p.x - spot.x, p.z - spot.z));
      }
      // On the radio before they are even alongside you.
      if (this.jeep) this.host.voice("police_gaddi_rok", this.jeep.v.position);
    }
    // Officers who lost track of you (you were in a vehicle) pick the chase back up.
    if (!driving && !this.catching) {
      for (const o of this.officers) {
        const f = this.host.combat.fights.get(o);
        if (o.pose !== "down" && (!f || (f.target === null && f.downT <= 0))) this.host.combat.engage(o, { side: "foe", target: "player", cool: 0, speed: 4.4 + this.stars * 0.35, moves: ["lathi", "shove"] });
      }
    }
    // The jeep homes in along the roads, then straight at you.
    if (this.jeep) {
      const c = this.jeep;
      c.ai.chase = p.clone();
      this.lastRepathT -= dt;
      if (this.lastRepathT <= 0) { this.lastRepathT = 2; c.ai.routeTo(p.x, p.z); }
      this.host.siren(true, c.v.position);
      if (!this.host.traffic.cars.includes(c)) this.jeep = null;
    }
    // Seen / escaped bookkeeping.
    let nearest = Infinity;
    for (const o of this.officers) nearest = Math.min(nearest, Math.hypot(o.pos.x - p.x, o.pos.z - p.z));
    if (this.jeep) nearest = Math.min(nearest, Vector3.Distance(this.jeep.v.position, p));
    if (nearest < 45) this.sinceSeen = 0;
    else this.sinceSeen += dt;
    if (this.sinceSeen > 34) {
      this.sinceSeen = 0;
      this.stars--;
      this.host.toast(this.stars ? `You're losing them… ${"★".repeat(this.stars)}` : "The police gave up. Phew!", "info");
    }
    // Caught?
    if (this.catching || this.host.busy()) return;
    let caught = false;
    if (!driving) caught = this.officers.some((o) => o.pose !== "down" && Math.hypot(o.pos.x - p.x, o.pos.z - p.z) < 1.4);
    else if (this.jeep && Vector3.Distance(this.jeep.v.position, p) < 7.5 && driving.speed < 2.2) this.cool += dt;
    else this.cool = 0;
    if (this.cool > 1.2) caught = true;
    if (caught) void this.bribe();
  }

  /** The inevitable ending: chai-paani, and everyone goes home. */
  private async bribe(): Promise<void> {
    this.catching = true;
    this.host.combat.calmAll();
    for (const o of this.officers) {
      if (this.onDuty.has(o)) this.host.combat.release(o);
      else this.host.combat.engage(o, { side: "neutral", target: null, cool: 999, leave: true });
    }
    const ask = 30 + this.stars * 50;
    const have = this.host.money();
    this.host.voice("police_chai", this.officers[0]?.pos ?? this.host.playerPos());
    const v = await this.host.dialogue("havaldar", `Oye! <b>Rukk ja</b>, hero! Bada tez bhajda ae… Paper dikha. Rehen de, paper vi nahi honge.<br><br>Dekh puttar, case bada serious ae. Par asi vi insaan haan. <b>Chai-paani</b> da intezaam ho jaave, taan gal khatam.`, [
      { label: `Pay ₹${ask} "chai-paani"`, value: "pay" },
      { label: "Sirf chai, paani free? (haggle)", value: "haggle" },
      { label: "Mere kol kuchh nahi, ji…", value: "broke" },
    ]);
    let amount = ask;
    let line = "Chal, ja. Te agli vaari dhyaan naal!";
    if (v === "haggle") {
      if (this.rng.next() < 0.55) { amount = Math.round(ask * 0.5); line = "Hahaha! Gallan bahut karda ae. Chal, adha de te nikal!"; }
      else { amount = ask + 20; line = "Mazaak? Hun ₹20 hor — mazaak di fees!"; }
    } else if (v === "broke") {
      amount = Math.min(have, Math.round(ask * 0.6));
      line = have > 0 ? "Jebaan taan bhariyan ne! Eh lai lo, baaki maaf." : "Sach vich kuchh nahi? Chal koi na… aaj tera din ae.";
    }
    amount = Math.min(have, amount);
    if (amount > 0) this.host.pay(amount);
    this.paid += amount;
    await this.host.dialogue("havaldar", `${amount > 0 ? `<i>(₹${amount} disappears into a khaki pocket.)</i><br>` : ""}${line}`, [{ label: "Ji, Havaldar sahib", value: "ok" }]);
    this.stars = 0;
    this.standDown();
    this.catching = false;
  }

  /** Officers walk off (and vanish once out of sight); the jeep drives away. */
  private standDown(): void {
    const p = this.host.playerPos();
    for (const o of [...this.officers]) {
      if (this.onDuty.has(o)) {
        // Back to the beat.
        this.host.combat.release(o);
        this.onDuty.delete(o);
        this.officers = this.officers.filter((x) => x !== o);
        continue;
      }
      const f = this.host.combat.fights.get(o);
      if (!f || f.target || !f.leave) this.host.combat.engage(o, { side: "neutral", target: null, cool: 999, leave: true });
      if (Math.hypot(o.pos.x - p.x, o.pos.z - p.z) > 26 || o.pose === "down") {
        this.host.combat.release(o);
        this.host.crowd.remove(o);
        this.officers = this.officers.filter((x) => x !== o);
      }
    }
    if (this.jeep) {
      this.host.siren(false, this.jeep.v.position);
      this.jeep.ai.chase = null;
      this.jeep.police = false;
      this.jeep.patrol = true;
      this.jeep.ai.aggression = 0.8;
      this.jeep.ai.wander(6);
      this.jeep = null;
    }
  }
}
