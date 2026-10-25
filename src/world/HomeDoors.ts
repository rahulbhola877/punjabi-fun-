import { PhysicsBody, PhysicsMotionType, PhysicsShapeBox, Quaternion, TransformNode, Vector3, type Mesh, type Scene } from "../babylon";
import { Group } from "../app/config";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { ALWAYS_OPEN_IDS, HOUSE_BELLS, houseToWorld } from "./openHouses";

/** Real doors and colliders, shared by the invitation and closing animations. */
export class HomeDoors {
  private doors = new Map<string, Array<{ pivot: TransformNode; mesh: Mesh; body: PhysicsBody; shape: PhysicsShapeBox; node: TransformNode; closed: Vector3; yaw: number }>>();
  constructor(scene: Scene, mats: Materials) {
    for (const h of HOUSE_BELLS) {
      if (ALWAYS_OPEN_IDS.has(h.id)) continue;
      const parts = [];
      for (const [label, u, z, width, height, y] of [
        ["gate", h.gateU - h.gateWidth / 2, -0.1, h.gateWidth, 1.65, 0.05],
        ["door", h.doorU, -h.yd - 0.08, h.doorW, 2.25, h.plinth],
      ] as const) {
        const p = houseToWorld(h, u, z), centre = houseToWorld(h, u + width / 2, z);
        const pivot = new TransformNode(`${h.id}_${label}`, scene);
        pivot.position.set(p.x, y, p.z); pivot.rotation.y = h.rot;
        const g = new GeoBuilder(1);
        g.box(width / 2, height / 2, 0, width, height, 0.07, rgb(label === "gate" ? "#304b45" : "#765137"));
        g.box(width - 0.15, height / 2, 0.06, 0.07, 0.16, 0.06, rgb("#c7aa66"));
        const mesh = g.toMesh(`${h.id}_${label}_leaf`, scene, mats.get(label === "gate" ? "metal" : "wood"));
        mesh.parent = pivot; mesh.isPickable = false; mesh.receiveShadows = true;
        const node = new TransformNode(`${h.id}_${label}_collision`, scene);
        node.position.set(centre.x, y + height / 2, centre.z); node.rotationQuaternion = Quaternion.FromEulerAngles(0, h.rot, 0);
        const shape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(width, height, 0.16), scene);
        shape.filterMembershipMask = Group.STATIC;
        const body = new PhysicsBody(node, PhysicsMotionType.ANIMATED, false, scene); body.shape = shape;
        parts.push({ pivot, mesh, body, shape, node, closed: node.position.clone(), yaw: h.rot });
      }
      this.doors.set(h.id, parts);
    }
  }
  set(id: string, amount: number): void {
    for (const d of this.doors.get(id) ?? []) {
      d.mesh.rotation.y = amount * Math.PI / 2;
      // No invisible obstruction after the leaves are open; do not close while someone is inside.
      d.node.position.copyFrom(d.closed); if (amount > 0.7) d.node.position.y = -50;
      d.body.setTargetTransform(d.node.position, Quaternion.FromEulerAngles(0, d.yaw, 0));
    }
  }
  update(p: Vector3): void {
    for (const parts of this.doors.values()) for (const d of parts) {
      const visible = Vector3.DistanceSquared(p, d.closed) < 90 ** 2;
      if (d.mesh.isVisible !== visible) d.mesh.isVisible = visible;
    }
  }
  dispose(): void { for (const parts of this.doors.values()) for (const d of parts) { d.body.dispose(); d.shape.dispose(); d.node.dispose(); d.pivot.dispose(); } this.doors.clear(); }
}
