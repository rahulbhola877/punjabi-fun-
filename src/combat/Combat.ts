import { Vector3 } from "../babylon";
import type { Crowd, Resident } from "../crowds/Crowd";
import type { Player } from "../characters/Player";
import type { Gesture } from "../characters/HumanAnimator";
import { Rng } from "../render/textures";

/**
 * Punjabi street scuffles ("ladai-jhagde"): fists, the open-hand chapet,
 * shoves and the constable's lathi — slapstick, never gory. Everyone who
 * fights has hit points; at zero they go down seeing stars for a few
 * seconds and then get up, embarrassed. Pure game logic: rendering and
 * sound go through the host.
 */

export type Side = "player" | "foe" | "neutral";
export type Move = "punch" | "punchL" | "slap" | "shove" | "lathi" | "kick" | "knee" | "brick";

interface MoveDef { gesture: Gesture; dur: number; hitAt: number; reach: number; dmg: number; push: number; heavy?: boolean }

export const MOVES: Record<Move, MoveDef> = {
  punch: { gesture: "punch", dur: 0.42, hitAt: 0.17, reach: 1.35, dmg: 12, push: 1.6 },
  punchL: { gesture: "punchL", dur: 0.42, hitAt: 0.17, reach: 1.35, dmg: 12, push: 1.6 },
  slap: { gesture: "slap", dur: 0.6, hitAt: 0.3, reach: 1.25, dmg: 22, push: 3.2, heavy: true },
  shove: { gesture: "shove", dur: 0.5, hitAt: 0.2, reach: 1.3, dmg: 5, push: 4.2 },
  lathi: { gesture: "lathi", dur: 0.75, hitAt: 0.42, reach: 1.7, dmg: 10, push: 2.2 },
  // Slower than a punch and easier to miss, but it reaches further and hurts.
  kick: { gesture: "kick", dur: 0.62, hitAt: 0.28, reach: 1.75, dmg: 18, push: 3.6, heavy: true },
  // Close in, where a punch has no room: the hardest thing in the game.
  knee: { gesture: "knee", dur: 0.5, hitAt: 0.22, reach: 1.0, dmg: 20, push: 1.4, heavy: true },
  // Both hands, a half-brick, straight down. Ends most arguments.
  brick: { gesture: "brick", dur: 0.78, hitAt: 0.5, reach: 1.5, dmg: 34, push: 2.6, heavy: true },
};

/**
 * Tap repeatedly and the combo walks through it: jab, cross, a knee if they
 * are right on top of you, then the chapet to finish. Holding a brick
 * replaces the lot (see `playerAttack`).
 */
const PLAYER_COMBO: Move[] = ["punch", "punchL", "knee", "kick", "slap"];

export interface FightState {
  side: Side;
  /** Who this fighter is after: the player or another person. */
  target: "player" | Resident | null;
  cd: number;
  /** Current swing (null when not attacking). */
  swing: { move: Move; t: number; done: boolean } | null;
  stagger: number;
  downT: number;
  /** After getting up: flee or stand down until this many seconds pass. */
  cool: number;
  moves: Move[];
  speed: number;
  /** Damage multiplier for this fighter's blows. */
  power: number;
  /** Stays within this ring (dangal); leaving it loses the bout. */
  ring?: { x: number; z: number; r: number };
  /** Called once when this fighter is knocked out. */
  onDown?: () => void;
  /** Walking away from the scene (police going back to their tea). */
  leave?: boolean;
}

export interface CombatHost {
  player: Player;
  crowd: Crowd;
  /** Feet position of the player (null while in a vehicle). */
  playerFeet(): Vector3 | null;
  say(r: Resident, text: string): void;
  sound(kind: "punch" | "slap" | "whoosh" | "thud", pos: Vector3, strength: number): void;
  /** Player hit a person who was not fighting them (for police interest). */
  onAssault(r: Resident, knockedOut: boolean): void;
  /** A recorded line from a resident (optional: falls back to the bubble). */
  voice?(clip: string, pos: Vector3): void;
  /** As `voice`, but picks from a pool without repeating the last one. */
  voicePick?(key: string, pool: string[], pos: Vector3): void;
  /** Say a recorded line if the voice map allows this speaker at this moment. */
  speak?(when: "hit", who: Resident): void;
  /** A resident has just picked a fight with the player. */
  onFightStart?(r: Resident): void;
  /** The brick broke or was thrown away, so the HUD can stop showing it. */
  onBrickLost?(): void;
  onPlayerDown(): void;
  onFoeDown(r: Resident): void;
  shake(strength: number): void;
}

