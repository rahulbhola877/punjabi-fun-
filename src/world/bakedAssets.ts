import broadleafUrl from "./assets/broadleaf.json?url";
import cottageUrl from "./assets/cottage.json?url";
import cornerShopUrl from "./assets/cornerShop.json?url";
import pickupUrl from "../vehicles/assets/tunyard-pickup.json?url";

/** Large immutable geometry files are emitted separately so the browser can
 * cache and parse them as JSON instead of compiling them into the entry JS. */
const urls = { broadleaf: broadleafUrl, cottage: cottageUrl, cornerShop: cornerShopUrl, pickup: pickupUrl } as const;
export type BakedAssetId = keyof typeof urls;
const cache = new Map<BakedAssetId, unknown>();
const pending = new Map<BakedAssetId, Promise<void>>();

/** Place already-loaded geometry in the cache (also useful to non-browser callers). */
export function cacheBakedAsset(id: BakedAssetId, data: unknown): void {
  if (!data || typeof data !== "object" || !Array.isArray((data as { meshes?: unknown }).meshes)) throw new Error(`Invalid ${id} geometry`);
  cache.set(id, data);
}

/** Retrieve geometry only after loading succeeds, with a useful failure if a caller forgot. */
export function bakedAsset<T>(id: BakedAssetId): T {
  const value = cache.get(id);
  if (!value) throw new Error(`Game geometry ${id} has not loaded`);
  return value as T;
}

/** Load in parallel, share concurrent requests and allow retry after failure. */
export async function preloadBakedAssets(): Promise<void> {
  await Promise.all((Object.keys(urls) as BakedAssetId[]).map(async (id) => {
    if (cache.has(id)) return;
    let task = pending.get(id);
    if (!task) {
      task = (async () => {
        const response = await fetch(urls[id]);
        if (!response.ok) throw new Error(`Could not load game geometry ${id} (HTTP ${response.status})`);
        cacheBakedAsset(id, await response.json());
      })().finally(() => pending.delete(id));
      pending.set(id, task);
    }
    await task;
  }));
}
