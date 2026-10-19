import { NullEngine, Scene, Vector3 } from "../../src/babylon";
import fs from "node:fs";
import path from "node:path";
import { Physics, StaticColliderBuilder } from "../../src/physics/Physics";
import { FIXED_DT } from "../../src/app/config";

/** Headless Havok world for physics regression tests (no rendering). */
export async function makeWorld(build?: (c: StaticColliderBuilder, scene: Scene) => void): Promise<{ scene: Scene; physics: Physics; step: (n: number, before?: () => void) => void }> {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const physics = new Physics();
  const wasm = fs.readFileSync(path.resolve("node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm"));
  await physics.init(scene, wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const c = new StaticColliderBuilder();
  c.add(0, -0.5, 0, 400, 1, 400);
  build?.(c, scene);
  c.build(scene);
  return {
    scene,
    physics,
    step: (n, before) => {
      for (let i = 0; i < n; i++) {
        before?.();
        physics.step(FIXED_DT);
      }
    },
  };
}

export const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