/** The player takes a fraction of the knockback a resident does. */
const PLAYER_KNOCK = 0.4;
const HIT_LINES = ["Hai!", "Oye hoye!", "Uff!", "Mera daand!", "Hai mummy!", "Oho!", "Ahh!", "Bas kar!", "Lagg gayi!", "Oye maaria!", "Hatt!", "Chhad de!"];
const HARD_HIT_LINES = ["Hai oye!", "Teri bhen di!", "Mere naal panga?!", "Khad, tainu dasda haan!", "Fuddu ho gia hai tu!", "Hai rabba, mar gaya!", "Haddi tod ditti!", "Police nu bulao!", "Eh ki si?!", "Mera sir!"];
const DOWN_LINES = ["Taare dikh gaye…", "Mummy ji…", "Main theek haan… shayad.", "Kithe aa main?"];
const GETUP_LINES = ["Chal koi na, phir milange!", "Galti ho gayi paaji!", "Main taan mazaak kar reha si!", "Aaj chhadd dinda haan!"];
const TAUNT_LINES = ["Aaja, aaja!", "Dekh lavanga tainu!", "Pehlwan banda ae tu?", "Aa ja mukabla kar!", "Hor ki haal?"];
/** What the other fellow says when HIS punch lands on you. */
const GLOAT_LINES = ["Lai, kha!", "Hor la!", "Dassan hor?", "Mere naal panga?", "Seekh gaya?", "Fuddu ho gia hai tu!", "Haun bol!"];
/** And when you go down in front of the whole bazaar. */
const FINISH_LINES = ["Bas? Ethe hi mukk gaya?", "Utth, utth, natak na kar.", "Pehlwan ji so gaye.", "Agli vaar soch ke panga lavin."];

export class Combat {
  readonly fights = new Map<Resident, FightState>();
  hp = 100;
  readonly maxHp = 100;
  private sinceHurt = 99;
  private combo = 0;
  private comboT = 0;
  private swing: { move: Move; t: number; done: boolean } | null = null;
  private downT = 0;
  private rng = new Rng(99);
  /** Seconds since the player last threw or took a blow (HUD and music use it). */
  sinceAction = 99;

  constructor(private host: CombatHost) {}

  get inFight(): boolean {
    for (const f of this.fights.values()) if (f.side === "foe" && f.downT <= 0 && f.cool <= 0 && f.target === "player") return true;
    return false;
  }

  get playerDown(): boolean {
    return this.downT > 0;
  }

  /** The knock-out timer ran out (the game then revives the player). */
  get readyToWake(): boolean {
    return this.downT > 0 && this.downT <= 0.001;
  }

  /** Make someone fight (the player by default). */
  engage(r: Resident, opts: Partial<FightState> = {}): FightState {
    let f = this.fights.get(r);
    const wasAfterPlayer = !!f && f.side === "foe" && f.target === "player";
    if (!f) {
      f = {
        side: "foe", target: "player", cd: this.rng.range(0.4, 1.0), swing: null, stagger: 0, downT: 0, cool: 0,
        moves: r.faction === "police" ? ["lathi", "shove", "kick"] : ["punch", "punchL", "slap", "shove", "kick", "knee"],
        speed: r.faction === "police" ? 4.6 : 3.6, power: r.faction === "wrestler" ? 1.3 : 1,
      };
      this.fights.set(r, f);
      r.wait = 0;
    }
    Object.assign(f, opts);
    if (opts.cool === undefined) f.cool = 0;
    // Someone squaring up to the player: a shout, and a bystander's "ki ho gaya?".
    if (!wasAfterPlayer && f.side === "foe" && f.target === "player" && r.faction !== "police") this.host.onFightStart?.(r);
    r.brain = (rr, dt) => this.brain(rr, dt);
    if (f.side === "foe" && r.bubbleCooldown <= 0) this.host.say(r, this.rng.pick(TAUNT_LINES));
    return f;
  }

  /** Release someone back to their normal routine. */
  release(r: Resident): void {
    if (!this.fights.has(r)) return;
    this.fights.delete(r);
    r.brain = null;
    r.pose = r.role === "seated" ? "sit" : "stand";
    r.vel.setAll(0);
    r.path = [];
    r.pathI = 0;
    r.wait = 1;
    r.hp = r.maxHp;
  }

  /** Player pressed attack (on foot). */
  /**
   * Half a brick, picked up off the street. One swing does most of a
   * person's health and then it is gone — thrown down, like they always are.
   */
  brick = false;
  private brickSwings = 0;

