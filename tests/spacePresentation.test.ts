import { afterEach, expect, it, vi } from "vitest";
import { DirectionalLight, MeshBuilder, NullEngine, Scene, StandardMaterial, TransformNode, Vector3 } from "../src/babylon";
import { lunarPresentation } from "../src/alternate/SpacePresentation";
import { finishDistrict } from "../src/render/DistrictLook";

// NullEngine has no WebGL cube upload. Only replace that GPU allocation;
// district setup, silhouette selection, depth/contact meshes and disposal run.
vi.mock("../src/render/waterSky", async () => {
  const { Texture } = await import("../src/babylon");
  return { waterSky: (scene: Scene) => new Texture(null, scene) };
});

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const context = { clearRect() {}, fillRect() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  vi.stubGlobal("document", Object.assign(new EventTarget(), { createElement: () => ({ width: 128, height: 128, getContext: () => context }) }));
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ shadows: "low" }) });
  const engine = new NullEngine(), scene = new Scene(engine);
  const sun = new DirectionalLight("moonSun", new Vector3(-0.4, -1, 0.3), scene);
  const material = new StandardMaterial("paint", scene), rocket = new TransformNode("rocket", scene);
  for (let i = 0; i < 2; i++) {
    const mesh = MeshBuilder.CreateBox(`habitat${i}`, { size: 2 }, scene);
    mesh.position.set(2 + i * 3, 1, 2); mesh.material = material;
  }
  const actor = new TransformNode("hero", scene), body = MeshBuilder.CreateBox("heroTorso", { size: 1 }, scene);
  body.parent = actor; body.material = material;
  const hiddenQuest = MeshBuilder.CreateBox("archivedCore", { size: 1 }, scene); hiddenQuest.material = material; hiddenQuest.setEnabled(false);
  const faded = MeshBuilder.CreateBox("antenna", { size: 1 }, scene); faded.material = material; faded.visibility = 0.4;
  const rocketMesh = MeshBuilder.CreateBox("rocketPart", { size: 1 }, scene); rocketMesh.parent = rocket; rocketMesh.material = material;
  const initialize = vi.fn(() => {
    expect(scene.meshes.find(mesh => mesh.name.startsWith("static-batch-"))!.visibility).toBe(1);
    finishDistrict(scene, sun, "moon");
  });
  const reveal = lunarPresentation(scene, rocket, initialize);
  const departure = MeshBuilder.CreateBox("launchGround", { size: 10 }, scene); departure.material = material;
  return { engine, scene, sun, reveal, initialize, hiddenQuest, faded, rocketMesh, departure };
}

it.each(["descent", "skip"])("creates lunar depth and contact resources only after the first %s reveal", () => {
  const f = fixture();
  try {
    expect(f.initialize).not.toHaveBeenCalled();
    expect(f.sun.getShadowGenerator()).toBeNull();
    expect(f.scene.getMeshByName("district-static-shadow-depth")).toBeNull();
    expect(f.scene.getMeshByName("district-moving-contact-shadows")).toBeNull();
    expect(f.scene.meshes.find(mesh => mesh.name.startsWith("static-batch-"))!.visibility).toBe(0);
    expect(f.rocketMesh.visibility).toBe(1);
    f.departure.setEnabled(false);
    f.reveal();
    expect(f.initialize).toHaveBeenCalledTimes(1);
    const depth = f.scene.getMeshByName("district-static-shadow-depth")!;
    const contact = f.scene.getMeshByName("district-moving-contact-shadows")!;
    expect(depth).not.toBeNull(); expect(contact).not.toBeNull();
    expect(depth.getTotalIndices()).toBe(72);
    const map = f.sun.getShadowGenerator()!.getShadowMap()!;
    expect(map.renderList).toContain(depth); expect(map.refreshRate).toBe(0);
    expect(f.faded.visibility).toBe(0.4); expect(f.hiddenQuest.isEnabled()).toBe(false);
    const counts = [f.scene.meshes.length, f.scene.materials.length, f.scene.textures.length];
    f.reveal(); f.reveal();
    expect(f.initialize).toHaveBeenCalledTimes(1);
    expect([f.scene.meshes.length, f.scene.materials.length, f.scene.textures.length]).toEqual(counts);
    f.scene.dispose();
    expect(depth.isDisposed()).toBe(true); expect(contact.isDisposed()).toBe(true);
    expect(f.engine.scenes).toHaveLength(0);
  } finally { f.scene.dispose(); f.engine.dispose(); }
});

it("can abort before revealing without initializing lunar resources", () => {
  const f = fixture();
  try {
    f.scene.dispose(); f.reveal();
    expect(f.initialize).not.toHaveBeenCalled();
    expect(f.engine.scenes).toHaveLength(0);
  } finally { f.scene.dispose(); f.engine.dispose(); }
});
