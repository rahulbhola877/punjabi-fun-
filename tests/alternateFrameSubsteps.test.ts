import { describe, expect, it } from "vitest";
import { ForegroundFrameClock, forEachFrameSubstep } from "../src/alternate/frameSubsteps";
import { canDriveSpace, canWalkSpace } from "../src/alternate/spaceMap";
import { canWalkPixel, collectPixelLanterns } from "../src/alternate/pixelMap";

describe("alternate world foreground timing", () => {
  it("preserves full foreground time, including frames longer than the old caps", () => {
    const clock = new ForegroundFrameClock();
    expect(clock.read(12, false)).toBe(0); // Opening never inherits parent-scene time.
    for (const seconds of [1 / 60, 0.2, 0.9, 1.25]) {
      expect(clock.preview(seconds, false)).toBe(seconds);
      expect(clock.read(seconds, false)).toBe(seconds);
      const steps: number[] = [];
      forEachFrameSubstep(seconds, dt => steps.push(dt));
      expect(steps.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(seconds, 12);
      expect(Math.max(...steps)).toBeLessThanOrEqual(1 / 60);
    }
  });

  it("discards paused time and the resume interval without retaining catch-up debt", () => {
    const clock = new ForegroundFrameClock();
    clock.read(0, false);
    expect(clock.read(0.2, false)).toBe(0.2);
    expect(clock.read(60, true)).toBe(0);
    expect(clock.read(30, true)).toBe(0);
    expect(clock.preview(20, false)).toBe(0); // Input camera timing also resets.
    expect(clock.read(20, false)).toBe(0);
    expect(clock.read(0.2, false)).toBe(0.2);
  });

  it("resets when hide/show or blur occurs entirely between rendered frames", () => {
    const clock = new ForegroundFrameClock();
    clock.read(0, false);
    clock.interrupt();
    clock.interrupt();
    expect(clock.preview(90, false)).toBe(0);
    expect(clock.read(90, false)).toBe(0);
    expect(clock.read(0.4, false)).toBe(0.4);
  });

  it("ignores invalid time without issuing simulation steps", () => {
    const clock = new ForegroundFrameClock();
    clock.read(0, false);
    for (const seconds of [NaN, Infinity, -Infinity, -1, 0]) {
      expect(clock.read(seconds, false)).toBe(0);
      let calls = 0;
      forEachFrameSubstep(seconds, () => calls++);
      expect(calls).toBe(0);
    }
  });
});

describe("alternate world collision substeps", () => {
  const walk = (fps: number, seconds: number, speed: number, dx: number, dz: number): number => {
    const p = { x: 0, z: 0 }, length = Math.hypot(dx, dz);
    for (let frame = 0; frame < seconds * fps; frame++) {
      forEachFrameSubstep(1 / fps, dt => { p.x += dx / length * speed * dt; p.z += dz / length * speed * dt; });
    }
    return Math.hypot(p.x, p.z);
  };

  it("keeps walking/running distance at 1, 5 and 60 FPS without diagonal bonuses", () => {
    for (const speed of [3.3, 3.6, 5.5, 6]) {
      for (const fps of [1, 5, 60]) {
        expect(walk(fps, 2, speed, 0, 1)).toBeCloseTo(speed * 2, 10);
        expect(walk(fps, 2, speed, 1, 1)).toBeCloseTo(speed * 2, 10);
      }
    }
  });

  it("stops the fastest lunar burst at the actual narrow canister footprint", () => {
    const p = { x: -20, z: -9.7 };
    // A single endpoint test would skip the whole canister at this speed.
    expect(canWalkSpace(p.x + 18 * 0.25, p.z)).toBe(true);
    forEachFrameSubstep(0.25, dt => {
      if (canWalkSpace(p.x + 18 * dt, p.z)) p.x += 18 * dt;
    });
    expect(p.x).toBeLessThanOrEqual(-18.125);
    expect(p.x).toBeGreaterThan(-18.5);
    expect(canWalkSpace(p.x, p.z)).toBe(true);
  });

  it("keeps a maximum-speed rover outside equipment during a long foreground frame", () => {
    const p = { x: -22, z: -9.7 };
    expect(canDriveSpace(p.x + 10 * 2, p.z)).toBe(true);
    forEachFrameSubstep(2, dt => {
      if (canDriveSpace(p.x + 10 * dt, p.z)) p.x += 10 * dt;
    });
    expect(p.x).toBeLessThanOrEqual(-18.125);
    expect(canDriveSpace(p.x, p.z)).toBe(true);
  });

  it("cannot cross Pixel trees or the river during a slow running frame", () => {
    const tree = { x: 1.5, y: 3.72 }, river = { x: 18.5, y: 10.5 };
    forEachFrameSubstep(1.2, dt => {
      for (const p of [tree, river]) if (canWalkPixel(p.x + 5.5 * dt, p.y)) p.x += 5.5 * dt;
    });
    expect(tree.x).toBeLessThanOrEqual(3.04);
    expect(river.x).toBeLessThanOrEqual(19.78);
    expect(canWalkPixel(tree.x, tree.y)).toBe(true);
    expect(canWalkPixel(river.x, river.y)).toBe(true);
  });

  it("collects a lantern crossed mid-frame even when the endpoint is beyond it", () => {
    const p = { x: 13, y: 22.5 }, found = new Set<number>();
    forEachFrameSubstep(0.9, dt => {
      if (canWalkPixel(p.x + 5.5 * dt, p.y)) p.x += 5.5 * dt;
      for (const i of collectPixelLanterns(p.x, p.y, found)) found.add(i);
    });
    expect(found).toEqual(new Set([1]));
    expect(collectPixelLanterns(p.x, p.y, new Set())).toEqual([]);
  });
});
