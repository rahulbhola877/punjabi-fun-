import { Vector3 } from "../babylon";
import type { Resident } from "../crowds/Crowd";
import MAP from "./voiceMap.json";

/**
 * Who may say which recorded line, when, and from how far away — read from
 * src/audio/voiceMap.json, which is made from docs/voice-map.xlsx by
 * `python3 tools/voice_map.py import <file>`. Every recorded voice line in the
 * game goes through here, so a clip plays only for the speaker and moment the
 * sheet gives it, only when that speaker is within its distance of the player,
 * and never twice inside its gap. Anything not allowed stays silent.
 */
export interface VoiceRule { on: boolean; who: string[]; when: string[]; maxDist: number; gap: number; /** The words, shown in the speech bubble. */ say: string; /** Recorded voice (letter on the sheet): decides whether a man or a woman may say it. */ voice?: string; /** A greeting: repeats on its own gap, not the 90 s minimum. */ greet?: boolean }

/** Voices on the sheet recorded by men, and by women (the rest are unknown). */
const MALE_VOICES = new Set(["A", "D", "E", "F", "G", "P", "R", "S"]);
const FEMALE_VOICES = new Set(["B", "C", "Q"]);

const RULES = MAP as Record<string, VoiceRule>;
/** No clip but a greeting repeats sooner than this, whatever the sheet says (seconds). */
export const MIN_GAP = 90;

/** The moments a line can be spoken (the "When" codes). */
export type VoiceWhen =
  | "talk" | "mission-start" | "mission-shop" | "mission-end" | "pass-by" | "chat" | "street-call" | "bumped" | "hit"
  | "police-chase" | "police-bribe" | "police-jeep" | "lafanga-taunt" | "gang-fight" | "quarrel-start" | "quarrel-blows"
  | "aunty-quarrel-start" | "aunty-quarrel-blows" | "quarrel-onlooker" | "blame-both" | "road-rage" | "safari-hit"
  | "auto-tipped" | "ride-jolt" | "dangal-start" | "fight-start" | "fight-onlooker" | "meet" | "meet-reply"
  | "colony-fight-start" | "colony-fight-blows" | "crash-drivers" | "police-patrol" | "snake-hit"
  /** The player squaring up to an old uncle. */
  | "fight-elder";

/** How much a moment matters: a line of a higher one may wait its turn, a lower one is dropped. */
export function priority(when: VoiceWhen): 1 | 2 | 3 {
  if (when === "talk" || when.startsWith("mission") || when === "meet" || when === "meet-reply") return 3;
  if (when === "pass-by" || when === "chat" || when === "street-call") return 1;
  return 2;
}

/** Seconds since any line started before a line of this priority may start. */
const SPACING: Record<1 | 2 | 3, number> = { 1: 8, 2: 2, 3: 0 };

/** Where the player is and how they are moving. */
export interface VoiceContext { driving: boolean; speed: number }

/** A speaker: a resident, or a stand-in for voices without one (the police jeep, a passenger). */
export type Speaker = Resident | { group: string; pos: Vector3 };

export class VoiceDirector {
  private last = new Map<string, number>();
  private lastOf = new Map<string, string>();
  /** When the last line of any kind started. */
  private lastAny = -1e9;
  /** Why the last `pick` gave silence (for ?voicelog). */
  why = "";