  /** Pick one up (the game spawns them near kilns, building work and fights). */
  takeBrick(): void {
    this.brick = true;
    this.brickSwings = 0;
  }

  /** Drop it: used up, knocked out of your hand, or you got into a vehicle. */
  dropBrick(): void {
    this.brick = false;
    this.brickSwings = 0;
  }

  /**
   * `heavy` is the second fight button: one deliberate boot rather than the
   * next step of the jab combo — or the brick swing when you are carrying
   * one. It does not advance the combo, so you can mix it in.
   */
  playerAttack(heavy = false): void {
    const p = this.host.player;
    if (this.downT > 0 || this.swing) return;
    if (this.comboT <= 0) this.combo = 0;
    let move = heavy ? "kick" as Move : PLAYER_COMBO[this.combo % PLAYER_COMBO.length]!;
    // A brick in your hand is the only move you have, and the only one you need.
    if (this.brick) move = "brick";
    // The knee only makes sense in a clinch; at arm's length throw a kick.
    else if (move === "knee" && !this.bestTarget(MOVES.knee.reach, 0.2)) move = "kick";
    // A heavy lands in a clinch as a knee — it reads better than a boot to
    // someone who is already chest to chest with you.
    else if (heavy && this.bestTarget(MOVES.knee.reach, 0.3)) move = "knee";
    if (!heavy) this.combo++;
    this.comboT = 0.9;
    const m = MOVES[move];
    this.swing = { move, t: 0, done: false };
    p.anim.play(m.gesture, m.dur);
    p.frozen = m.dur * 0.7;
    this.sinceAction = 0;
    // Turn toward the nearest person in reach so blows land where you mean them.
    const t = this.bestTarget(m.reach + 0.8, 0.0);
    if (t) p.yaw = Math.atan2(t.pos.x - p.feet.x, t.pos.z - p.feet.z);
    this.host.sound("whoosh", p.feet, move === "brick" ? 0.9 : 0.5);
    if (this.brick && ++this.brickSwings >= 2) { this.dropBrick(); this.host.onBrickLost?.(); }
  }

  private bestTarget(reach: number, minDot: number): Resident | null {
    const p = this.host.player, f = p.feet;
    const fwd = new Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    let best: Resident | null = null, bs = Infinity;
    for (const r of this.host.crowd.residents) {
      if (r.pose === "down" || r.role === "child" || r.role === "seated" || r.contact) continue;
      const dx = r.pos.x - f.x, dz = r.pos.z - f.z;
      const d = Math.hypot(dx, dz);
      if (d > reach || d < 1e-3 || Math.abs(r.pos.y - f.y) > 1.2) continue;
      const dot = (dx * fwd.x + dz * fwd.z) / d;
      if (dot < minDot) continue;
      const score = d - dot * 0.8 - (this.fights.get(r)?.side === "foe" ? 0.6 : 0);
      if (score < bs) { bs = score; best = r; }
    }
    return best;
  }

  /** Damage a person; returns true if it knocked them out. */
  hitResident(r: Resident, move: Move, from: Vector3, power = 1, byPlayer = false): boolean {
    const m = MOVES[move];
    const wasFoe = this.fights.get(r)?.side === "foe";
    r.hp -= m.dmg * power * (byPlayer ? 1 : 0.8);
    const dx = r.pos.x - from.x, dz = r.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    r.dodgeDir.set(dx / d, 0, dz / d);
    r.dodgeT = 0;
    this.host.sound(move === "slap" ? "slap" : "punch", r.pos, m.heavy ? 1 : 0.7);
    const f = this.fights.get(r) ?? (byPlayer ? this.provoked(r) : null);
    if (f) {
      f.stagger = m.heavy ? 0.65 : 0.38;
      f.swing = null;
      r.vel.set((dx / d) * m.push, 0, (dz / d) * m.push);
    }
    r.anim.play("hit", m.heavy ? 0.6 : 0.4);
    this.yelp(r, !!m.heavy);
    const ko = r.hp <= 0;
    if (ko) this.knockDown(r);
    if (byPlayer && !wasFoe) this.host.onAssault(r, ko);
    return ko;
  }

