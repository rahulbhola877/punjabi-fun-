import type { InstancedMesh, Material, Mesh, Scene } from "../babylon";
import { GeoBuilder, rgb, type RGB } from "../render/GeoBuilder";

/** Chhatri colours: mostly black, some bright ones (and the odd rainbow-ish one). */
const COLOURS: RGB[] = [rgb("#1b1b1f"), rgb("#1b1b1f"), rgb("#1f3b73"), rgb("#c62828"), rgb("#6a1b9a"), rgb("#2e7d32")];

/**
 * Umbrellas for people out in the rain: one source mesh per colour, each
 * person gets an instance on their right hand, so a street full of them
 * costs one draw call a colour. Built along +Y (handle at 0, canopy above);
 * the caller orients it in the hand.
 */
export class Umbrellas {
  private src: Mesh[] = [];

  constructor(private scene: Scene, private mat: Material) {}

  private source(i: number): Mesh {
    let m = this.src[i];
    if (m) return m;
    const g = new GeoBuilder(0.3);
    const c = COLOURS[i]!, dark = rgb("#2a2a2a");
    // Crook handle, shaft, eight-panel canopy (a low cone with a rim) and a tip.
    g.torus(0, 0.0, 0.03, 0.03, 0.008, 8, 3, rgb("#5d4037"), "x");
    g.cylinder(0, 0.0, 0, 0.008, 0.008, 0.85, 6, dark);
    g.cylinder(0, 0.62, 0, 0.5, 0.04, 0.2, 8, c);
    g.cylinder(0, 0.6, 0, 0.5, 0.5, 0.02, 8, c, false);
    g.cylinder(0, 0.82, 0, 0.008, 0.002, 0.08, 4, dark);
    m = g.toMesh(`umbrella${i}`, this.scene, this.mat);
    m.isPickable = false;
    m.isVisible = false;
    m.position.y = -100;
    this.src[i] = m;
    return m;
  }

  /** A new umbrella for someone (`seed` picks the colour). */
  make(seed: number): InstancedMesh {
    const inst = this.source(seed % COLOURS.length).createInstance(`chhatri${seed}`);
    inst.isPickable = false;
    return inst;
  }
}
