import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Missions, INTRO, DESTINATIONS, type MissionHost } from "../src/missions/Missions";
import { TiffinRun, TIFFIN, TIFFIN_CUSTOMERS, type TiffinHost } from "../src/economy/Tiffin";
import { Ledger } from "../src/economy/Ledger";
import { newSave, readSave, writeSave, sanitizeActiveJob, type SaveData, type KV } from "../src/save/schema";
import { buildRoadGraph } from "../src/world/nav";
import { PLAYER_START, POIS } from "../src/world/layout";

const bounds = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: 2000 };
const graph = buildRoadGraph();
const fresh = () => { const save = newSave("preet", PLAYER_START, []); save.introStage = INTRO.DONE; return save; };
const memory = (): KV => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
};
function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Real controllers and schema, with only scene/UI/economy effects replaced. */
function session(save = fresh(), kv = memory()) {
  const ledger = new Ledger(save.econ);
  const state = { hour: 12, carrying: false, passenger: false, pos: new Vector3(), charges: 0 };
  const ui = { dialogue: vi.fn(async () => "take"), results: vi.fn(async () => "ok"), toast: vi.fn() };
  let missions!: Missions, tiffin!: TiffinRun;
  const persist = vi.fn(() => {
    // Optional calls also let the admission regressions run against the pre-snapshot source.
    save.activeJob = missions?.snapshot?.() ?? tiffin?.snapshot?.() ?? null;
    expect(writeSave(kv, save).ok).toBe(true);
  });
  const base = {
    playerPos: () => state.pos, vehicleSpeed: () => null, setCarrying: (on: boolean) => { state.carrying = on; },
    dialogue: () => ui.dialogue(), toast: ui.toast, sting: () => {}, residentSay: () => {}, residentGesture: () => {},
    tipMultiplier: () => 1, spillFactor: () => 1, persist,
  };
  const missionHost: MissionHost = {
    ...base, save, vehicleType: () => null, results: () => ui.results(),
    reward: (money, rep) => { save.money += money; save.rep += rep; }, repTier: () => 0,
    voice: () => {}, roadGraph: graph, takeWarmthBonus: () => 0,
    otherJob: () => !!tiffin?.batch || state.passenger,
  };
  missions = new Missions(missionHost);
  const tiffinHost: TiffinHost = {
    ...base, ledger, hour: () => state.hour, day: () => save.home.day ?? 0, money: () => save.money,
    charge: (amount) => { if (save.money < amount) return false; save.money -= amount; state.charges++; return true; },
    earn: (money, tip, rep, district) => { save.money += money + tip; save.rep += rep; save.stats.tiffins++; ledger.repGain(district, rep); },
    otherJob: () => !!missions.job || missions.stage < INTRO.DONE || state.passenger, repTier: () => 0,
  };
  tiffin = new TiffinRun(tiffinHost);
  const active = save.activeJob;
  if (active?.kind === "delivery") missions.restore(active);
  if (active?.kind === "tiffin" && tiffin.restore(active)) state.hour = active.hour;
  if (save.introStage === INTRO.RETURN) state.carrying = true;
  const reload = () => {
    const loaded = readSave(kv, ["preet"], bounds);
    expect(loaded.error).toBeUndefined();
    expect(loaded.data).not.toBeNull();
    return session(loaded.data!, kv);
  };
  const collect = async () => { tiffin.interaction()!.run(); await Promise.resolve(); };
  return { save, kv, state, ui, missions, tiffin, missionHost, persist, reload, collect };
}

