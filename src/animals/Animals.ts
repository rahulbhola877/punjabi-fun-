import {
  PhysicsBody, PhysicsMotionType, PhysicsShapeBox, Quaternion, Scene, TransformNode, Vector3, type Mesh,
} from "../babylon";
import { GeoBuilder, rgb, shade, type RGB } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { Group } from "../app/config";
import { Rng } from "../render/textures";
import type { NavGraph } from "../world/nav";
import { TOWN, isOpenCountry } from "../world/region";
import { isOpenGround } from "../world/layout";

/**
 * Street animals of Punjab: stray dogs that chase motorbikes, cats that dart
 * across the road, and buffaloes and cows that stand in the middle of it and
 * refuse to move. Big animals have a kinematic collision box, so you cannot
 * drive through a buffalo; dogs and cats always leap clear.
 */

export type AnimalKind = "dog" | "cat" | "buffalo" | "cow";

interface AnimalDef { len: number; height: number; legLen: number; speed: number; run: number; heavy: boolean }
const DEFS: Record<AnimalKind, AnimalDef> = {
  dog: { len: 0.9, height: 0.62, legLen: 0.36, speed: 1.3, run: 8.5, heavy: false },
  cat: { len: 0.5, height: 0.3, legLen: 0.18, speed: 0.9, run: 6, heavy: false },
  buffalo: { len: 2.3, height: 1.45, legLen: 0.72, speed: 0.8, run: 2.2, heavy: true },
  cow: { len: 2.0, height: 1.35, legLen: 0.72, speed: 0.9, run: 2.5, heavy: true },
};

export interface Animal {
  kind: AnimalKind;
  root: TransformNode;
  legs: TransformNode[];
  tail: TransformNode;
  head: TransformNode;
  pos: Vector3;
  facing: number;
  vel: Vector3;
  state: "wander" | "stand" | "cross" | "chase" | "flee" | "sleep";
  t: number;
  goal: Vector3;
  phase: number;
  body: PhysicsBody | null;
  node: TransformNode | null;
  meshes: Mesh[];
  barkT: number;
  /** Fixed animals (the bazaar cow, a sleeping dog) never despawn. */
  resident: boolean;
}

export interface AnimalHost {
  playerPos(): Vector3;
  /** The player's vehicle, if riding (dogs only chase two-wheelers). */
  playerRide(): { pos: Vector3; speed: number; twoWheeler: boolean } | null;
  movers(): Array<{ pos: Vector3; fwd: Vector3; speed: number }>;
  sound(name: "dog_bark" | "buffalo_moo" | "cat_meow", pos: Vector3): void;
  addCaster(m: Mesh): void;
  removeCaster(m: Mesh): void;
}

export class Animals {
  animals: Animal[] = [];
  private rng = new Rng(1212);
  private spawnT = 0;
  target = { dog: 5, cat: 2, buffalo: 3, cow: 2 };

  constructor(private host: AnimalHost, private scene: Scene, private mats: Materials, private g: NavGraph) {}

