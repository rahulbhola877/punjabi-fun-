import type { Rect } from "./layout";

/** Half-width of each paved arm of a park's cross-shaped path. */
export const PARK_PATH_HALF_WIDTH = 1.5;

/** The park path in world coordinates, optionally widened for vegetation clearance. */
export function onParkPath(park: Rect, x: number, z: number, margin = 0): boolean {
  const cx = (park.x0 + park.x1) / 2, cz = (park.z0 + park.z1) / 2;
  const width = PARK_PATH_HALF_WIDTH + margin;
  return (Math.abs(x - cx) <= width && z >= park.z0 - margin && z <= park.z1 + margin)
    || (Math.abs(z - cz) <= width && x >= park.x0 - margin && x <= park.x1 + margin);
}
