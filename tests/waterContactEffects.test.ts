import { describe, expect, it } from "vitest";
import { NullEngine, Scene } from "../src/babylon";
import { CANAL } from "../src/world/region";
import { WaterContactEffects } from "../src/render/WaterContactEffects";

describe("bounded surface-contact effects", () => {
  it("shares the same bounded pool with shallow spring and flood surfaces",()=>{
    const engine=new NullEngine(),scene=new Scene(engine),effects=new WaterContactEffects(scene);
    try{effects.splash({x:-884,z:1910},.3,12.2);for(let i=0;i<15;i++)effects.update(1/60);
      const active=scene.meshes.filter(m=>m.isEnabled());expect(active).toHaveLength(1);expect(active[0]!.position.y).toBeCloseTo(12.225);
      expect(scene.meshes).toHaveLength(8);effects.reset();expect(scene.meshes.some(m=>m.isEnabled())).toBe(false);
    }finally{scene.dispose();engine.dispose();}
  });
  it("reuse a fixed pool, stay invisible when dry, and clean up their resources", () => {
    const engine = new NullEngine(), scene = new Scene(engine);
    const effects = new WaterContactEffects(scene);
    try {
      expect(scene.meshes.length).toBe(8);
      effects.splash({ x: 0, z: 0 });
      expect(scene.meshes.some(m => m.isEnabled())).toBe(false);
      for (let i = 0; i < 500; i++) effects.update(1 / 60, { x: 0, y: -2, z: 170 }, true, 1.5);
      expect(scene.meshes.length).toBe(8);
      expect(scene.materials.filter(m => m.name.startsWith("contactRippleMat")).length).toBe(8);
      const active = scene.meshes.filter(m => m.isEnabled());
      expect(active.length).toBeGreaterThan(0);
      expect(active.every(m => Math.abs(m.position.y - (CANAL.waterY + 0.025)) < 1e-6)).toBe(true);
      effects.reset();
      expect(scene.meshes.some(m => m.isEnabled())).toBe(false);
      effects.dispose();
      expect(scene.meshes.length).toBe(0);
      expect(scene.materials.filter(m => m.name.startsWith("contactRippleMat")).length).toBe(0);
    } finally { scene.dispose(); engine.dispose(); }
  });
});
