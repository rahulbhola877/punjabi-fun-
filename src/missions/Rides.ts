import { Vector3, type Scene, type Material, type AbstractMesh } from "../babylon";
import { POIS } from "../world/layout";
import type { Vehicle } from "../vehicles/Vehicle";
import { buildHuman, type BuiltHuman } from "../characters/HumanBuilder";
import { HumanAnimator } from "../characters/HumanAnimator";
import { randomAppearance } from "../characters/appearances";
import type { SaveData } from "../save/schema";
import { Rng } from "../render/textures";
import type { NavGraph } from "../world/nav";

/**
 * "Sawari": drive the auto-rickshaw as a city ride. Pick a passenger up at a
 * stand (the bus adda or the bazaar gate), take them where they want to go,
 * and get paid by distance — less if you rattle them over every pothole.
 */

export interface RideHost {
  save: SaveData;
  scene: Scene;
  mat: Material;
  driving(): Vehicle | null;
  toast(msg: string, kind?: "info" | "warn" | "money", ms?: number): void;
  reward(money: number, rep: number): void;
  say(text: string): void;
  /** A recorded passenger reaction, played at the auto. */
  sound(clip: string): void;
  sting(kind: "small" | "big"): void;
  roadGraph: NavGraph;
  addCaster(m: AbstractMesh): void;
  removeCaster(m: AbstractMesh): void;
  persist(reason: string): void;
}

export const STANDS = [
  { id: "busAdda", label: "Bus adda auto stand", x: 458, z: -80 },
  { id: "gate", label: "Bazaar gate auto stand", x: 0, z: -80 },
  { id: "ludhAdda", label: "Ludhiana auto stand", x: -412, z: -340 },
];

const DROPS: Array<{ poi: keyof typeof POIS; ask: string }> = [
  { poi: "sherDhaba", ask: "Sher-e-Punjab dhaba chalo, bhaiya — G.T. Road te." },
  { poi: "sarpanch", ask: "Pind Kotli, Sarpanch ji de ghar. Jaldi!" },
  { poi: "mandi", ask: "Anaj mandi. Boli shuru hon wali ae!" },
  { poi: "cinema", ask: "Raj Talkies! Show nikal na jaave." },
  { poi: "petrol", ask: "Petrol pump te chhad dena." },
  { poi: "dhabaCounter", ask: "Ranggarh bazaar, Bhole da dhaba." },
  { poi: "chemist", ask: "Sehat chemist, bazaar vich. Dawai leni ae." },
  { poi: "jarnail", ask: "Jarnail Singh de dere, kacche raste ton." },
  { poi: "busAdda", ask: "Bus adda! Ludhiana di bus fadni ae." },
  { poi: "ludhChowk", ask: "Ludhiana, Ghanta Ghar! Bheed ton bach ke chalaana." },
  { poi: "ludhMandi", ask: "Ludhiana sabzi mandi — bhaa puchhna ae." },
  { poi: "ludhAdda", ask: "Ludhiana adda chalo ji, bus fadni ae." },
  { poi: "ludhCinema", ask: "Deepak Talkies, Ludhiana. Show shuru hon wala ae!" },
];
const CHATTER = ["Bhaiya, gaana laga do!", "Thoda dheere, mera dil kachcha ae!", "Shortcut lao ji, shortcut!", "Eh sadak kado banu?", "Meter chalda ae ke nahi?", "Oye, kutta! Bach ke!", "Mere bhatije da viah ae kal…"];

export interface ActiveRide {
  stand: string;
  dropPoi: keyof typeof POIS;
  fare: number;
  comfort: number;
  elapsed: number;
  passenger: BuiltHuman;
  anim: HumanAnimator;
  chatT: number;
}

export class Rides {
  ride: ActiveRide | null = null;
  private rng = new Rng(6060);

  constructor(private host: RideHost) {}

  /** Interaction label at a stand while driving an auto. */
  standHere(pos: Vector3): (typeof STANDS)[number] | null {
    const v = this.host.driving();
    if (!v || v.spec.type !== "auto" || this.ride || v.speed > 2.5) return null;
    return STANDS.find((s) => Math.hypot(s.x - pos.x, s.z - pos.z) < 9) ?? null;
  }

