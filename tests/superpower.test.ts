import { describe, expect, it } from "vitest";
import {
  DASH_COOLDOWN, DASH_SECONDS, DASH_SPEED, GLIDE_FALL, GLIDE_SECONDS, JUMP_MUL, POWER_SECONDS, Superpower,
} from "../src/characters/Superpower";

const DT = 1 / 60;

describe("a superpower", () => {
  it("lasts for its thirty seconds, and then the ordinary world is back", () => {
    const p = new Superpower();
    expect(p.active).toBe(false);
    p.start();
    for (let t = 0; t < POWER_SECONDS - 1; t += DT) p.update(DT, true);
    expect(p.active).toBe(true);
    for (let t = 0; t < 2; t += DT) p.update(DT, true);
    expect(p.active).toBe(false);
  });

  it("jumps higher while the power is on", () => {
    const p = new Superpower();
    expect(p.jumpSpeed(8)).toBe(8);
    p.start();
    expect(p.jumpSpeed(8)).toBeCloseTo(8 * JUMP_MUL, 9);
  });

  it("glides on a jump: the fall is held to a gentle descent, only in the air, with jump held, and only while powered", () => {
    const p = new Superpower();
    expect(p.glide(-10, DT, true, false)).toBe(-10);
    p.start();
    expect(p.glide(-10, DT, false, false)).toBe(-10);
    expect(p.glide(-10, DT, true, true)).toBe(-10);
    expect(p.glide(-10, DT, true, false)).toBeCloseTo(-GLIDE_FALL, 9);
    expect(p.glide(5, DT, true, false)).toBe(5);
  });

  it("glides for at most its time, and gets a glide back on landing", () => {
    const p = new Superpower();
    p.start();
    let vy = -10;
    for (let t = 0; t < GLIDE_SECONDS + 0.5; t += DT) vy = p.glide(-10, DT, true, false);
    expect(vy).toBe(-10);
    p.update(DT, true);
    expect(p.glide(-10, DT, true, false)).toBeCloseTo(-GLIDE_FALL, 9);
  });

  it("dashes forward at dash speed for a moment, then waits before the next dash", () => {
    const p = new Superpower();
    expect(p.dash(0, 1)).toBeNull();
    p.start();
    expect(p.dash(0, 1)).toEqual({ x: 0, z: DASH_SPEED });
    expect(p.dashing).toBe(true);
    expect(p.dash(1, 0)).toBeNull();
    for (let t = 0; t < DASH_SECONDS + 0.05; t += DT) p.update(DT, false);
    expect(p.dashing).toBe(false);
    for (let t = 0; t < DASH_COOLDOWN; t += DT) p.update(DT, false);
    expect(p.dash(1, 0)).toEqual({ x: DASH_SPEED, z: 0 });
  });
});
