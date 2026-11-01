import { PhysicsBody, PhysicsMotionType, PhysicsShapeBox, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh, type Mesh } from "../babylon";
import { Group } from "../app/config";
import type { Physics } from "../physics/Physics";
import type { Materials } from "../render/Materials";
import { buildCrate } from "../vehicles/models";
import { canalWaterAt, submergedFraction, waterVelocityDelta } from "../physics/water";

/**
 * Sandbox props: crates and oil drums at the village ground, physical things to knock about. Each is a dynamic body with
 * its own weight. A kick on foot (the heavy button) sends the ones in front of you flying, and a vehicle shoves them as it
 * drives into them. Residents walk through them, so they never block the village.
 */

/** A kick reaches this far (m), and only what is within the cone of your facing (cos of the half-angle). */
export const KICK_REACH = 1.6;
export const KICK_CONE = 0.6;
/** The impulse a kick gives a prop at its nearest (N·s): a crate of 30 kg flies a few metres. */
export const KICK_IMPULSE = 220;

/**
 * How hard a kick pushes a prop at (x, z) from the kicker's feet along `dir` (both on the ground, dir a unit vector): zero
 * when it is out of reach or off to the side, full when it is at your toes and half at the edge of reach. Pure, so it is tested.
 */
export function kickStrength(feet: Point, dir: Point, prop: Point): number {
  const dx = prop.x - feet.x, dz = prop.z - feet.z;
  const d = Math.hypot(dx, dz);
  if (d > KICK_REACH || d < 1e-6) return 0;
  const cos = (dx * dir.x + dz * dir.z) / d;
  if (cos < KICK_CONE) return 0;
  return KICK_IMPULSE * cos * (1 - 0.5 * d / KICK_REACH);
}

/** Where the props lie, as metres from the village ground's centre (the kabaddi court), with each one's facing and kind. */
export const SANDBOX_SPOTS: Array<{ dx: number; dz: number; yaw: number; drum: boolean }> = [
  { dx: 14, dz: -6, yaw: 0.3, drum: false },
  { dx: 14, dz: 4, yaw: 1.1, drum: true },
  { dx: 15.5, dz: 10, yaw: 2.2, drum: false },
  { dx: -15, dz: 7, yaw: -0.6, drum: true },
];

export interface Point { x: number; z: number }

export interface SandboxHost {
  scene: Scene;
  mats: Materials;
  physics: Physics;
  caster: { addCaster(m: AbstractMesh): void; removeCaster(m: AbstractMesh): void };
}

interface Prop {
  root: TransformNode;
  body: PhysicsBody;
  shape: PhysicsShapeBox;
  meshes: Mesh[];
  mass: number;
  densityRatio: number;
  wet: boolean;
}

export class SandboxProps {
  private readonly props: Prop[] = [];
  private n = 0;
  /** A physical prop crosses the water surface, for shared sound/ripple effects. */
  onSplash: ((at: Vector3, strength: number) => void) | null = null;

  constructor(private readonly host: SandboxHost) {}

  /** A prop on the ground at (x, z), facing yaw: a crate, or an oil drum. */
  place(x: number, z: number, yaw: number, drum: boolean, y = 0.05): void {
    const h = this.host;
    const id = `sandbox${this.n++}`;
    const { root, meshes } = buildCrate(h.scene, h.mats, id, drum, "#2e5fa8");
    root.position.set(x, y, z);
    root.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
    for (const m of meshes) h.caster.addCaster(m);
    // The shape is a box the size of the prop, its centre half a metre up (the origin is on the ground).
    const shape = new PhysicsShapeBox(new Vector3(0, 0.45, 0), Quaternion.Identity(), new Vector3(0.9, 0.9, 0.9), h.scene);
    shape.filterMembershipMask = Group.PROP;
    shape.filterCollideMask = 0xffff & ~Group.RESIDENT;
    shape.material = { friction: 0.6, restitution: 0.08 };
    const body = new PhysicsBody(root, PhysicsMotionType.DYNAMIC, false, h.scene);
    body.shape = shape;
    const mass = drum ? 60 : 30;
    body.setMassProperties({ mass });
    // A crate's open gaps do not displace its entire bounding volume. This
    // effective displaced mass represents the wooden frame / closed drum.
    this.props.push({ root, body, shape, meshes, mass, densityRatio: 120 / mass, wet: false });
  }

  /** Add water forces before Havok's fixed step. Dry props do no force work. */
  fixedUpdate(dt: number): void {
    for (const p of this.props) {
      const at = p.root.position;
      const water = canalWaterAt(at.x, at.z);
      if (!water) { p.wet = false; continue; }
      // Body origin is the prop's bottom, not its centre of mass. Transform
      // the centre and vertical extent so a tumbling prop is not given a
      // spurious torque by applying buoyancy at an unrotated world offset.
      const matrix = p.root.computeWorldMatrix(true);
      const centre = Vector3.TransformCoordinates(new Vector3(0, 0.45, 0), matrix);
      const m = matrix.m;
      const halfHeight = 0.45 * (Math.abs(m[1]!) + Math.abs(m[5]!) + Math.abs(m[9]!));
      const fraction = submergedFraction(centre.y - halfHeight, halfHeight * 2, water.surfaceY);
      if (fraction <= 0) { p.wet = false; continue; }
      const velocity = p.body.getLinearVelocity();
      if (!p.wet) this.onSplash?.(new Vector3(at.x, water.surfaceY, at.z), Math.min(1, 0.15 + Math.abs(velocity.y) * 0.12));
      p.wet = true;
      const dv = waterVelocityDelta(velocity, water, dt, fraction, p.densityRatio);
      p.body.applyImpulse(new Vector3(dv.x * p.mass, dv.y * p.mass, dv.z * p.mass), centre);
      p.body.setAngularVelocity(p.body.getAngularVelocity().scale(Math.exp(-2 * fraction * dt)));
    }
  }

  /** A kick from the feet along `dir` (horizontal, unit): every prop in reach in front of you is pushed. Returns how many. */
  kick(feet: Vector3, dir: Vector3): number {
    let moved = 0;
    for (const p of this.props) {
      const s = kickStrength({ x: feet.x, z: feet.z }, { x: dir.x, z: dir.z }, { x: p.root.position.x, z: p.root.position.z });
      if (s <= 0) continue;
      // Pushed at its middle, so it slides rather than spinning over on its base.
      p.body.applyImpulse(new Vector3(dir.x * s, s * 0.35, dir.z * s), p.root.position.add(new Vector3(0, 0.45, 0)));
      moved++;
    }
    return moved;
  }

  /** Where every prop is now, for the probes. */
  positions(): Array<{ x: number; z: number; y: number }> {
    return this.props.map((p) => ({ x: +p.root.position.x.toFixed(2), z: +p.root.position.z.toFixed(2), y: +p.root.position.y.toFixed(2) }));
  }

  /** Take every prop out of the world (a new game puts them back). */
  clear(): void {
    for (const p of this.props) {
      for (const m of p.meshes) this.host.caster.removeCaster(m);
      p.body.dispose();
      p.shape.dispose();
      p.root.dispose();
    }
    this.props.length = 0;
  }
}
