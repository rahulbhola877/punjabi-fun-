import { visibleCinematicEye } from "../camera/CinematicOcclusion";
import { CinematicDirector, interactionShots } from "../camera/CinematicDirector";
import { clearWater } from "../render/ClearWater";
import { DistrictControls } from "./DistrictControls";
import { districtSurface, districtMatteSurface, districtPeople, finishDistrict, worldSurfaceUV } from "../render/DistrictLook";
import { Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder, Scene, PBRMaterial, StandardMaterial, TransformNode, UniversalCamera, Vector3, VertexBuffer, VertexData } from "../babylon";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { KitHuman, type KitLook } from "../characters/KitHuman";
import { PLAYER_LOOKS } from "../characters/appearances";
import { canWalkChina, chinaConversation, chinaHeight, CHINA_BUILDINGS, CHINA_TABLES, CHINA_TREES, CHINA_WORLD, normalizeChinaProgress, CHINA_LINES, type ChinaPerson, type ChinaProgress } from "./chinaMap";
import { addChinaAsset } from "./ChinaAssets";
import { addChinaTree } from "./ChinaTrees";
import { castChinaFishing, CHINA_FISHING_SPOT, CHINA_FISHMONGER, deliverChinaFishing, reelChinaFishing, startChinaFishing, tickChinaFishing } from "./chinaFishing";
import { batchStatic } from "./batchStatic";
import { districtRoof } from "./DistrictRoof";
import { districtFrameDelta, moveInDistrict } from "./districtMovement";
import { caption, type DistrictSoundscape } from "./regionalDialogue";

