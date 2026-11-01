/**
 * Free-roam superpowers: higher jumps, a held-jump glide and a dash. They can
 * stay enabled until the player switches them off. With free-roam powers off,
 * a desi ghee laddoo still grants a temporary version with a limited glide.
 * The character controller asks this class what to do each frame.
 */

/** How long the laddoo's power lasts, in seconds. */
export const POWER_SECONDS = 30;
/** The jump speed is multiplied by this while powered. */
export const JUMP_MUL = 1.8;
/** A glide lasts at most this long (seconds, refilled on landing), and holds the fall to this speed (m/s, down). */
export const GLIDE_SECONDS = 2.5;
export const GLIDE_FALL = 1.5;
/** A dash: this speed (m/s) for this long (seconds), and the wait before the next (seconds). */
export const DASH_SPEED = 16;
export const DASH_SECONDS = 0.3;
export const DASH_COOLDOWN = 1.2;

export class Superpower {
  private left = 0;
  private alwaysOn = false;
  private glideLeft = 0;
  private dashLeft = 0;
  private cool = 0;

  /** Is the power on? */
  get active(): boolean {
    return this.alwaysOn || this.left > 0;
  }

  /** Free-roam powers stay available until the player switches them off. */
  get unlimited(): boolean { return this.alwaysOn; }

  setUnlimited(enabled: boolean): void {
    this.alwaysOn = enabled;
    if (enabled) this.glideLeft = GLIDE_SECONDS;
    else { this.left = 0; this.glideLeft = 0; this.dashLeft = 0; this.cool = 0; }
  }

  /** Is a dash still carrying you? */
  get dashing(): boolean {
    return this.dashLeft > 0;
  }

  /** The laddoo: the power starts (or starts again) for POWER_SECONDS. */
  start(): void {
    this.left = POWER_SECONDS;
    this.glideLeft = GLIDE_SECONDS;
  }

  /** Per frame: count the power and its parts down; a glide is ready again once you are back on the ground. */
  update(dt: number, grounded: boolean): void {
    this.left = Math.max(0, this.left - dt);
    this.cool = Math.max(0, this.cool - dt);
    this.dashLeft = Math.max(0, this.dashLeft - dt);
    if (grounded) this.glideLeft = GLIDE_SECONDS;
  }

  /** The take-off speed for a jump: higher while the power is on. */
  jumpSpeed(base: number): number {
    return this.active ? base * JUMP_MUL : base;
  }

  /**
   * In the air with jump held: the fall is held to GLIDE_FALL for as long as the glide lasts. Returns the new
   * vertical speed (rising is never touched).
   */
  glide(vy: number, dt: number, jumpHeld: boolean, grounded: boolean): number {
    if (!this.active || grounded || !jumpHeld || (!this.alwaysOn && this.glideLeft <= 0)) return vy;
    if (!this.alwaysOn) this.glideLeft = Math.max(0, this.glideLeft - dt);
    return Math.max(vy, -GLIDE_FALL);
  }

  /**
   * The kick button, while powered: a dash forward along (fwdX, fwdZ), if the dash is ready. Returns the horizontal
   * velocity to dash at, or null.
   */
  dash(fwdX: number, fwdZ: number): { x: number; z: number } | null {
    if (!this.active || this.cool > 0) return null;
    this.cool = DASH_COOLDOWN;
    this.dashLeft = DASH_SECONDS;
    return { x: fwdX * DASH_SPEED, z: fwdZ * DASH_SPEED };
  }
}
