import { describe, expect, it } from "vitest";
import { grassy } from "../src/world/grass";

const field = { x0: -860, x1: -840, z0: 30, z1: 50 };

describe("field ground cover", () => {
  it("allows grass on the bund but keeps the cultivated middle clear", () => {
    expect(grassy(-859.5, 40, [field])).toBe(true);
    expect(grassy(-850, 40, [field])).toBe(false);
  });

  it("keeps grass off roads even when a field edge is nearby", () => {
    expect(grassy(-850, -160, [{ x0: -860, x1: -840, z0: -160, z1: -140 }])).toBe(false);
  });

  it("keeps grass off the bridge pavement beyond the roadway", () => {
    expect(grassy(5, 170, [])).toBe(false);
  });

  it("keeps the home street's pavement clear of grass cards", () => {
    expect(grassy(66.25, -35.4, [])).toBe(false);
    expect(grassy(73.75, -35.4, [])).toBe(false);
  });

  it("keeps streamed grass out of the orchard shelter and its benches", () => {
    expect(grassy(371, 1344, [])).toBe(false);
    expect(grassy(371, 1345.8, [])).toBe(false);
    expect(grassy(376, 1344, [])).toBe(true);
  });
});