/** A fictional river district with an independent scene, story and return. */
export function openChinaWorld(parent: HTMLElement, engine: AbstractEngine, onExit: () => void, options: Partial<ChinaProgress> & { look?: KitLook; soundscape?: DistrictSoundscape; onProgress?: (progress: ChinaProgress) => void } = {}): { dispose: () => void } {
  const scene = new Scene(engine), overlay = document.createElement("div"), abort = new AbortController();
  const people: KitHuman[] = [];
  let controlsInput: DistrictControls | undefined;
  let cinematic: CinematicDirector | undefined;
  let closed = false, started = false, loop: (() => void) | undefined;
  const disposeScene = (): void => {
    cinematic?.dispose();
    controlsInput?.dispose();
    abort.abort();
    options.soundscape?.dispose();
    if (started && loop) engine.stopRenderLoop(loop);
    for (const h of people) h.dispose();
    scene.dispose(); overlay.remove();
  };
  try {
    scene.clearColor = new Color4(0.70, 0.80, 0.84, 1);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.0028; scene.fogColor = new Color3(0.70, 0.80, 0.84);
    const camera = new UniversalCamera("harborCamera", new Vector3(41, 8, -74), scene);
    camera.minZ = 0.15; camera.maxZ = 450; camera.fov = 0.85; scene.activeCamera = camera;
    const hemi = new HemisphericLight("harborSky", new Vector3(0.2, 1, -0.1), scene);
    hemi.intensity = 0.45; hemi.diffuse = Color3.FromHexString("#f5eee2"); hemi.groundColor = Color3.FromHexString("#777d69");
    const sun = new DirectionalLight("harborSun", new Vector3(-0.45, -1, 0.35), scene);
    sun.intensity = 2.1; sun.diffuse = Color3.FromHexString("#fff0d8");
    const material = (name: string, color: string): PBRMaterial | StandardMaterial => /glass/i.test(name)?districtSurface(scene,name,color,"glass"):districtMatteSurface(scene,name,color,
      /glass/i.test(name)?"glass":/road/i.test(name)?"asphalt":/roof/i.test(name)?"tile":/timber|wood|basket|fence/i.test(name)?"wood":/ground|earth|shrub/i.test(name)?"earth":/wall|people/i.test(name)?"plaster":"stone");
    const ground = material("harborGround", "#82916b"), road = material("harborRoad", "#706f69"), paving = material("harborPaving", "#c0b7a4");
    const timber = material("harborTimber", "#6d5545"), roof = material("harborRoof", "#5c605e"), glass = material("harborGlass", "#9baead");
    const white = material("harborMarking", "#ece5d4"), red = material("harborAccent", "#a64d3f");
    const waterMat = clearWater(scene,"harborWater",{x:0,z:9,rx:9,rz:210});
    const peopleMat = districtPeople(scene,"harborPeople");
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: PBRMaterial | StandardMaterial, owner?: TransformNode): Mesh => {
      const o = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); o.position.set(x, y, z); o.material = mat; worldSurfaceUV(o); if (owner) o.parent = owner; return o;
    };
    const disc = (name: string, x: number, y: number, z: number, radius: number, height: number, mat: PBRMaterial | StandardMaterial): Mesh => {
      const o = MeshBuilder.CreateCylinder(name, { diameter: radius * 2, height, tessellation: 10 }, scene); o.position.set(x, y, z); o.material = mat; return o;
    };
    // A real height mesh makes the lookout a walkable place, rather than a
    // painted backdrop. Position and movement use the same height function.
    const terrain = MeshBuilder.CreateGround("harborTerrain", { width: 164, height: 166, subdivisions: 83, updatable: true }, scene);
    terrain.position.z = 9;
    const positions = terrain.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < positions.length; i += 3) positions[i + 1] = Math.abs(positions[i]!) < 9 ? -0.3 - Math.min(1, (9-Math.abs(positions[i]!))/5)*1.5 : chinaHeight(positions[i]!, positions[i + 2]! + 9) - 0.04;
    const normals: number[] = []; VertexData.ComputeNormals(positions, terrain.getIndices()!, normals);
    terrain.updateVerticesData(VertexBuffer.PositionKind, positions); terrain.updateVerticesData(VertexBuffer.NormalKind, normals); terrain.refreshBoundingInfo(); terrain.material = ground; worldSurfaceUV(terrain);
    // A signed footpath runs from the upper bridge to the overlook. It samples
    // the same rise as the player so it follows the hill rather than floating.
    const trailLeft: Vector3[] = [], trailRight: Vector3[] = [];
    const trail: Array<[number, number]> = [[-12, 48], [-24, 49], [-34, 53], [-42, 58], [-48, 62]];
    for (let i = 1; i < trail.length; i++) {
      const [ax, az] = trail[i - 1]!, [bx, bz] = trail[i]!, dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), n = Math.ceil(len / 1.5);
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
        const t = j / n, x = ax + dx * t, z = az + dz * t, ox = -dz / len * 1.4, oz = dx / len * 1.4;
        trailLeft.push(new Vector3(x - ox, chinaHeight(x - ox, z - oz) + 0.08, z - oz));
        trailRight.push(new Vector3(x + ox, chinaHeight(x + ox, z + oz) + 0.08, z + oz));
      }
    }
    const trailMat = material("harborTrail", "#b4a388"); trailMat.backFaceCulling = false; trailMat.emissiveColor = new Color3(0.12, 0.105, 0.085);
    const trailMesh = MeshBuilder.CreateRibbon("harborTrail", { pathArray: [trailLeft, trailRight] }, scene); trailMesh.material = trailMat; trailMesh.isPickable = false;
    // River and two accessible bridges. Water is a visual surface; the shared
    // walking test prevents crossing except where bridge decks are present.
    const river = MeshBuilder.CreateGround("riverWater",{width:18,height:420},scene); river.position.set(0,0.01,9); river.material=waterMat; river.isPickable=false;
    // Continue the channel and its banks into the background. The playable
    // bounds stay unchanged; there is no sky-coloured split at the water end.
    const bankP:number[]=[],bankI:number[]=[],rows=[92,115,150,200,245];
    for(const side of [-1,1])for(let j=0;j<rows.length;j++)for(let i=0;i<=24;i++) {
      const bx=side*(9+i*6),bz=rows[j]!;bankP.push(bx,chinaHeight(bx,bz)-0.04,bz);
      if(j<rows.length-1&&i<24){const a=(side===-1?0:rows.length*25)+j*25+i;if(side<0)bankI.push(a,a+25,a+1,a+1,a+25,a+26);else bankI.push(a,a+1,a+25,a+1,a+26,a+25);}
    }
    const banks=new Mesh("backgroundRiverBanks",scene),bankData=new VertexData(),bankN:number[]=[];VertexData.ComputeNormals(bankP,bankI,bankN);bankData.positions=bankP;bankData.normals=bankN;bankData.indices=bankI;bankData.applyToMesh(banks);banks.material=ground;ground.backFaceCulling=false;worldSurfaceUV(banks);
    const farBed=MeshBuilder.CreateGround("backgroundRiverBed",{width:18,height:150},scene);farBed.position.set(0,-1.8,167);farBed.material=ground;
    for (const side of [-1,1]) {
      box("riverLining",side*9.15,-0.75,9,0.3,1.5,166,paving);
      box("riverCoping",side*9.15,0.08,9,0.48,0.16,166,paving);
      for(let z=-68;z<86;z+=7.7) {
        const r=MeshBuilder.CreateSphere("riverBedRock",{diameter:0.5+(z%3)*0.04,segments:6},scene); r.position.set(side*(7.3+Math.sin(z)*0.4),-0.35,z); r.scaling.y=0.5; r.material=paving;
      }
    }
    for (const z of [2, 48]) {
      box("bridgeDeck", 0, 0.13, z, 21, 0.26, 12, paving);
      for (const side of [-1, 1]) {
        box("bridgeRail", 0, 0.82, z + side * 5.8, 20, 0.12, 0.12, timber);
        for (let x = -9; x <= 9; x += 3) box("bridgePost", x, 0.45, z + side * 5.8, 0.12, 0.9, 0.12, timber);
      }
    }
    // The east side is an everyday street, with pavements, crossings and
    // individual shopfronts. The riverside walk leads naturally to the bridge.
    box("eastRoad", 35, 0.015, -12, 12, 0.03, 112, road);
    for (const x of [26, 44]) box("eastPavement", x, 0.06, -12, 6, 0.12, 112, paving);
    box("riverWalk", 11.2, 0.07, 5, 4.4, 0.14, 150, paving);
    box("westWalk", -11.2, 0.07, 5, 4.4, 0.14, 150, paving);
    for (let z = -60; z < 41; z += 11) box("streetLine", 35, 0.04, z, 0.18, 0.02, 4.8, white);
    for (const x of [31, 33, 35, 37, 39]) box("crosswalk", x, 0.04, 1, 0.9, 0.02, 5, white);
    box("westRoad", -38, 0.02, -12, 46, 0.04, 7, road);
    for (let x = -58; x < -14; x += 8) box("westRoadMark", x, 0.05, -12, 3.6, 0.02, 0.15, white);
    // Distinct low-rise facades with balcony details and varied awnings.
    const walls = CHINA_BUILDINGS.map((b, i) => { const m = material(`harborWall${i}`, b.color); return m; });
    for (let i = 0; i < CHINA_BUILDINGS.length; i++) {
      const b = CHINA_BUILDINGS[i]!, wall = walls[i]!, roofMat = material(`harborRoof${i}`, b.roof);
      const front = b.x > 35 ? b.x - b.w / 2 : b.x + b.w / 2, face = b.x > 35 ? -1 : 1;
      box(`harborHome${i}`, b.x, b.h / 2, b.z, b.w, b.h, b.d, wall);
      box(`harborFoundation${i}`, b.x, 0.2, b.z, b.w + 0.15, 0.4, b.d + 0.15, timber);
      districtRoof(scene,`harborEave${i}`,b.x,b.h+0.08,b.z,b.w+1.8,b.d+1.8,roofMat,true);
      for (const z of [-b.d * 0.27, b.d * 0.27]) {
        box("upperWindow", front + face * 0.08, b.h - 2, b.z + z, 0.08, 1.65, 2.1, glass);
        box("windowFrame", front + face * 0.14, b.h - 2, b.z + z, 0.1, 1.65, 0.09, timber);
        box("windowFrame", front + face * 0.14, b.h - 2, b.z + z, 0.1, 0.08, 2.1, timber);
      }
      box("door", front + face * 0.1, 1.25, b.z, 0.18, 2.5, 1.7, timber);
      box("doorGlass", front + face * 0.22, 1.6, b.z, 0.04, 1.2, 1.25, glass);
      if (i % 3 !== 0) {
        box("awning", front + face * 0.9, 2.95, b.z, 1.9, 0.18, 5.8, i % 2 ? red : roof);
        box("shopWindow", front + face * 0.12, 1.55, b.z + 3, 0.08, 1.8, 2.5, glass);
        const signTex = new DynamicTexture(`harborShopSign${i}`, { width: 512, height: 128 }, scene, true);
        const c = signTex.getContext() as CanvasRenderingContext2D;
        c.fillStyle = i % 2 ? "#94493b" : "#405e5b"; c.fillRect(0, 0, 512, 128);
        c.fillStyle = "#fff2d4"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = "bold 42px sans-serif";
        const signs = ["河畔 · RIVERSIDE", "茶铺 · TEA", "面包 · BAKERY", "日用 · GOODS", "花店 · FLOWERS"];
        c.fillText(signs[i % signs.length]!, 256, 66); signTex.update(); signTex.uScale = -1; signTex.uOffset = 1;
        const signMat = new StandardMaterial(`harborShopSignMat${i}`, scene); signMat.disableLighting = true; signMat.diffuseColor = Color3.Black(); signMat.emissiveColor = Color3.White(); signMat.diffuseTexture = signTex; signMat.emissiveTexture = signTex; signMat.backFaceCulling = false;
        const sign = MeshBuilder.CreatePlane(`harborShopSign${i}`, { width: 4.2, height: 1 }, scene);
        sign.position.set(front + face * 0.18, 3.55, b.z); sign.rotation.y = face * Math.PI / 2; sign.material = signMat; sign.isPickable = false;
      } else {
        box("balcony", front + face * 0.6, 4, b.z, 1.2, 0.15, 4.8, timber);
        box("balconyRail", front + face * 1.1, 4.7, b.z, 0.1, 0.1, 4.8, timber);
      }
    }
    // The west bank is a market and garden, not another copy of the street.
    box("marketCourt", -32, 0.04, 24, 37, 0.08, 28, paving);
    for (let x = -48; x <= -18; x += 4) for (let z = 13; z <= 35; z += 4) box("courtJoint", x, 0.085, z, 0.025, 0.01, 3.9, timber);
    for (const [x, z, yaw] of [[-46, 18, 0], [-30, 31, Math.PI]] as const) addChinaAsset(scene, "marketStall", x, 0, z, 1, yaw);
    for (const [x, z] of [[-46, 24], [-30, 24], [-18, 24]] as const) {
      // The original Tunyard string includes its own ground-level posts.
      addChinaAsset(scene, "lanternString", x, 0, z, 1, 0);
    }
    // Produce tables, baskets and crates give the riverside market everyday
    // detail while retaining a clear central walking path.
    const basket = material("marketBasket", "#9c7954"), produce = [material("marketLeaf", "#728b53"), material("marketFruit", "#bd7054"), material("marketPear", "#c8ad62")];
    for (let i = 0; i < CHINA_TABLES.length; i++) {
      const { x, z } = CHINA_TABLES[i]!;
      box("marketTable", x, 0.85, z, 2.1, 0.12, 1.2, timber);
      for (const a of [-0.85, 0.85]) for (const b of [-0.45, 0.45]) box("marketLeg", x + a, 0.42, z + b, 0.1, 0.84, 0.1, timber);
      for (const a of [-0.6, 0, 0.6]) {
        disc("marketBasket", x + a, 0.99, z, 0.23, 0.18, basket);
        disc("marketProduce", x + a, 1.11, z, 0.19, 0.1, produce[(i + Math.round(a * 5) + 6) % produce.length]!);
      }
      box("marketCrate", x + 1.55, 0.3, z + 0.2, 0.65, 0.6, 0.65, timber);
    }
    for (const [x, z] of [[-52, 22], [-52, 28], [-17, 16], [-15, 34]] as const) {
      disc("courtPlanter", x, 0.3, z, 0.5, 0.6, basket);
      const shrub = MeshBuilder.CreateSphere("courtShrub", { diameter: 1.3, segments: 7 }, scene); shrub.position.set(x, 1.05, z); shrub.scaling.y = 0.7; shrub.material = ground;
    }
    // An actual fishing place on the east bank: a bench, basket, rod rest and
    // animated float. The player stands on the open riverside walk.
    const fishBasket = new TransformNode("harborFishBasket", scene);
    fishBasket.position.set(12.8, 0, -25);
    const catchBasketMat = material("fishBasketWeave", "#a3815c");
    box("fishBasket", 0, 0.24, 0, 0.95, 0.48, 0.7, catchBasketMat, fishBasket);
    const fishMat = material("harborFishSilver", "#a5c5ba");
    const fishInBasket: TransformNode[] = [];
    for (let i = 0; i < 3; i++) {
      const fish = new TransformNode(`harborCatch${i}`, scene);
      fish.parent = fishBasket; fish.position.set(-0.25 + i * 0.25, 0.54 + i * 0.06, 0);
      const body = MeshBuilder.CreateSphere("fishBody", { diameter: 0.28, segments: 8 }, scene);
      body.parent = fish; body.scaling.set(1.6, 0.65, 0.7); body.material = fishMat;
      const tail = MeshBuilder.CreateCylinder("fishTail", { height: 0.18, diameterTop: 0.19, diameterBottom: 0.04, tessellation: 4 }, scene);
      tail.parent = fish; tail.position.x = -0.25; tail.rotation.z = Math.PI / 2; tail.material = fishMat;
      fish.setEnabled(false); fishInBasket.push(fish);
    }
    const rod = box("fishingRod", 9.4, 1.1, -25, 5, 0.055, 0.055, timber); rod.rotation.z = -0.2;
    const float = MeshBuilder.CreateSphere("fishingFloat", { diameter: 0.22, segments: 8 }, scene);
    float.position.set(6.9, 0.15, -25); float.material = red; float.setEnabled(false);
    const line = box("fishingLine", 6.95, 0.85, -25, 0.025, 1.5, 0.025, white); line.setEnabled(false);
    // The music evening is a saved, tangible transformation of the market.
    const festival = new TransformNode("harborFestival", scene); festival.setEnabled(false);
    const glow = material("festivalLanternGlow", "#f4b45e"); glow.emissiveColor = Color3.FromHexString("#b75d24");
    for (const x of [-45, -41, -37, -33, -29, -25, -21]) {
      const lantern = MeshBuilder.CreateSphere("festivalLantern", { diameter: 0.55, segments: 10 }, scene);
      const y = 4.12 - 0.3 * Math.sin((x + 45) / 24 * Math.PI);
      lantern.parent = festival; lantern.position.set(x, y, 25); lantern.scaling.y = 1.25; lantern.material = glow;
      const drop = 4.45 - (y + 0.3);
      box("festivalLanternCord", x, 4.45 - drop / 2, 25, 0.025, drop, 0.025, timber, festival);
    }
    box("festivalBunting", -33, 4.45, 25, 24, 0.035, 0.035, timber, festival);
    const feast = new TransformNode("harborFeast", scene); feast.setEnabled(false);
    const bowl = material("festivalCeramic", "#f1e6d1"), soup = material("festivalSoup", "#b9844c");
    for (let i = 0; i < 3; i++) {
      const dish = disc("feastBowl", -43.65 + i * 0.6, 1.04, 24, 0.23, 0.14, bowl); dish.parent = feast;
      const food = disc("feastSoup", -43.65 + i * 0.6, 1.12, 24, 0.17, 0.025, soup); food.parent = feast;
    }
    for (const z of [13, 36]) {
      box("marketBench", -37, 0.52, z, 2.4, 0.14, 0.5, timber);
      for (const x of [-37.8, -36.2]) box("marketBenchLeg", x, 0.25, z, 0.1, 0.5, 0.35, timber);
    }
    // Poles and cables are set back from the footpath and give the street a
    // readable lived-in scale without placing collision on the roadway.
    for (const z of [-61, -36, -11, 14, 39]) {
      box("utilityPole", 23, 4.2, z, 0.16, 8.4, 0.16, timber);
      box("utilityArm", 23, 8.1, z, 1.2, 0.12, 0.12, timber);
      if (z < 39) box("utilityCable", 23, 8.12, z + 12.5, 0.035, 0.035, 25, timber);
    }
    for (const [i, [x, z]] of CHINA_TREES.entries()) addChinaTree(scene, x, chinaHeight(x, z), z, 1 + (i % 3) * 0.13, i * 1.3);
    // A visible shuttle stop makes the in-world return point discoverable.
    for (const x of [38.7, 43.3]) box("shuttlePost", x, 1.35, -69, 0.16, 2.7, 0.16, timber);
    box("shuttleRoof", 41, 2.75, -69, 5.2, 0.2, 1.6, roof);
    box("shuttleBench", 41, 0.55, -69.3, 2.4, 0.12, 0.5, timber);
    // Soft distant ridges visually enclose the district without pretending the
    // player can walk beyond its boundary.
    for (const [x, z, sx, sy] of [[-90, 123, 55, 23], [-40, 133, 60, 30], [20, 126, 58, 24], [75, 132, 60, 32]] as const) {
      const m = MeshBuilder.CreateSphere("distantRidge", { diameter: 1, segments: 8 }, scene);
      m.position.set(x, -1, z); m.scaling.set(sx, sy, 20); m.material = material(`ridge${x}`, "#84918a");
    }
    // Steps/benches at the hilltop overlook; the ground rises gently below.
    const overlookY = chinaHeight(-48, 62);
    disc("overlook", -48, overlookY + 0.03, 62, 5, 0.12, paving);
    for (const x of [-51.2, -44.8]) {
      const y = chinaHeight(x, 65);
      box("benchSeat", x, y + 0.55, 65, 2.2, 0.14, 0.55, timber);
      for (const s of [-0.8, 0.8]) box("benchLeg", x + s, y + 0.25, 65, 0.15, 0.5, 0.35, timber);
    }
    const makePerson = (name: string, look: KitLook, x: number, z: number, yaw = 0): KitHuman => {
      const h = new KitHuman(scene, name, look, peopleMat); people.push(h); h.root.position.set(x, chinaHeight(x, z), z); h.root.rotation.y = yaw; h.sync(0); return h;
    };
    const hero = makePerson("harborHero", options.look ?? PLAYER_LOOKS[0]!.kit, CHINA_WORLD.start.x, CHINA_WORLD.start.z);
    const host = makePerson("harborMei", { archetype: "female", outfit: "casual_f", colors: { top: "#ac6252" } }, CHINA_WORLD.host.x, CHINA_WORLD.host.z, Math.PI / 2);
    const artisan = makePerson("harborLin", { archetype: "female", outfit: "casual_f", colors: { top: "#6e9b8c" } }, CHINA_WORLD.artisan.x, CHINA_WORLD.artisan.z, -Math.PI / 2);
    const musician = makePerson("harborWen", { archetype: "male", outfit: "street_casual", colors: { top: "#698199" } }, CHINA_WORLD.musician.x, CHINA_WORLD.musician.z, Math.PI);
    const keeper = makePerson("harborShu", { archetype: "male", outfit: "office_casual" }, CHINA_WORLD.keeper.x, CHINA_WORLD.keeper.z, 0);
    const walker = makePerson("harborWalker", { archetype: "female", outfit: "casual_f", colors: { top: "#bd8b70" } }, 25, -35, 0);
    walker.ch.play("walk", { fade: 0 });
    const vendor = makePerson("harborVendor", { archetype: "female", outfit: "casual_f", colors: { top: "#738e7e" } }, -49, 20, Math.PI / 2);
    const customer = makePerson("harborCustomer", { archetype: "male", outfit: "street_casual", colors: { top: "#927e6e" } }, -22, 30, -Math.PI / 2);
    const marketWalker = makePerson("harborMarketWalker", { archetype: "female", outfit: "casual_f", colors: { top: "#9b7977" } }, -15, 22, 0);
    marketWalker.ch.play("walk", { fade: 0 });
    const nameplate = (name: string, x: number, z: number, caption: string): void => {
      const texture = new DynamicTexture(`${name}Label`, { width: 512, height: 128 }, scene, true);
      const c = texture.getContext() as CanvasRenderingContext2D; c.clearRect(0, 0, 512, 128);
      c.fillStyle = "rgba(54,46,41,.88)"; c.fillRect(12, 14, 488, 100); c.fillStyle = "#fff8e9"; c.font = "600 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(caption, 256, 66);
      texture.hasAlpha = true; texture.update();
      const m = new StandardMaterial(`${name}LabelMaterial`, scene); m.disableLighting = true; m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.White(); m.diffuseTexture = texture; m.emissiveTexture = texture; m.useAlphaFromDiffuseTexture = true; m.backFaceCulling = false;
      const p = MeshBuilder.CreatePlane(`${name}Label`, { width: 2.3, height: 0.58 }, scene); p.position.set(x, chinaHeight(x, z) + 2.55, z); p.billboardMode = Mesh.BILLBOARDMODE_Y; p.material = m; p.isPickable = false;
    };
    for (const [name, p, label] of [["mei", CHINA_WORLD.host, "Mei · Riverside"], ["lin", CHINA_WORLD.artisan, "Lin · Workshop"], ["wen", CHINA_WORLD.musician, "Wen · Music"], ["shu", CHINA_WORLD.keeper, "Shu · Lookout"], ["cook", CHINA_FISHMONGER, "Market cook"], ["fishing", CHINA_FISHING_SPOT, "Riverside fishing"]] as const) nameplate(name, p.x, p.z, label);
    // Batch only immutable, opaque street and market primitives. The fishing
    // rod/float, changing feast and festival, NPCs and source assets stay separate.
    batchStatic(scene, new Set([
      "bridgeRail", "bridgePost", "riverBedRock", "riverLining", "riverCoping", "eastPavement", "riverWalk", "westWalk", "streetLine", "crosswalk", "westRoadMark",
      "upperWindow", "windowFrame", "door", "doorGlass", "awning", "shopWindow", "balcony", "balconyRail",
      "courtJoint", "marketTable", "marketLeg", "marketCrate", "utilityPole", "utilityArm", "utilityCable",
      "shuttlePost", "benchSeat", "benchLeg", "marketBench", "marketBenchLeg",
    ]));

    overlay.dataset.chinaWorld = ""; overlay.setAttribute("role", "region"); overlay.setAttribute("aria-label", "Lantern Harbor river district");
    Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "10000", color: "#fff8ee", fontFamily: "system-ui, sans-serif", pointerEvents: "auto", touchAction: "none" });
    const top = document.createElement("div"); Object.assign(top.style, { position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px", pointerEvents: "none" });
    const status = document.createElement("div"); status.dataset.chinaStatus = ""; status.setAttribute("aria-live", "polite");
    Object.assign(status.style, { background: "rgba(47,43,40,.90)", border: "2px solid #ddbd91", borderRadius: "8px", padding: "7px 11px", fontSize: "14px", lineHeight: "1.35", maxWidth: "min(68vw, 440px)", maxHeight: "38vh", overflowY: "auto", pointerEvents: "auto", whiteSpace: "pre-line" });
    const back = document.createElement("button"); back.type = "button"; back.dataset.chinaReturn = ""; back.textContent = "Return to Ranggarh";
    Object.assign(back.style, { pointerEvents: "auto", border: "2px solid #ddbd91", borderRadius: "7px", padding: "8px 10px", color: "#fff", background: "#74594b", cursor: "pointer", fontWeight: "700" });
    top.append(status, back); overlay.appendChild(top);
    const held = new Set<string>(), controls = document.createElement("div");
    Object.assign(controls.style, { position: "absolute", left: "12px", bottom: "max(12px, env(safe-area-inset-bottom))", display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: "3px", opacity: "0.9" });
    const control = (label: string, code: string, col: string, row: string): void => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("aria-label", code === "run" ? "Hold to run" : `Move ${code}`);
      Object.assign(b.style, { gridColumn: col, gridRow: row, width: "44px", height: "44px", color: "#fff", background: "#69584f", border: "2px solid #ddbd91", borderRadius: "7px", fontSize: code === "run" ? "12px" : "20px", touchAction: "none" });
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); held.add(code); b.setPointerCapture(e.pointerId); }, { signal: abort.signal });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) b.addEventListener(name, () => held.delete(code), { signal: abort.signal });
      controls.appendChild(b);
    };
    control("Run", "run", "1", "1"); control("▲", "up", "2", "1"); control("◀", "left", "1", "2"); control("▼", "down", "2", "2"); control("▶", "right", "3", "2"); overlay.appendChild(controls);
    const action = document.createElement("button"); action.type = "button"; action.textContent = "Talk / Interact"; action.dataset.chinaInteract = "";
    Object.assign(action.style, { position: "absolute", right: "12px", bottom: "max(18px, env(safe-area-inset-bottom))", border: "2px solid #ddbd91", borderRadius: "8px", padding: "12px", color: "#fff", background: "#74594b", fontWeight: "700", touchAction: "none" });
    overlay.appendChild(action); parent.appendChild(overlay);
    const hint = document.createElement("div"); Object.assign(hint.style, { position: "absolute", left: "50%", bottom: "max(78px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", padding: "7px 12px", borderRadius: "6px", background: "rgba(47,43,40,.9)", border: "1px solid #ddbd91", fontSize: "14px", display: "none", pointerEvents: "none" }); overlay.appendChild(hint);
    const player = { ...CHINA_WORLD.start };
    const nearby: Array<{ kind: ChinaPerson; name: string; x: number; z: number }> = [
      { kind: "host", name: "Mei", ...CHINA_WORLD.host }, { kind: "artisan", name: "Lin", ...CHINA_WORLD.artisan },
      { kind: "musician", name: "Wen", ...CHINA_WORLD.musician }, { kind: "keeper", name: "Shu", ...CHINA_WORLD.keeper },
    ];
    const personNear = () => nearby.find((p) => Math.hypot(player.x - p.x, player.z - p.z) < 2.5);
    let stage = normalizeChinaProgress(options).stage, locomotion = "idle", elapsed = 0;
    let fishing = startChinaFishing(options.fishingComplete === true);
    const saveProgress = (): void => options.onProgress?.({ stage, fishingComplete: fishing.phase === "delivered" });
    const refreshCatch = (): void => {
      for (let i = 0; i < fishInBasket.length; i++) fishInBasket[i]!.setEnabled(fishing.phase !== "delivered" && i < fishing.catches);
      feast.setEnabled(fishing.phase === "delivered");
      float.setEnabled(fishing.phase === "waiting" || fishing.phase === "bite");
      line.setEnabled(fishing.phase === "waiting" || fishing.phase === "bite");
    };
    refreshCatch();
    // Finishing the neighbors' preparations changes the district's light to
    // evening. Reapply it on entry so the saved story has a visible result.
    const setEvening = (): void => {
      scene.clearColor = new Color4(0.78, 0.65, 0.61, 1);
      scene.fogColor = new Color3(0.78, 0.65, 0.61);
      hemi.diffuse = Color3.FromHexString("#f5dbbd");
      sun.diffuse = Color3.FromHexString("#ffd7a4");
      sun.intensity = 1.5;
      festival.setEnabled(true);
    };
    if (stage === 4) setEvening();
    let notice = stage === 4 ? "The riverside evening is ready. Explore or return." : stage === 3 ? "Tell Mei the music evening is ready." : stage === 2 ? "Take the lantern shade across the bridge to Wen." : stage === 1 ? "Talk to Lin at the workshop up the east street." : "Talk to Mei beside the east street.";
    const updateStatus = (): void => { status.textContent = `Lantern Harbor · ${stage === 4 ? "riverside evening ready" : "a riverside evening"}\n${controlsInput?.hint(notice)??notice}`; overlay.dataset.chinaStage = String(stage); };
    const exit = (): void => { if (closed) return; closed = true; held.clear(); disposeScene(); onExit(); };
    const interact = (): void => {
      if(controlsInput?.isPaused) return;
      if(cinematic?.active) return;
      if (Math.hypot(player.x - CHINA_WORLD.portal.x, player.z - CHINA_WORLD.portal.z) < 2.7) { exit(); return; }
      const atWater = Math.hypot(player.x - CHINA_FISHING_SPOT.x, player.z - CHINA_FISHING_SPOT.z) < 2.7;
      if (atWater && fishing.phase !== "delivered") {
        if (fishing.phase === "idle") { fishing = castChinaFishing(fishing); hero.root.rotation.y = -Math.PI / 2; notice = "Cast out. Watch the float: press E when a fish bites, not before."; }
        else if (fishing.phase === "waiting") { fishing = reelChinaFishing(fishing); notice = "Too soon! The fish slipped away. Press E to cast again."; }
        else if (fishing.phase === "bite") {
          fishing = reelChinaFishing(fishing);
          notice = fishing.phase === "ready" ? "Three fish! Bring them to the market cook by the west-bank stall." : `Caught one! ${fishing.catches}/3. Press E to cast again.`;
        } else notice = "Bring the catch to the market cook by the west-bank stall.";
        refreshCatch(); updateStatus(); return;
      }
      if (Math.hypot(player.x - CHINA_FISHMONGER.x, player.z - CHINA_FISHMONGER.z) < 2.5) {
        if (fishing.phase === "ready") { fishing = deliverChinaFishing(fishing); saveProgress(); moment(CHINA_FISHMONGER.x,0,CHINA_FISHMONGER.z,"The market cook · A fresh catch for the evening table."); refreshCatch(); notice = caption(CHINA_LINES.cookThanks); options.soundscape?.playDialogue?.(CHINA_LINES.cookThanks); }
        else { const line = fishing.phase === "delivered" ? CHINA_LINES.cookDone : CHINA_LINES.cookAsk; notice = caption(line); options.soundscape?.playDialogue?.(line); }
        updateStatus(); return;
      }
      const who = personNear();
      if (!who) { notice = "Walk close to a neighbor and press E to talk, or use Return to Ranggarh."; updateStatus(); return; }
      const result = chinaConversation(stage, who.kind);
      if (stage !== result.stage) { stage = result.stage; if (stage === 4) setEvening(); saveProgress(); moment(who.x,chinaHeight(who.x,who.z),who.z,stage===4?"Lantern Harbor · The riverside evening begins.":`${who.name} · A little help brings the neighborhood together.`); }
      notice = result.text; options.soundscape?.playDialogue?.(result.line); updateStatus();
    };
    back.addEventListener("click", exit, { signal: abort.signal }); action.addEventListener("click", interact, { signal: abort.signal });
    updateStatus();
    controlsInput = new DistrictControls(overlay,engine.getRenderingCanvas()!,held,interact,exit);
    cinematic = new CinematicDirector(overlay,camera,(at,eye)=>visibleCinematicEye(scene,at,eye,false));
    const moment = (tx:number,ty:number,tz:number,text:string): void => {
      hero.ch.greet({fade:0.15});
      void cinematic!.play(interactionShots(player.x,hero.root.position.y,player.z,tx,ty,tz,text)).then(()=>{
        held.clear(); controlsInput?.input.clear(); if(!closed) hero.ch.play("idle",{fade:0.15});
      });
    };
    batchStatic(scene,new Set(scene.meshes.filter(m=>/^harbor-tree|^china-market-/.test(m.name)).map(m=>m.name)),8,true);
    finishDistrict(scene,sun,"harbor",chinaHeight);
    if(stage===4) setEvening();
    let lastHint = "";
    loop = (): void => {
      if (closed) return;
      try {
        const dt = districtFrameDelta(engine.getDeltaTime() / 1000);
        if(cinematic!.active) { cinematic!.update(dt); for(const h of people) h.sync(dt); scene.render(); return; }
        const frameInput=controlsInput!.read(dt); if(closed) return; if(frameInput.paused) {scene.render();return;}
        elapsed += dt;
        const oldFishingPhase = fishing.phase;
        fishing = tickChinaFishing(fishing, dt);
        if (oldFishingPhase !== fishing.phase) {
          if (fishing.phase === "bite") notice = "A bite! Press E now to reel it in!";
          else if (oldFishingPhase === "bite") notice = "It got away. Press E to cast again.";
          refreshCatch(); updateStatus();
        }
        float.position.y = 0.14 + (fishing.phase === "bite" ? Math.sin(elapsed * 18) * 0.07 - 0.05 : Math.sin(elapsed * 2) * 0.025);
        const {dx,dz,running,jump,paused} = frameInput;
        const moved = moveInDistrict(player,dx,dz,running?6:3.6,paused?0:dt,canWalkChina);
        if (moved) hero.root.rotation.y = Math.atan2(dx, dz);
        const nextLocomotion = moved ? running ? "run" : "walk" : "idle";
        if (locomotion !== nextLocomotion) { locomotion = nextLocomotion; hero.ch.play(locomotion, { fade: 0.15 }); }
        options.soundscape?.update(player.x, player.z, dt);
        if ((fishing.phase === "waiting" || fishing.phase === "bite") && Math.hypot(player.x - CHINA_FISHING_SPOT.x, player.z - CHINA_FISHING_SPOT.z) >= 2.7) {
          fishing = { ...fishing, phase: "idle", remaining: 0 }; refreshCatch(); notice = "You left the rod. Return to the river walk to cast again."; updateStatus();
        }
        hero.root.position.set(player.x, chinaHeight(player.x, player.z)+controlsInput!.elevation(paused?0:dt,jump), player.z);
        const pace = Math.sin(elapsed * 0.10), previous = Math.sin((elapsed - dt) * 0.10);
        walker.root.position.z = -35 + pace * 10; walker.root.rotation.y = pace >= previous ? 0 : Math.PI;
        const marketPace = Math.sin(elapsed * 0.14), marketPrevious = Math.sin((elapsed - dt) * 0.14);
        marketWalker.root.position.z = 24 + marketPace * 4; marketWalker.root.rotation.y = marketPace >= marketPrevious ? 0 : Math.PI;
        for (const h of [hero, host, artisan, musician, keeper, walker, vendor, customer, marketWalker]) h.sync(dt);
        controlsInput!.follow(camera,player,chinaHeight(player.x,player.z),dt);
        overlay.dataset.chinaLocomotion = locomotion; overlay.dataset.chinaX = player.x.toFixed(2); overlay.dataset.chinaZ = player.z.toFixed(2);
        const near = personNear(), nearReturn = Math.hypot(player.x - CHINA_WORLD.portal.x, player.z - CHINA_WORLD.portal.z) < 2.7;
        const atWater = Math.hypot(player.x - CHINA_FISHING_SPOT.x, player.z - CHINA_FISHING_SPOT.z) < 2.7;
        const nearCook = Math.hypot(player.x - CHINA_FISHMONGER.x, player.z - CHINA_FISHMONGER.z) < 2.5;
        const nextHint = nearReturn ? "E · Return to Ranggarh" : atWater && fishing.phase !== "delivered" ? (fishing.phase === "bite" ? "E · Reel in!" : fishing.phase === "waiting" ? "Watch the float" : "E · Fish") : nearCook ? "E · Talk to market cook" : near ? `E · Talk to ${near.name}` : "";
        if (nextHint !== lastHint) { lastHint = nextHint; hint.textContent = controlsInput!.hint(nextHint); hint.style.display = nextHint ? "block" : "none"; }
        overlay.dataset.chinaNear = nearReturn ? "return" : atWater && fishing.phase !== "delivered" ? "fishing" : nearCook ? "cook" : near?.kind ?? "";
        overlay.dataset.chinaFishing = fishing.phase;
        scene.render();
      } catch (error) { console.error("Lantern Harbor could not render", error); exit(); }
    };
    started = true; engine.runRenderLoop(loop);
    return { dispose: exit };
  } catch (e) { closed = true; disposeScene(); throw e; }
}
