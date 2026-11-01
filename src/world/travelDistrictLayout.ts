/** Compact authored areas sharing the same world, not separate country maps. */
export const NORTH_AIRFIELD = { x0: 350, x1: 860, z0: 1640, z1: 1950 } as const;
export const CANADA_SET = { x0: 940, x1: 1450, z0: 1640, z1: 2040 } as const;
export const AIRFIELD_CHECKIN = { x: 635, z: 1672 } as const;
export const AIRFIELD_ARRIVAL = { x: 630, z: 1665 } as const;
export const CANADA_CHECKIN = { x: 1120, z: 1750 } as const;
export const CANADA_ARRIVAL = { x: 1108, z: 1748 } as const;
/** Local street and sidewalk centre lines in the Canada-inspired district. */
export const CANADA_MAIN_STREET = { x0: 1020, x1: 1370, z0: 1814, z1: 1826 } as const;
export const CANADA_CONNECTOR = { x0: 1041, x1: 1049, z0: 1700, z1: 1820 } as const;
export const CANADA_SIDEWALKS = [1809, 1831] as const;
/** Small local frontages with varied placement, scale, wall and roof tones. */
export const CANADA_HOMES = [
  { x: 1068, z: 1849, scale: 1.5, yaw: Math.PI, tint: [1, 0.9, 0.83] as const, roof: [0.85, 0.88, 0.95] as const },
  { x: 1094, z: 1846, scale: 1.8, yaw: Math.PI, tint: [0.82, 0.92, 1] as const, roof: [1, 0.9, 0.82] as const },
  { x: 1160, z: 1847, scale: 1.6, yaw: Math.PI, tint: [1, 0.97, 0.88] as const, roof: [0.9, 0.9, 0.95] as const },
  { x: 1185, z: 1850, scale: 1.85, yaw: Math.PI, tint: [0.83, 0.95, 0.87] as const, roof: [0.82, 0.86, 0.92] as const },
  { x: 1210, z: 1845, scale: 1.55, yaw: Math.PI, tint: [1, 0.88, 0.83] as const, roof: [1, 0.93, 0.87] as const },
  { x: 1237, z: 1848, scale: 1.75, yaw: Math.PI, tint: [0.85, 0.91, 1] as const, roof: [0.9, 0.86, 0.82] as const },
  { x: 1264, z: 1846, scale: 1.5, yaw: Math.PI, tint: [1, 0.94, 0.85] as const, roof: [0.8, 0.85, 0.9] as const },
  { x: 1291, z: 1850, scale: 1.9, yaw: Math.PI, tint: [0.88, 0.96, 0.9] as const, roof: [1, 0.91, 0.82] as const },
  { x: 1068, z: 1794, scale: 1.6, yaw: 0, tint: [0.83, 0.95, 0.87] as const, roof: [0.9, 0.88, 0.84] as const },
  { x: 1094, z: 1792, scale: 1.85, yaw: 0, tint: [1, 0.88, 0.83] as const, roof: [0.83, 0.9, 0.95] as const },
  { x: 1120, z: 1794, scale: 1.5, yaw: 0, tint: [0.85, 0.91, 1] as const, roof: [1, 0.9, 0.83] as const },
  { x: 1146, z: 1792, scale: 1.75, yaw: 0, tint: [1, 0.96, 0.86] as const, roof: [0.82, 0.87, 0.93] as const },
  { x: 1172, z: 1795, scale: 1.55, yaw: 0, tint: [0.84, 0.93, 0.91] as const, roof: [0.94, 0.88, 0.82] as const },
  { x: 1198, z: 1792, scale: 1.9, yaw: 0, tint: [1, 0.9, 0.86] as const, roof: [0.84, 0.89, 0.95] as const },
  { x: 1224, z: 1794, scale: 1.55, yaw: 0, tint: [0.84, 0.92, 1] as const, roof: [1, 0.9, 0.84] as const },
  { x: 1250, z: 1791, scale: 1.8, yaw: 0, tint: [1, 0.95, 0.85] as const, roof: [0.86, 0.89, 0.94] as const },
  { x: 1276, z: 1795, scale: 1.5, yaw: 0, tint: [0.86, 0.95, 0.89] as const, roof: [0.92, 0.86, 0.82] as const },
  { x: 1302, z: 1792, scale: 1.75, yaw: 0, tint: [1, 0.9, 0.84] as const, roof: [0.84, 0.89, 0.96] as const },
] as const;

/** Interleave distinct Tunyard silhouettes along both sides of the street. */
export function canadaHomeStyle(index: number): "cottage" | "bungalow" | "modern" {
  return index % 3 === 0 ? "cottage" : index % 3 === 1 ? "bungalow" : "modern";
}

/** Keep trees and large props out of streets, pavements and adjacent frontages. */
export function canadaStreetClearance(x: number, z: number): boolean {
  return (x >= 1010 && x <= 1380 && z >= 1805 && z <= 1835)
    || (x >= 1035 && x <= 1055 && z >= 1695 && z <= 1830)
    || (x >= 1103 && x <= 1109 && z >= 1743 && z <= 1809)
    || CANADA_HOMES.some((h, i) => {
      const style = canadaHomeStyle(i), s = h.scale * (style === "bungalow" ? 0.72 : style === "modern" ? 0.55 : 1);
      return Math.abs(x - h.x) <= (style === "bungalow" ? 5.2 : style === "modern" ? 7.8 : 3.1) * s + 4
        && Math.abs(z - h.z) <= (style === "bungalow" ? 7.2 : style === "modern" ? 10.5 : 3.2) * s + 4;
    })
    || (x >= 1117 && x <= 1143 && z >= 1838 && z <= 1858);
}

/** No streamed grass on the runway, paved apron or the snowy set. */
export function inTravelDistrict(x: number, z: number): boolean {
  return (x >= NORTH_AIRFIELD.x0 && x <= NORTH_AIRFIELD.x1 && z >= NORTH_AIRFIELD.z0 && z <= NORTH_AIRFIELD.z1)
    || (x >= CANADA_SET.x0 && x <= CANADA_SET.x1 && z >= CANADA_SET.z0 && z <= CANADA_SET.z1);
}
