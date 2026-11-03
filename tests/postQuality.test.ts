import { afterEach, expect, it, vi } from "vitest";
import { Game } from "../src/app/Game";

const created = vi.hoisted(() => [] as Array<{ ratio: { ssaoRatio: number; blurRatio: number }; samples: number; dispose: ReturnType<typeof vi.fn> }>);
vi.mock("../src/babylon", async importOriginal => {
  const actual = await importOriginal<typeof import("../src/babylon")>();
  return { ...actual, SSAO2RenderingPipeline: class {
    static IsSupported = true;
    samples = 0;
    dispose = vi.fn();
    constructor(_name: string, _scene: unknown, readonly ratio: { ssaoRatio: number; blurRatio: number }) { created.push(this); }
  } };
});
afterEach(() => { created.length = 0; vi.unstubAllGlobals(); });

it("switches High/Ultra AO allocations without changing full-resolution rendering", () => {
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("location", { search: "" });
  const state = {
    gfxLow: false, settings: { quality: "high", post: true, renderScale: 1 },
    engine: { setHardwareScalingLevel: vi.fn() },
    pipeline: { imageProcessing: {}, sharpen: {} },
    scene: { postProcessRenderPipelineManager: { detachCamerasFromRenderPipeline: vi.fn() } },
    cam: { camera: {} }, ssao: null, ssaoQuality: null,
  };
  const game = Object.assign(Object.create(Game.prototype), state) as { applyPost(): void };
  game.applyPost();
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ samples: 8, ratio: { ssaoRatio: 0.5, blurRatio: 0.5 } });
  state.settings.quality = "ultra";
  game.applyPost();
  expect(created).toHaveLength(2);
  expect(created[0]!.dispose).toHaveBeenCalledOnce();
  expect(created[1]).toMatchObject({ samples: 16, ratio: { ssaoRatio: 0.75, blurRatio: 0.75 } });
  game.applyPost();
  expect(created).toHaveLength(2); // Reapplying the same setting reuses resources.
  state.settings.quality = "high";
  game.applyPost();
  expect(created).toHaveLength(3);
  expect(created[1]!.dispose).toHaveBeenCalledOnce();
  expect(created[2]!.samples).toBe(8);
  state.settings.post = false;
  game.applyPost();
  expect(created[2]!.dispose).toHaveBeenCalledOnce();
  expect(state.engine.setHardwareScalingLevel.mock.calls.every(([scale]) => scale === 1)).toBe(true);
  expect(state.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline).toHaveBeenCalledTimes(3);
});
