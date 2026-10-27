import { Vector3 } from "../babylon";
import type { AudioSystem } from "../audio/Audio";
import type { Crowd, Resident } from "./Crowd";
import { Rng } from "../render/textures";
import { lifeAt } from "../world/zones";

/**
 * Street calls: the sabzi-wala shouting "Aaloo le lo!", the doodhwala at the
 * gate, the auto-wala at the stand barking his route — "Gill, Gill, Gill!",
 * "Ludhiana, Ludhiana!" — the bus conductor, the kabadi-wala.
 *
 * The point of this file is the *restraint*. A market with thirty vendors all
 * calling at once is unlistenable, so only one call is allowed to start at a
 * time, there is a floor on the gap between them, each seller then holds his
 * tongue for half a minute, and nobody calls at all unless the player is close
 * enough to be worth selling to. Busy places feel busy because the calls
 * overlap with the ambience and each other's tails — not because everyone
 * shouts at once.
 */

export type CallKind = "sabzi" | "fruit" | "doodh" | "chaat" | "auto" | "bus" | "kabadi";

/** How far a caller bothers to project, per trade. */
const RANGE: Record<CallKind, number> = {
  sabzi: 22, fruit: 22, chaat: 18, doodh: 26, auto: 28, bus: 32, kabadi: 30,
};


/** Greetings by voice and the named characters' own lines: [clip, bubble text]. */
const GREETS: Record<string, [string, string]> = {
  m1: ["greet_m1", "Sat Sri Akal ji! Ki haal ne?"],
  young: ["greet_young", "Oye, ki haal aa bai? Chadhdi kala!"],
  old: ["greet_old", "Jeonde raho puttar! Sab sukh-saand?"],
  f1: ["greet_f1", "Sat Sri Akal! Aaj badi jaldi vich ae?"],
  f2: ["greet_f2", "Haanji, ki gall ae? Theek-thaak?"],
  shopF: ["shop_aao", "Aao bhenji, aao! Ajj sab kujh sasta ae!"],
};
const NAMED_LINES: Record<string, [string, string]> = {
  masterji: ["masterji_naap", "Naap do vaari lao, kainchi ik vaari!"],
  sohal: ["sohal_race", "Ik din tainu gate tak race vich harauna ae!"],
  mrsKaur: ["mrskaur_chah", "Aa ja puttar, chah pee ke ja!"],
  gill: ["gill_vele", "Saade vele gali kachi si, par dil pakke si!"],
  chemist: ["chemist_paani", "Paani peeo ji, garmi bahut ae."],
  pammi: ["pammi_kinnow", "Kinnow from Abohar, sweet as gur!"],
};
/** Every clip the greeter may use (probed at start so missing files stay silent). */
export const GREET_CLIPS = [...Object.values(GREETS), ...Object.values(NAMED_LINES)].map((x) => x[0]).concat(["gossip_a", "gossip_b", "chat_match", "chat_petrol"]);

export class Barkers {
  private rng = new Rng(3131);
  /** Time until any caller may speak again. */
  private gap = 2;
  private scanT = 0;
  /** Per-resident silence, so one vendor does not dominate a street. */
  private quiet = new WeakMap<Resident, number>();
  private t = 0;
  /** Set false while a dialogue/menu is open. */
  enabled = true;

  constructor(private crowd: Crowd, _audio?: AudioSystem) {}

  /** Nearby callers, for the test probe. */
  nearby = 0;
  /** Greetings and chats played (for the probe). */
  spoken = 0;
  /** Is this seller at their cart/stall (or a tout at a stand)? Set by the game. */
  atStall: ((r: Resident) => boolean) | null = null;
  /** Say a line through the voice map; returns the clip, or null when nothing may be said. */
  speak: ((when: "pass-by" | "chat" | "street-call", r: Resident, from?: readonly string[], street?: boolean) => string | null) | null = null;