  pickUp(standId: string): void {
    const v = this.host.driving();
    if (!v) return;
    const stand = STANDS.find((s) => s.id === standId)!;
    const opts = DROPS.filter((d) => Math.hypot(POIS[d.poi]!.x - stand.x, POIS[d.poi]!.z - stand.z) > 120);
    const drop = this.rng.pick(opts);
    const to = POIS[drop.poi]!;
    const g = this.host.roadGraph;
    const len = g.length(g.path(g.nearest(stand.x, stand.z), g.nearest(to.x, to.z))) + 20;
    const fare = Math.round((25 + len * 0.09) / 5) * 5;
    const look = randomAppearance(this.rng.int(1, 99999));
    const h = buildHuman(this.host.scene, "passenger", { ...look, age: look.age === "child" ? "adult" : look.age }, this.host.mat);
    h.root.parent = v.model.root;
    h.root.position.set(0.25, 0.68 - 0.92 * h.scale, -0.6);
    this.host.addCaster(h.mesh);
    const a = new HumanAnimator(h);
    this.ride = { stand: standId, dropPoi: drop.poi, fare, comfort: 100, elapsed: 0, passenger: h, anim: a, chatT: 6 };
    this.host.say(`"${drop.ask}"`);
    this.host.toast(`Sawari! ${POIS[drop.poi]!.label} — fare ₹${fare}. Smooth driving earns a tip.`, "money", 3500);
  }

  /** A bump or crash while carrying a passenger. */
  onJolt(dv: number): void {
    if (!this.ride) return;
    const loss = Math.max(0, dv - 1.4) * 7;
    if (loss <= 0) return;
    this.ride.comfort = Math.max(0, this.ride.comfort - loss);
    if (loss > 5) {
      this.host.say(this.rng.pick(["Hai! Meri kamar!", "Oye, dhyaan naal!", "Auto ae ke jahaaz?!", "Haye rabba, lak tut gaya!"]));
      if (loss > 9) this.host.sound("sawari_lak");
    }
  }

  /** At the drop-off point: hand-over. */
  dropHere(pos: Vector3): boolean {
    const r = this.ride;
    const v = this.host.driving();
    if (!r || !v) return false;
    const p = POIS[r.dropPoi]!;
    return Math.hypot(p.x - pos.x, p.z - pos.z) < 7 && v.speed < 2.5;
  }

  dropOff(): void {
    const r = this.ride;
    if (!r) return;
    const tip = r.comfort > 85 ? Math.round(r.fare * 0.25 / 5) * 5 : 0;
    const paid = Math.round((r.fare * (0.6 + r.comfort / 250)) / 5) * 5 + tip;
    this.host.reward(paid, r.comfort > 70 ? 3 : 1);
    this.host.say(r.comfort > 85 ? "Vadhiya chalaunda ae! Eh lai tip." : r.comfort > 50 ? "Theek ae, pahunch gaye." : "Agli vaari bus ch hi jaavanga!");
    this.host.sting(tip ? "big" : "small");
    this.host.save.stats.rides++;
    this.end();
    this.host.persist("ride");
  }

  end(): void {
    const r = this.ride;
    if (!r) return;
    this.host.removeCaster(r.passenger.mesh);
    r.passenger.root.dispose();
    this.ride = null;
  }

  update(dt: number): void {
    const r = this.ride;
    if (!r) return;
    r.elapsed += dt;
    r.chatT -= dt;
    if (r.chatT <= 0) { r.chatT = this.rng.range(10, 18); this.host.say(this.rng.pick(CHATTER)); }
    r.anim.update(dt, { speed: 0, grounded: true, pose: "sit", carry: false, lookYaw: 0.3 * Math.sin(r.elapsed * 0.4) });
    // Passenger leaves if you abandon the auto.
    if (!this.host.driving() || this.host.driving()!.spec.type !== "auto") { this.host.toast("Your passenger got off and walked away, grumbling.", "warn"); this.end(); }
  }

  get target(): Vector3 | null {
    if (!this.ride) return null;
    const p = POIS[this.ride.dropPoi]!;
    return new Vector3(p.x, 0, p.z);
  }

  get label(): string {
    return this.ride ? POIS[this.ride.dropPoi]!.label : "";
  }
}
