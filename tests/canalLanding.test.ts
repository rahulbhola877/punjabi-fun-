import { describe, expect, it } from "vitest";
import { CANAL, GHAT, ROADS, isOpenCountry } from "../src/world/region";
import { CANAL_LANDING, inCanalLandingTreeReserve, onCanalGroveSurface, onCanalLanding } from "../src/world/canalLandingLayout";
import { grassy } from "../src/world/grass";
import { hillY } from "../src/world/hillTerrain";

describe("canal ghat landing", () => {
  it("keeps a clear connection between the road and the existing steps", () => {
    expect(CANAL_LANDING.x).toBe(GHAT.x);
    for (const z of [180.5, 182, 184, 186, 187.5]) expect(onCanalLanding(GHAT.x, z)).toBe(true);
    const road = ROADS.find((r) => r.id === "col_estateCanal")!;
    expect(road.z0).toBe(188);
    expect(CANAL.z1).toBe(178);
    expect(onCanalLanding(GHAT.x, road.z0)).toBe(true);
  });
  it("keeps grass and roadside tree trunks off the walking surface", () => {
    for (const [x, z] of [[45, 180.5], [45, 184], [38.5, 182.5], [51.5, 182.5]]) {
      expect(grassy(x!, z!, [])).toBe(false);
      expect(inCanalLandingTreeReserve(x!, z!)).toBe(true);
    }
    expect(inCanalLandingTreeReserve(72, 181.5)).toBe(false);
  });
  it("connects the south-bank clearing to the road over flat open ground", () => {
    for (const [x, z] of [[34, 145], [34, 141], [34, 139], [32, 134.5], [30, 130], [30, 127], [18, 136], [41, 136], [21, 117]]) {
      expect(isOpenCountry(x!, z!)).toBe(true);
      expect(hillY(x!, z!)).toBe(0);
    }
    for (const [x, z] of [[34, 145], [34, 139], [32, 134.5], [30, 130], [30, 127]]) {
      expect(onCanalGroveSurface(x!, z!)).toBe(true);
      expect(grassy(x!, z!, [])).toBe(false);
    }
  });
});
