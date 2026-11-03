import { describe, expect, it } from "vitest";
import { onForestChannel } from "../src/world/forestChannelLayout";
import { grassy } from "../src/world/grass";

describe("forest channel ground cover", () => {
  it("clears the channel banks, both outlets and the wider pool bed", () => {
    for (const [x, z] of [[-872.5, 1923.5], [-886, 1908], [-879, 1904.5], [-891.6, 1904]]) {
      expect(onForestChannel(x!, z!)).toBe(true);
      expect(grassy(x!, z!, [])).toBe(false);
    }
  });

  it("keeps the exclusion local to the channel", () => {
    expect(onForestChannel(-871, 1921)).toBe(false);
    expect(onForestChannel(-893, 1904)).toBe(false);
    expect(onForestChannel(-800, 1900)).toBe(false);
  });
});
