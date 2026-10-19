import { describe, expect, it } from "vitest";
import { newSave, readSave, validate, writeSave, SAVE_KEY, SAVE_VERSION, SaveError, type KV } from "../src/save/schema";

const looks = ["preet", "jaggi"];
const bounds = { minX: -46, maxX: 34, minZ: -78, maxZ: 58 };
const mem = (): KV & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const fresh = () => newSave("preet", { x: 1, z: 2, yaw: 0 }, [{ id: "s1", type: "scooter", x: 0, y: 0, z: 0, yaw: 0, paint: "mint" }]);

describe("save schema", () => {
  it("migrates v1 saves (no outfit) and validates outfit colours", () => {
    const d = { ...fresh(), version: 1 } as unknown as Record<string, unknown>;
    delete d.outfit;
    expect(validate(d, looks, bounds).outfit).toEqual({});
    const e = { ...fresh(), outfit: { head: "#ef8f1b", top: "javascript:alert(1)", wings: "#ffffff" } };
    expect(validate(e, looks, bounds).outfit).toEqual({ head: "#ef8f1b" });
  });
  it("migrates v2 saves to the open world (v3): new stats, new vehicle types kept", () => {
    const d = { ...fresh(), version: 2, stats: { deliveries: 4, failed: 1, distance: 300 } } as unknown as Record<string, unknown>;
    (d.vehicles as unknown[]).push({ id: "t1", type: "tractor", x: -350, y: 0, z: 50, yaw: 0, paint: "tractorRed" }, { id: "x", type: "spaceship", x: 0, y: 0, z: 0, yaw: 0 });
    const v = validate(d, looks, { minX: -700, maxX: 700, minZ: -700, maxZ: 700 });
    expect(v.version).toBe(3);
    expect(v.stats).toMatchObject({ deliveries: 4, failed: 1, fightsWon: 0, bribes: 0, rides: 0, dangalWins: 0, knockedOut: 0, calmed: 0 });
    expect(v.vehicles.map((x) => x.type)).toEqual(["scooter", "tractor"]);
    expect(v.vehicles[1]!.x).toBe(-350);
  });
  it("round-trips a new save", () => {
    const kv = mem();
    expect(writeSave(kv, fresh()).ok).toBe(true);
    const r = readSave(kv, looks, bounds);
    expect(r.error).toBeUndefined();
    expect(r.data?.player.look).toBe("preet");
    expect(r.data?.vehicles).toHaveLength(1);
  });
  it("rejects newer versions and garbage", () => {
    expect(() => validate({ ...fresh(), version: 99 }, looks, bounds)).toThrow(SaveError);
    expect(() => validate("nope", looks, bounds)).toThrow(SaveError);
    expect(() => validate({ ...fresh(), player: { look: "ghost", x: 0, y: 0, z: 0, yaw: 0 } }, looks, bounds)).toThrow(/look/);
    expect(() => validate({ ...fresh(), money: -5 }, looks, bounds)).toThrow(/money/);
  });
  it("clamps positions into the district and drops bad vehicles", () => {
    const d = fresh() as unknown as Record<string, unknown>;
    d.player = { look: "preet", x: 9999, y: -3, z: -9999, yaw: 1 };
    d.vehicles = [{ id: "a", type: "scooter", x: 1, y: 0, z: 1, yaw: 0 }, { id: "a", type: "scooter", x: 1, y: 0, z: 1, yaw: 0 }, { id: "b", type: "tank", x: 0, y: 0, z: 0, yaw: 0 }, { id: "c", type: "auto", x: "x" }];
    const v = validate(d, looks, bounds);
    expect(v.player.x).toBe(34);
    expect(v.player.z).toBe(-78);
    expect(v.player.y).toBe(0);
    expect(v.vehicles.map((x) => x.id)).toEqual(["a"]);
  });
  it("migrates version 0 saves (no stats)", () => {
    const d = fresh() as unknown as Record<string, unknown>;
    d.version = 0;
    delete d.stats;
    const v = validate(d, looks, bounds);
    expect(v.version).toBe(SAVE_VERSION);
    expect(v.stats.deliveries).toBe(0);
    expect(v.outfit).toEqual({});
  });
  it("reports storage failures instead of throwing", () => {
    const broken: KV = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("QuotaExceeded"); }, removeItem: () => undefined };
    const w = writeSave(broken, fresh());
    expect(w.ok).toBe(false);
    const r = readSave(broken, looks, bounds);
    expect(r.data).toBeNull();
    expect(r.error).toMatch(/denied/);
  });
  it("detects corrupt JSON", () => {
    const kv = mem();
    kv.setItem(SAVE_KEY, "{not json");
    const r = readSave(kv, looks, bounds);
    expect(r.data).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
