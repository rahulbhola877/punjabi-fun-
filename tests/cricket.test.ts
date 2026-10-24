import { describe, expect, it } from "vitest";
import { BALLS, FLIGHT, TARGET, WICKETS, ballAt, judge, over, pitch, park, type Delivery } from "../src/minigames/Cricket";
import { Rng } from "../src/render/textures";
import { SITES } from "../src/world/region";

const d = (speed: "slow" | "medium" | "fast", line: -1 | 0 | 1 = 0): Delivery => ({ speed, line, flight: FLIGHT[speed] });

describe("tape-ball cricket", () => {
  it("rewards a swing as the ball arrives, and punishes one that is early or late", () => {
    const m = d("medium", 1);
    expect(judge(m.flight, m, 1).kind).toBe("six");
    expect(judge(m.flight, m, 0).kind).toBe("four");
    expect(judge(m.flight + 0.1, m, 1)).toMatchObject({ kind: "four", runs: 4 });
    expect(judge(m.flight - 0.18, m, 0)).toMatchObject({ kind: "two", runs: 2 });
    expect(judge(m.flight + 0.28, m, 0)).toMatchObject({ kind: "one", runs: 1 });
    expect(judge(m.flight + 0.5, m, 0).kind).toBe("miss");
    expect(judge(m.flight - 0.6, m, 0).kind).toBe("early");
    // A slow ball sent right on the middle goes the distance whichever way you stand.
    expect(judge(FLIGHT.slow, d("slow"), 0).kind).toBe("six");
  });

  it("bowls an over of six, quicker as it goes", () => {
    const o = over(new Rng(4));
    expect(o).toHaveLength(BALLS);
    expect(o[0]!.speed).toBe("slow");
    expect(o.some((x) => x.speed === "fast")).toBe(true);
    for (const x of o) expect(x.flight).toBe(FLIGHT[x.speed]);
    expect(TARGET).toBeLessThan(BALLS * 6);
    expect(WICKETS).toBe(2);
  });

  it("flies the ball from the bowler to the batter with one bounce", () => {
    const from = { x: 10, z: 0 }, to = { x: 0, z: 0 };
    const a = ballAt(0, 1.2, from, to), end = ballAt(1.2, 1.2, from, to);
    expect(a.x).toBe(10); expect(a.y).toBeGreaterThan(1.3);
    expect(end.x).toBeCloseTo(0, 5);
    expect(end.y).toBeGreaterThan(0.6); expect(end.y).toBeLessThan(1.2);
    let low = 9;
    for (let t = 0; t <= 1.2; t += 0.02) low = Math.min(low, ballAt(t, 1.2, from, to).y);
    expect(low).toBeLessThan(0.15);
  });

  it("is played on the pitch in the park near home", () => {
    const p = park(), s = SITES.find((q) => q.id === "santPark0")!;
    expect(p.cx).toBeGreaterThan(s.x0);
    const pt = pitch();
    expect(Math.hypot(pt.bowl.x - pt.bat.x, pt.bowl.z - pt.bat.z)).toBeGreaterThan(9);
    expect(pt.bat.x).toBeGreaterThan(s.x0 + 4);
    expect(pt.bowl.x).toBeLessThan(s.x1 - 4);
  });
});
