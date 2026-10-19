import {
  HavokPlugin, PhysicsBody, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeBox, PhysicsShapeContainer,
  PhysicsRaycastResult, Quaternion, Scene, TransformNode, Vector3, type PhysicsEngineV2 as PhysicsEngine,
} from "../babylon";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { FIXED_DT, GRAVITY, Group } from "../app/config";

/**
 * Owns the Havok world. The scene's automatic physics stepping is disabled;
 * `step` is called only from the fixed simulation clock.
 */
export class Physics {
  engine!: PhysicsEngine;
  plugin!: HavokPlugin;
  private ray = new PhysicsRaycastResult();

  /** @param wasmBinary optional pre-loaded WASM (used by headless tests in Node). */
  async init(scene: Scene, wasmBinary?: ArrayBuffer): Promise<void> {
    const hk = await HavokPhysics(wasmBinary ? { wasmBinary } : { locateFile: () => havokWasmUrl });
    this.plugin = new HavokPlugin(false, hk);
    scene.enablePhysics(new Vector3(0, GRAVITY, 0), this.plugin);
    // One authoritative clock: we step manually from FixedClock.
    scene.physicsEnabled = false;
    this.engine = scene.getPhysicsEngine() as PhysicsEngine;
    this.engine.setTimeStep(FIXED_DT);
  }

  step(dt: number): void {
    this.engine._step(dt);
  }

  /**
   * Teleport a body to its node's current transform. Works for bodies whose
   * pre-step sync is disabled (vehicles), which Havok otherwise refuses.
   */
  teleport(body: PhysicsBody, node: TransformNode): void {
    node.computeWorldMatrix(true);
    const prev = body.getPrestepType();
    body.setPrestepType(PhysicsPrestepType.TELEPORT);
    this.plugin.setPhysicsBodyTransformation(body, node);
    body.setPrestepType(prev);
  }

  /** Raycast returning hit info or null. The result object is reused. */
  raycast(from: Vector3, to: Vector3, collideWith: number, ignore?: PhysicsBody): PhysicsRaycastResult | null {
    this.engine.raycastToRef(from, to, this.ray, { collideWith, membership: 0xffff, ignoreBody: ignore });
    return this.ray.hasHit ? this.ray : null;
  }
}

/** Axis-aligned or Y-rotated solid box describing static collision. */
export interface ColliderBox {
  cx: number; cy: number; cz: number;
  sx: number; sy: number; sz: number;
  rotY: number;
  /** Optional pitch (about local X after yaw) for ramps and slopes. */
  rotX?: number;
}

/**
 * Accumulates static boxes and builds a few compound static bodies, one per
 * spatial chunk, which is far cheaper than one body per box.
 */
export class StaticColliderBuilder {
  readonly boxes: ColliderBox[] = [];

  add(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotY = 0, rotX = 0): void {
    if (sx <= 0.001 || sy <= 0.001 || sz <= 0.001) return;
    this.boxes.push({ cx, cy, cz, sx, sy, sz, rotY, rotX });
  }

  build(scene: Scene, chunkSize = 40): PhysicsBody[] {
    const chunks = new Map<string, ColliderBox[]>();
    for (const b of this.boxes) {
      const key = `${Math.floor(b.cx / chunkSize)},${Math.floor(b.cz / chunkSize)}`;
      const list = chunks.get(key) ?? [];
      list.push(b);
      chunks.set(key, list);
    }
    const bodies: PhysicsBody[] = [];
    for (const [key, list] of chunks) {
      const node = new TransformNode(`static_${key}`, scene);
      const container = new PhysicsShapeContainer(scene);
      for (const b of list) {
        const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(b.sx, b.sy, b.sz), scene);
        shape.material = { friction: 0.8, restitution: 0.05 };
        shape.filterMembershipMask = Group.STATIC;
        container.addChild(shape, new Vector3(b.cx, b.cy, b.cz), Quaternion.FromEulerAngles(b.rotX ?? 0, b.rotY, 0));
      }
      container.filterMembershipMask = Group.STATIC;
      const body = new PhysicsBody(node, PhysicsMotionType.STATIC, false, scene);
      body.shape = container;
      bodies.push(body);
    }
    return bodies;
  }
}
