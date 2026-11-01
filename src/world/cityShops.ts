import { TRADE } from "../missions/Shops";
import { MOBILE_SHOP, OUTER_BUILDINGS } from "./region";

/** A signed shop in Nawan Shehar or Ludhiana with someone behind the counter. */
export interface CityShop {
  /** Building id. */
  id: string;
  /** The keeper's resident id. */
  keeper: string;
  /** Sign key: which TRADE menu. */
  trade: string;
  /** Where the keeper stands, facing the customer. */
  x: number; z: number; yaw: number;
  /** Where the customer stands, on the footpath in front. */
  cx: number; cz: number;
}

/**
 * Every city or Chaura Bazaar shop whose sign has a menu. Pinka's mobile shop
 * (the first mission's) is left to Pinka.
 */
export const CITY_SHOPS: CityShop[] = OUTER_BUILDINGS.filter((b) => b.shop && TRADE[b.shop] && b.id !== MOBILE_SHOP.building && (b.style === "city" || b.id.startsWith("ludh"))).map((b) => {
  const nx = Math.round(Math.sin(b.face)), nz = Math.round(Math.cos(b.face));
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  // Front edge centre: half the depth out along the facing.
  const fx = nx ? (nx > 0 ? b.x1 : b.x0) : cx, fz = nz ? (nz > 0 ? b.z1 : b.z0) : cz;
  return { id: b.id, keeper: `keeper_${b.id}`, trade: b.shop!, x: fx - nx * 2.0, z: fz - nz * 2.0, yaw: b.face, cx: fx + nx * 0.9, cz: fz + nz * 0.9 };
});

// The authored café has a closed facade, so its keeper serves at a cleared
// outdoor approach. Keep it distinct from CITY_SHOPS: those keepers stand
// inside their generated building footprints.
export const OUTDOOR_SHOPS: CityShop[] = [
  { id: "canadaCafe", keeper: "keeper_canadaCafe", trade: "canadaCafe", x: 1130, z: 1839, yaw: Math.PI, cx: 1130, cz: 1837 },
];
export const ALL_CITY_SHOPS: CityShop[] = [...CITY_SHOPS, ...OUTDOOR_SHOPS];
