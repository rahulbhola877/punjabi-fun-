import { Mesh, PhysicsBody, PhysicsMotionType, PhysicsShapeMesh, VertexData, type Scene } from "../babylon";
import { Group } from "../app/config";
import { terrainGrid } from "./hillTerrain";

/** The hillside of Sukh Pahar as one static triangle-mesh body, from the same grid the turf is drawn from. */
export function buildTerrainCollider(scene: Scene): PhysicsBody {
  const t = terrainGrid();
  const positions: number[] = [], indices: number[] = [];
  for (let j = 0; j < t.nz; j++) for (let i = 0; i < t.nx; i++) positions.push(t.x0 + i * t.step, t.y[j * t.nx + i]!, t.z0 + j * t.step);
  for (let j = 0; j < t.nz - 1; j++) for (let i = 0; i < t.nx - 1; i++) {
    const a = j * t.nx + i;
    indices.push(a, a + 1, a + t.nx + 1, a, a + t.nx + 1, a + t.nx);
  }
  const mesh = new Mesh("terrain_collider", scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.applyToMesh(mesh);
  mesh.isVisible = false;
  mesh.isPickable = false;
  const shape = new PhysicsShapeMesh(mesh, scene);
  shape.material = { friction: 0.8, restitution: 0.05 };
  shape.filterMembershipMask = Group.STATIC;
  const body = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
  body.shape = shape;
  return body;
}
