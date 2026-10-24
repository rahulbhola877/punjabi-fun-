import { Mesh, PhysicsBody, PhysicsMotionType, PhysicsShapeBox, Quaternion, StandardMaterial, Color3, TransformNode, Vector3 } from "../babylon";
import type { Scene } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { Group } from "../app/config";
import { RAIL, GATE_SECONDS, gateClosed, trainAt, type TrainAt } from "./Rail";

/**
 * The moving parts of the railway (the track itself is scenery, see country.ts): the two boom gates at the
 * Kotli road crossing with their flashing lamps, and the goods train that runs the line. Everything is read
 * off the game clock (world/Rail.ts); the gates and the wagons are solid to vehicles.
 */

const RED = rgb("#c62828"), WHITE = rgb("#f2efe6"), DARK = rgb("#2b2b2e"), STEEL = rgb("#555a5e");
/** How far a raised gate leans over (radians). */
const OPEN_ANGLE = 1.45;

interface Gate {
  pivot: TransformNode;
  arm: Mesh;
  /** The side of the road it stands on: -1 west (south gate, traffic going north), +1 east. */
  side: -1 | 1;
  body: PhysicsBody;
  node: TransformNode;
  lamps: Mesh[];
}

interface Unit { root: TransformNode; len: number; body: PhysicsBody; node: TransformNode }

export interface RailState {
  /** Gates are coming down or down (cars must stop). */
  closed: boolean;
  /** 0 down, 1 raised. */
  open: number;
  train: TrainAt | null;
}

export class RailWorld {
  private gates: Gate[] = [];
  private openAmt = 1;
  private train: TransformNode;
  private units: Unit[] = [];
  private lampOn: StandardMaterial;
  private lampOff: StandardMaterial;
  state: RailState = { closed: false, open: 1, train: null };

  constructor(private scene: Scene, private mats: Materials) {
    this.lampOn = new StandardMaterial("railLampOn", scene);
    this.lampOn.disableLighting = true;
    this.lampOn.emissiveColor = new Color3(1, 0.15, 0.1);
    this.lampOff = new StandardMaterial("railLampOff", scene);
    this.lampOff.disableLighting = true;
    this.lampOff.emissiveColor = new Color3(0.22, 0.04, 0.03);
    // The crossing sits on the Kotli road: the south gate shuts the lane going north (the left, x < 0), the north gate the lane going south.
    this.gates.push(this.makeGate(-1), this.makeGate(1));
    this.train = new TransformNode("train", scene);
    this.buildTrain();
    this.train.setEnabled(false);
  }

  private mesh(name: string, g: GeoBuilder, parent: TransformNode): Mesh {
    const m = g.toMesh(name, this.scene, this.mats.get("paint"));
    m.isPickable = false;
    m.parent = parent;
    return m;
  }