  private build(kind: AnimalKind, seed: number): Pick<Animal, "root" | "legs" | "tail" | "head" | "meshes"> {
    const rng = new Rng(seed);
    const d = DEFS[kind];
    const root = new TransformNode(`${kind}${seed}`, this.scene);
    const coat: RGB = kind === "buffalo" ? rgb("#1d1b1a") : kind === "cow" ? rgb(rng.pick(["#efe9df", "#d9d2c6", "#c9b8a0"])) : rgb(rng.pick(kind === "dog" ? ["#b07a43", "#d9b382", "#2b2522", "#8a6a4a", "#efe6d6"] : ["#e0a44c", "#3a3330", "#d9d2c8", "#7c6f64"]));
    const body = new GeoBuilder(0.6), parts: Mesh[] = [];
    const L = d.len, H = d.height, leg = d.legLen;
    const bodyY = leg + (H - leg) * 0.45;
    body.ellipsoid(0, bodyY, 0, L * (kind === "buffalo" ? 0.27 : 0.22), (H - leg) * 0.48, L * 0.48, 12, 8, coat);
    if (kind === "cow") body.ellipsoid(0, bodyY + (H - leg) * 0.42, L * 0.3, L * 0.09, L * 0.07, L * 0.1, 8, 5, shade(coat, 0.95));
    const mk = (g: GeoBuilder, name: string, parent: TransformNode) => {
      const m = g.toMesh(name, this.scene, this.mats.get("matte"));
      m.parent = parent;
      m.isPickable = false;
      m.receiveShadows = true;
      parts.push(m);
      return m;
    };
    mk(body, `${kind}_body`, root);
    // Head on a neck pivot.
    const head = new TransformNode(`${kind}_headN`, this.scene);
    head.parent = root;
    head.position.set(0, bodyY + (H - leg) * 0.2, L * 0.45);
    const hg = new GeoBuilder(0.6);
    const hs = kind === "buffalo" || kind === "cow" ? 0.22 : kind === "dog" ? 0.14 : 0.08;
    hg.ellipsoid(0, hs * 0.4, hs * 0.9, hs, hs * 0.95, hs * 1.15, 10, 6, coat);
    hg.ellipsoid(0, hs * 0.1, hs * 2.0, hs * 0.55, hs * 0.5, hs * 0.6, 8, 5, kind === "buffalo" ? rgb("#3a3532") : shade(coat, 0.85));
    for (const s of [-1, 1]) {
      if (kind === "dog" || kind === "cat") hg.cylinder(s * hs * 0.55, hs * 1.1, hs * 0.7, hs * 0.28, 0.01, hs * (kind === "cat" ? 0.9 : 0.6), 5, shade(coat, 0.8));
      else {
        hg.ellipsoid(s * hs * 1.1, hs * 0.6, hs * 0.6, hs * 0.45, hs * 0.15, hs * 0.25, 6, 4, coat);
        // Horns: the buffalo's sweep back and curl; the cow's are short.
        const hc = rgb("#7a7066");
        if (kind === "buffalo") { hg.tube(new Vector3(s * hs * 0.5, hs * 1.0, hs * 0.7), new Vector3(s * hs * 1.6, hs * 1.15, hs * -0.2), 0.05, 5, hc); hg.tube(new Vector3(s * hs * 1.6, hs * 1.15, hs * -0.2), new Vector3(s * hs * 1.2, hs * 0.7, hs * -0.7), 0.04, 5, hc); }
        else hg.tube(new Vector3(s * hs * 0.5, hs * 1.0, hs * 0.7), new Vector3(s * hs * 0.9, hs * 1.6, hs * 0.6), 0.035, 5, hc);
      }
      hg.ellipsoid(s * hs * 0.45, hs * 0.65, hs * 1.85, hs * 0.1, hs * 0.1, hs * 0.05, 5, 3, rgb("#111111"));
    }
    mk(hg, `${kind}_head`, head);
    // Legs swing from hip/shoulder pivots.
    const legs: TransformNode[] = [];
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      const n = new TransformNode(`${kind}_leg`, this.scene);
      n.parent = root;
      n.position.set(x * L * 0.13, leg + 0.02, z * L * 0.32);
      const lg = new GeoBuilder(0.6);
      const r = kind === "buffalo" || kind === "cow" ? 0.07 : kind === "dog" ? 0.04 : 0.025;
      lg.cylinder(0, -leg, 0, r * 0.8, r, leg + 0.05, 6, coat);
      lg.cylinder(0, -leg, 0, r * 0.9, r * 0.9, 0.06, 6, kind === "buffalo" ? rgb("#111") : shade(coat, 0.6));
      mk(lg, `${kind}_legm`, n);
      legs.push(n);
    }
    const tail = new TransformNode(`${kind}_tail`, this.scene);
    tail.parent = root;
    tail.position.set(0, bodyY + (H - leg) * 0.2, -L * 0.47);
    const tg = new GeoBuilder(0.6);
    if (kind === "dog") tg.tube(new Vector3(0, 0, 0), new Vector3(0, 0.22, -0.18), 0.03, 5, coat);
    else if (kind === "cat") tg.tube(new Vector3(0, 0, 0), new Vector3(0, 0.25, -0.12), 0.02, 5, coat);
    else { tg.tube(new Vector3(0, 0, 0), new Vector3(0, -0.6, -0.08), 0.025, 4, coat); tg.ellipsoid(0, -0.65, -0.08, 0.05, 0.1, 0.05, 5, 3, rgb("#111")); }
    mk(tg, `${kind}_tailm`, tail);
    for (const m of parts) this.host.addCaster(m);
    return { root, legs, tail, head, meshes: parts };
  }

  spawn(kind: AnimalKind, x: number, z: number, resident = false, state: Animal["state"] = "wander"): Animal {
    const parts = this.build(kind, this.rng.int(1, 99999));
    const a: Animal = {
      kind, ...parts, pos: new Vector3(x, 0, z), facing: this.rng.next() * Math.PI * 2, vel: new Vector3(), state, t: this.rng.range(2, 8),
      goal: new Vector3(x, 0, z), phase: 0, body: null, node: null, barkT: 0, resident,
    };
    if (DEFS[kind].heavy) {
      const node = new TransformNode(`${kind}_col`, this.scene);
      node.position.set(x, DEFS[kind].height / 2, z);
      const sh = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(DEFS[kind].len * 0.42, DEFS[kind].height * 0.9, DEFS[kind].len), this.scene);
      sh.filterMembershipMask = Group.ANIMAL;
      sh.filterCollideMask = Group.VEHICLE | Group.PLAYER;
      const body = new PhysicsBody(node, PhysicsMotionType.ANIMATED, false, this.scene);
      body.shape = sh;
      body.setMassProperties({ mass: 500 });
      a.body = body;
      a.node = node;
    }
    a.root.position.copyFrom(a.pos);
    this.animals.push(a);
    return a;
  }

  remove(a: Animal): void {
    this.animals = this.animals.filter((x) => x !== a);
    for (const m of a.meshes) this.host.removeCaster(m);
    a.root.dispose();
    a.body?.dispose();
    a.node?.dispose();
  }

  /** Horn: dogs and cats scatter; buffaloes mostly ignore you. */
  horn(pos: Vector3): void {
    for (const a of this.animals) {
      const d = Vector3.Distance(a.pos, pos);
      if (d > 16) continue;
      if (DEFS[a.kind].heavy) {
        if (this.rng.next() < 0.3) { a.state = "wander"; a.goal = this.sideStep(a, pos, 6); a.t = 8; }
        else if (this.rng.next() < 0.5) this.host.sound("buffalo_moo", a.pos);
      } else if (a.state !== "chase") { a.state = "flee"; a.goal = this.sideStep(a, pos, 10); a.t = 3; }
    }
  }

  private sideStep(a: Animal, from: Vector3, dist: number): Vector3 {
    const dx = a.pos.x - from.x, dz = a.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    return new Vector3(a.pos.x + (dx / d) * dist, 0, a.pos.z + (dz / d) * dist);
  }

  /** A road node at a distance, for spawning. */
  private spawnSpot(minR: number, maxR: number): Vector3 | null {
    const p = this.host.playerPos();
    for (let i = 0; i < 12; i++) {
      const n = this.g.nodes[this.rng.int(0, this.g.nodes.length - 1)]!;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < minR || d > maxR || !n.road) continue;
      const x = n.x + this.rng.range(-8, 8), z = n.z + this.rng.range(-8, 8);
      if (!isOpenCountry(x, z)) continue;
      return new Vector3(x, 0, z);
    }
    return null;
  }

  fixedUpdate(dt: number): void {
    const p = this.host.playerPos();
    // Keep a few animals around the player out in the country.
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.5;
      for (const k of Object.keys(this.target) as AnimalKind[]) {
        const have = this.animals.filter((a) => a.kind === k && !a.resident).length;
        if (have < this.target[k]) {
          const s = this.spawnSpot(50, 170);
          if (s) this.spawn(k, s.x, s.z, false, k === "buffalo" && this.rng.next() < 0.5 ? "cross" : "wander");
          break;
        }
      }
      for (const a of [...this.animals]) if (!a.resident && Vector3.Distance(a.pos, p) > 230) this.remove(a);
    }
    const ride = this.host.playerRide();
    const movers = this.host.movers();
    for (const a of this.animals) {
      const D = DEFS[a.kind];
      a.t -= dt;
      a.barkT -= dt;
      let speed = 0;
      // Dogs chase passing two-wheelers, barking all the way.
      if (a.kind === "dog" && ride?.twoWheeler && ride.speed > 3 && a.state !== "sleep" && a.state !== "chase" && Vector3.Distance(a.pos, ride.pos) < 14 && this.rng.next() < dt * 2) {
        a.state = "chase";
        a.t = this.rng.range(5, 8);
      }
      switch (a.state) {
        case "sleep":
          if (a.t <= 0 && this.rng.next() < 0.02) { a.state = "wander"; a.t = 6; }
          break;
        case "chase": {
          if (!ride || a.t <= 0) { a.state = "wander"; a.t = 4; break; }
          // Run alongside the rider, a little behind and to the side.
          const side = new Vector3(Math.cos(a.facing), 0, -Math.sin(a.facing));
          a.goal = ride.pos.add(side.scale(1.8));
          speed = Math.min(D.run, ride.speed + 1.5);
          if (a.barkT <= 0) { a.barkT = this.rng.range(0.8, 1.6); this.host.sound("dog_bark", a.pos); }
          break;
        }
        case "flee":
          speed = D.run * 0.7;
          if (a.t <= 0) { a.state = "wander"; a.t = 5; }
          break;
        case "cross":
          speed = D.speed;
          if (Vector3.Distance(a.pos, a.goal) < 0.6 || a.t <= 0) {
            // Buffaloes like to stop in the middle of the road for a think.
            if (D.heavy && this.rng.next() < 0.6) { a.state = "stand"; a.t = this.rng.range(8, 20); if (this.rng.next() < 0.5) this.host.sound("buffalo_moo", a.pos); }
            else { a.state = "wander"; a.t = this.rng.range(3, 8); }
          }
          break;
        case "stand":
          if (a.t <= 0) { a.state = "cross"; a.goal = new Vector3(a.pos.x + this.rng.range(-12, 12), 0, a.pos.z + this.rng.range(-12, 12)); a.t = 25; }
          break;
        case "wander":
          speed = D.speed;
          if (Vector3.Distance(a.pos, a.goal) < 0.6 || a.t <= 0) {
            a.t = this.rng.range(4, 10);
            if (this.rng.next() < 0.4) { a.state = "stand"; a.t = this.rng.range(3, 8); }
            else if (a.kind === "dog" && this.rng.next() < 0.15) { a.state = "sleep"; a.t = 20; }
            else a.goal = new Vector3(a.pos.x + this.rng.range(-10, 10), 0, a.pos.z + this.rng.range(-10, 10));
            if (a.kind === "cat" && this.rng.next() < 0.3) { a.state = "cross"; a.goal = new Vector3(a.pos.x + this.rng.range(-14, 14), 0, a.pos.z + this.rng.range(-14, 14)); this.host.sound("cat_meow", a.pos); }
          }
          break;
      }
      // Small animals leap out of the way of anything fast.
      if (!D.heavy && a.state !== "chase") {
        for (const m of movers) {
          if (m.speed < 2) continue;
          const dx = a.pos.x - m.pos.x, dz = a.pos.z - m.pos.z;
          const ahead = dx * m.fwd.x + dz * m.fwd.z, lat = dx * m.fwd.z - dz * m.fwd.x;
          if (ahead > -1 && ahead < 4 + m.speed * 0.5 && Math.abs(lat) < 2) {
            const s = lat >= 0 ? 1 : -1;
            a.goal = new Vector3(a.pos.x + m.fwd.z * s * 4, 0, a.pos.z - m.fwd.x * s * 4);
            a.state = "flee";
            a.t = 1.2;
            if (ahead < 1.5) { a.pos.x += m.fwd.z * s * 1.2; a.pos.z -= m.fwd.x * s * 1.2; if (a.kind === "cat") this.host.sound("cat_meow", a.pos); }
            break;
          }
        }
      }
      // Move.
      const dx = a.goal.x - a.pos.x, dz = a.goal.z - a.pos.z, d = Math.hypot(dx, dz);
      const want = d > 0.3 ? new Vector3((dx / d) * speed, 0, (dz / d) * speed) : Vector3.Zero();
      a.vel.x += (want.x - a.vel.x) * Math.min(1, dt * (D.heavy ? 2 : 6));
      a.vel.z += (want.z - a.vel.z) * Math.min(1, dt * (D.heavy ? 2 : 6));
      // Animals stay out of the walled bazaar (except the ones who live there) and off the canal.
      const nx = a.pos.x + a.vel.x * dt, nz = a.pos.z + a.vel.z * dt;
      const inTown = nx > TOWN.x0 && nx < TOWN.x1 && nz > TOWN.z0 && nz < TOWN.z1;
      if ((a.resident || !inTown) && isOpenGround(nx, nz)) { a.pos.x = nx; a.pos.z = nz; }
      else { a.vel.scaleInPlace(-0.5); a.goal = a.pos.clone(); }
      const sp = Math.hypot(a.vel.x, a.vel.z);
      if (sp > 0.1) {
        const wantYaw = Math.atan2(a.vel.x, a.vel.z);
        const dy = Math.atan2(Math.sin(wantYaw - a.facing), Math.cos(wantYaw - a.facing));
        a.facing += dy * Math.min(1, dt * (D.heavy ? 2 : 7));
      }
      a.phase += dt * sp * (a.kind === "cat" ? 9 : a.kind === "dog" ? 6 : 2.2);
      if (a.node && a.body) {
        a.node.position.set(a.pos.x, D.height / 2, a.pos.z);
        a.body.setTargetTransform(a.node.position, Quaternion.RotationYawPitchRoll(a.facing, 0, 0));
      }
    }
  }

  /** Per-frame visuals: position, leg swing, tail wag, sleeping curl. */
  update(dt: number, camPos: Vector3): void {
    for (const a of this.animals) {
      const far = Vector3.Distance(camPos, a.pos) > 120;
      a.root.setEnabled(!far);
      if (far) continue;
      a.root.position.set(a.pos.x, a.state === "sleep" ? -DEFS[a.kind].legLen * 0.85 : 0, a.pos.z);
      a.root.rotation.y = a.facing;
      const sp = Math.hypot(a.vel.x, a.vel.z);
      const amp = Math.min(0.7, sp * (DEFS[a.kind].heavy ? 0.4 : 0.15));
      a.legs.forEach((l, i) => { l.rotation.x = a.state === "sleep" ? 1.4 : Math.sin(a.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp; });
      a.tail.rotation.x = a.kind === "dog" ? 0.3 * Math.sin(performance.now() / (a.state === "chase" ? 60 : 160)) : 0.2 * Math.sin(performance.now() / 700);
      a.tail.rotation.z = a.kind === "dog" ? 0.5 * Math.sin(performance.now() / 90) : 0;
      a.head.rotation.x = a.state === "chase" ? -0.2 : a.state === "stand" ? 0.25 + 0.1 * Math.sin(performance.now() / 900) : 0.05;
      void dt;
    }
  }

  clear(): void {
    for (const a of [...this.animals]) this.remove(a);
  }
}
