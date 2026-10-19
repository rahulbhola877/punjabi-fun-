/**
 * Versioned save format with validation and migration. Pure functions so
 * they can be unit tested without a browser.
 */
export const SAVE_VERSION = 2;
export const SAVE_KEY = "pfs.save";
export const SETTINGS_KEY = "pfs.settings.v1";

export type Medal = "gold" | "silver" | "bronze";

export interface SavedVehicle { id: string; type: "scooter" | "auto"; x: number; y: number; z: number; yaw: number; paint: string }

export interface SaveData {
  version: number;
  savedAt: string;
  player: { look: string; x: number; y: number; z: number; yaw: number };
  money: number;
  rep: number;
  /** Intro mission stage index, -1 = not started, 999 = complete. */
  introStage: number;
  flags: Record<string, boolean>;
  unlockedVehicles: Array<"scooter" | "auto">;
  upgrades: string[];
  paints: string[];
  vehicles: SavedVehicle[];
  medals: Record<string, Medal>;
  bests: Record<string, number>;
  stats: { deliveries: number; failed: number; distance: number };
  /** Purchased outfit colours by part (top/head/drape/bottom). */
  outfit: Record<string, string>;
}

export function newSave(look: string, start: { x: number; z: number; yaw: number }, vehicles: SavedVehicle[]): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    player: { look, x: start.x, y: 0.2, z: start.z, yaw: start.yaw },
    money: 50,
    rep: 0,
    introStage: 0,
    flags: {},
    unlockedVehicles: ["scooter", "auto"],
    upgrades: [],
    paints: ["mint", "cng"],
    vehicles,
    medals: {},
    bests: {},
    stats: { deliveries: 0, failed: 0, distance: 0 },
    outfit: {},
  };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export class SaveError extends Error {}

/** Older formats → current. Version 0 was an unreleased prototype without stats. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let v = isNum(raw.version) ? raw.version : 0;
  const out = { ...raw };
  if (v < 1) {
    out.stats = isObj(out.stats) ? out.stats : { deliveries: 0, failed: 0, distance: 0 };
    v = 1;
  }
  if (v < 2) {
    // v2 added purchasable outfits.
    out.outfit = {};
    v = 2;
  }
  out.version = v;
  return out;
}

/**
 * Validates and sanitises untrusted JSON into SaveData. Throws SaveError with
 * a readable reason when the data cannot be used.
 */
export function validate(input: unknown, validLooks: string[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): SaveData {
  if (!isObj(input)) throw new SaveError("Save is not an object");
  if (isNum(input.version) && input.version > SAVE_VERSION) throw new SaveError(`Save is from a newer version (${input.version})`);
  const d = migrate(input);
  const p = d.player;
  if (!isObj(p)) throw new SaveError("Missing player");
  if (!isStr(p.look) || !validLooks.includes(p.look)) throw new SaveError("Unknown player look");
  for (const k of ["x", "y", "z", "yaw"]) if (!isNum(p[k])) throw new SaveError(`Bad player ${k}`);
  const clampX = (x: number) => Math.min(bounds.maxX, Math.max(bounds.minX, x));
  const clampZ = (z: number) => Math.min(bounds.maxZ, Math.max(bounds.minZ, z));
  if (!isNum(d.money) || d.money < 0) throw new SaveError("Bad money");
  if (!isNum(d.rep) || d.rep < 0) throw new SaveError("Bad reputation");
  if (!isNum(d.introStage)) throw new SaveError("Bad mission progress");
  const flags: Record<string, boolean> = {};
  if (isObj(d.flags)) for (const [k, v] of Object.entries(d.flags)) if (typeof v === "boolean") flags[k] = v;
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter(isStr) : []);
  const vehicles: SavedVehicle[] = [];
  const ids = new Set<string>();
  if (Array.isArray(d.vehicles)) {
    for (const v of d.vehicles) {
      if (!isObj(v) || !isStr(v.id) || ids.has(v.id)) continue;
      if (v.type !== "scooter" && v.type !== "auto") continue;
      if (![v.x, v.y, v.z, v.yaw].every(isNum)) continue;
      ids.add(v.id);
      vehicles.push({ id: v.id, type: v.type, x: clampX(v.x as number), y: Math.min(10, Math.max(0, v.y as number)), z: clampZ(v.z as number), yaw: v.yaw as number, paint: isStr(v.paint) ? v.paint : "mint" });
    }
  }
  const medals: Record<string, Medal> = {};
  if (isObj(d.medals)) for (const [k, v] of Object.entries(d.medals)) if (v === "gold" || v === "silver" || v === "bronze") medals[k] = v;
  const bests: Record<string, number> = {};
  if (isObj(d.bests)) for (const [k, v] of Object.entries(d.bests)) if (isNum(v) && v > 0) bests[k] = v;
  const st = isObj(d.stats) ? d.stats : {};
  const outfit: Record<string, string> = {};
  if (isObj(d.outfit)) for (const [k, v] of Object.entries(d.outfit)) if (["top", "head", "drape", "bottom"].includes(k) && isStr(v) && /^#[0-9a-f]{6}$/i.test(v)) outfit[k] = v;
  return {
    version: SAVE_VERSION,
    savedAt: isStr(d.savedAt) ? d.savedAt : new Date(0).toISOString(),
    player: { look: p.look as string, x: clampX(p.x as number), y: Math.min(30, Math.max(0, p.y as number)), z: clampZ(p.z as number), yaw: p.yaw as number },
    money: Math.floor(d.money),
    rep: Math.floor(d.rep),
    introStage: Math.floor(d.introStage),
    flags,
    unlockedVehicles: strArr(d.unlockedVehicles).filter((v): v is "scooter" | "auto" => v === "scooter" || v === "auto"),
    upgrades: strArr(d.upgrades),
    paints: strArr(d.paints),
    vehicles,
    medals,
    bests,
    stats: { deliveries: isNum(st.deliveries) ? st.deliveries : 0, failed: isNum(st.failed) ? st.failed : 0, distance: isNum(st.distance) ? st.distance : 0 },
    outfit,
  };
}

/** Storage abstraction so tests can inject a fake and failures are reported. */
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export type SaveResult = { ok: true } | { ok: false; error: string };

export function writeSave(kv: KV, data: SaveData): SaveResult {
  try {
    const json = JSON.stringify({ ...data, savedAt: new Date().toISOString() });
    kv.setItem(SAVE_KEY, json);
    // Read back to detect silently failing storage.
    if (kv.getItem(SAVE_KEY) !== json) return { ok: false, error: "Storage did not keep the save" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function readSave(kv: KV, validLooks: string[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): { data: SaveData | null; error?: string } {
  let raw: string | null;
  try {
    raw = kv.getItem(SAVE_KEY);
  } catch (e) {
    return { data: null, error: `Storage unavailable: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!raw) return { data: null };
  try {
    return { data: validate(JSON.parse(raw), validLooks, bounds) };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Corrupt save" };
  }
}
