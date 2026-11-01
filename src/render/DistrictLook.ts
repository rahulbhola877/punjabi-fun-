import { Color3, Color4, DynamicTexture, ImageProcessingConfiguration, Mesh, PBRMaterial, ShadowGenerator, Texture, type DirectionalLight, type Scene } from "../babylon";
import { waterSky } from "./waterSky";

/** A scene-owned surface library: colour and normal maps are generated once,
 * shared by finish, and sampled in world units so large meshes don't stretch. */
export function districtSurface(scene: Scene, name: string, hex: string, finish: "stone" | "wood" | "plaster" | "earth" | "metal" = "stone"): PBRMaterial {
  const m = new PBRMaterial(name, scene); m.albedoColor = Color3.FromHexString(hex); m.metallic = finish === "metal" ? 0.65 : 0;
  m.roughness = finish === "metal" ? 0.32 : finish === "wood" ? 0.72 : 0.91;
  m.environmentBRDFTexture = null; m.environmentIntensity = 0.65; m.maxSimultaneousLights = 2;
  const key = `district-${finish}`;
  let color = scene.getTextureByName(key) as DynamicTexture | null;
  let normal = scene.getTextureByName(`${key}-normal`) as DynamicTexture | null;
  if (!color) {
    color = new DynamicTexture(key, { width: 256, height: 256 }, scene, true);
    normal = new DynamicTexture(`${key}-normal`, { width: 256, height: 256 }, scene, true);
    const c = color.getContext() as CanvasRenderingContext2D, n = normal.getContext() as CanvasRenderingContext2D;
    c.fillStyle = "#eeeae3"; c.fillRect(0,0,256,256); n.fillStyle = "#8080ff"; n.fillRect(0,0,256,256);
    let seed = 671;
    for (let i = 0; i < 8500; i++) {
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0; const x = seed % 256;
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0; const y = seed % 256;
      c.fillStyle = i % 2 ? "rgba(55,48,38,.10)" : "rgba(255,255,255,.18)";
      c.fillRect(x,y,finish === "wood" ? 1 : 2,finish === "wood" ? 18 : 2);
      n.fillStyle = i % 2 ? "#7987fd" : "#8779fd"; n.fillRect(x,y,1,finish === "wood" ? 14 : 2);
    }
    if (finish === "stone") {
      c.strokeStyle = "rgba(38,40,37,.22)"; n.strokeStyle = "#808cfb";
      for (let y=0;y<=256;y+=64) for (const ctx of [c,n]) { ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
      for (let y=0;y<256;y+=64) for (let x=(y/64%2)*64;x<256;x+=128) for (const ctx of [c,n]) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+64); ctx.stroke(); }
    }
    color.update(false); normal.update(false);
    for (const t of [color,normal]) { t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel=8; }
  }
  m.albedoTexture = color; m.bumpTexture = normal; if (normal) normal.level = 0.35;
  // Kit bodies supply vertex colours and skin normals, with no surface UVs.
  if (/people/i.test(name)) { m.albedoTexture=null; m.bumpTexture=null; }
  return m;
}

export function worldSurfaceUV(mesh: Mesh): void {
  const p=mesh.getVerticesData("position"),n=mesh.getVerticesData("normal");
  if(!p||!n) return;
  const uv:number[]=[];
  for(let i=0;i<p.length;i+=3) {
    const ax=Math.abs(n[i]!),ay=Math.abs(n[i+1]!),az=Math.abs(n[i+2]!);
    uv.push((ax>ay&&ax>az?p[i+2]!:p[i]!)/3,(ay>=ax&&ay>=az?p[i+2]!:p[i+1]!)/3);
  }
  mesh.setVerticesData("uv",uv);
}

/** Deliberate sun/sky ratio gives dimensional form; one bounded shadow pass.
 * Static details are batched before registration; no per-object shadow work. */
export function finishDistrict(scene: Scene, sun: DirectionalLight, kind: "harbor" | "japan" | "neon" | "moon"): void {
  const image = scene.imageProcessingConfiguration;
  image.toneMappingEnabled = true; image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  image.exposure = 1.12; image.contrast = 1.08;
  if (kind !== "moon") {
    scene.fogMode = 3; scene.fogDensity = kind === "harbor" ? 0.003 : 0.004;
    scene.fogColor = kind === "neon" ? Color3.FromHexString("#363951") : Color3.FromHexString("#a8c5ce");
    scene.clearColor = Color4.FromColor3(scene.fogColor, 1);
  }
  const reflection = waterSky(scene); scene.environmentTexture = reflection;
  sun.position.set(30,60,-30); sun.shadowMinZ=1; sun.shadowMaxZ=180;
  sun.autoUpdateExtends=false; sun.orthoLeft=-100; sun.orthoRight=100; sun.orthoTop=100; sun.orthoBottom=-100;
  const shadows = new ShadowGenerator(1024,sun); shadows.usePercentageCloserFiltering=true; shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;
  shadows.bias=0.0008; shadows.normalBias=0.025; shadows.setDarkness(0.22);
  for (const mesh of scene.meshes) {
    mesh.receiveShadows = true;
    if (!(mesh instanceof Mesh) || !mesh.material || mesh.material.alpha < 1 || /label|sign|water|stars|planet|ridge|glow|sea|ground|terrain|path|track/i.test(mesh.name)) continue;
    shadows.addShadowCaster(mesh,false);
  }
  scene.onDisposeObservable.addOnce(()=>{ shadows.dispose(); reflection.dispose(); });
}
