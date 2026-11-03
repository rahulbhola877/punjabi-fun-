import { afterEach, describe, expect, it, vi } from "vitest";
import { NullEngine, Scene, StandardMaterial, TransformNode, Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { Rides, RIDE_SAVE_BLOCKED, STANDS, type RideHost } from "../src/missions/Rides";
import { newSave, readSave, writeSave, SAVE_KEY, type KV, type SavedDeliveryJob, type SavedTiffinJob } from "../src/save/schema";
import { buildRoadGraph } from "../src/world/nav";
import { PLAYER_START, POIS } from "../src/world/layout";
import { SPECS } from "../src/vehicles/specs";
import type { Vehicle } from "../src/vehicles/Vehicle";

afterEach(() => vi.unstubAllGlobals());

function gameFixture(ride = false, failWrite = false) {
  const data = new Map<string, string>();
  const kv: KV = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { if (failWrite) throw new Error("QuotaExceeded"); data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
  const save = newSave("preet", PLAYER_START, []);
  data.set(SAVE_KEY, "previous checkpoint");
  vi.stubGlobal("localStorage", kv);
  const state = {
    save, rides: { ride: ride ? {} : null },
    missions: { job: null, snapshot: vi.fn<() => SavedDeliveryJob | null>(() => null) },
    tiffinRun: { batch: null, snapshot: vi.fn<() => SavedTiffinJob | null>(() => null) },
    driving: null, vehicles: [], player: { grounded: true, feet: new Vector3(10, 0, 15), yaw: 0 },
    lastSafe: new Vector3(),
    state: "playing", input: { gameplayActive: true, clear: vi.fn(), exitPointerLock: vi.fn() },
    audio: { setPaused: vi.fn() }, clock: { reset: vi.fn() }, titleFlow: vi.fn(),
    ui: { toast: vi.fn(), menu: vi.fn(async () => "resume") },
  };
  const game = Object.assign(Object.create(Game.prototype) as object, state) as unknown as Game;
  return { game, state, kv, data };
}

describe("Game persistence and Save & quit", () => {
  it("leaves the last checkpoint byte-for-byte intact during a passenger ride", () => {
    const { game, state, data } = gameFixture(true);
    expect(game.persist("manual")).toBe(false);
    expect(state.ui.toast).toHaveBeenCalledWith(RIDE_SAVE_BLOCKED, "warn", 5000);
    expect(data.get(SAVE_KEY)).toBe("previous checkpoint");
    state.ui.toast.mockClear();
    for (const reason of ["auto", "shop", "fuel"]) expect(game.persist(reason)).toBe(false);
    expect(state.ui.toast).not.toHaveBeenCalled();
    expect(data.get(SAVE_KEY)).toBe("previous checkpoint");
  });

  it.each(["ride", "storage"])("keeps the pause menu instead of quitting when saving fails: %s", async (reason) => {
    const { game, state, data } = gameFixture(reason === "ride", reason === "storage");
    state.ui.menu.mockResolvedValueOnce("quit").mockResolvedValueOnce("resume");
    await (game as unknown as { pause(): Promise<void> }).pause();
    expect(state.ui.menu).toHaveBeenCalledTimes(2);
    expect(state.titleFlow).not.toHaveBeenCalled();
    expect(data.get(SAVE_KEY)).toBe("previous checkpoint");
    expect(state.ui.toast).toHaveBeenCalled();
  });

  it("writes the live delivery snapshot through the real Game save path", () => {
    const { game, state, kv } = gameFixture();
    const active = { kind: "delivery" as const, destId: "tailor", elapsed: 12, par: 30, limit: 66, condition: 82, routeLen: 40 };
    state.missions.snapshot.mockReturnValue(active);
    expect(game.persist("manual")).toBe(true);
    const loaded = readSave(kv, ["preet"], { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 }).data!;
    expect(loaded.activeJob).toEqual(active);
    expect(loaded.player).toMatchObject({ x: 10, z: 15 });
    expect(state.ui.toast).toHaveBeenCalledWith("Game saved.");
  });

  it("writes the tiffin clock and clears the active job after completion", () => {
    const { game, state, kv } = gameFixture();
    const active = { kind: "tiffin" as const, day: 2, hour: 12.8, stops: ["tailor", "fruit"], condition: 71 };
    state.tiffinRun.snapshot.mockReturnValue(active);
    expect(game.persist("manual")).toBe(true);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).activeJob).toEqual(active);
    state.tiffinRun.snapshot.mockReturnValue(null);
    expect(game.persist("tiffin")).toBe(true);
    expect(JSON.parse(kv.getItem(SAVE_KEY)!).activeJob).toBeNull();
  });
});

