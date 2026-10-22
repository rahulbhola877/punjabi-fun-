/**
 * Bus and auto travel between the famous places of the district.
 *
 * The map is 1.4 km across and Ludhiana is a long ride from the bazaar, so
 * there is a stand button on the HUD: pick a place, pay the fare, and you are
 * dropped there. It is deliberately not free and deliberately not available
 * mid-job — a delivery with a timer, a passenger in the auto or the police on
 * your back all have to be dealt with the hard way.
 */

export interface Place {
  id: string;
  /** What the board at the stand says. */
  label: string;
  /** Which part of the district it is in, for the menu. */
  area: string;
  x: number;
  z: number;
  /** Facing on arrival (radians, 0 = +Z). */
  yaw: number;
}

export const FAMOUS_PLACES: Place[] = [
  { id: "bazaar", label: "Ranggarh bazaar gate", area: "Ranggarh", x: 0, z: -70, yaw: 0 },
  { id: "dhabaGate", label: "Bhole Da Dhaba", area: "Ranggarh", x: -5.4, z: -40, yaw: Math.PI / 2 },
  { id: "sherDhaba", label: "Sher-e-Punjab Dhaba, G.T. Road", area: "G.T. Road", x: 66, z: -176, yaw: Math.PI },
  { id: "petrol", label: "Panj Aab Fuels pump", area: "G.T. Road", x: 142.5, z: -176, yaw: Math.PI },
  { id: "busAdda", label: "Bus Adda, Nawan Shehar", area: "Nawan Shehar", x: 468, z: -84, yaw: Math.PI },
  { id: "ghantaGhar", label: "Ghanta Ghar Chowk", area: "Nawan Shehar", x: 321, z: 42, yaw: Math.PI / 2 },
  { id: "mandi", label: "Anaj Mandi", area: "Nawan Shehar", x: 250, z: -82, yaw: 0 },
  { id: "cinema", label: "Raj Talkies", area: "Nawan Shehar", x: 428, z: 45, yaw: Math.PI },
  { id: "ludhAdda", label: "Ludhiana Bus & Auto Adda", area: "Ludhiana", x: -412, z: -340, yaw: 0 },
  { id: "ludhChowk", label: "Ludhiana Ghanta Ghar", area: "Ludhiana", x: -468, z: -266, yaw: 0 },
  { id: "ludhBazaar", label: "Chaura Bazaar (Dal Bazaar gali)", area: "Ludhiana", x: -415, z: -245, yaw: 0 },
  { id: "ludhMandi", label: "Ludhiana Sabzi Mandi", area: "Ludhiana", x: -527, z: -340, yaw: 0 },
  { id: "pind", label: "Pind Kotli chowk", area: "Pind Kotli", x: -12, z: 316, yaw: Math.PI },
  { id: "akhada", label: "Kotli Akhada", area: "Pind Kotli", x: -31.5, z: 347, yaw: -Math.PI / 2 },
  { id: "gurdwara", label: "Gurdwara Sahib", area: "Pind Kotli", x: 67, z: 327, yaw: Math.PI },
  { id: "gnn", label: "Guru Nanak Nagar", area: "Ranggarh", x: -167, z: 0, yaw: Math.PI / 2 },
  { id: "sant", label: "Sant Nagar", area: "Ranggarh", x: 92, z: 0, yaw: Math.PI / 2 },
  { id: "model", label: "Model Town", area: "Nawan Shehar", x: 550, z: 0, yaw: Math.PI / 2 },
  { id: "estate", label: "Urban Estate", area: "Nawan Shehar", x: 250, z: 192, yaw: Math.PI / 2 },
  { id: "sarabha", label: "Sarabha Nagar", area: "Ludhiana", x: -515, z: -480, yaw: Math.PI / 2 },
  { id: "kitchlu", label: "Kitchlu Nagar", area: "Ludhiana", x: -215, z: -290, yaw: Math.PI / 2 },
  { id: "dhaliwal", label: "Pind Dhaliwal", area: "Villages", x: 700, z: 720, yaw: Math.PI / 2 },
  { id: "bhangu", label: "Pind Bhangu", area: "Villages", x: -700, z: 720, yaw: -Math.PI / 2 },
];

/** Bus fare: a base charge plus a few paise a metre, rounded to ₹5. */
export function fare(fromX: number, fromZ: number, p: Place): number {
  const d = Math.hypot(p.x - fromX, p.z - fromZ);
  return Math.max(5, Math.round((8 + d * 0.035) / 5) * 5);
}

/** The nearest place to a point, if the player is practically standing on it. */
export function placeAt(x: number, z: number, within = 25): Place | null {
  let best: Place | null = null, bd = within;
  for (const p of FAMOUS_PLACES) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
