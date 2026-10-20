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
export interface VoiceRule { on: boolean; who: string[]; when: string[]; maxDist: number; gap: number; /** The words, shown in the speech bubble. */ say: string }

const RULES = MAP as Record<string, VoiceRule>;

/** The moments a line can be spoken (the "When" codes). */
export type VoiceWhen =
  | "talk" | "mission-start" | "mission-shop" | "mission-end" | "pass-by" | "chat" | "street-call" | "bumped" | "hit"
  | "police-chase" | "police-bribe" | "police-jeep" | "lafanga-taunt" | "gang-fight" | "quarrel-start" | "quarrel-blows"
  | "aunty-quarrel-start" | "aunty-quarrel-blows" | "quarrel-onlooker" | "blame-both" | "road-rage" | "safari-hit"
  | "auto-tipped" | "ride-jolt" | "dangal-start";

/** A speaker: a resident, or a stand-in for voices without one (the police jeep, a passenger). */
export type Speaker = Resident | { group: string; pos: Vector3 };

export class VoiceDirector {
  private last = new Map<string, number>();
  private lastOf = new Map<string, string>();

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
        case "shopkeeper-man": if (man && r.role === "keeper" && !r.contact) return true; break;
        case "shopkeeper-woman": if (woman && r.role === "keeper" && !r.contact) return true; break;
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
    if (Vector3.Distance(sp.pos, listener) > rule.maxDist) return false;
    return now - (this.last.get(clip) ?? -1e9) >= rule.gap;
  }

  /**
   * Pick the clip this speaker may say at this moment (or null for silence).
   * `from` limits the choice to particular clips (e.g. a named line); when
   * several fit, the last one picked for this moment is avoided.
   */
  pick(when: VoiceWhen, sp: Speaker, listener: Vector3, from?: readonly string[], available?: (clip: string) => boolean): string | null {
    const now = performance.now() / 1000;
    const names = from ?? Object.keys(RULES);
    let fit = names.filter((c) => RULES[c] && this.ok(c, RULES[c]!, when, sp, listener, now) && (!available || available(c)));
    if (!fit.length) return null;
    // A character's own lines beat the lines for their group.
    if (!("group" in sp)) { const own = fit.filter((c) => RULES[c]!.who.includes(sp.id)); if (own.length) fit = own; }
    const prev = this.lastOf.get(when);
    const pool = fit.length > 1 ? fit.filter((c) => c !== prev) : fit;
    const clip = pool[Math.floor(Math.random() * pool.length)]!;
    this.last.set(clip, now);
    this.lastOf.set(when, clip);
    return clip;
  }

  /** Is this one clip allowed right now (marks it as played if so)? */
  allow(clip: string, when: VoiceWhen, sp: Speaker, listener: Vector3): boolean {
    return this.pick(when, sp, listener, [clip]) === clip;
  }

  /** The rule for a clip (for the probe and tests). */
  static rule(clip: string): VoiceRule | undefined {
    return RULES[clip];
  }
}
