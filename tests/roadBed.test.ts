import { describe, expect, it } from "vitest";
import { levelOf } from "../src/audio/Audio";

/** A stand-in for an AudioBuffer: levelOf only reads its first channel. */
const buffer = (samples: number[]) => ({ getChannelData: () => Float32Array.from(samples) }) as unknown as AudioBuffer;

describe("the recorded road loop's level", () => {
  it("measures the average loudness and the loudest sample of a buffer", () => {
    const { rms, peak } = levelOf(buffer([0.5, -0.5, 0.5, -0.5]));
    expect(rms).toBeCloseTo(0.5, 6);
    expect(peak).toBeCloseTo(0.5, 6);
  });

  it("takes the peak as the largest magnitude, whichever way the sample swings", () => {
    expect(levelOf(buffer([0.1, -0.8, 0.2])).peak).toBeCloseTo(0.8, 6);
  });

  it("never divides by a silent buffer", () => {
    const { rms, peak } = levelOf(buffer([0, 0, 0]));
    expect(rms).toBeGreaterThan(0);
    expect(peak).toBeGreaterThan(0);
  });
});
