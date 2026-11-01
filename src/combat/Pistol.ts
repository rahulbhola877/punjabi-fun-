import { Vector3 } from "../babylon";
import type { Resident } from "../crowds/Crowd";

/** Saved ammunition is stored in the existing bag; equipped state is session-only. */
export interface PistolHost {
  ammo(): number;
  consume(): void;
  player(): { pos: Vector3; yaw: number; down: boolean };
  residents(): readonly Resident[];
  blocked(from: Vector3, to: Vector3): boolean;
  hit(r: Resident, from: Vector3): void;
  shot(pos: Vector3): void;
}

/** A short-range, cone-aimed sidearm; walls block it and every shot consumes one round. */
export class Pistol {
  equipped = false;
  private cooldown = 0;
  constructor(private host: PistolHost) {}
  update(dt: number): void { this.cooldown = Math.max(0, this.cooldown - dt); }
  toggle(): boolean { this.equipped = !this.equipped; return this.equipped; }
  fire(): "cooldown" | "empty" | "shot" | "hit" {
    const p = this.host.player();
    if (!this.equipped || p.down || this.cooldown > 0) return "cooldown";
    if (this.host.ammo() <= 0) return "empty";
    this.cooldown = 0.45;
    this.host.consume();
    const from = p.pos.add(new Vector3(0, 1.2, 0));
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    let best: Resident | null = null, score = Infinity;
    for (const r of this.host.residents()) {
      if (r.away || r.pose === "down" || r.role === "child" || r.look.age === "child" || r.contact) continue;
      const dx = r.pos.x - p.pos.x, dz = r.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3 || d > 22 || Math.abs(r.pos.y - p.pos.y) > 2) continue;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < 0.94) continue;
      const to = r.pos.add(new Vector3(0, 1.0, 0));
      if (this.host.blocked(from, to)) continue;
      const s = d + (1 - dot) * 20;
      if (s < score) { best = r; score = s; }
    }
    this.host.shot(from);
    if (best) { this.host.hit(best, p.pos); return "hit"; }
    return "shot";
  }
}
