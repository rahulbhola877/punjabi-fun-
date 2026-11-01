import { Vector3 } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import { hillY } from "./hillTerrain";
import type { Kit } from "./Kit";

/** A footpath through the pine woods, from the railway clearing to the ridge. */
const WAYPOINTS: ReadonlyArray<readonly [number, number]> = [
  [1186, 574], [1216, 600], [1233, 621], [1260, 641],
  [1294, 654], [1330, 648], [1360, 638], [1390, 657], [1430, 684],
];
const WIDTH = 2.4;

/** Keep streamed grass and tree trunks off the same path that is drawn. */
export function onWoodlandTrail(x: number, z: number, extra = 0): boolean {
  if (x < 1184 - extra || x > 1432 + extra || z < 572 - extra || z > 686 + extra) return false;
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [ax, az] = WAYPOINTS[i - 1]!, [bx, bz] = WAYPOINTS[i]!;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < WIDTH / 2 + extra) return true;
  }
  return false;
}

/** Ribbon sampled against the same terrain height function used by the hill mesh and physics. */
export function woodlandTrail(kit: Kit): void {
  const col = rgb("#b3a283");
  const side = (i: number): readonly [number, number] => {
    const [ax, az] = WAYPOINTS[Math.max(0, i - 1)]!, [bx, bz] = WAYPOINTS[Math.min(WAYPOINTS.length - 1, i + 1)]!;
    const length = Math.hypot(bx - ax, bz - az);
    return [(bz - az) / length * WIDTH / 2, -(bx - ax) / length * WIDTH / 2];
  };
  let distance = 0;
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [ax, az] = WAYPOINTS[i - 1]!, [bx, bz] = WAYPOINTS[i]!;
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    const [nax, naz] = side(i - 1), [nbx, nbz] = side(i);
    const count = Math.ceil(length / 1.5);
    for (let j = 0; j < count; j++) {
      const t0 = j / count, t1 = (j + 1) / count;
      const x0 = ax + t0 * dx, z0 = az + t0 * dz, x1 = ax + t1 * dx, z1 = az + t1 * dz;
      const nx0 = nax + t0 * (nbx - nax), nz0 = naz + t0 * (nbz - naz);
      const nx1 = nax + t1 * (nbx - nax), nz1 = naz + t1 * (nbz - naz);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      kit.frame(cx, cz, 0, 0);
      const point = (x: number, z: number) => new Vector3(x - cx, hillY(x, z) + 0.07, z - cz);
      kit.g("dirt").quad(point(x0 - nx0, z0 - nz0), point(x0 + nx0, z0 + nz0),
        point(x1 + nx1, z1 + nz1), point(x1 - nx1, z1 - nz1), col, WIDTH / 5, (length / count) / 5, [0, distance / 5]);
      distance += length / count;
    }
  }
  // Two simple resting places beside the path, built into the terrain frame.
  for (const [x, z, yaw] of [[1266, 638, -0.5], [1395, 653, 0.6]] as const) {
    kit.frame(x, z, yaw);
    const wood = kit.g("wood");
    wood.box(0, 0.52, 0, 1.8, 0.12, 0.48, rgb("#a07b53"));
    wood.box(0, 0.95, -0.2, 1.8, 0.5, 0.1, rgb("#8b6948"));
    for (const s of [-0.7, 0.7]) wood.box(s, 0.25, 0, 0.1, 0.5, 0.35, rgb("#6d5037"));
  }
  kit.world();
}
