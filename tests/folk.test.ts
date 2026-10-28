import { describe, expect, it } from "vitest";
import { countryFolk } from "../src/crowds/countryFolk";
import { isOpenGround } from "../src/world/layout";
import { court } from "../src/minigames/Kabaddi";

describe("country population", () => {
  const { groups } = countryFolk();
  it("puts people along the roads, not on buildings or in the canal", () => {
    const road = groups.filter((g) => g.id.startsWith("road_"));
    expect(road.length).toBeGreaterThan(15);
    // Shopkeepers stand behind their counters, inside the shop (tests/shops.test.ts).
    for (const g of groups) for (const d of g.defs) if (d.role !== "seated" && d.role !== "walker" && !g.id.startsWith("shopKeep") && !g.id.startsWith("civicClerks")) expect(isOpenGround(d.x, d.z), `${g.id}/${d.id} at ${d.x},${d.z}`).toBe(true);
  });
  it("keeps the kabaddi warm-up off the court, where a match spawns its own players", () => {
    const c = court();
    const warm = groups.find((g) => g.id === "kabaddiWarm")!;
    expect(warm.defs.length).toBeGreaterThanOrEqual(4);
    for (const d of warm.defs) expect(Math.hypot(d.x - c.cx, d.z - c.cz)).toBeGreaterThan(c.r + 2);
  });
  it("has police on duty without any crime (city beat and a G.T. Road naka)", () => {
    const cops = groups.flatMap((g) => g.defs).filter((d) => d.faction === "police");
    expect(cops.length).toBeGreaterThanOrEqual(6);
    expect(groups.find((g) => g.id === "naka")!.defs.length).toBe(3);
  });
});