  /**
   * Everyone makes a noise when they are hit. The bubble always shows; the
   * recorded take is held back briefly per person so that a three-punch combo
   * is a yelp and a curse rather than three lines on top of each other.
   */
  private yelp(r: Resident, heavy: boolean): void {
    this.host.say(r, this.rng.pick(heavy ? HARD_HIT_LINES : HIT_LINES));
    const now = performance.now() / 1000;
    // Per person, and globally: two people hit in quick succession should not
    // both shout, and nobody should hear the same take twice in a row.
    if (now - (this.lastYelp.get(r) ?? -99) < 2.5 || now - this.anyYelp < 1.4) return;
    this.lastYelp.set(r, now);
    this.anyYelp = now;
    // Women and elders yelp; anyone else swears back at you.
    // Which lines a hit person may shout comes from the voice map ("hit").
    this.host.speak?.("hit", r);
  }
  private lastYelp = new WeakMap<Resident, number>();
  private anyYelp = -1e9;

  /** Someone the player hit decides whether to fight back or run. */
  private provoked(r: Resident): FightState | null {
    const timid = r.look.age === "elder" || (r.faction !== "lafanga" && r.faction !== "police" && this.rng.next() < 0.35);
    if (timid) {
      const f = this.engage(r, { side: "neutral", target: null, cool: 6 });
      this.host.say(r, this.rng.pick(["Bachao! Bachao!", "Police nu bulaavanga!", "Pagal ho gaya ae?"]));
      return f;
    }
    return this.engage(r, { side: "foe", target: "player" });
  }

  private knockDown(r: Resident): void {
    const f = this.fights.get(r) ?? this.engage(r, { side: "neutral", target: null });
    r.pose = "down";
    r.hp = 0;
    f.downT = this.rng.range(5, 8);
    f.swing = null;
    this.host.say(r, this.rng.pick(DOWN_LINES));
    this.host.sound("thud", r.pos, 1);
    f.onDown?.();
    if (f.side === "foe") this.host.onFoeDown(r);
  }

  /** A blow on the player. */
  hitPlayer(move: Move, from: Vector3, power: number, by?: Resident): void {
    if (this.downT > 0) return;
    const p = this.host.player, m = MOVES[move];
    this.hp -= m.dmg * power;
    this.sinceHurt = 0;
    this.sinceAction = 0;
    const f = p.feet, dx = f.x - from.x, dz = f.z - from.z, d = Math.hypot(dx, dz) || 1;
    // Knockback that reads on a resident sends the player skating halfway
    // down the street, because nothing but drag slows them. Keep the shove
    // readable and let the freeze below carry the weight of the blow.
    p.push((dx / d) * m.push * PLAYER_KNOCK, (dz / d) * m.push * PLAYER_KNOCK);
    p.frozen = Math.max(p.frozen, m.heavy ? 0.5 : 0.25);
    this.swing = null;
    p.anim.play("hit", m.heavy ? 0.55 : 0.35);
    this.host.sound(move === "slap" ? "slap" : "punch", f, m.heavy ? 1 : 0.7);
    this.host.shake(m.heavy ? 0.5 : 0.25);
    // A scuffle in silence is not a scuffle: whoever landed the blow crows
    // about it, held back by the bubble cooldown so it stays banter.
    if (by && by.bubbleCooldown <= 0) this.host.say(by, this.rng.pick(this.hp <= 0 ? FINISH_LINES : GLOAT_LINES));
    if (this.hp <= 0) {
      this.hp = 0;
      this.downT = 4;
      p.down = true;
      this.dropBrick();
      this.host.onBrickLost?.();
      this.host.sound("thud", f, 1);
      this.host.onPlayerDown();
    }
  }

  /** End every fight aimed at the player (they won, the police arrived, the player was knocked out…). */
  calmAll(): void {
    for (const [r, f] of this.fights) {
      if (f.target === "player") { f.target = null; f.side = "neutral"; f.cool = Math.max(f.cool, 2); }
      void r;
    }
  }

  /** Player got back up after being knocked out. */
  revivePlayer(hp = 40): void {
    this.downT = 0;
    this.hp = hp;
    this.host.player.down = false;
    this.host.player.anim.play("dizzy", 2.2);
  }

  fixedUpdate(dt: number): void {
    const p = this.host.player;
    this.sinceHurt += dt;
    this.sinceAction += dt;
    this.comboT -= dt;
    if (this.sinceHurt > 6 && this.hp < this.maxHp && this.downT <= 0) this.hp = Math.min(this.maxHp, this.hp + dt * 6);
    if (this.downT > 0) {
      this.downT -= dt;
      if (this.downT <= 0) this.downT = 0.0001; // the game revives the player (with consequences)
    }
    // The player's swing lands at its hit time.
    const s = this.swing;
    if (s) {
      s.t += dt;
      const m = MOVES[s.move];
      if (!s.done && s.t >= m.hitAt) {
        s.done = true;
        const t = this.bestTarget(m.reach, 0.35);
        if (t) this.hitResident(t, s.move, p.feet, 1, true);
      }
      if (s.t >= m.dur) this.swing = null;
    }
  }