describe("one job owns the player's carrying state", () => {
  it("blocks Bhola after collecting tiffins, retaining paid stops and the carrying prop", async () => {
    const s = session();
    await s.collect();
    const batch = s.tiffin.batch;
    await s.missions.talkBhola();
    const accepted = s.missions.startJob(DESTINATIONS[0]!);
    expect(s.missions.job).toBeNull();
    expect(accepted).toBe(false);
    expect(s.tiffin.batch).toBe(batch);
    expect(s.state.carrying).toBe(true);
    expect(s.state.charges).toBe(1);
  });

  it("blocks tiffins after Bhola without charging or clearing carrying", async () => {
    const s = session();
    s.missions.startJob(DESTINATIONS[0]!);
    const job = s.missions.job;
    await s.collect();
    expect(s.tiffin.batch).toBeNull();
    expect(s.missions.job).toBe(job);
    expect(s.state.charges).toBe(0);
    expect(s.state.carrying).toBe(true);
  });

  it("rechecks Bhola's pending offer after another job takes ownership", async () => {
    const s = session(), offer = deferred();
    s.ui.dialogue.mockImplementationOnce(() => offer.promise);
    const accepting = s.missions.talkBhola();
    await s.collect();
    offer.resolve("take");
    await accepting;
    expect(s.missions.job).toBeNull();
    expect(s.tiffin.batch?.stops).toHaveLength(4);
    expect(s.state.carrying).toBe(true);
  });

  it("rechecks Mummy ji's pending offer before spending money", async () => {
    const s = session(), offer = deferred(), money = s.save.money;
    s.ui.dialogue.mockImplementationOnce(() => offer.promise);
    await s.collect();
    s.missions.startJob(DESTINATIONS[0]!);
    offer.resolve("take");
    await Promise.resolve();
    expect(s.tiffin.batch).toBeNull();
    expect(s.save.money).toBe(money);
    expect(s.state.charges).toBe(0);
    expect(s.state.carrying).toBe(true);
  });

  it("rejects a tiffin offer whose day or collection window expired", async () => {
    for (const change of ["day", "hour"]) {
      const s = session(), offer = deferred();
      s.ui.dialogue.mockImplementationOnce(() => offer.promise);
      await s.collect();
      if (change === "day") s.save.home.day = 1; else s.state.hour = 13;
      offer.resolve("take");
      await Promise.resolve();
      expect(s.tiffin.batch).toBeNull();
      expect(s.state.charges).toBe(0);
    }
  });

  it("keeps optional food work out of an active passenger ride or phone errand", async () => {
    const s = session();
    s.state.passenger = true;
    await s.collect();
    expect(s.missions.startJob(DESTINATIONS[0]!)).toBe(false);
    expect(s.state.charges).toBe(0);
    s.state.passenger = false;
    s.save.introStage = INTRO.RETURN;
    s.state.carrying = true;
    await s.collect();
    expect(s.tiffin.batch).toBeNull();
    expect(s.state.carrying).toBe(true);
  });
});

