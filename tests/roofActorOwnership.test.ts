import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NullEngine, Scene, StandardMaterial, Vector3 } from "../src/babylon";
import { Crowd, streetFree, type Resident, type ResidentDef, type VehicleThreat } from "../src/crowds/Crowd";
import { Jhagde, type JhagdeHost } from "../src/combat/Jhagde";
import { randomAppearance } from "../src/characters/appearances";
import type { Physics } from "../src/physics/Physics";
import { NavGraph } from "../src/world/nav";

describe("rooftop support and street ownership", () => {
  let engine: NullEngine, scene: Scene, crowd: Crowd, jhagde: Jhagde;
  const at = (x = 0, y = 0, z = -45) => new Vector3(x, y, z);
  const threat = (pos = at()): VehicleThreat => ({ pos, fwd: new Vector3(0, 0, 1), speed: 4, halfWidth: 1, halfLen: 2, isPlayer: true });
  const spawn = (id: string, extra: Partial<ResidentDef> = {}) => crowd.spawn({ id, name: id, role: "keeper", look: randomAppearance(4), x: 0, z: -45, y: 0, yaw: 0, ...extra });
  const step = (count = 1, player: Vector3 | null = null, vehicles: VehicleThreat[] = []) => {
    for (let i = 0; i < count; i++) crowd.fixedUpdate(1 / 60, player, vehicles);
  };

  beforeEach(() => {
    engine = new NullEngine(); scene = new Scene(engine);
    crowd = new Crowd(scene, { raycast: () => null } as unknown as Physics, new StandardMaterial("people", scene));
    jhagde = new Jhagde({ crowd, speak: vi.fn(), busy: () => false } as unknown as JhagdeHost);
  });
  afterEach(() => { crowd.dispose(); scene.dispose(); engine.dispose(); });

  it("borrows a street onlooker while the patang flyer stays at its roof post", () => {
    const roof = spawn("patang_regression", { onRoof: true, kite: true, y: 6 });
    const a = spawn("arguer_a", { x: -3 }), b = spawn("arguer_b", { x: 3 });
    const walker = spawn("available", { role: "walker", z: -43 });
    const q = { a, b, t: 0, stage: "argue", line: 0, topic: 0, spot: at(), aunty: false, crowd: [] as Resident[], cheerT: 0, helpers: [] };
    (jhagde as unknown as { gatherTamasha(stage: typeof q, dt: number): void }).gatherTamasha(q, 1 / 60);
    const start = roof.pos.clone(), walkerStart = walker.pos.clone();
    step(120);
    expect(q.crowd.map(r => r.id)).toEqual([walker.id]);
    expect(roof.brain).toBeNull(); expect(walker.brain).not.toBeNull();
    expect(roof.pos.asArray()).toEqual(start.asArray());
    expect(Vector3.Distance(walker.pos, walkerStart)).toBeGreaterThan(0.4);
    expect(walker.pos.y).toBe(0);
  });

  it("reserves unavailable residents, but accepts ordinary street folk", () => {
    const r = spawn("available");
    expect(streetFree(r)).toBe(true);
    const reserved: Partial<Resident>[] = [
      { onRoof: true }, { kite: true }, { away: true }, { trip: "returning" }, { trip: "leaving" },
      { pole: true }, { dhol: true }, { indoor: true }, { contact: true }, { brain: () => {} },
      { pose: "sit" }, { pose: "ride" }, { pose: "drive" }, { pose: "down" },
    ];
    for (const flags of reserved) expect(streetFree({ ...r, ...flags }), JSON.stringify(flags)).toBe(false);
  });

  it("rejects an explicit quarrel handoff of a roof actor, then accepts street neighbours", () => {
    const roof = spawn("roof", { onRoof: true, y: 6 });
    const a = spawn("neighbour_a", { role: "chatter", x: -3 });
    const b = spawn("neighbour_b", { role: "chatter", x: 3 });
    expect(jhagde.quarrelBetween(roof, a)).toBe(false);
    expect(roof.brain).toBeNull(); expect(a.brain).toBeNull();
    expect(jhagde.quarrelBetween(a, b)).toBe(true);
    const start = a.pos.clone(); step(30);
    expect(Vector3.Distance(a.pos, start)).toBeGreaterThan(0.4);
    expect(jhagde.quarrelling).toEqual([a, b]);
  });

  it("does not displace a roof keeper for a player passing directly below", () => {
    const roof = spawn("roof", { onRoof: true, kite: true, y: 6 });
    const start = roof.pos.clone();
    step(120, at(-0.3));
    expect(roof.pos.asArray()).toEqual(start.asArray());
    expect(roof.vel.length()).toBe(0);
  });

  it("ignores road contact and horns on a roof while street walkers still dodge and report bumps", () => {
    const roof = spawn("roof", { role: "walker", onRoof: true, y: 6 });
    const street = spawn("street", { role: "walker", x: 0.4 });
    const onBump = vi.fn(); crowd.onBump = onBump;
    const start = roof.pos.clone();
    expect(crowd.horn(at(0, 0, -46), new Vector3(0, 0, 1))).toBe(1);
    expect(roof.dodgeT).toBe(0); expect(street.dodgeT).toBeGreaterThan(0);
    step(1, null, [threat()]);
    expect(roof.pos.asArray()).toEqual(start.asArray());
    expect(onBump.mock.calls.map(([r]) => r.id)).toEqual([street.id]);
    expect(street.pos.x).toBeGreaterThan(1);
  });

  it("does not let a roof neighbour repel street walkers through the floor", () => {
    spawn("roof", { onRoof: true, y: 6 });
    const street = spawn("street", { role: "walker", x: 0.3 });
    step(); // Rebuild the real neighbour grid.
    expect(crowd.avoid(street, at(0, 6)).length()).toBe(0);
    spawn("street_neighbour", { x: 0.6 }); step();
    expect(crowd.avoid(street, null).length()).toBeGreaterThan(0);
  });

  it("keeps a scheduled roof actor supported until out of view and restores its roof on return", () => {
    const roof = spawn("roof_shift", { onRoof: true, kite: true, y: 6, shift: [8, 18] });
    const post = roof.pos.clone(); crowd.hour = 20;
    step(120, at());
    expect(roof.pos.asArray()).toEqual(post.asArray());
    expect(roof.trip).toBeUndefined(); expect(roof.away).not.toBe(true);
    step(1, at(100)); expect(roof.away).toBe(true);
    crowd.hour = 9;
    step(1, at()); expect(roof.away).toBe(true);
    step(1, at(100));
    expect(roof.away).toBe(false); expect(roof.trip).toBeUndefined();
    expect(roof.pos.asArray()).toEqual(post.asArray());
    expect(roof.prev.asArray()).toEqual(post.asArray());
    step(120, at()); expect(roof.pos.asArray()).toEqual(post.asArray());
  });

  it("restores a rooftop actor born off shift to its original support height", () => {
    crowd.hour = 20;
    const roof = spawn("roof_asleep", { onRoof: true, y: 6, shift: [8, 18] });
    expect(roof.away).toBe(true);
    crowd.hour = 9; step();
    expect(roof.pos.asArray()).toEqual([0, 6, -45]);
    expect(roof.home.asArray()).toEqual([0, 6, -45]);
  });

  it("still lets a street keeper walk its shift route out and return to its post", () => {
    const keeper = spawn("shift_keeper", { shift: [8, 18], route: [{ x: 0, z: -44 }, { x: 0, z: -42 }] });
    crowd.hour = 20; step(90, at(10));
    expect(keeper.trip).toBe("leaving"); expect(keeper.pos.z).toBeGreaterThan(-44);
    expect(streetFree(keeper)).toBe(false);
    step(300); expect(keeper.away).toBe(true);
    crowd.hour = 9; step();
    expect(keeper.away).toBe(false); expect(keeper.trip).toBe("returning");
    step(300);
    expect(keeper.trip).toBeUndefined(); expect(streetFree(keeper)).toBe(true);
    expect(Vector3.Distance(keeper.pos, keeper.post)).toBeLessThan(0.1);
  });

  it("retains ordinary pedestrian navigation at street level", () => {
    const graph = new NavGraph(); graph.add(0, -45, "walk"); graph.add(0, -42, "walk"); graph.link(0, 1);
    const walker = spawn("street_walker", { role: "walker", graph });
    walker.path = [1]; walker.pathI = 0; walker.wait = 0;
    step(60);
    expect(walker.pos.z).toBeGreaterThan(-44); expect(walker.pos.y).toBe(0);
    expect(streetFree(walker)).toBe(true);
  });

  it("runs explicit roof movement brains instead of freezing all supported actors", () => {
    const rider = spawn("scripted_roof", { onRoof: true, y: 0.75 });
    rider.brain = r => { r.vel.set(1, 0, 0); };
    step(60, null, [threat()]);
    expect(rider.pos.x).toBeCloseTo(1); expect(rider.pos.y).toBe(0.75);
  });

  it("preserves explicit procession ownership for roof riders and prop-carrying walkers", () => {
    const rider = spawn("proc_rider", { onRoof: true, y: 0.75, shift: [8, 18] });
    const marcher = spawn("proc_flag", { role: "walker", pole: true, x: 4 });
    rider.brain = r => { r.vel.setAll(0); };
    marcher.brain = r => { r.vel.set(1, 0, 0); };
    crowd.hour = 20;
    for (let i = 0; i < 60; i++) {
      // Processions.placeFloat owns the rider's world position each tick.
      rider.pos.set(i / 60, 0.75, -45);
      step(1, at(), [threat()]);
    }
    expect(rider.pos.asArray()).toEqual([59 / 60, 0.75, -45]);
    expect(rider.away).not.toBe(true); expect(rider.trip).toBeUndefined();
    expect(marcher.pos.x).toBeCloseTo(5);
    expect(streetFree(rider)).toBe(false); expect(streetFree(marcher)).toBe(false);
  });
});