  /** Per-step movement and attacks for everyone in a fight. */
  private brain(r: Resident, dt: number): void {
    const f = this.fights.get(r)!;
    if (f.downT > 0) {
      r.vel.setAll(0);
      f.downT -= dt;
      if (f.downT <= 0) {
        r.pose = "stand";
        r.hp = r.maxHp * 0.6;
        r.anim.play("dizzy", 2.5);
        f.cool = 7;
        f.target = null;
        f.side = "neutral";
        this.host.say(r, this.rng.pick(GETUP_LINES));
      }
      return;
    }
    if (f.stagger > 0) {
      f.stagger -= dt;
      r.vel.scaleInPlace(Math.exp(-dt * 6));
      return;
    }
    if (f.cool > 0 || !f.target) {
      // Standing down: drift away from the player, then go back to normal life.
      f.cool -= dt;
      const pf = this.host.playerFeet() ?? (f.leave ? this.host.player.capsuleCenter : null);
      if (pf && f.side === "neutral") {
        const dx = r.pos.x - pf.x, dz = r.pos.z - pf.z, d = Math.hypot(dx, dz) || 1;
        const sp = f.leave ? 1.5 : d < 8 ? 2.4 : 0;
        if (sp > 0.1) r.facing = Math.atan2(dx, dz);
        r.vel.x += ((dx / d) * sp - r.vel.x) * Math.min(1, dt * 5);
        r.vel.z += ((dz / d) * sp - r.vel.z) * Math.min(1, dt * 5);
      } else r.vel.scaleInPlace(Math.exp(-dt * 6));
      if (f.cool <= 0 && !f.target) this.release(r);
      return;
    }
    // Where is the target?
    let tp: Vector3 | null;
    if (f.target === "player") {
      tp = this.host.playerFeet();
      if (!tp || this.downT > 0) { f.target = null; f.side = "neutral"; f.cool = 3; return; }
    } else {
      if (f.target.pose === "down" || !this.host.crowd.residents.includes(f.target)) { f.target = null; f.cool = 3; return; }
      tp = f.target.pos;
    }
    const dx = tp.x - r.pos.x, dz = tp.z - r.pos.z, d = Math.hypot(dx, dz) || 1;
    r.facing = Math.atan2(dx, dz);
    r.lookTarget = tp.clone();
    // Swinging.
    if (f.swing) {
      f.swing.t += dt;
      const m = MOVES[f.swing.move];
      r.vel.scaleInPlace(Math.exp(-dt * 10));
      if (!f.swing.done && f.swing.t >= m.hitAt) {
        f.swing.done = true;
        if (d <= m.reach + 0.15) {
          if (f.target === "player") this.hitPlayer(f.swing.move, r.pos, f.power, r);
          else this.hitResident(f.target, f.swing.move, r.pos, f.power);
        } else this.host.sound("whoosh", r.pos, 0.4);
      }
      if (f.swing.t >= m.dur) f.swing = null;
      return;
    }
    f.cd -= dt;
    const want = 1.05;
    if (d > want) {
      // Close in (slower when circling near the target).
      const sp = d > 4 ? f.speed : 1.6;
      const av = this.host.crowd.avoid(r, null);
      r.vel.x += ((dx / d) * sp + av.x - r.vel.x) * Math.min(1, dt * 6);
      r.vel.z += ((dz / d) * sp + av.z - r.vel.z) * Math.min(1, dt * 6);
      if (r.anim.currentGesture === "none" && d < 5) r.anim.play("guard", 0.8);
    } else {
      r.vel.scaleInPlace(Math.exp(-dt * 8));
      if (r.anim.currentGesture === "none") r.anim.play("guard", 0.6);
    }
    // Keep inside a ring if one is set.
    if (f.ring) {
      const rx = r.pos.x - f.ring.x, rz = r.pos.z - f.ring.z, rd = Math.hypot(rx, rz);
      if (rd > f.ring.r - 0.6) { r.vel.x -= (rx / rd) * 2; r.vel.z -= (rz / rd) * 2; }
    }
    if (d <= 1.6 && f.cd <= 0) {
      const move = this.rng.pick(f.moves);
      const m = MOVES[move];
      f.swing = { move, t: 0, done: false };
      f.cd = this.rng.range(0.9, 1.7) / Math.max(0.6, f.power);
      r.anim.play(m.gesture, m.dur);
    }
  }
}
