import { describe, expect, it } from "vitest";
import { grassy } from "../src/world/grass";
import { onParkPath, PARK_PATH_HALF_WIDTH } from "../src/world/parkPathLayout";
import { SITES } from "../src/world/region";

describe("park path grass clearance", () => {
  const park = SITES.find((site) => site.id === "santPark0")!;
  const cx = (park.x0 + park.x1) / 2, cz = (park.z0 + park.z1) / 2;

  it("clears both paving arms and the full width of a grass card", () => {
    const edge = PARK_PATH_HALF_WIDTH + 0.375;
    for (const [x, z] of [[cx + edge, cz + 5], [cx + 5, cz + edge], [cx, cz]]) {
      expect(onParkPath(park, x!, z!, 0.375)).toBe(true);
      expect(grassy(x!, z!, [])).toBe(false);
    }
    expect(onParkPath(park, cx + edge + 0.01, cz + 5, 0.375)).toBe(false);
    expect(onParkPath(park, cx + 5, cz + edge + 0.01, 0.375)).toBe(false);
  });

  it("leaves nearby park turf eligible for grass", () => {
    expect(grassy(cx + 5, cz + 5, [])).toBe(true);
  });
});
