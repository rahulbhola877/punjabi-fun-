/** Northern orchard reserve, reached from the new northern road. */
export const ORCHARD = { x0: 220, x1: 600, z0: 1240, z1: 1460 } as const;
export const ORCHARD_STEP = 4;
/** Picnic shelter centre and footprint, shared with streamed ground cover. */
export const ORCHARD_PICNIC = { x: 371, z: 1344, halfWidth: 2.5, halfDepth: 2.2 } as const;

/** Gentle knolls taper to the surrounding ground inside the reserve. */
export function orchardHeight(x: number, z: number): number {
  const mound = (cx: number, cz: number, rx: number, rz: number, h: number) => {
    const d = Math.hypot((x - cx) / rx, (z - cz) / rz);
    return d < 1 ? h * (0.5 + 0.5 * Math.cos(Math.PI * d)) : 0;
  };
  return mound(360, 1350, 125, 92, 6.5) + mound(515, 1368, 78, 74, 4.5);
}