function rideFixture() {
  const engine = new NullEngine(), scene = new Scene(engine), mat = new StandardMaterial("person", scene);
  const auto = (id: string) => ({ id, spec: SPECS.auto, speed: 0,
    position: new Vector3(STANDS[0]!.x, 0, STANDS[0]!.z), model: { root: new TransformNode(id, scene) },
  } as unknown as Vehicle);
  const first = auto("one"), second = auto("two");
  const state = { driving: first as Vehicle | null, otherJob: false };
  const save = newSave("preet", PLAYER_START, []);
  const kv = new Map<string, string>();
  const host: RideHost = {
    save, scene, mat, driving: () => state.driving, otherJob: () => state.otherJob,
    toast: vi.fn(), reward: vi.fn((money, rep) => { save.money += money; save.rep += rep; }),
    say: vi.fn(), jolt: () => null, sting: vi.fn(), roadGraph: buildRoadGraph(),
    addCaster: vi.fn(), removeCaster: vi.fn(), persist: vi.fn(() => { writeSave({
      getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => { kv.set(k, v); }, removeItem: (k) => { kv.delete(k); },
    }, save); }),
  };
  const rides = new Rides(host);
  return { engine, scene, state, first, second, host, rides, save, kv };
}

describe("passenger ownership", () => {
  it("refuses food-job overlap, invalid stands and duplicate pickups without leaking a passenger", () => {
    const f = rideFixture();
    try {
      f.state.otherJob = true;
      expect(f.rides.standHere(f.first.position)).toBeNull();
      f.rides.pickUp(STANDS[0]!.id);
      expect(f.rides.ride).toBeNull();
      f.state.otherJob = false;
      f.rides.pickUp("missing");
      expect(f.rides.ride).toBeNull();
      f.rides.pickUp(STANDS[0]!.id);
      const passenger = f.rides.ride!.passenger;
      expect(passenger.root.parent).toBe(f.first.model.root);
      f.rides.pickUp(STANDS[0]!.id);
      expect(f.rides.ride!.passenger).toBe(passenger);
      expect(f.host.addCaster).toHaveBeenCalledTimes(1);
    } finally { f.engine.dispose(); }
  });

  it("does not let a different auto complete a ride and disposes its original passenger", () => {
    const f = rideFixture();
    try {
      f.rides.pickUp(STANDS[0]!.id);
      const passenger = f.rides.ride!.passenger;
      const dest = POIS[f.rides.ride!.dropPoi]!;
      f.state.driving = f.second;
      f.second.position.set(dest.x, 0, dest.z);
      expect(f.rides.dropHere(f.second.position)).toBe(false);
      f.rides.dropOff();
      expect(f.host.reward).not.toHaveBeenCalled();
      f.rides.update(0.1);
      expect(f.rides.ride).toBeNull();
      expect(passenger.root.isDisposed()).toBe(true);
      expect(f.host.removeCaster).toHaveBeenCalledTimes(1);
      expect(f.host.persist).toHaveBeenCalledWith("ride-end");
    } finally { f.engine.dispose(); }
  });

  it("pays and checkpoints a valid drop-off once, after releasing the save guard", () => {
    const f = rideFixture();
    try {
      f.rides.pickUp(STANDS[0]!.id);
      const dest = POIS[f.rides.ride!.dropPoi]!;
      f.first.position.set(dest.x, 0, dest.z);
      f.rides.dropOff(); f.rides.dropOff();
      expect(f.rides.ride).toBeNull();
      expect(f.host.reward).toHaveBeenCalledTimes(1);
      expect(f.save.stats.rides).toBe(1);
      expect(JSON.parse(f.kv.get(SAVE_KEY)!).stats.rides).toBe(1);
      expect(f.host.removeCaster).toHaveBeenCalledTimes(1);
    } finally { f.engine.dispose(); }
  });
});
