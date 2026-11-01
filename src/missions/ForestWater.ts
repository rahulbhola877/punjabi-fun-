import { MeshBuilder, Vector3, type Mesh, type Scene } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { hillY } from "../world/hillTerrain";

/** A one-off repair, persisted in the existing numeric save dictionary. */
export const FOREST_RANGER = { x: -895, z: 1900 } as const;
export const FOREST_CHANNEL = { x: -883, z: 1909 } as const;
export const FOREST_BLOCKAGE = { x: -874, z: 1918 } as const;
export const FOREST_GATE = { x: -867, z: 1928 } as const;
const KEY = "forestWaterStage";
/** 0 available; 1 inspect; 2 clear; 3 choose; 4/5 report pool/hillside; 6/7 completed. */
export function forestWaterStage(home: Record<string, number>): number {
  const n = home[KEY];
  return Number.isInteger(n) && n! >= 0 && n! <= 7 ? n! : 0;
}
export function forestWaterActive(home: Record<string, number>): boolean {
  const stage = forestWaterStage(home);
  return stage >= 1 && stage <= 5;
}
export function advanceForestWater(home: Record<string, number>, from: number, to: number): boolean {
  const allowed = (from === 0 && to === 1) || (from === 1 && to === 2) || (from === 2 && to === 3)
    || (from === 3 && (to === 4 || to === 5)) || (from === 4 && to === 6) || (from === 5 && to === 7);
  if (!allowed || forestWaterStage(home) !== from) return false;
  home[KEY] = to;
  return true;
}

/** Physical evidence of the repair. Two separate outlets retain the player's choice on reload. */
export class ForestWaterProps {
  private obstruction: Mesh[] = [];
  private pool: Mesh[] = [];
  private hillside: Mesh[] = [];
  constructor(scene: Scene, mats: Materials) {
    // The channel lies beside the walking trail; all surfaces sample the ridge,
    // and short segments follow its actual triangles instead of hovering on a slope.
    const trunk: Array<readonly [number, number]> = [[-869, 1928], [-876, 1919], [-884, 1910]];
    const poolBranch: Array<readonly [number, number]> = [[-884, 1910], [-888, 1906], [-890, 1904]];
    const hillsideBranch: Array<readonly [number, number]> = [[-884, 1910], [-881, 1906], [-877, 1903]];
    const bed = new GeoBuilder(), banks = new GeoBuilder();
    const stream = new GeoBuilder(), pool = new GeoBuilder(), hillside = new GeoBuilder();
    const strip = (g: GeoBuilder, path: Array<readonly [number, number]>, width: number, offset: number, lift: number, color: ReturnType<typeof rgb>) => {
      for (let k = 1; k < path.length; k++) {
        const [ax, az] = path[k - 1]!, [bx, bz] = path[k]!;
        const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
        const point = (t: number, side: number) => {
          const x = ax + dx * t + nx * (offset + side * width / 2), z = az + dz * t + nz * (offset + side * width / 2);
          return new Vector3(x, hillY(x, z) + lift, z);
        };
        const count = Math.ceil(length / 0.8);
        for (let i = 0; i < count; i++) { const a = i / count, b = (i + 1) / count; g.quad(point(a, -1), point(b, -1), point(b, 1), point(a, 1), color); }
      }
    };
    for (const path of [trunk, poolBranch, hillsideBranch]) {
      strip(bed, path, 1.45, 0, 0.14, rgb("#665b46"));
      for (const side of [-0.82, 0.82]) strip(banks, path, 0.25, side, 0.18, rgb("#9a8e73"));
    }
    strip(stream, trunk, 1.05, 0, 0.19, rgb("#a6d6d0"));
    strip(pool, poolBranch, 1.05, 0, 0.19, rgb("#a6d6d0"));
    strip(bed, [[-890, 1905], [-890, 1903]], 3.0, 0, 0.14, rgb("#665b46"));
    strip(pool, [[-890, 1905], [-890, 1903]], 2.6, 0, 0.19, rgb("#a6d6d0"));
    strip(hillside, hillsideBranch, 1.05, 0, 0.19, rgb("#a6d6d0"));
    for (const [g, name, material] of [[bed, "forest_channel_bed", "dirt"], [banks, "forest_channel_banks", "concrete"]] as const) {
      const mesh = g.toMesh(name, scene, mats.get(material)); mesh.isPickable = false;
    }
    const commonWater = stream.toMesh("forest_spring_water", scene, mats.get("water")); commonWater.isPickable = false;
    const poolWater = pool.toMesh("forest_pool_water", scene, mats.get("water")); poolWater.isPickable = false;
    const hillWater = hillside.toMesh("forest_hillside_water", scene, mats.get("water")); hillWater.isPickable = false;
    this.pool = [commonWater, poolWater]; this.hillside = [hillWater];
    // A small sluice frame at the head gives the gate interaction a physical object.
    const gateY = hillY(-869, 1928);
    const gate = new GeoBuilder(), timber = rgb("#6c5135"), iron = rgb("#68716a");
    gate.box(-869.8, gateY + 0.55, 1928, 0.18, 1.1, 0.18, timber);
    gate.box(-868.2, gateY + 0.55, 1928, 0.18, 1.1, 0.18, timber);
    gate.box(-869, gateY + 1.08, 1928, 1.8, 0.16, 0.2, timber);
    gate.box(-869, gateY + 0.65, 1928, 0.12, 0.75, 0.12, iron);
    const gateMesh = gate.toMesh("forest_sluice_gate", scene, mats.get("wood")); gateMesh.isPickable = false;
    for (let i = 0; i < 3; i++) {
      const x = -876 + (i - 1) * 0.38, z = 1919 + i * 0.28;
      const log = MeshBuilder.CreateCylinder(`forest_water_log_${i}`, { height: 2.1 - i * 0.2, diameter: 0.3, tessellation: 8 }, scene);
      log.position.set(x, hillY(x, z) + 0.23 + i * 0.15, z);
      log.rotation.set(Math.PI / 2, 0.3 + i * 0.65, 0); log.material = mats.get("tunyardBark"); log.isPickable = false;
      this.obstruction.push(log);
    }
  }
  sync(home: Record<string, number>): void {
    const s = forestWaterStage(home);
    for (const m of this.obstruction) m.setEnabled(s < 3);
    for (const m of this.pool) m.setEnabled(s === 4 || s === 6);
    if (s === 5 || s === 7) this.pool[0]!.setEnabled(true);
    for (const m of this.hillside) m.setEnabled(s === 5 || s === 7);
  }
}
