import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, StandardMaterial } from "../babylon";
import { addJapanAsset } from "./JapanAssets";
import { JAPAN_PARK, JAPAN_ZEN } from "./japanMap";

/** A walkable neighborhood park, connected to the street by its east lane. */
export function buildJapanPark(scene: Scene): { setStory: (stage: number) => void } {
  const mat = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color); m.specularColor = new Color3(0.05, 0.05, 0.05); return m;
  };
  const grass = mat("parkGrass", "#879b6f"), path = mat("parkPath", "#d2c6a8"), timber = mat("parkTimber", "#665447");
  const stone = mat("parkStone", "#a9a99c"), black = mat("parkCamera", "#303d3d"), metal = mat("parkCameraLens", "#b8c4c1");
  const reed = mat("parkBambooFence", "#ac9a6d"), fenceDark = mat("parkFenceTimber", "#615345");
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: StandardMaterial) => {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z); mesh.material = material; return mesh;
  };
  const groundTexture = (name: string, base: string, speckle: string, count: number) => {
    const tex = new DynamicTexture(name, { width: 128, height: 128 }, scene, true);
    const c = tex.getContext() as CanvasRenderingContext2D; c.fillStyle = base; c.fillRect(0, 0, 128, 128);
    let seed = 1731;
    for (let i = 0; i < count; i++) {
      // Use high bits: the low seven LCG bits repeat after only 128 draws,
      // leaving the old lawn almost completely flat at normal distances.
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = (seed >>> 16) % 128;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = (seed >>> 16) % 128;
      c.fillStyle = speckle; c.fillRect(x, y, 1 + i % 2, 1 + i % 3);
    }
    tex.update(false); tex.uScale = 12; tex.vScale = 18; return tex;
  };
  grass.diffuseTexture = groundTexture("parkGrassTexture", "#d9e2c9", "rgba(55,90,45,.18)", 2400);
  path.diffuseTexture = groundTexture("parkGravelTexture", "#ece7d9", "rgba(101,91,74,.20)", 2100);
  // The visual ground extends beyond the playable garden so planting at its
  // boundary is rooted in soil rather than hanging over an exposed edge.
  box("parkGround", 34, -0.15, -1, 38, 0.3, 60, grass);
  box("parkEntryLane", 15, 0.018, -7, 10, 0.035, 4, path);
  box("parkPathEast", 23.5, 0.02, -7, 16, 0.04, 3.4, path);
  box("parkPathNorth", 29, 0.021, 0, 3.4, 0.04, 17.5, path);
  box("parkPathBoard", 31, 0.022, -2, 6, 0.04, 2.8, path);
  for (const [x, z, scale, yaw] of [[21,-17,1.15,0], [32,-15,1,1], [32,12,1.15,2], [21,13,0.95,0.5]] as const)
    addJapanAsset(scene, "cherry", x, 0, z, scale, yaw);
  for (const [x, z, scale, yaw] of [[36.7,-19,1.1,1.2], [37,8,1,0.4], [34,20,1.1,2.5], [23,20,1,1.8], [18,-22,1,0.9]] as const)
    addJapanAsset(scene, "cherry", x, 0, z, scale, yaw);
  // A neighboring house and its garden continue behind the park boundary,
  // so the view from the path does not end abruptly in empty sky.
  addJapanAsset(scene, "teahouse", 43.5, 0, -3, 0.65, Math.PI / 2);
  for (const [x, z, scale, yaw] of [[43, 10, 1.1, 1.1], [44, -16, 1.05, 0.5], [49, 15, 1.2, 2.2]] as const)
    addJapanAsset(scene, "cherry", x, 0, z, scale, yaw);
  // Complete source models: the gravel bed includes its own raked surface,
  // stones and moss; each grove includes grounded canes and leaf sprays.
  addJapanAsset(scene, "zen", JAPAN_ZEN.x, 0, JAPAN_ZEN.z, 1, 0);
  for (const [x, z, scale, yaw] of [[37,-15,1.1,0.2], [37,12,1.05,1.3], [20,20,0.8,0.4]] as const)
    addJapanAsset(scene, "bamboo", x, 0, z, scale, yaw);
  addJapanAsset(scene, "lantern", 25.7, 0, 7, 0.85, 0);
  // A low bamboo screen reads as an intentional garden boundary and leaves
  // the entrance open. The backdrop models are rooted in the extended soil.
  for (const y of [0.36, 1.02]) {
    box("parkFenceRail", 36.15, y, -1.1, 0.1, 0.1, 40, fenceDark);
    box("parkFenceRail", 27.1, y, 19.1, 18.3, 0.1, 0.1, fenceDark);
  }
  const canes: Mesh[] = [];
  for (let i = 0; i <= 32; i++) canes.push(box("parkFenceCane", 36.15, 0.67, -21 + i * 1.24, 0.13, 1.34 + (i % 3) * 0.04, 0.13, reed));
  for (let i = 0; i <= 15; i++) canes.push(box("parkFenceCane", 18 + i * 1.21, 0.67, 19.1, 0.13, 1.34 + (i % 3) * 0.04, 0.13, reed));
  Mesh.MergeMeshes(canes, true, true, undefined, false, true);
  // Low stone edging and an open entrance make the park legible from the lane.
  for (const z of [-21, 18]) box("parkEdge", 26.5, 0.18, z, 18, 0.36, 0.25, stone);
  for (const [z, length] of [[-15.5, 10], [7.5, 21]] as const) box("parkEdge", 17.25, 0.18, z, 0.25, 0.36, length, stone);
  for (const z of [3.77, 3.97, 4.17]) box("parkBenchSeatSlat", 29, 0.52, z, 1.9, 0.1, 0.16, timber);
  for (const y of [0.74, 0.96, 1.18]) box("parkBenchBackSlat", 29, y, 4.27, 1.9, 0.14, 0.1, timber);
  for (const x of [28.3, 29.7]) box("parkBenchLeg", x, 0.25, 4, 0.14, 0.5, 0.5, timber);
  for (const x of [28.25, 29.75]) box("parkBenchBackSupport", x, 0.85, 4.3, 0.1, 0.85, 0.1, timber);
  // A physical camera remains visible until the visitor picks it up.
  const camera = box("yunaCamera", JAPAN_PARK.cameraX, 0.13, JAPAN_PARK.cameraZ, 0.36, 0.22, 0.17, black);
  const lens = MeshBuilder.CreateCylinder("yunaCameraLens", { diameter: 0.13, height: 0.06, tessellation: 12 }, scene);
  lens.rotation.x = Math.PI / 2; lens.position.set(JAPAN_PARK.cameraX, 0.13, JAPAN_PARK.cameraZ - 0.12); lens.material = metal;
  // The board becomes a permanent visual payoff for returning the camera.
  box("parkBoardPost", 33.8, 1, -2, 0.16, 2, 0.16, timber);
  box("parkBoard", 33.8, 1.7, -2, 0.18, 1.3, 2, timber);
  box("parkBoardPaper", 33.69, 1.7, -2, 0.03, 1.05, 1.75, path);
  const image = new DynamicTexture("parkBlossomPhotograph", { width: 512, height: 256 }, scene, true);
  const c = image.getContext() as CanvasRenderingContext2D;
  c.fillStyle = "#dceaf0"; c.fillRect(0, 0, 512, 256);
  c.fillStyle = "#8eaa85"; c.fillRect(0, 160, 512, 96);
  c.strokeStyle = "#604f46"; c.lineWidth = 14; c.beginPath(); c.moveTo(250, 210); c.lineTo(251, 92); c.moveTo(251, 125); c.lineTo(190, 70); c.moveTo(251, 120); c.lineTo(310, 65); c.stroke();
  for (const [x, y, radius] of [[180,65,42],[220,50,48],[270,52,51],[320,55,45],[350,83,35],[155,91,32]] as const) { c.fillStyle = "#e8b5bb"; c.beginPath(); c.arc(x,y,radius,0,Math.PI*2); c.fill(); }
  c.fillStyle = "#fff9eb"; c.font = "bold 22px sans-serif"; c.fillText("GRANDMA'S BLOSSOMS", 105, 243); image.update();
  const photoMat = new StandardMaterial("parkPhotoMaterial", scene); photoMat.diffuseTexture = image; photoMat.emissiveColor = new Color3(0.2, 0.2, 0.2); photoMat.backFaceCulling = false;
  const welcome = new DynamicTexture("parkWelcomeNotice", { width: 512, height: 256 }, scene, true);
  const w = welcome.getContext() as CanvasRenderingContext2D;
  w.fillStyle = "#f2e8d4"; w.fillRect(0, 0, 512, 256);
  w.strokeStyle = "#a45e56"; w.lineWidth = 7; w.strokeRect(10, 10, 492, 236);
  w.textAlign = "center"; w.fillStyle = "#524d3d"; w.font = "bold 48px sans-serif"; w.fillText("SAKURA PARK", 256, 85);
  w.font = "25px sans-serif"; w.fillText("Please enjoy the garden", 256, 139);
  w.fillStyle = "#a45e56"; w.font = "20px sans-serif"; w.fillText("Cherry blossoms  ·  Stone garden", 256, 193);
  welcome.update();
  const photo = MeshBuilder.CreatePlane("parkPhoto", { width: 1.75, height: 0.86 }, scene);
  // Keep the notice in front of the wooden face from the path side.
  photo.rotation.y = Math.PI / 2; photo.position.set(33.64, 1.7, -2); photo.material = photoMat;
  return { setStory(stage) { camera.setEnabled(stage === 1); lens.setEnabled(stage === 1); photoMat.diffuseTexture = stage === 3 ? image : welcome; } };
}
