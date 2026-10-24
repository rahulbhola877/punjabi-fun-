import { describe, expect, it } from "vitest";
import { nextStation, stationName, STATIONS } from "../src/audio/Radio";

describe("the radio dial", () => {
  it("N goes through the four stations and then turns the radio off", () => {
    let id = nextStation(null);
    const seen: Array<string | null> = [id];
    for (let i = 0; i < 4; i++) { id = nextStation(id); seen.push(id); }
    expect(seen).toEqual(["bhangra", "purane", "gurbani", "talk", null]);
  });
  it("has a name and a frequency for each station", () => {
    expect(STATIONS.length).toBe(4);
    for (const s of STATIONS) expect(stationName(s.id)).toBe(`${s.name} ${s.mhz}`);
    expect(stationName(null)).toBe("Radio off");
  });
});
