/**
 * Where people sit out in the colony galis and village mohallas: the same
 * spots get a manji or a plastic chair in the scenery (country.ts) and an
 * elder on it (countryFolk.ts), so nobody sits on thin air.
 */
import { COLONIES, type Colony } from "./colonies";
import { isOpenGround } from "./layout";
import { buildStreetWalkGraph, type NavGraph } from "./nav";

export interface ColonyLife { colony: Colony; graph: NavGraph; walks: Array<{ x: number; z: number }>; seats: Array<{ x: number; z: number; yaw: number }> }

let cache: ColonyLife[] | null = null;

export function colonyLife(): ColonyLife[] {
  if (cache) return cache;
  cache = COLONIES.map((c) => {
    const ids = c.roads.map((r) => r.id).filter((x) => x !== "pindMain" && x !== "pindCross");
    const graph = buildStreetWalkGraph(ids);
    const walks = graph.nodes.filter((nd) => nd.kind === "walk" && isOpenGround(nd.x, nd.z));
    const seats: ColonyLife["seats"] = [];
    for (let i = 0; i < Math.min(8, walks.length / 10); i++) {
      const nd = walks[(i * 37 + 17) % walks.length]!;
      // Back to the house: face the nearest gali centre (the graph tag is the road).
      const r = c.roads.find((q) => q.id === nd.tag);
      if (!r) continue;
      const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
      const yaw = alongX ? (nd.z < (r.z0 + r.z1) / 2 ? 0 : Math.PI) : (nd.x < (r.x0 + r.x1) / 2 ? Math.PI / 2 : -Math.PI / 2);
      seats.push({ x: nd.x, z: nd.z, yaw });
    }
    return { colony: c, graph, walks, seats };
  });
  return cache;
}
