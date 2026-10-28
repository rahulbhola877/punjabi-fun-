import { describe, expect, it } from "vitest";
import { CHASE_RANGE, CHASE_TIME, chaseOver } from "../src/combat/Jhagde";
import { onRoad } from "../src/world/region";

describe("a rival chase", () => {
  it("goes on while you are within reach and it has not run too long", () => {
    expect(chaseOver(10, 40)).toBe(false);
    expect(chaseOver(CHASE_TIME, CHASE_RANGE)).toBe(false);
  });

  it("gives up when you are beyond its range, or when it has run its time", () => {
    expect(chaseOver(10, CHASE_RANGE + 1)).toBe(true);
    expect(chaseOver(CHASE_TIME + 0.1, 20)).toBe(true);
  });
});

describe("the G.T. Road", () => {
  it("is the highway across the country, along z = -160", () => {
    expect(onRoad(500, -160)?.name).toBe("G.T. Road");
    expect(onRoad(500, -90)?.name).not.toBe("G.T. Road");
  });
});
