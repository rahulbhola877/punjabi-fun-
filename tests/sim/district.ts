import { Scene } from "../../src/babylon";
import { StaticColliderBuilder } from "../../src/physics/Physics";
import { Kit } from "../../src/world/Kit";
import { BUILDINGS } from "../../src/world/layout";
import { buildBuilding } from "../../src/world/buildings";
import { dhabaInterior, workshop } from "../../src/world/interiors";
import { buildStreet } from "../../src/world/street";
import { buildPolesAndWires, buildProps } from "../../src/world/props";
import type { Materials } from "../../src/render/Materials";
import type { SignAtlas } from "../../src/render/Signs";

/** Builds the real district collision set without any rendering resources. */
export function districtColliders(scene: Scene, c: StaticColliderBuilder): void {
  const signs = { get: () => ({ u0: 0, u1: 1, v0: 0, v1: 1, aspect: 4.57 }) } as unknown as SignAtlas;
  const kit = new Kit(scene, {} as Materials, signs, c);
  buildStreet(kit);
  for (const b of BUILDINGS) {
    buildBuilding(kit, b);
    if (b.use === "dhaba") dhabaInterior(kit, b);
    if (b.use === "workshop") workshop(kit, b);
  }
  buildPolesAndWires(kit);
  buildProps(kit);
}
