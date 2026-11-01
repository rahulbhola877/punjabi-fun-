import { Color3, MeshBuilder, Scene, StandardMaterial } from "../babylon";
import { JAPAN_POND } from "./japanMap";
import { addTunyardKoi } from "./TunyardKoi";
import { koiPose } from "./koiMotion";

/** A compact Japanese-inspired garden, with a raised koi pond and a dry bed. */
export function buildJapanGarden(scene: Scene): { koiCount: number; feed: () => void; update: (dt: number) => void } {
  const material = (name: string, color: string): StandardMaterial => {
    const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color); m.specularColor = new Color3(0.08, 0.08, 0.08); return m;
  };
  const sand = material("gardenSand", "#c8bfa8"), stone = material("gardenStone", "#837e70"), darkStone = material("pondBed", "#3e655e");
  const green = material("gardenMoss", "#708b6c"), wood = material("gardenFence", "#8d7a5c"), leaf = material("lilyLeaf", "#6d946b");
  const water = material("koiWater", "#668e83"); water.alpha = 0.72; water.specularColor = new Color3(0.45, 0.48, 0.43); water.specularPower = 64;
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); mesh.position.set(x, y, z); mesh.material = m; return mesh;
  };
  const cylinder = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: StandardMaterial) => {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter: 1, height: h, tessellation: 32 }, scene); mesh.position.set(x, y, z); mesh.scaling.x = w; mesh.scaling.z = d; mesh.material = m; return mesh;
  };
  // The sand is a decorative surface; the player's collision stays on the
  // same level street ground around the pond.
  box("gardenSand", 10.8, 0.015, 27.4, 10.5, 0.03, 11.5, sand);
  // Raked furrows are confined to the dry strip behind the water.
  for (let z = 22.1; z <= 32.6; z += 0.33) box("sandFurrow", 15.0, 0.038, z, 1.45, 0.012, 0.045, stone);
  // A simple timber garden screen gives the space a quiet back edge.
  for (let z = 22; z <= 33; z += 1.1) box("gardenPost", 16.25, 0.55, z, 0.11, 1.1, 0.11, wood);
  for (const y of [0.35, 0.8]) box("gardenRail", 16.25, y, 27.5, 0.09, 0.09, 11.1, wood);

  const { x, z, rx, rz } = JAPAN_POND;
  cylinder("pondRim", x, 0.06, z, rx * 2.08, 0.12, rz * 2.08, stone);
  cylinder("pondBed", x, 0.13, z, rx * 1.94, 0.03, rz * 1.94, darkStone);
  cylinder("pondWater", x, 0.17, z, rx * 1.88, 0.025, rz * 1.88, water);
  for (let i = 0; i < 18; i++) {
    const a = i * Math.PI * 2 / 18, px = x + Math.cos(a) * rx * 0.98, pz = z + Math.sin(a) * rz * 0.98;
    const s = 0.4 + (i % 3) * 0.08;
    const rock = MeshBuilder.CreateSphere("pondEdgeStone", { diameter: s, segments: 6 }, scene);
    rock.position.set(px, 0.22, pz); rock.scaling.set(1.2, 0.65, 0.9); rock.material = i % 3 === 0 ? darkStone : stone;
  }
  for (const [lx, lz, radius] of [[11.5, 26.1, 0.35], [12.4, 28.1, 0.28], [9.5, 28.6, 0.24]] as const) {
    cylinder("lilyPad", lx, 0.205, lz, radius * 2, 0.018, radius * 1.6, leaf);
  }
  for (const [sx, sz] of [[6.5, 23], [6.7, 24.2], [6.5, 25.4], [6.4, 29], [6.7, 30.2], [7.2, 31.3]] as const) {
    cylinder("steppingStone", sx, 0.045, sz, 0.7, 0.06, 0.55, stone);
  }
  for (const [sx, sz] of [[14.8, 22.8], [14.7, 32.2], [7.6, 32.3]] as const) {
    const shrub = MeshBuilder.CreateSphere("gardenShrub", { diameter: 1.0, segments: 8 }, scene);
    shrub.position.set(sx, 0.42, sz); shrub.scaling.y = 0.7; shrub.material = green;
  }
  const pellets = Array.from({ length: 5 }, (_, i) => {
    const dot = MeshBuilder.CreateSphere("koiFeed", { diameter: 0.08, segments: 5 }, scene);
    dot.position.set(x - 2.1 + (i % 3) * 0.3, 0.23, z - 0.35 + Math.floor(i / 3) * 0.4); dot.material = wood; dot.setEnabled(false); return dot;
  });
  // Original Tunyard koi have an articulated middle and tail. Their +Z head
  // follows the tangent; the delayed tail turn creates a lateral swim wave.
  const fish = [0, 1, 2].map((i) => addTunyardKoi(scene, i === 1 ? "ogon" : "kohaku", x, 0.15, z, i === 2 ? 0.9 : 1));
  let feedTime = 0, swimTime = 0, feedBlend = 0;
  const garden = {
    koiCount: fish.length,
    feed: () => { feedTime = 5; pellets.forEach((p) => p.setEnabled(true)); },
    update: (dt: number) => {
      const step = Math.max(0, Math.min(dt, 0.1)); swimTime += step;
      if (feedTime > 0) { feedTime = Math.max(0, feedTime - step); if (feedTime === 0) pellets.forEach((p) => p.setEnabled(false)); }
      feedBlend += ((feedTime > 0 ? 1 : 0) - feedBlend) * Math.min(1, step * 1.2);
      for (let i = 0; i < fish.length; i++) {
        const f = fish[i]!, p = koiPose(swimTime, i, feedBlend);
        f.root.position.set(p.x, 0.15 + Math.sin(swimTime * 1.1 + i) * 0.008, p.z);
        f.root.rotation.y = p.yaw;
        f.mid.rotation.y = p.tail * 0.45;
        f.tail.rotation.y = Math.sin(swimTime * 2.2 + i * 1.1 - 0.8) * 0.24;
      }
    },
  };
  garden.update(0);
  return garden;
}