  /** Does this speaker fit one of a rule's "Who" codes? */
  static fits(sp: Speaker, who: string[]): boolean {
    if (who.includes("anyone")) return true;
    if ("group" in sp) return who.includes(sp.group);
    const r = sp;
    if (who.includes(r.id)) return true;
    // Named characters say only the lines that list them by name.
    if (r.contact) return false;
    const man = r.look.sex === "m" && r.look.age !== "child", woman = r.look.sex === "f" && r.look.age !== "child";
    const name = r.name.toLowerCase();
    for (const g of who) {
      switch (g) {
        case "any-man": if (man && r.look.age !== "elder") return true; break;
        case "young-man": if (man && r.look.age === "adult" && r.look.beard !== "full") return true; break;
        case "any-woman": if (woman && r.look.age !== "elder") return true; break;
        case "any-elder": if (r.look.age === "elder") return true; break;
        // Only people who keep a real shop: not drivers, havaldars or cart-walas.
        case "shopkeeper-man": if (man && r.shop) return true; break;
        case "shopkeeper-woman": if (woman && r.shop) return true; break;
        case "aunty": if (woman) return true; break;
        case "police": if (r.faction === "police") return true; break;
        case "lafanga": if (r.faction === "lafanga") return true; break;
        case "auto-wala": if (r.callKind === "auto") return true; break;
        case "bus-conductor": if (r.callKind === "bus") return true; break;
        case "sabzi-wala": if (r.callKind === "sabzi") return true; break;
        case "fruit-wala": if (r.callKind === "fruit") return true; break;
        case "chaat-wala": if (r.callKind === "chaat") return true; break;
        case "doodh-wala": if (r.callKind === "doodh") return true; break;
        case "kabadi-wala": if (r.callKind === "kabadi") return true; break;
        case "driver": if (name.includes("driver")) return true; break;
        case "passenger": if (name.includes("passenger") || name.includes("sawari") || name.includes("safari")) return true; break;
        case "onlooker": return true;
      }
    }
    return false;
  }

  private ok(clip: string, rule: VoiceRule, when: VoiceWhen, sp: Speaker, listener: Vector3, now: number): boolean {
    if (!rule.on || !rule.when.includes(when) || !VoiceDirector.fits(sp, rule.who)) return false;
    // A man's recording is never said by a woman, nor a woman's by a man.
    if (!("group" in sp) && rule.voice) {
      if (MALE_VOICES.has(rule.voice) && sp.look.sex === "f") return false;
      if (FEMALE_VOICES.has(rule.voice) && sp.look.sex === "m") return false;
    }
    if (Vector3.Distance(sp.pos, listener) > rule.maxDist) return false;
    return now - (this.last.get(clip) ?? -1e9) >= (rule.greet ? rule.gap : Math.max(MIN_GAP, rule.gap));
  }

  /**
   * Pick the clip this speaker may say at this moment (or null for silence).
   * `from` limits the choice to particular clips (e.g. a named line); when
   * several fit, the last one picked for this moment is avoided.
   */
  pick(when: VoiceWhen, sp: Speaker, listener: Vector3, from?: readonly string[], available?: (clip: string) => boolean, dry = false, ctx?: VoiceContext, now = performance.now() / 1000): string | null {
    const pr = priority(when);
    // Street talk (greetings, chats, sellers' calls) is for someone on foot or
    // crawling past, never for a player driving down the road.
    if (pr === 1 && ctx && (ctx.driving ? ctx.speed > 2 : ctx.speed > 6)) { this.why = `moving (${ctx.driving ? "driving" : "on foot"} ${ctx.speed.toFixed(1)} m/s)`; return null; }
    if (!dry && now - this.lastAny < SPACING[pr]) { this.why = `spacing (${(now - this.lastAny).toFixed(1)} s since the last line)`; return null; }
    const names = from ?? Object.keys(RULES);
    let fit = names.filter((c) => RULES[c] && this.ok(c, RULES[c]!, when, sp, listener, now) && (!available || available(c)));
    if (!fit.length) { this.why = "no rule fits (who/when/distance/repeat gap)"; return null; }
    // A character's own lines beat the lines for their group.
    if (!("group" in sp)) { const own = fit.filter((c) => RULES[c]!.who.includes(sp.id)); if (own.length) fit = own; }
    const prev = this.lastOf.get(when);
    const pool = fit.length > 1 ? fit.filter((c) => c !== prev) : fit;
    const clip = pool[Math.floor(Math.random() * pool.length)]!;
    if (dry) return clip;
    this.lastAny = now;
    this.last.set(clip, now);
    this.lastOf.set(when, clip);
    return clip;
  }

  /** Is this one clip allowed right now (marks it as played if so)? */
  allow(clip: string, when: VoiceWhen, sp: Speaker, listener: Vector3): boolean {
    return this.pick(when, sp, listener, [clip]) === clip;
  }

  /** The words of every enabled clip that names this character. */
  static linesFor(id: string): string[] {
    return Object.values(RULES).filter((r) => r.on && r.who.includes(id) && r.say).map((r) => r.say);
  }

  /** The rule for a clip (for the probe and tests). */
  static rule(clip: string): VoiceRule | undefined {
    return RULES[clip];
  }
}
