/** The north-road rest stop, kept separate from fields and ground cover. */
export const NORTH_WAYSIDE = { x0: 178, x1: 222, z0: 1544, z1: 1611 } as const;
export const NORTH_WAYSIDE_CENTRE = { x: 201, z: 1591 } as const;

/** Clear only the pedestrian path and seating pad; leave the nearby meadow wild. */
export function onWaysideSurface(x: number, z: number): boolean {
  return (x >= 193.8 && x <= 198.2 && z >= 1542 && z <= 1582)
    || (x >= 191 && x <= 211 && z >= 1581 && z <= 1602);
}
