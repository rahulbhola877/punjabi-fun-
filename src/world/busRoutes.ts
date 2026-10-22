/**
 * The district's bus service: stops on the main roads and the routes that
 * link them. Shared by the scenery (shelters, country.ts) and the buses that
 * run them (traffic/Buses.ts). Each stop is a point on a road's centre line;
 * the shelter stands just off the tarmac on `side` (-1 west/south, +1
 * east/north of the road) and buses pull up in their own lane beside it.
 */
import { ROADS } from "./region";

export interface BusStop {
  id: string;
  /** Name on the board and in the conductor's call. */
  label: string;
  road: string;
  x: number;
  z: number;
  side: -1 | 1;
}

export const BUS_STOPS: BusStop[] = [
  { id: "ludhAdda", label: "Ludhiana Bus Adda", road: "ludhS0", x: -412, z: -385, side: 1 },
  { id: "ranggarh", label: "Ranggarh Mor", road: "gt", x: 22, z: -160, side: 1 },
  { id: "hospital", label: "Civil Hospital", road: "gt", x: 238, z: -160, side: -1 },
  { id: "nsAdda", label: "Nawan Shehar Bus Adda", road: "ave2", x: 400, z: -120, side: 1 },
  { id: "kotli", label: "Pind Kotli", road: "kotli", x: 0, z: 262, side: 1 },
  { id: "dhaliwal", label: "Pind Dhaliwal", road: "pindLink", x: 598, z: 720, side: -1 },
  { id: "bhangu", label: "Pind Bhangu", road: "pindLink", x: -598, z: 720, side: -1 },
];

export interface BusRoute {
  id: string;
  /** Board on the front: where it is going, both ways. */
  name: string;
  livery: "roadways" | "prtc";
  /** Stops in order; buses run to the end and back. */
  stops: string[];
  /** How many buses work the route. */
  buses: number;
}

export const BUS_ROUTES: BusRoute[] = [
  { id: "r1", name: "Ludhiana – Nawan Shehar", livery: "roadways", stops: ["ludhAdda", "ranggarh", "hospital", "nsAdda"], buses: 2 },
  { id: "r2", name: "Nawan Shehar – Pind Dhaliwal", livery: "prtc", stops: ["nsAdda", "kotli", "dhaliwal"], buses: 1 },
  { id: "r3", name: "Ranggarh – Pind Bhangu", livery: "prtc", stops: ["ranggarh", "kotli", "bhangu"], buses: 1 },
];

export const stopById = (id: string): BusStop => BUS_STOPS.find((s) => s.id === id)!;

/** Where the shelter stands: just off the tarmac on the stop's side. */
export function shelterSpot(s: BusStop): { x: number; z: number; yaw: number } {
  const r = ROADS.find((q) => q.id === s.road)!;
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const half = (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2;
  const off = half + 1.6;
  // Yaw: the shelter's open front faces the road.
  return alongX
    ? { x: s.x, z: s.z + s.side * off, yaw: s.side > 0 ? Math.PI : 0 }
    : { x: s.x + s.side * off, z: s.z, yaw: s.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
}