  private blocker(id: string, w: number, h: number, l: number): { node: TransformNode; body: PhysicsBody } {
    const node = new TransformNode(`${id}_col`, this.scene);
    node.position.y = -60;
    const sh = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(w, h, l), this.scene);
    sh.filterMembershipMask = Group.ANIMAL;
    sh.filterCollideMask = Group.VEHICLE | Group.PLAYER;
    const body = new PhysicsBody(node, PhysicsMotionType.ANIMATED, false, this.scene);
    body.shape = sh;
    body.setMassProperties({ mass: 4000 });
    return { node, body };
  }

  // ------------------------------------------------------------------ the gates

  private makeGate(side: -1 | 1): Gate {
    // The post stands at the edge of the road, 4.4 m from the track on this lane's side of the line, and the arm
    // reaches across its half of the carriageway to the middle.
    const z = RAIL.z + (side < 0 ? -4.4 : 4.4);
    const x = RAIL.crossX + side * 5.0;
    const pivot = new TransformNode(`gate${side}`, this.scene);
    pivot.position.set(x, 1.05, z);
    // Post, with a lamp box on each side.
    const post = new GeoBuilder(1);
    post.boxMinMax(-0.17, -1.05, -0.17, 0.17, 0.5, 0.17, rgb("#e9e4d6"));
    post.boxMinMax(-0.17, -1.05, -0.17, 0.17, -0.35, 0.17, RED);
    post.boxMinMax(-0.3, 0.5, -0.26, 0.3, 1.05, 0.26, DARK);
    this.mesh(`gatePost${side}`, post, pivot).position.set(0, 0, 0);
    const lamps: Mesh[] = [];
    for (const k of [-1, 1]) {
      const lamp = new GeoBuilder(1);
      lamp.boxMinMax(-0.1, -0.1, -0.03, 0.1, 0.1, 0.03, [1, 1, 1]);
      const m = lamp.toMesh(`gateLamp${side}${k}`, this.scene, this.lampOff);
      m.isPickable = false;
      m.parent = pivot;
      // On the faces toward the road (north and south), at the top of the post.
      m.position.set(0, 0.78, k * 0.27);
      lamps.push(m);
    }
    // The arm: red and white in 0.6 m bands, 4.8 m long, hinged at the post.
    const arm = new GeoBuilder(1);
    const sx = side < 0 ? 1 : -1; // east of a west post, west of an east post
    for (let i = 0; i < 8; i++) {
      const a0 = i * 0.6 * sx, a1 = (i + 1) * 0.6 * sx;
      arm.boxMinMax(Math.min(a0, a1), -0.09, -0.06, Math.max(a0, a1), 0.09, 0.06, i % 2 ? WHITE : RED);
    }
    const armMesh = this.mesh(`gateArm${side}`, arm, pivot);
    const { node, body } = this.blocker(`gate${side}`, 4.8, 0.3, 0.3);
    return { pivot, arm: armMesh, side, body, node, lamps };
  }

  // ------------------------------------------------------------------ the train

  private unit(parts: (g: GeoBuilder) => void, len: number, offset: number, name: string): void {
    const g = new GeoBuilder(1);
    parts(g);
    const root = new TransformNode(`${name}_u`, this.scene);
    root.parent = this.train;
    root.position.set(0, 0, -(offset + len / 2));
    this.mesh(name, g, root);
    const { node, body } = this.blocker(name, 3.0, 3.6, len);
    this.units.push({ root, len, body, node });
  }

  private bogies(g: GeoBuilder, len: number): void {
    for (const z of [-len / 2 + 2.2, len / 2 - 2.2]) {
      g.boxMinMax(-1.35, 0.35, z - 1.5, 1.35, 0.95, z + 1.5, DARK);
      // The wheels, as dark discs seen from the side: four to a bogie.
      for (const wz of [-1.0, 1.0]) for (const wx of [-1.5, 1.5]) g.boxMinMax(wx - 0.06, 0.05, z + wz - 0.45, wx + 0.06, 0.95, z + wz + 0.45, STEEL);
    }
  }

  private buildTrain(): void {
    let off = 0;
    // The loco: a long-hood diesel in blue and yellow, a cab at one end.
    const LOCO = 16;
    this.unit((g) => {
      const blue = rgb("#1d4f91"), yellow = rgb("#f0b323");
      this.bogies(g, LOCO);
      g.boxMinMax(-1.5, 0.95, -LOCO / 2, 1.5, 2.9, LOCO / 2, blue);
      g.boxMinMax(-1.52, 1.55, -LOCO / 2, 1.52, 1.7, LOCO / 2, yellow);
      // Cab at the front (+z is the nose), hood behind it.
      g.boxMinMax(-1.45, 2.9, LOCO / 2 - 4.2, 1.45, 4.2, LOCO / 2 - 0.2, blue);
      g.boxMinMax(-1.0, 3.3, LOCO / 2 - 0.22, 1.0, 3.95, LOCO / 2 - 0.1, rgb("#9fc3d6"));
      g.boxMinMax(-1.46, 4.2, LOCO / 2 - 4.25, 1.46, 4.3, LOCO / 2 - 0.15, yellow);
      g.boxMinMax(-1.5, 0.95, LOCO / 2 - 0.2, 1.5, 2.9, LOCO / 2, yellow);
      for (let i = 0; i < 6; i++) g.boxMinMax(-1.4, 2.9, -LOCO / 2 + 1.0 + i * 1.7, 1.4, 3.35, -LOCO / 2 + 1.0 + i * 1.7 + 1.1, rgb("#2a4a78"));
      // The headlight.
      g.boxMinMax(-0.18, 2.1, LOCO / 2, 0.18, 2.4, LOCO / 2 + 0.06, rgb("#fff3c4"));
    }, LOCO, off, "loco");
    off += LOCO + 0.9;
    const colours = ["#7a4a2c", "#8d3b2a", "#5f6b6a", "#7a4a2c", "#40505e", "#8d3b2a", "#6b5a3a"];
    for (let i = 0; i < colours.length; i++) {
      const W = 12.0, body = rgb(colours[i]!), rib = rgb("#2b2625");
      this.unit((g) => {
        this.bogies(g, W);
        g.boxMinMax(-1.5, 0.95, -W / 2, 1.5, 3.6, W / 2, body);
        for (let k = 0; k < 11; k++) { const z = -W / 2 + 0.6 + k * 1.0; g.boxMinMax(-1.53, 0.95, z, 1.53, 3.6, z + 0.12, rib); }
        g.boxMinMax(-1.55, 3.6, -W / 2, 1.55, 3.7, W / 2, rib);
        // A sliding door, a darker panel.
        g.boxMinMax(-1.56, 1.3, -1.3, 1.56, 3.2, 1.3, rgb("#3a3330"));
      }, W, off, `wagon${i}`);
      off += W + 0.9;
    }
  }

  // ------------------------------------------------------------------ per frame

  /** Move everything to the game clock `t` (seconds). `cam` is the camera, for switching what is far off. */
  update(t: number, dt: number, cam: Vector3): RailState {
    const closed = gateClosed(t);
    const target = closed ? 0 : 1;
    const step = dt / GATE_SECONDS;
    this.openAmt = this.openAmt < target ? Math.min(target, this.openAmt + step) : Math.max(target, this.openAmt - step);
    const near = Math.abs(cam.x - RAIL.crossX) < 220 && Math.abs(cam.z - RAIL.z) < 220;
    const ang = this.openAmt * OPEN_ANGLE;
    const flash = (this.openAmt < 1) && Math.floor(t * 1.8) % 2 === 0;
    for (const g of this.gates) {
      g.pivot.setEnabled(near);
      // Lift the arm: the tip rises when the rotation about z turns +x toward +y (west gate) or -x toward +y (east gate).
      g.pivot.rotation.z = 0;
      g.arm.rotation.z = g.side < 0 ? ang : -ang;
      g.lamps[0]!.material = flash ? this.lampOn : this.lampOff;
      g.lamps[1]!.material = this.openAmt < 1 && !flash ? this.lampOn : this.lampOff;
      // Solid only while it lies across the road.
      const down = this.openAmt < 0.25;
      g.node.position.set(g.pivot.position.x - g.side * 2.4, down ? 1.0 : -60, g.pivot.position.z);
      g.body.setTargetTransform(g.node.position, Quaternion.Identity());
    }
    const tr = trainAt(t);
    const trainNear = !!tr && Math.abs(cam.z - RAIL.z) < 600 && Math.abs(cam.x - (tr.x - tr.dir * RAIL.length / 2)) < 650;
    this.train.setEnabled(trainNear);
    if (tr && trainNear) {
      this.train.position.set(tr.x, 0.18, RAIL.z);
      // Local +z is the nose: it points east for dir = +1.
      this.train.rotation.y = tr.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.train.computeWorldMatrix(true);
      for (const u of this.units) {
        const w = u.root.getAbsolutePosition();
        u.node.position.set(w.x, 2.0, w.z);
        u.body.setTargetTransform(u.node.position, Quaternion.RotationYawPitchRoll(this.train.rotation.y, 0, 0));
      }
    } else for (const u of this.units) { u.node.position.y = -60; u.body.setTargetTransform(u.node.position, Quaternion.Identity()); }
    this.state = { closed, open: this.openAmt, train: tr };
    return this.state;
  }

  dispose(): void {
    for (const g of this.gates) { g.body.dispose(); g.node.dispose(); g.pivot.dispose(); }
    for (const u of this.units) { u.body.dispose(); u.node.dispose(); }
    this.train.dispose();
  }
}

