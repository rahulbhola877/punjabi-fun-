import { Vector3, type Scene } from "../babylon";
import type { Materials } from "../render/Materials";
import { randomAppearance } from "../characters/appearances";
import { houseToWorld, OPEN_HOUSES, type HouseBell } from "../world/openHouses";
import { HomeDoors } from "../world/HomeDoors";
import { doorResponse } from "../world/dailyLife";
import { HOME_ID } from "../world/home";
import { familyOf } from "./cast";
import type { Crowd, Resident } from "./Crowd";
import type { Speaker, VoiceWhen } from "../audio/VoiceDirector";

export interface DoorbellHost {
  scene: Scene; mats: Materials; crowd: Crowd;
  playerPos(): Vector3; hour(): number;
  ring(pos: Vector3): void; toast(msg: string): void; greet(r: Resident): void;
  say(when: VoiceWhen, sp: Speaker): string | null;
  dialogue(who: string, text: string, options: Array<{ label: string; value: string }>): Promise<string>;
}
type Stage = "ringing" | "opening" | "coming" | "inviting" | "leading" | "inside" | "closing" | "night" | "siesta" | "declined";
interface Visit { h: HouseBell; stage: Stage; t: number; r: Resident | null; gate: Vector3; door: Vector3; waypoint: number; chatting: boolean }
export const NIGHT_LINES = [
  "ਐਨੀ ਰਾਤ ਨੂੰ ਘੰਟੀ ਕਿਉਂ ਵਜਾਈ? ਸੁੱਤੇ ਪਏ ਸੀ! ਸਵੇਰੇ ਆਈਂ। (Enni raat nu ghanti kyon vajayi? Sutte paye si!)",
  "ਗੁਆਂਢੀ: ਸਭ ਖੈਰ ਤਾਂ ਹੈ? ਐਨੀ ਰਾਤ ਨੂੰ ਕੀ ਗੱਲ ਹੋ ਗਈ? (Sab khair taan hai? Enni raat nu ki gall ho gayi?)",
  "ਬੱਚੇ ਸੁੱਤੇ ਨੇ, ਪੁੱਤਰਾ। ਕੋਈ ਜ਼ਰੂਰੀ ਗੱਲ ਹੈ? ਨਹੀਂ ਤਾਂ ਸਵੇਰੇ ਆ ਜਾਈਂ।",
];
export const STRANGER_LINES = [
  "ਮਾਫ਼ ਕਰਨਾ ਜੀ, ਅਸੀਂ ਤੁਹਾਨੂੰ ਜਾਣਦੇ ਨਹੀਂ। ਘਰ ਵਾਲੇ ਰੁੱਝੇ ਨੇ, ਦਰਵਾਜ਼ਾ ਨਹੀਂ ਖੋਲ੍ਹ ਸਕਦੇ। (Maaf karna ji, asi tuhanu jaande nahi. Ghar wale rujjhe ne.)",
  "ਜੀ, ਘਰ ਦੇ ਵੱਡੇ ਬਾਹਰ ਗਏ ਨੇ। ਅਣਜਾਣ ਬੰਦੇ ਲਈ ਦਰਵਾਜ਼ਾ ਨਹੀਂ ਖੋਲ੍ਹਣਾ। (Ghar de vadde bahar gaye ne. Anjaan bande layi darwaza nahi kholna.)",
  "ਹੁਣ ਖਾਣਾ ਬਣਾ ਰਹੇ ਹਾਂ ਜੀ। ਤੁਹਾਡੀ ਪਛਾਣ ਨਹੀਂ, ਇੱਥੋਂ ਹੀ ਦੱਸ ਦਿਓ ਕੀ ਕੰਮ ਹੈ। (Hun khaana bana rahe haan ji. Tuhadi pachhaan nahi.)",
];

export const SIESTA_LINE = "ਦੁਪਹਿਰ ਨੂੰ ਸੌਂ ਰਹੇ ਹਾਂ ਜੀ। ਬਾਅਦ ਵਿੱਚ ਆਇਓ। (Dupehar nu saun rahe haan ji. Baad vich aayo.)";

