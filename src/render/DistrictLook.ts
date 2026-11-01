import { Color3, Color4, DynamicTexture, ImageProcessingConfiguration, Mesh, PBRMaterial, StandardMaterial, ShadowGenerator, Texture, type DirectionalLight, Scene } from "../babylon";
import { waterSky } from "./waterSky";
import { batchShadowCasters } from "./DistrictShadowBatch";
import { districtContactShadows } from "./DistrictContactShadows";

/** Vertex-painted skinned people have no physical surface maps. Keep their
 * existing compact skin shader, lit by the same sun/sky and tone mapping. */
export function districtPeople(scene:Scene,name:string):StandardMaterial {
  const material=new StandardMaterial(name,scene);material.diffuseColor=new Color3(0.65,0.65,0.65);material.specularColor=new Color3(0.07,0.07,0.07);material.specularPower=32;material.maxSimultaneousLights=2;return material;
}

/** A scene-owned surface library: colour and normal maps are generated once,
 * shared by finish, and sampled in world units so large meshes don't stretch. */
export function districtSurface(scene: Scene, name: string, hex: string, finish: "stone" | "wood" | "plaster" | "earth" | "metal" | "asphalt" | "tile" | "glass" = "stone"): PBRMaterial {
  const m = new PBRMaterial(name, scene); m.albedoColor = Color3.FromHexString(hex).toLinearSpace(); m.metallic = finish === "metal" ? 0.65 : 0;
  m.roughness = finish === "glass" ? 0.13 : finish === "metal" ? 0.32 : finish === "wood" ? 0.72 : 0.91;
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
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0; const x = (seed >>> 16) % 256;
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0; const y = (seed >>> 16) % 256;
      c.fillStyle = i % 2 ? "rgba(55,48,38,.025)" : "rgba(255,255,255,.055)";
      c.fillRect(x,y,finish === "wood" ? 1 : 2,finish === "wood" ? 18 : 2);
      n.fillStyle = i % 2 ? "#7d83fe" : "#837dfe"; n.fillRect(x,y,1,finish === "wood" ? 14 : 2);
    }
    if (finish === "stone" || finish === "tile") {
      c.strokeStyle = "rgba(38,40,37,.22)"; n.strokeStyle = "#808cfb";
      for (let y=0;y<=256;y+=64) for (const ctx of [c,n]) { ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(256,y); ctx.stroke(); }
      for (let y=0;y<256;y+=64) for (let x=(y/64%2)*64;x<256;x+=128) for (const ctx of [c,n]) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+64); ctx.stroke(); }
    }
    color.update(false); normal.update(false); normal.gammaSpace=false;
    for (const t of [color,normal]) { t.wrapU=t.wrapV=Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel=8; }
  }
  m.albedoTexture = color;
  // Smooth plaster/paint/regolith must not inherit the same artificial relief
  // as masonry. Fine colour variation supplies texture without quilted walls.
  m.bumpTexture = finish === "wood" ? normal : null;
  if (normal) normal.level = 1;
  // Kit bodies supply vertex colours and skin normals, with no surface UVs.
  if (finish === "glass" || /people/i.test(name)) { m.albedoTexture=null; m.bumpTexture=null; }
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
 * Static details are batched before registration; major silhouettes cast. */
