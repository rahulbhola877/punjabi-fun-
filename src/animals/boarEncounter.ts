/** One opt-in forest encounter, separate from the roaming street-animal budget. */
export const BOAR_HOME = { x: -745, z: 1895 } as const;
export type BoarPhase = "waiting" | "charging" | "retreating" | "done";
export interface PointXZ { x: number; z: number }
export type BoarEvent = "hitPlayer" | "hit" | "repelled" | "escaped";

/**
 * A single boar waits until the player chooses to confront it. It pursues for
 * a bounded time and can be driven away by three well-timed close strikes.
 * Walking away or getting into a vehicle ends the encounter without a reward.
 * Position and timers are independent of rendering so the behavior can be
 * tested without a browser.
 */
export class BoarEncounter {
  phase: BoarPhase = "waiting";
  x: number = BOAR_HOME.x;
  z: number = BOAR_HOME.z;
  health = 3;
  facing = 0;
  private attackCooldown = 0;
  private playerCooldown = 0;
  private remaining = 0;
  private retreatTime = 0;

  reset(completed: boolean): void {
    this.phase = completed ? "done" : "waiting";
    this.x = BOAR_HOME.x; this.z = BOAR_HOME.z; this.health = 3;
    this.attackCooldown = this.playerCooldown = this.remaining = this.retreatTime = 0;
  }

  start(player: PointXZ): boolean {
    if (this.phase !== "waiting" || Math.hypot(player.x - this.x, player.z - this.z) > 4) return false;
    this.phase = "charging";
    this.health = 3; this.remaining = 35; this.attackCooldown = 0.7; this.playerCooldown = 0;
    return true;
  }

  /** A close unarmed strike, gated to the duration of the player's swing. */
  strike(player: PointXZ, yaw: number): BoarEvent | null {
    return this.tryHit(player, yaw, 2.3, 0.15, 0.75);
  }

  /** A fired shot is checked for sight-line occlusion by the game first. */
  shoot(player: PointXZ, yaw: number): BoarEvent | null {
    return this.tryHit(player, yaw, 22, 0.94, 0.45);
  }

  private tryHit(player: PointXZ, yaw: number, range: number, cone: number, cooldown: number): BoarEvent | null {
    if (this.phase !== "charging" || this.playerCooldown > 0) return null;
    const dx = this.x - player.x, dz = this.z - player.z, d = Math.hypot(dx, dz);
    if (d > range || d < 0.01 || (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d < cone) return null;
    this.playerCooldown = cooldown;
    if (--this.health > 0) return "hit";
    this.phase = "retreating";
    this.retreatTime = 5;
    return "repelled";
  }

  update(dt: number, player: PointXZ | null): BoarEvent | null {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.playerCooldown = Math.max(0, this.playerCooldown - dt);
    if (this.phase === "charging") {
      this.remaining -= dt;
      if (!player || this.remaining <= 0 || Math.hypot(player.x - BOAR_HOME.x, player.z - BOAR_HOME.z) > 35) {
        this.reset(false);
        return "escaped";
      }
      const dx = player.x - this.x, dz = player.z - this.z, d = Math.hypot(dx, dz);
      if (d > 0.001) {
        this.facing = Math.atan2(dx, dz);
        const step = Math.min(Math.max(0, d - 1.3), dt * 3.2);
        this.x += dx / d * step; this.z += dz / d * step;
      }
      if (Math.hypot(player.x - this.x, player.z - this.z) < 1.8 && this.attackCooldown <= 0) {
        this.attackCooldown = 2.5;
        return "hitPlayer";
      }
    } else if (this.phase === "retreating") {
      this.retreatTime -= dt;
      // Turn and run away from the player, but stay inside the ridge bounds.
      if (player) {
        const dx = this.x - player.x, dz = this.z - player.z, d = Math.hypot(dx, dz) || 1;
        this.facing = Math.atan2(dx, dz);
        this.x = Math.max(-955, Math.min(-345, this.x + dx / d * dt * 4));
        this.z = Math.max(1600, Math.min(2020, this.z + dz / d * dt * 4));
      }
      if (this.retreatTime <= 0) this.phase = "done";
    }
    return null;
  }
}
