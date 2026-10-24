import type { VehicleType } from "./specs";

/**
 * Fuel. Every vehicle you drive has a tank (0 to 1). It runs down with the distance you cover; at empty the
 * engine dies, and you fill up at Panj Aab Fuels on the G.T. Road, or call Gurnam to bring a can.
 * Tanks are kept per vehicle id in the save, so the Bullet is as you left it.
 */

export interface Tank {
  /** Metres on a full tank. */
  range: number;
  /** Rupees to fill it from empty. */
  fill: number;
  /** What the pump calls it. */
  fuel: "petrol" | "diesel" | "CNG" | "charge";
}

export const TANKS: Partial<Record<VehicleType, Tank>> = {
  scooter: { range: 5500, fill: 180, fuel: "petrol" },
  motorcycle: { range: 6500, fill: 250, fuel: "petrol" },
  auto: { range: 5500, fill: 220, fuel: "CNG" },
  erickshaw: { range: 6500, fill: 60, fuel: "charge" },
  car: { range: 5500, fill: 600, fuel: "petrol" },
  jeep: { range: 4200, fill: 700, fuel: "diesel" },
  tractor: { range: 3500, fill: 500, fuel: "diesel" },
  truck: { range: 4500, fill: 900, fuel: "diesel" },
  bus: { range: 6000, fill: 1200, fuel: "diesel" },
};

/** At or below this a warning is shown. */
export const LOW_FUEL = 0.15;

/** What a can of petrol brought by Gurnam gives, and costs. */
export const CAN = { gives: 0.3, cost: 150 };

function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export class Fuel {
  constructor(public levels: Record<string, number>) {}

  /** The tank now. A vehicle never driven before has some in it (your own Bullet is full). */
  level(id: string, type: VehicleType): number {
    if (!TANKS[type]) return 1;
    let l = this.levels[id];
    if (l === undefined) {
      l = id === "bullet_ghar" ? 1 : 0.4 + (hashOf(id) % 60) / 100;
      this.levels[id] = l;
    }
    return l;
  }

  /** Run it down by a distance driven. Returns the new level. */
  burn(id: string, type: VehicleType, metres: number): number {
    const t = TANKS[type];
    if (!t) return 1;
    const l = Math.max(0, this.level(id, type) - metres / t.range);
    this.levels[id] = l;
    return l;
  }

  /** What it costs to fill the tank from here. */
  cost(id: string, type: VehicleType): number {
    const t = TANKS[type];
    return t ? Math.ceil((1 - this.level(id, type)) * t.fill) : 0;
  }

  fillUp(id: string): void {
    this.levels[id] = 1;
  }

  add(id: string, type: VehicleType, amount: number): void {
    this.levels[id] = Math.min(1, this.level(id, type) + amount);
  }

  /** For the save: levels rounded. */
  toJSON(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, l] of Object.entries(this.levels)) out[id] = Math.round(l * 1000) / 1000;
    return out;
  }
}
