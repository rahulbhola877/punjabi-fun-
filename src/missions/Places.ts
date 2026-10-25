import { HOME } from "../world/home";
import { POIS } from "../world/layout";
import { SITES } from "../world/region";
import { FAMOUS_PLACES } from "./Travel";

/** A place you can ask for a route to (map "Route to…" list). */
export interface RoutePlace { id: string; label: string; x: number; z: number }

/** Where a site is entered from: the middle of its street (south) side, just outside the wall. */
function gateOf(id: string): { x: number; z: number } | null {
  const s = SITES.find((q) => q.id === id);
  return s ? { x: (s.x0 + s.x1) / 2, z: s.id === "bypassFuel" || s.id === "bypassDhaba" ? s.z1 + 3 : s.z0 - 3 } : null;
}

/**
 * The places a player goes back to: home first, the people who give work,
 * the gurdwara and mandir near home, then the district's famous places from
 * the travel stand. Used for routes (no fare, you ride there yourself).
 */
export const ROUTE_PLACES: RoutePlace[] = (() => {
  const out: RoutePlace[] = [];
  const add = (id: string, label: string, p: { x: number; z: number } | null | undefined) => { if (p && !out.some((o) => o.id === id)) out.push({ id, label, x: p.x, z: p.z }); };
  if (HOME) add("ghar", "🏠 Ghar (home), Sant Nagar", HOME.gate);
  add("bhola", "🍲 Bhola's Dhaba (delivery jobs)", POIS.dhabaCounter);
  add("gurnam", "🔧 Gurnam Motor Works", POIS.workshop);
  add("gurdwara", "☬ Gurdwara Singh Sabha, Sant Nagar", gateOf("santGurdwara"));
  add("mandir", "🛕 Shiv Mandir, Guru Nanak Nagar", gateOf("gnnMandir"));
  add("akhada", "💪 Kotli Akhada (dangal)", POIS.akhada);
  add("bypassNagar", "Nava Bypass Nagar", { x: -1005, z: -600 });
  for (const s of SITES.filter(s => s.id.startsWith("bypass"))) add(s.id, s.label, gateOf(s.id));
  for (const p of FAMOUS_PLACES) if (p.id !== "ghar") add(p.id, p.label, p);
  return out;
})();
