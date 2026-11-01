import { Color3, MeshBuilder, Scene, StandardMaterial, type Mesh, type Vector3 } from "../babylon";
import { canalWaterAt } from "../physics/water";

/** A bounded pool of surface disturbances. Idle water adds no draw calls,
 * and swimming never allocates meshes or textures. No reflection render pass. */
export class WaterContactEffects {
  private rings: Array<{ mesh: Mesh; material: StandardMaterial; age: number; strength: number }>;
  private next = 0;
  private strokeT = 0;

  constructor(scene: Scene) {
    this.rings = Array.from({ length: 8 }, (_, i) => {
      const mesh = MeshBuilder.CreateTorus(`contactRipple${i}`, { diameter: 1, thickness: 0.025, tessellation: 24 }, scene);
      const material = new StandardMaterial(`contactRippleMat${i}`, scene);
      material.disableLighting = true;
      material.emissiveColor = Color3.FromHexString("#b3e4dc");
      material.alpha = 0;
      material.backFaceCulling = false;
      mesh.material = material;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      return { mesh, material, age: 2, strength: 0 };
    });
  }

  splash(at: Pick<Vector3, "x" | "z">, strength = 0.6): void {
    const water = canalWaterAt(at.x, at.z);
    if (!water) return;
    const ring = this.rings[this.next++ % this.rings.length]!;
    ring.age = 0;
    ring.strength = Math.max(0.1, Math.min(1, strength));
    ring.mesh.position.set(at.x, water.surfaceY + 0.025, at.z);
    ring.mesh.scaling.set(0.2, 0.3, 0.2);
    ring.material.alpha = 0.55 * ring.strength;
    ring.mesh.setEnabled(true);
  }

  update(dt: number, feet?: Pick<Vector3, "x" | "y" | "z">, swimming = false, speed = 0): void {
    const h = Math.max(0, Math.min(dt, 0.1));
    this.strokeT = Math.max(0, this.strokeT - h);
    if (feet && swimming && speed > 0.3 && this.strokeT <= 0) {
      this.splash(feet, Math.min(0.65, 0.2 + speed * 0.15));
      this.strokeT = Math.max(0.28, 0.7 - speed * 0.1);
    }
    for (const ring of this.rings) {
      if (ring.age >= 1.4) continue;
      ring.age += h;
      const scale = 0.2 + ring.age * (1.2 + ring.strength);
      ring.mesh.scaling.set(scale, 0.3, scale);
      ring.material.alpha = Math.max(0, 1 - ring.age / 1.4) ** 2 * 0.55 * ring.strength;
      const water = canalWaterAt(ring.mesh.position.x, ring.mesh.position.z);
      if (water) ring.mesh.position.x += water.currentX * h;
      if (ring.age >= 1.4 || !water) ring.mesh.setEnabled(false);
    }
  }

  reset(): void { for (const r of this.rings) { r.age = 2; r.mesh.setEnabled(false); } this.strokeT = 0; }
  dispose(): void { for (const r of this.rings) { r.mesh.dispose(); r.material.dispose(); } this.rings.length = 0; }
}
