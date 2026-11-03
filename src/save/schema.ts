/**
 * Versioned save format with validation and migration. Pure functions so
 * they can be unit tested without a browser.
 */
import { normalizeGaliCup, type GaliCupState } from "../missions/GaliCup";
import { normalizeBulletTrial, type BulletTrialState } from "../missions/BulletTrial";
import { normalizeKotliSelection, type KotliSelectionState } from "../missions/KotliSelection";
import { normalizeTractorSponsorship, type TractorSponsorshipState } from "../missions/TractorSponsorship";
import { VEHICLE_TYPES, type VehicleType } from "../vehicles/specs";
import type { PersonFile } from "../crowds/People";
import { emptyEcon, sanitizeEcon, type EconFile } from "../economy/Ledger";

export const SAVE_VERSION = 3;
export const SAVE_KEY = "pfs.save";
export const SETTINGS_KEY = "pfs.settings.v1";

export type Medal = "gold" | "silver" | "bronze";

export interface SavedVehicle { id: string; type: VehicleType; x: number; y: number; z: number; yaw: number; paint: string }

/** Optional v3 extension: one owner of the player's current paid delivery. */
export interface SavedDeliveryJob {
  kind: "delivery";
  destId: string;
  elapsed: number;
  par: number;
  limit: number;
  condition: number;
  routeLen: number;
}
export interface SavedTiffinJob {
  kind: "tiffin";
  day: number;
  hour: number;
  stops: string[];
  condition: number;
}
export type SavedActiveJob = SavedDeliveryJob | SavedTiffinJob;

export interface SaveStats {
  deliveries: number; failed: number; distance: number;
  /** v3: fights won, times knocked out, rupees paid to the police, auto passengers, dangal wins, quarrels calmed. */
  fightsWon: number; knockedOut: number; bribes: number; rides: number; dangalWins: number; calmed: number;
  /** v4: Mummy ji's tiffins delivered, all told. */
  tiffins: number;
}
const STAT_KEYS = ["deliveries", "failed", "distance", "fightsWon", "knockedOut", "bribes", "rides", "dangalWins", "calmed", "tiffins"] as const;
const isVehicleType = (v: unknown): v is VehicleType => (VEHICLE_TYPES as readonly unknown[]).includes(v);

export interface SaveData {
  version: number;
  savedAt: string;
  player: { look: string; x: number; y: number; z: number; yaw: number };
  money: number;
  rep: number;
  /** Intro mission stage index, -1 = not started, 999 = complete. */
  introStage: number;
  flags: Record<string, boolean>;
  unlockedVehicles: VehicleType[];
  upgrades: string[];
  paints: string[];
  vehicles: SavedVehicle[];
  medals: Record<string, Medal>;
  bests: Record<string, number>;
  stats: SaveStats;
  /** Purchased outfit colours by part (top/head/drape/bottom). */
  outfit: Record<string, string>;
  /** Goods you bought and carry (id → how many). Missing in older saves. */
  bag: Record<string, number>;
  /** Home life: the game day and what was done on which day (blessing, errand, meals). Missing in older saves. */
  home: Record<string, number>;
  /** The people who know the family: one small file each (see crowds/People.ts). Missing in older saves. */
  people: Record<string, PersonFile>;
  /** How much is in the tank of each vehicle you have driven (0 to 1). Missing in older saves. */
  fuel: Record<string, number>;
  /** Rupees in the bank (safe from a lighter pocket; earns a little each day). Missing in older saves. */
  bank: number;
  /** The books: money by what it was for, reputation by district, the tiffin round, the family's dues. Missing in older saves. */
  econ: EconFile;
  /** Missing in older saves. Passenger rides are deliberately not saveable yet. */
  activeJob?: SavedActiveJob | null;
  /** Optional v3 extension: Sant Nagar cup preparation and once-only records. */
  galiCup?: GaliCupState;
  /** Optional workshop riding trial; absent in older saves. */
  bulletTrial?: BulletTrialState;
  /** Optional village kabaddi selection, absent in older saves. */
  kotliSelection?: KotliSelectionState;
  /** Optional village tractor-race sponsorship, absent in older saves. */
  tractorSponsorship?: TractorSponsorshipState;
}

export function newSave(look: string, start: { x: number; z: number; yaw: number }, vehicles: SavedVehicle[]): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    player: { look, x: start.x, y: 0.2, z: start.z, yaw: start.yaw },
    money: 20000,
    rep: 0,
    introStage: 0,
    flags: {},
    unlockedVehicles: ["scooter", "auto"],
    upgrades: [],
    paints: ["mint", "cng"],
    vehicles,
    medals: {},
    bests: {},
    stats: { deliveries: 0, failed: 0, distance: 0, fightsWon: 0, knockedOut: 0, bribes: 0, rides: 0, dangalWins: 0, calmed: 0, tiffins: 0 },
    outfit: {},
    bag: {},
    home: {},
    people: {},
    fuel: {},
    bank: 0,
    econ: emptyEcon(0),
    activeJob: null,
  };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Reject damaged optional job data without discarding the player's historical save. */