/** One active visit with opening colliders, an escort indoors and contextual conversation. */
export class Doorbell {
  private visit: Visit | null = null;
  private doors: HomeDoors;
  private n = 0;
  private cool = 0;
  constructor(private host: DoorbellHost) { this.doors = new HomeDoors(host.scene, host.mats); }
  get busy(): boolean { return !!this.visit; }
  get state() { const v = this.visit; return v ? { house: v.h.id, stage: v.stage, person: v.r?.id, invited: v.stage === "leading" || v.stage === "inside" } : null; }
  ring(h: HouseBell): void {
    if (this.visit) { this.host.toast("Ruko ji, pehlan eh gall mukaa laiye."); return; }
    if (this.cool > 0) return;
    this.cool = 3;
    this.host.ring(new Vector3(h.bell.x, 1.5, h.bell.z));
    const gate = houseToWorld(h, h.gateU, -0.75);
    this.visit = { h, stage: "ringing", t: 0, r: null, gate: new Vector3(gate.x, 0, gate.z), door: new Vector3(h.frontDoor.x, 0, h.frontDoor.z), waypoint: 0, chatting: false };
  }
  private spawn(v: Visit): Resident {
    let seed = 7; for (const c of v.h.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const base = randomAppearance(seed % 9000 + 21000), family = familyOf(v.h.id);
    const r = this.host.crowd.spawn({ id: `bell_${v.h.id}_${this.n++}`, name: family ? `${family.surname} ji` : "Ghar wale", role: "chatter", indoor: true,
      look: { ...base, age: "adult", height: Math.max(1.6, base.height) }, x: v.door.x, z: v.door.z, yaw: v.h.rot });
    r.brain = () => undefined; return r;
  }
  private move(r: Resident, target: Vector3, dt: number): boolean {
    const dx = target.x - r.pos.x, dz = target.z - r.pos.z, distance = Math.hypot(dx, dz);
    if (distance < 0.2) { r.vel.scaleInPlace(Math.exp(-dt * 12)); return true; }
    r.vel.set(dx / distance * 1.2, 0, dz / distance * 1.2); r.facing = Math.atan2(dx, dz); return false;
  }
  private async invite(v: Visit): Promise<void> {
    const answer = await this.host.dialogue("neighbour", "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਅੰਦਰ ਆਓ, ਬੈਠ ਕੇ ਦੋ ਗੱਲਾਂ ਕਰੀਏ।<br>Sat sri akal ji! Andar aao, baith ke do gallan kariye.", [
      { label: "Haanji, andar chal ke gall karde haan", value: "in" }, { label: "Phir aavaanga ji", value: "leave" },
    ]);
    if (this.visit !== v) return;
    v.t = 0;
    if (answer !== "in") { v.stage = "closing"; return; }
    v.stage = "leading";
    this.host.toast("Aao ji, mere pichhe. Follow your host through the door.");
  }
  interactions() {
    const v = this.visit;
    if (!v || v.stage !== "inside" || !v.r || v.chatting) return [];
    return [{ id: `visit_${v.h.id}`, pos: v.r.pos, radius: 2.5, label: `Gall karo — ${v.r.name}`, run: async () => {
      v.chatting = true;
      try {
        const answer = await this.host.dialogue("neighbour", "ਆਓ ਜੀ, ਘਰ ਦੇ ਸਾਰੇ ਠੀਕ ਨੇ? ਅੱਜ ਕਿੱਧਰ ਚੱਕਰ ਲੱਗਿਆ?<br>Aao ji! Ghar de saare theek ne?", [
          { label: "Saare theek ne. Tusi sunao?", value: "family" }, { label: "Nave bypass te ki ki ae?", value: "area" }, { label: "Changa ji, hun chalda haan", value: "bye" },
        ]);
        await this.host.dialogue("neighbour", answer === "area" ? "ਦੱਖਣ ਵਾਲੇ ਬਾਈਪਾਸ ਤੇ ਨਵੀਂ ਮੰਡੀ ਤੇ ਬੱਸ ਅੱਡਾ ਹੈ। ਬੱਸ ਵੀ ਜਾਂਦੀ ਹੈ। Map vich 'Bypass' labh lo, rasta mil jaauga." : answer === "family" ? "ਰੱਬ ਦੀ ਮਿਹਰ ਜੀ! ਕੰਮ ਕਾਰ ਚੱਲ ਰਿਹਾ। ਆਉਂਦੇ ਜਾਂਦੇ ਰਿਹਾ ਕਰੋ, ਆਪਣਾ ਹੀ ਘਰ ਸਮਝੋ।" : "ਚੰਗਾ ਪੁੱਤਰਾ, ਧਿਆਨ ਨਾਲ ਜਾਈਂ। ਫਿਰ ਆਈਂ!", [{ label: "Theek ae ji", value: "ok" }]);
      } finally { v.chatting = false; }
    } }];
  }
  /** A voice from the house, if the sheet lets one play (it shows its own words); otherwise the scripted line. */
  private answer(when: VoiceWhen, v: Visit, scripted: string): void {
    if (this.host.say(when, v.r!) !== null) return;
    this.host.crowd.say(v.r!, scripted);
    this.host.toast(scripted);
  }

  update(dt: number): void {
    this.cool = Math.max(0, this.cool - dt);
    const p = this.host.playerPos(); this.doors.update(p);
    const v = this.visit; if (!v) return;
    v.t += dt;
    if (Math.hypot(p.x - v.h.bell.x, p.z - v.h.bell.z) > 45) { this.finish(v); return; }
    const home = OPEN_HOUSES.find(h => h.id === v.h.id)!;
    switch (v.stage) {
      case "ringing":
        if (v.t < 2) break;
        v.r = this.spawn(v); v.t = 0;
        const response = doorResponse(this.host.hour(), v.h.id === HOME_ID || !!familyOf(v.h.id));
        if (response === "night") {
          v.stage = "night";
          this.answer("doorbell-night", v, NIGHT_LINES[this.n % NIGHT_LINES.length]!);
        } else if (response === "siesta") {
          v.stage = "siesta";
          this.answer("doorbell-siesta", v, SIESTA_LINE);
        } else if (response === "stranger") {
          v.stage = "declined";
          this.answer("doorbell-stranger", v, STRANGER_LINES[this.n % STRANGER_LINES.length]!);
        } else v.stage = "opening";
        break;
      case "declined":
      case "night":
      case "siesta": if (v.t > 8) this.finish(v); break;
      case "opening":
        this.doors.set(v.h.id, Math.min(1, v.t));
        if (v.t >= 1) { v.stage = "coming"; v.t = 0; v.r!.brain = (r, dt2) => { this.move(r, v.gate, dt2); }; }
        break;
      case "coming":
        if (Math.hypot(v.r!.pos.x - v.gate.x, v.r!.pos.z - v.gate.z) < 0.4) {
          v.r!.vel.setAll(0); v.r!.brain = () => undefined; v.r!.anim.play("greet", 1.5);
          v.stage = "inviting"; void this.invite(v);
        }
        break;
      case "leading": {
        const inside = houseToWorld(v.h, v.h.doorU + v.h.doorW / 2, -v.h.yd - 1.2);
        const targets = [v.door, new Vector3(inside.x, 0, inside.z), new Vector3(home.talk.x, 0, home.talk.z)];
        v.r!.brain = (r, dt2) => { if (this.move(r, targets[v.waypoint]!, dt2)) { v.waypoint++; if (v.waypoint >= targets.length) { v.stage = "inside"; v.t = 0; r.vel.setAll(0); r.brain = () => undefined; } } };
        break;
      }
      case "inside":
        if (v.t > 30 && (p.x < home.plot.x0 - 2 || p.x > home.plot.x1 + 2 || p.z < home.plot.z0 - 2 || p.z > home.plot.z1 + 2)) { v.stage = "closing"; v.t = 0; }
        break;
      case "closing":
        if (p.x > home.plot.x0 && p.x < home.plot.x1 && p.z > home.plot.z0 && p.z < home.plot.z1) break;
        this.doors.set(v.h.id, Math.max(0, 1 - v.t));
        if (v.t > 1.1) this.finish(v);
        break;
    }
  }
  private finish(v: Visit): void { if (v.r && this.host.crowd.residents.includes(v.r)) this.host.crowd.remove(v.r); this.doors.set(v.h.id, 0); this.visit = null; }
  dispose(): void { if (this.visit) this.finish(this.visit); this.doors.dispose(); }
}