describe("delivery checkpoints", () => {
  it("resumes the same destination, timer, warmth limit, condition and carry after reload", () => {
    const s = session();
    s.missionHost.takeWarmthBonus = () => 30;
    s.missions.startJob(DESTINATIONS[2]!);
    s.missions.fixedUpdate(12.75);
    s.missions.onJolt(3);
    s.persist();
    const r = s.reload();
    expect(r.missions.snapshot()).toEqual(s.missions.snapshot());
    expect(r.missions.objective()).toEqual(s.missions.objective());
    expect(r.state.carrying).toBe(true);
    expect(r.save.money).toBe(s.save.money);
  });

  it("checkpoints reward and removal before dialogue; a stale handover cannot pay another job", async () => {
    const s = session();
    s.missions.startJob(DESTINATIONS[0]!);
    const p = POIS[DESTINATIONS[0]!.poi]!;
    s.state.pos.set(p.x, 0, p.z);
    const action = s.missions.deliveryHere()!, dialog = deferred();
    s.ui.dialogue.mockImplementationOnce(() => dialog.promise);
    const completion = action.run();
    const paid = s.save.money;
    expect(s.reload().save.stats.deliveries).toBe(1);
    expect(s.reload().missions.job).toBeNull();
    expect(s.reload().state.carrying).toBe(false);
    await action.run();
    dialog.resolve("ok");
    await completion;
    s.missions.startJob(DESTINATIONS[1]!);
    await action.run();
    expect(s.save.money).toBe(paid);
    expect(s.save.stats.deliveries).toBe(1);
    expect(s.missions.job?.dest.id).toBe(DESTINATIONS[1]!.id);
  });

  it("checkpoints cancellation and expiry without allowing an expired saved delivery to pay", async () => {
    const s = session();
    s.missions.startJob(DESTINATIONS[0]!);
    s.missions.abandon();
    expect(s.reload().missions.job).toBeNull();
    expect(s.reload().state.carrying).toBe(false);
    s.missions.startJob(DESTINATIONS[0]!);
    s.missions.job!.elapsed = s.missions.job!.limit;
    s.persist();
    const r = s.reload(), money = r.save.money;
    const p = POIS[DESTINATIONS[0]!.poi]!;
    r.state.pos.set(p.x, 0, p.z);
    await r.missions.deliveryHere()!.run();
    expect(r.save.money).toBe(money);
    expect(r.save.stats.failed).toBe(1);
    expect(r.reload().missions.job).toBeNull();
  });

  it("checkpoints the phone reward and completed intro together before the final dialogue", async () => {
    const data = fresh(); data.introStage = INTRO.RETURN;
    const s = session(data), dialog = deferred();
    s.ui.dialogue.mockResolvedValueOnce("ok").mockImplementationOnce(() => dialog.promise);
    const completion = s.missions.talkBhola();
    await Promise.resolve();
    const r = s.reload();
    expect(r.save.introStage).toBe(INTRO.DONE);
    expect(r.save.money).toBe(data.money);
    expect(r.save.rep).toBe(10);
    expect(r.state.carrying).toBe(false);
    r.ui.dialogue.mockResolvedValue("no");
    await r.missions.talkBhola();
    expect(r.save.money).toBe(data.money);
    dialog.resolve("ok"); await completion;
  });
});

describe("prepaid tiffin checkpoints", () => {
  it("resumes ordered remaining stops, their damage and the batch's saved time without charging again", async () => {
    const s = session();
    await s.collect();
    s.tiffin.onJolt(3);
    s.state.hour = 12.4;
    const first = s.tiffin.next()!, p = POIS[first.poi]!;
    s.state.pos.set(p.x, 0, p.z);
    await s.tiffin.deliveryHere()!.run();
    const r = s.reload();
    expect(r.tiffin.snapshot()).toEqual(s.tiffin.snapshot());
    expect(r.state.hour).toBe(12.4);
    expect(r.state.charges).toBe(0);
    expect(r.save.money).toBe(s.save.money);
    expect(r.save.econ.tiffinDone).toContain(first.id);
    expect(r.tiffin.open().map((c) => c.id)).not.toContain(first.id);
    expect(r.state.carrying).toBe(true);
  });

  it("checkpoints each stop before dialogue and pays each delivered stop once across reloads", async () => {
    const s = session();
    await s.collect();
    const first = s.tiffin.next()!, p = POIS[first.poi]!;
    s.state.pos.set(p.x, 0, p.z);
    const action = s.tiffin.deliveryHere()!, dialog = deferred();
    s.ui.dialogue.mockImplementationOnce(() => dialog.promise);
    const completion = action.run();
    const r = s.reload();
    expect(r.save.stats.tiffins).toBe(1);
    expect(r.tiffin.batch!.stops).toHaveLength(3);
    expect(r.tiffin.batch!.stops.some((c) => c.id === first.id)).toBe(false);
    dialog.resolve("ok"); await completion;
    const money = s.save.money;
    await action.run();
    expect(s.save.money).toBe(money);
    while (r.tiffin.next()) {
      const c = r.tiffin.next()!, p = POIS[c.poi]!;
      r.state.pos.set(p.x, 0, p.z);
      await r.tiffin.deliveryHere()!.run();
    }
    const done = r.reload();
    expect(done.save.stats.tiffins).toBe(4);
    expect(new Set(done.save.econ.tiffinDone).size).toBe(4);
    expect(done.tiffin.batch).toBeNull();
    expect(done.state.carrying).toBe(false);
  });

  it("checkpoints abandonment and day/hour expiry without stale carrying", async () => {
    for (const kind of ["abandon", "hour", "day"]) {
      const s = session(); await s.collect();
      if (kind === "abandon") s.tiffin.abandon();
      else { if (kind === "hour") s.state.hour = TIFFIN.giveUp; else s.save.home.day = 1; s.tiffin.update(); }
      const r = s.reload();
      expect(r.tiffin.batch).toBeNull();
      expect(r.state.carrying).toBe(false);
      expect(r.save.stats.tiffins).toBe(0);
    }
  });

  it("deduplicates corrupted stops, filters unknown/served IDs, and keeps the remaining route order", () => {
    const data = fresh(), [a, b] = TIFFIN_CUSTOMERS;
    data.econ.tiffinDay = 0; data.econ.tiffinDone = [a!.id];
    data.activeJob = sanitizeActiveJob({ kind: "tiffin", day: 0, hour: 12, stops: [a!.id, b!.id, b!.id, "unknown"], condition: 73 });
    const s = session(data);
    expect(s.tiffin.batch!.stops.map((c) => c.id)).toEqual([b!.id]);
    expect(s.tiffin.batch!.condition).toBe(73);
    expect(s.save.stats.tiffins).toBe(0);
  });

  it("refuses a batch from another day or another ledger instead of reopening served orders", () => {
    for (const ledgerDay of [0, -1]) {
      const data = fresh(); data.home.day = ledgerDay === 0 ? 1 : 0;
      data.econ.tiffinDay = ledgerDay;
      data.activeJob = { kind: "tiffin", day: 0, hour: 12, stops: [TIFFIN_CUSTOMERS[0]!.id], condition: 90 };
      const s = session(data);
      expect(s.tiffin.batch).toBeNull();
      expect(s.state.carrying).toBe(false);
    }
  });
});