export function sanitizeActiveJob(value: unknown): SavedActiveJob | null {
  if (!isObj(value)) return null;
  const id = (v: unknown): v is string => isStr(v) && /^[a-z0-9_]{1,40}$/i.test(v);
  const range = (v: unknown, lo: number, hi: number): v is number => isNum(v) && v >= lo && v <= hi;
  if (!range(value.condition, 0, 100)) return null;
  if (value.kind === "delivery") {
    if (!id(value.destId) || !range(value.elapsed, 0, 1e7) || !range(value.par, 1, 1e6)
      || !range(value.limit, value.par, 1e7) || !range(value.routeLen, 0, 1e6)) return null;
    return { kind: "delivery", destId: value.destId, elapsed: value.elapsed, par: value.par,
      limit: value.limit, condition: value.condition, routeLen: value.routeLen };
  }
  if (value.kind === "tiffin") {
    if (!range(value.day, 0, 1e6) || !Number.isInteger(value.day) || !range(value.hour, 0, 24)
      || value.hour === 24 || !Array.isArray(value.stops) || value.stops.length > 4 || !value.stops.every(id)) return null;
    const stops = [...new Set(value.stops as string[])];
    if (!stops.length) return null;
    return { kind: "tiffin", day: value.day, hour: value.hour, stops, condition: value.condition };
  }
  return null;
}

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
  if (v < 3) {
    // v3: the open world — new vehicle types (added by the game on load) and fight/ride stats.
    const st = isObj(out.stats) ? out.stats : {};
    out.stats = { ...st, fightsWon: 0, knockedOut: 0, bribes: 0, rides: 0, dangalWins: 0, calmed: 0 };
    v = 3;
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
      if (!isVehicleType(v.type)) continue;
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
  const bag: Record<string, number> = {};
  if (isObj(d.bag)) for (const [k, v] of Object.entries(d.bag)) if (/^[a-z0-9_]{1,24}$/i.test(k) && isNum(v) && v >= 1) bag[k] = Math.min(99, Math.floor(v));
  const home: Record<string, number> = {};
  if (isObj(d.home)) for (const [k, v] of Object.entries(d.home)) if (/^[a-z0-9_]{1,24}$/i.test(k) && isNum(v)) home[k] = v;
  // The first Amar challenge release used a 26-character receipt key, longer
  // than the generic home-key limit. Preserve that already-earned receipt.
  if (isObj(d.home) && d.home.canalChallengeRelationship === 1) home.canalChallengeReceipt = 1;
  const fuel: Record<string, number> = {};
  if (isObj(d.fuel)) for (const [k, v] of Object.entries(d.fuel)) if (/^[a-z0-9_]{1,40}$/i.test(k) && isNum(v)) fuel[k] = Math.max(0, Math.min(1, v));
  const people: Record<string, PersonFile> = {};
  if (isObj(d.people)) for (const [k, v] of Object.entries(d.people)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(k) || !isObj(v) || !isNum(v.rep) || !isNum(v.met)) continue;
    people[k] = { rep: Math.max(-10, Math.min(30, v.rep)), met: Math.max(0, Math.floor(v.met)), day: isNum(v.day) ? Math.floor(v.day) : -1, gifted: isNum(v.gifted) ? Math.floor(v.gifted) : -1, ...(typeof v.name === "string" && v.name ? { name: v.name.slice(0, 40), tie: typeof v.tie === "string" ? v.tie.slice(0, 120) : "" } : {}) };
  }
  return {
    version: SAVE_VERSION,
    savedAt: isStr(d.savedAt) ? d.savedAt : new Date(0).toISOString(),
    player: { look: p.look as string, x: clampX(p.x as number), y: Math.min(30, Math.max(0, p.y as number)), z: clampZ(p.z as number), yaw: p.yaw as number },
    money: Math.floor(d.money),
    rep: Math.floor(d.rep),
    introStage: Math.floor(d.introStage),
    flags,
    unlockedVehicles: strArr(d.unlockedVehicles).filter(isVehicleType),
    upgrades: strArr(d.upgrades),
    paints: strArr(d.paints),
    vehicles,
    medals,
    bests,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, isNum(st[k]) && st[k] >= 0 ? st[k] : 0])) as unknown as SaveStats,
    outfit,
    bag,
    home,
    people,
    fuel,
    bank: isNum(d.bank) && d.bank >= 0 ? Math.floor(Math.min(d.bank, 1e9)) : 0,
    econ: sanitizeEcon(d.econ, isNum(home.day) ? Math.floor(home.day) : 0),
    activeJob: sanitizeActiveJob(d.activeJob),
    galiCup: normalizeGaliCup(d.galiCup),
    bulletTrial: normalizeBulletTrial(d.bulletTrial, vehicles),
    kotliSelection: normalizeKotliSelection(d.kotliSelection),
    tractorSponsorship: normalizeTractorSponsorship(d.tractorSponsorship),
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
