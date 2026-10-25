import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { Scene, ShadowGenerator } from "../babylon";

type Timer = { counter: { count: number; lastSecAverage: number } };
type TimedTarget = { gpuTimeInFrame?: Timer };
const milliseconds = (t?: Timer): number | null => t && t.counter.count > 0 ? t.counter.lastSecAverage / 1e6 : null;

/** Modern WebGPU exposes pass timestamps, not encoder.writeTimestamp.
 * These are individual passes, deliberately not labelled whole-frame GPU time. */
export function gpuPassTimings(engine: AbstractEngine, scene: Scene, shadows: ShadowGenerator | null) {
  if (!engine.isWebGPU) return null;
  const main = engine as AbstractEngine & { gpuTimeInFrameForMainPass?: Timer };
  const sceneTarget = scene.prePassRenderer?.getRenderTarget().renderTarget as TimedTarget | undefined;
  const shadowTarget = shadows?.getShadowMap()?.renderTarget as TimedTarget | undefined;
  return { main: milliseconds(main.gpuTimeInFrameForMainPass), scene: milliseconds(sceneTarget?.gpuTimeInFrame), shadow: milliseconds(shadowTarget?.gpuTimeInFrame) };
}