export function finishDistrict(scene: Scene, sun: DirectionalLight, kind: "harbor" | "japan" | "neon" | "moon", height: (x:number,z:number)=>number=()=>0): void {
  const image = scene.imageProcessingConfiguration;
  image.toneMappingEnabled = true; image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  image.exposure = 1.12; image.contrast = 1.08;
  if (kind !== "moon") {
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = kind === "harbor" ? 0.003 : 0.004;
    scene.fogColor = kind === "neon" ? Color3.FromHexString("#363951") : Color3.FromHexString("#a8c5ce");
    scene.clearColor = Color4.FromColor3(scene.fogColor, 1);
  }
  const reflection = waterSky(scene);
  // Matte plaster/wood already receive sky fill from the hemisphere light.
  // Reserve reflection sampling for water, glazing and polished metal.
  for(const material of scene.materials) if(material instanceof PBRMaterial&&(material.roughness??1)<0.5) material.reflectionTexture=reflection;
  scene.onDisposeObservable.addOnce(()=>reflection.dispose());
  let shadowMode="low";
  try {
    const settings=JSON.parse(localStorage.getItem("pfs.settings.v1")??"{}");
    shadowMode=settings.shadows??(settings.quality==="low"?"off":"low");
  } catch { /* standalone scene/default graphics */ }
  if(shadowMode==="off") return;
  sun.position.set(30,60,-30);sun.autoUpdateExtends=false;sun.autoCalcShadowZBounds=true;sun.shadowOrthoScale=0.12;
  const shadows = new ShadowGenerator(shadowMode==="high"?2048:1024,sun); shadows.usePercentageCloserFiltering=true; shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;
  // Fit the fixed casters once rather than wasting texels on a 200m square.
  // The former undersized bias produced diagonal self-shadow acne on plaster.
  shadows.bias=0.0015; shadows.normalBias=0.08; shadows.setDarkness(0.22);
  const fixed: Mesh[] = [], moving: Mesh[] = [];
  for (const mesh of [...scene.meshes]) {
    mesh.receiveShadows = true;
    if (!(mesh instanceof Mesh) || !mesh.isEnabled() || !mesh.isVisible || !mesh.material || mesh.material.alpha < 1 || /ground|paving|asphalt|road|marking|lines|pondBed|gardenSand/i.test(mesh.material.name) || /submerged|label|sign|water|stars|planet|ridge|glow|sea|ground|terrain|path|track/i.test(mesh.name)) continue;
    // Window mullions, produce, cables and tiny trim receive the silhouettes'
    // shadows. Drawing all of them again adds cost without readable shadows.
    const silhouette=/_body$|harborHome|harborEave|harborRoofLine|^building\d|^roof\d|^block\d|^habitat\d|heroTorso|heroHead|harbor-tree|japan-cherry|japan-bamboo|japan-teahouse|japan-torii|marketStall|^rover|space-pod|space-solar|space-dish|pondEdgeStone/.test(mesh.name);
    if(!silhouette&&!mesh.metadata?.districtSilhouette) continue;
    const animated = !!mesh.skeleton || /heroTorso|heroHead|^rover/.test(mesh.name);
    (animated ? moving : fixed).push(mesh);
  }
  const opaque=fixed.filter(mesh=>!mesh.hasThinInstances&&!mesh.material!.needAlphaTestingForMesh(mesh));
  const fixedDepth=batchShadowCasters(scene,opaque);
  if(fixedDepth) shadows.addShadowCaster(fixedDepth,false);
  for(const mesh of fixed) if(!opaque.includes(mesh)) shadows.addShadowCaster(mesh,false);
  // Fixed sun and scenery: Babylon retries incomplete shaders automatically.
  // The completed map stays valid across walking, orbiting and story lighting.
  const map=shadows.getShadowMap()!;map.refreshRate=0;
  const roots=new Map<number,import("../babylon").TransformNode>();
  for(const mesh of moving) {let root:import("../babylon").TransformNode=mesh;while(root.parent instanceof Mesh||root.parent?.getClassName()==="TransformNode")root=root.parent as import("../babylon").TransformNode;roots.set(root.uniqueId,root);}
  districtContactShadows(scene,[...roots.values()],sun.direction,height);
  scene.metadata={...scene.metadata,districtShadowWork:{fixedSources:fixed.length,fixedDraws:(fixedDepth?1:0)+fixed.length-opaque.length,movingContactActors:roots.size,cached:true}};
  // Geometry, light membership and surface maps are fixed after construction.
  // PBR still binds live sun/skin/plugin uniforms; skip repeated define and
  // texture-readiness walks for every static facade each rendered frame.
  for(const material of scene.materials) if(!/water/i.test(material.name)) material.freeze();
  scene.onDisposeObservable.addOnce(()=>shadows.dispose());
}
