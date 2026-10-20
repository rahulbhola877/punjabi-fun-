import { Vector3 } from "../babylon";
import type { AudioSystem } from "../audio/Audio";
import type { Crowd, Resident } from "./Crowd";
import { Rng } from "../render/textures";

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

/** Rough syllable count, so the synthesised call matches the written line. */
function syllables(text: string): number {
  return Math.max(2, Math.min(6, (text.match(/[aeiouAEIOU]+/g) ?? []).length));
}

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

  constructor(private crowd: Crowd, private audio: AudioSystem) {}

  /** Nearby callers, for the test probe. */
  nearby = 0;

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
    this.gap = Math.max(2.2, this.rng.range(5.5, 9) / Math.max(1, Math.min(4, seen)));
    const r = this.rng.pick(ready);
    this.quiet.set(r, this.t + this.rng.range(16, 34));
    const line = this.rng.pick(r.calls!);
    this.crowd.say(r, line);
    r.lookTarget = player.clone();
    r.anim.play(r.callKind === "auto" || r.callKind === "bus" ? "point" : "talk", 2);
    // A recorded take when one has been dropped in for this trade, otherwise
    // the synthesised cry. Both are positional and both respect the budget.
    if (r.callClip && this.audio.hasClip(r.callClip)) this.audio.callClip(r.callClip, r.pos);
    else this.audio.cry(r.callKind!, r.pos, syllables(line));
  }
}