  /**
   * Passers-by and shopkeepers greet you as you walk (or ride slowly) past,
   * named characters with their own line; two people chatting on the street
   * now and then gossip aloud. Shares the street-call budget, so the street
   * never has more than one voice starting at once.
   */
  private greetT = 1;
  private greeted = new WeakMap<Resident, number>();
  greet(dt: number, player: Vector3, playerSpeed: number): void {
    this.greetT -= dt;
    if (!this.enabled || this.greetT > 0 || this.gap > 0 || !this.speak) return;
    this.greetT = 0.4;
    if (playerSpeed > 5) return;
    let best: Resident | null = null, bd = Infinity;
    for (const r of this.crowd.residents) {
      if (r.brain || r.pose === "down" || r.faction === "lafanga" || r.look.age === "child") continue;
      const d = Math.hypot(r.pos.x - player.x, r.pos.z - player.z);
      if (d > (r.role === "chatter" ? 11 : 8) || d >= bd) continue;
      if ((this.greeted.get(r) ?? -1e9) > this.t) continue;
      best = r; bd = d;
    }
    if (!best) return;
    const r = best;
    this.greeted.set(r, this.t + this.rng.range(60, 120));
    if (r.role === "chatter") {
      // A street chat overheard: one line each, both from the voice map ("chat").
      const partner = this.crowd.residents.find((o) => o !== r && o.role === "chatter" && Math.hypot(o.pos.x - r.pos.x, o.pos.z - r.pos.z) < 3);
      if (partner) this.greeted.set(partner, this.t + this.rng.range(60, 120));
      // Two women gossip (19 then 20); two men talk (21 then 22); mixed pairs keep it to themselves.
      if (!partner || partner.look.sex !== r.look.sex) return;
      const women = r.look.sex === "f";
      // Their own pair lines first; any other chat line while those are cooling down.
      const first = this.speak("chat", r, women ? ["gossip_a"] : ["chat_match"]) ?? this.speak("chat", r);
      if (!first) return;
      this.gap = 6.5;
      this.spoken++;
      r.anim.play("talk", 2.5);
      setTimeout(() => { if (this.enabled && (this.speak!("chat", partner, women ? ["gossip_b"] : ["chat_petrol"]) ?? this.speak!("chat", partner))) partner.anim.play("argue", 1.5); }, 3200);
      return;
    }
    if (!this.speak("pass-by", r)) return;
    this.gap = 4.5;
    this.spoken++;
    r.lookTarget = player.clone();
    r.anim.play("greet", 1.8);
  }


  update(dt: number, player: Vector3): void {
    this.t += dt;
    this.gap -= dt;
    this.scanT -= dt;
    if (!this.enabled || this.scanT > 0) return;
    this.scanT = 0.5;
    const ready: Resident[] = [];
    let seen = 0;
    for (const r of this.crowd.residents) {
      if (!r.callKind || !r.calls?.length || r.pose === "down" || r.brain) continue;
      // Sellers call only from their cart or stall, never while wandering.
      if (this.atStall && !this.atStall(r)) continue;
      const d = Math.hypot(r.pos.x - player.x, r.pos.z - player.z);
      if (d > RANGE[r.callKind]) continue;
      seen++;
      if ((this.quiet.get(r) ?? 0) > this.t) continue;
      ready.push(r);
    }
    this.nearby = seen;
    if (this.gap > 0 || !ready.length) return;
    // A crowded bazaar calls more often than a lone cart on a link road, but
    // never faster than one call every couple of seconds.
    // A market calls; a residential street mostly does not.
    const calls = lifeAt(player.x, player.z).calls;
    if (calls <= 0.02) { this.gap = 6; return; }
    this.gap = Math.max(5, this.rng.range(9, 16) / (Math.max(1, Math.min(3, seen)) * calls));
    const r = this.rng.pick(ready);
    this.quiet.set(r, this.t + this.rng.range(40, 80));
    r.lookTarget = player.clone();
    r.anim.play(r.callKind === "auto" || r.callKind === "bus" ? "point" : "talk", 2);
    // The voice map decides which recording (if any) this seller may call;
    // the bubble shows its words. With no recording allowed, just a bubble.
    const clip = this.speak?.("street-call", r, undefined, true);
    if (!clip) this.crowd.say(r, this.rng.pick(r.calls!));
  }
}
