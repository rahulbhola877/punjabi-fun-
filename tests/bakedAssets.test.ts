import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("separate baked assets", () => {
  it("shares concurrent requests and returns cached geometry", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ meshes: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { preloadBakedAssets, bakedAsset } = await import("../src/world/bakedAssets");
    await Promise.all([preloadBakedAssets(), preloadBakedAssets()]);
    await preloadBakedAssets();
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(bakedAsset("pickup")).toEqual({ meshes: [] });
  });

  it("reports failed requests and retries after a network error", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockImplementation(async () => new Response(JSON.stringify({ meshes: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { preloadBakedAssets, bakedAsset } = await import("../src/world/bakedAssets");
    await expect(preloadBakedAssets()).rejects.toThrow(/HTTP 503/);
    await preloadBakedAssets();
    expect(bakedAsset("broadleaf")).toEqual({ meshes: [] });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("rejects malformed data rather than constructing an incomplete world", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    const { preloadBakedAssets } = await import("../src/world/bakedAssets");
    await expect(preloadBakedAssets()).rejects.toThrow(/Invalid .* geometry/);
  });
});
