import { expect, it, vi } from "vitest";
import { DirectionalLight, MeshBuilder, NullEngine, Scene, StandardMaterial, Vector3 } from "../src/babylon";
import { Kit } from "../src/world/Kit";
import { World } from "../src/world/World";
import { StaticColliderBuilder, type Physics } from "../src/physics/Physics";
import type { Materials } from "../src/render/Materials";
import type { SignAtlas } from "../src/render/Signs";

it("quality changes preserve the short facade-detail limit and restore scenery distance", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const material = new StandardMaterial("test", scene);
    const kit = new Kit(scene, {get:()=>material} as unknown as Materials, {} as SignAtlas, new StaticColliderBuilder());
    kit.cullDistance=650; kit.cast=false;
    kit.g("paint").box(0,0,0,1,1,1,[1,1,1]);
    kit.cast=true;
    kit.g("brick").box(0,0,0,10,10,10,[1,1,1]);
    const meshes=kit.finish(), world=new World(scene,{} as Physics);
    (world as unknown as {staticMeshes:typeof meshes}).staticMeshes=meshes;
    for (const distance of [650,50,420]) {
      world.setDrawDistance(distance);
      expect(meshes.find(m=>m.name.endsWith("|nc"))!.getLODLevels()[0]!.distanceOrScreenCoverage).toBe(Math.min(90,distance));
      expect(meshes.find(m=>m.name.startsWith("world_brick"))!.getLODLevels()[0]!.distanceOrScreenCoverage).toBe(distance);
    }
  } finally {scene.dispose(); engine.dispose();}
});

it("shadow membership updates do not invalidate every scene material", () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const world = new World(scene, {} as Physics);
    world.sun = new DirectionalLight("sun", new Vector3(0,-1,0), scene);
    const near = MeshBuilder.CreateBox("near", {}, scene);
    const far = MeshBuilder.CreateBox("far", {}, scene);
    far.position.x=1000; far.computeWorldMatrix(true);
    world.addCaster(near); world.addCaster(far);
    world.setShadowQuality("low");
    const dirty = vi.spyOn(far,"_markSubMeshesAsLightDirty");
    world.followShadows(Vector3.Zero());
    expect(world.casterCount).toBe(1);
    expect(dirty).not.toHaveBeenCalled();
    // Changing a non-empty set must also avoid the empty-list transition.
    far.position.x=20; far.computeWorldMatrix(true);
    world.followShadows(new Vector3(13,0,0));
    expect(world.casterCount).toBe(2);
    expect(dirty).not.toHaveBeenCalled();
    world.shadows?.dispose();
  } finally {scene.dispose(); engine.dispose();}
});