describe("optional active-job data is tolerant of older and damaged saves", () => {
  it("loads old saves without a job and preserves historical progress", () => {
    const save: SaveData = fresh(); delete save.activeJob;
    save.money = 12345; save.stats.deliveries = 7; save.medals.delivery_tailor = "gold";
    const kv = memory(); writeSave(kv, save);
    const data = readSave(kv, ["preet"], bounds).data!;
    expect(data.activeJob).toBeNull();
    expect(data.money).toBe(12345);
    expect(data.stats.deliveries).toBe(7);
    expect(data.medals.delivery_tailor).toBe("gold");
  });

  it.each([
    { kind: "delivery", destId: "tailor", elapsed: -1, par: 30, limit: 60, condition: 90, routeLen: 30 },
    { kind: "delivery", destId: "tailor", elapsed: 1, par: 30, limit: 20, condition: 90, routeLen: 30 },
    { kind: "delivery", destId: "tailor", elapsed: 1, par: 30, limit: 60, condition: Infinity, routeLen: 30 },
    { kind: "tiffin", day: 0, hour: 25, stops: ["tailor"], condition: 90 },
    { kind: "tiffin", day: 0.5, hour: 12, stops: ["tailor"], condition: 90 },
    { kind: "tiffin", day: 0, hour: 12, stops: [], condition: 90 },
    { kind: "ride", vehicleId: "missing", condition: 90 },
  ])("drops damaged job data while keeping the rest of the save: %j", (activeJob) => {
    const kv = memory(), data = { ...fresh(), activeJob } as unknown as SaveData;
    writeSave(kv, data);
    const result = readSave(kv, ["preet"], bounds);
    expect(result.error).toBeUndefined();
    expect(result.data!.activeJob).toBeNull();
    expect(result.data!.money).toBe(data.money);
  });

  it("rejects a removed delivery destination without creating an invisible carry owner", () => {
    const data = fresh();
    data.activeJob = { kind: "delivery", destId: "missing", elapsed: 2, par: 30, limit: 60, condition: 90, routeLen: 30 };
    const s = session(data);
    expect(s.missions.job).toBeNull();
    expect(s.state.carrying).toBe(false);
  });
});
