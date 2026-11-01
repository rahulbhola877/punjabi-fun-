import { Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, UniversalCamera, Vector3, VertexBuffer, VertexData } from "../babylon";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { KitHuman, type KitLook } from "../characters/KitHuman";
import { createTunyardFox } from "./TunyardFox";
import { createTunyardRocket } from "./TunyardRocket";
import { addSpaceAsset } from "./SpaceAssets";
import { expeditionInteraction, normalizeExpeditionStage } from "./spaceExpedition";
import { canDriveSpace, canWalkSpace, normalizeSpaceProgress, SPACE_CRATER_ROCKS, SPACE_SOLIDS, SPACE_WORLD, spaceHeight, spaceInteraction, type SpaceProgress, type SpaceTarget } from "./spaceMap";

/** A separate small lunar outpost. The caller pauses the original world first. */
export function openSpaceWorld(parent: HTMLElement, engine: AbstractEngine, onExit: () => void, options: Partial<SpaceProgress> & { look?: KitLook; onProgress?: (p: SpaceProgress) => void } = {}): { dispose: () => void } {
  const scene = new Scene(engine), overlay = document.createElement("div"), abort = new AbortController();
  const people: KitHuman[] = [];
  let closed = false, started = false, loop: (() => void) | undefined;
  const release = (): void => {
    abort.abort();
    if (started && loop) engine.stopRenderLoop(loop);
    for (const person of people) person.dispose();
    scene.dispose(); overlay.remove();
  };
  try {
    scene.clearColor = new Color4(0.035, 0.035, 0.095, 1);
    const camera = new UniversalCamera("chandCamera", new Vector3(0, 6, -42), scene);
    camera.minZ = 0.1; camera.maxZ = 450; camera.fov = 0.86; scene.activeCamera = camera;
    const hemi = new HemisphericLight("chandSky", new Vector3(0.2, 1, -0.1), scene);
    hemi.intensity = 0.75; hemi.diffuse = Color3.FromHexString("#d9e2ff"); hemi.groundColor = Color3.FromHexString("#483d5c");
    const sun = new DirectionalLight("chandSun", new Vector3(-0.45, -1, 0.25), scene);
    sun.intensity = 0.8; sun.diffuse = Color3.FromHexString("#fff1dc");
    const mat = (name: string, hex: string, glow = false): StandardMaterial => {
      const m = new StandardMaterial(name, scene), c = Color3.FromHexString(hex);
      m.diffuseColor = c; m.specularColor = new Color3(0.08, 0.08, 0.08);
      if (glow) { m.disableLighting = true; m.emissiveColor = c; }
      return m;
    };
    const rock = mat("chandDust", "#b1a39e"), shadow = mat("chandRock", "#716e7b"), lightRock = mat("chandStone", "#b8abb0");
    const metal = mat("chandMetal", "#8a9ba8"), dark = mat("chandDark", "#344650"), white = mat("chandWhite", "#eee5d5");
    const cyan = mat("chandCyan", "#80e9ec", true), amber = mat("chandAmber", "#ffd376", true), red = mat("chandRed", "#c76551");
    const peopleMat = mat("chandPeople", "#ffffff");
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: StandardMaterial, owner?: TransformNode): Mesh => {
      const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      mesh.position.set(x, y, z); mesh.material = m; if (owner) mesh.parent = owner; return mesh;
    };
    const cylinder = (name: string, x: number, y: number, z: number, diameter: number, height: number, m: StandardMaterial): Mesh => {
      const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 20 }, scene);
      mesh.position.set(x, y, z); mesh.material = m; return mesh;
    };
    const sphere = (name: string, x: number, y: number, z: number, diameter: number, m: StandardMaterial, owner?: TransformNode): Mesh => {
      const mesh = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
      mesh.position.set(x, y, z); mesh.material = m; if (owner) mesh.parent = owner; return mesh;
    };
    // A broad landing basin, distant broken ridge and a large blue planet make
    // the destination legible at ground level rather than an empty skybox.
    const dust = new DynamicTexture("chandDustTexture", { width: 256, height: 256 }, scene, true);
    const paint = dust.getContext() as CanvasRenderingContext2D;
    paint.fillStyle = "#d4cbc5"; paint.fillRect(0, 0, 256, 256);
    let grain = 7123;
    for (let i = 0; i < 7500; i++) {
      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0; const x = grain % 256;
      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0; const y = grain % 256;
      paint.fillStyle = i % 3 ? "rgba(80,70,75,.08)" : "rgba(255,255,245,.11)";
      paint.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    // Long, subtle drifts break up the fine-grained regolith at walking scale.
    for (let i = 0; i < 55; i++) {
      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0; const x = grain % 256;
      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0; const y = grain % 256;
      paint.strokeStyle = i % 2 ? "rgba(84,75,84,.11)" : "rgba(255,247,229,.15)";
      paint.lineWidth = 1 + i % 3; paint.beginPath(); paint.moveTo(x, y);
      paint.bezierCurveTo(x + 7, y - 3, x + 18, y + 5, x + 26 + i % 12, y + 1); paint.stroke();
    }
    dust.update(false); dust.uScale = 11; dust.vScale = 11; rock.diffuseTexture = dust;
    // The land rises gently into distinct uplands. Player and rover use the
    // same height function, so the shaped ground remains traversable.
    const ground = MeshBuilder.CreateGround("chandGround", { width: 166, height: 167, subdivisions: 100, updatable: true }, scene);
    ground.position.z = 17.5; ground.material = rock;
    const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
    for (let i = 0; i < positions.length; i += 3) positions[i + 1] = spaceHeight(positions[i]!, positions[i + 2]! + 17.5);
    const normals: number[] = []; VertexData.ComputeNormals(positions, ground.getIndices()!, normals);
    ground.updateVerticesData(VertexBuffer.PositionKind, positions); ground.updateVerticesData(VertexBuffer.NormalKind, normals);
    const planet = sphere("homePlanet", -54, 28, 185, 45, mat("planet", "#668bb8", true));
    planet.scaling.z = 0.3;
    const planetLight = sphere("planetGlow", -50, 34, 182, 22, mat("planetClouds", "#9cbacb", true)); planetLight.scaling.set(1, 0.3, 0.2);
    // Stars are merged into a single mesh so their count does not add draw calls.
    const stars: Mesh[] = [];
    let seed = 4741;
    for (let i = 0; i < 105; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = (seed / 4294967296 - 0.5) * 420;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = 9 + seed / 4294967296 * 36;
      const s = MeshBuilder.CreateBox(`star${i}`, { size: i % 11 === 0 ? 0.9 : 0.42 }, scene); s.position.set(x, y, 205); stars.push(s);
    }
    const starField = Mesh.MergeMeshes(stars, true, true, undefined, false, true);
    if (starField) { starField.name = "chandStars"; starField.material = white; }
    for (let i = 0; i < 17; i++) {
      const x = -110 + i * 14, h = 4 + ((i * 19) % 8), d = 23 + (i % 4) * 5;
      const mountain = MeshBuilder.CreateCylinder("distantRidge", { diameterTop: 0, diameterBottom: d, height: h, tessellation: 5 }, scene);
      mountain.position.set(x, h / 2 - 1, 130 + (i % 3) * 3); mountain.material = i % 2 ? shadow : lightRock;
    }
    // Landing pad with enough clear approach space for the player.
    // Original Tunyard landing platform, partly below ground so its walkable
    // deck stays flush with the basin's collision plane.
    addSpaceAsset(scene, "pad", 0, -0.5, -35, 1.5, 0);
    // Four habitat/work structures use the exact footprint checks in spaceMap.
    for (let i = 0; i < SPACE_SOLIDS.length; i++) {
      const b = SPACE_SOLIDS[i]!, h = i === 0 ? 4.8 : i === 1 ? 4.1 : 3.1;
      box(`habitat${i}`, b.x, h / 2, b.z, b.w, h, b.d, i % 2 ? metal : white);
      box(`habitatFoot${i}`, b.x, 0.2, b.z, b.w + 0.4, 0.4, b.d + 0.4, dark);
      box(`habitatRoof${i}`, b.x, h + 0.15, b.z, b.w + 0.4, 0.3, b.d + 0.4, dark);
      for (const dx of [-b.w * 0.26, b.w * 0.26]) {
        box(`habitatWindow${i}`, b.x + dx, 2.5, b.z - b.d / 2 - 0.04, 2.1, 1.15, 0.08, cyan);
        box(`habitatWindowFrame${i}`, b.x + dx, 2.5, b.z - b.d / 2 - 0.1, 0.07, 1.2, 0.08, dark);
      }
      box(`habitatDoor${i}`, b.x, 1.15, b.z - b.d / 2 - 0.08, 1.6, 2.3, 0.16, dark);
      box(`doorGlow${i}`, b.x, 2.42, b.z - b.d / 2 - 0.11, 1.9, 0.12, 0.12, amber);
    }
    // Compacted regolith links the pad, work yard, rover and relay. These
    // strips are flush with the walkable basin rather than raised barriers.
    // One mesh holds all paths, with gently uneven shoulders and tinted bands.
    const pathMaterial = mat("outpostTracks", "#8b7975");
    pathMaterial.backFaceCulling = false;
    const pathPositions: number[] = [], pathNormals: number[] = [], pathColors: number[] = [], pathIndices: number[] = [];
    const addTrack = (ax: number, az: number, bx: number, bz: number, width: number, tint: [number, number, number], layer: number): void => {
      const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), nx = -dz / length, nz = dx / length;
      const first = pathPositions.length / 3, steps = Math.max(2, Math.ceil(length / 3));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = ax + dx * t, z = az + dz * t;
        const shoulder = width * (0.5 + 0.025 * Math.sin(i * 2.3 + ax));
        for (const side of [-1, 1]) {
          pathPositions.push(x + nx * shoulder * side, 0.018 + layer * 0.002, z + nz * shoulder * side);
          pathNormals.push(0, 1, 0);
          const grain = 0.95 + 0.05 * Math.sin(i * 1.7 + side);
          pathColors.push(tint[0] * grain, tint[1] * grain, tint[2] * grain, 1);
        }
        if (i < steps) {
          const n = first + i * 2;
          pathIndices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
        }
      }
    };
    addTrack(0, -30, 0, -20, 5.2, [1, 1, 1], 0);
    addTrack(0, -20, -10, -12, 4.2, [0.97, 0.96, 0.95], 1);
    addTrack(0, -20, 14, -12, 5, [1, 0.99, 0.97], 2);
    addTrack(0, -20, 12, 1, 3.7, [1, 1, 1], 3);
    addTrack(12, 1, 23, 27, 3.7, [1, 1, 1], 4);
    // Wheel ruts run from the parking area into the open eastern approach.
    for (const offset of [-0.85, 0.85]) addTrack(14 + offset, -12, 27 + offset, -7, 0.15, [0.63, 0.62, 0.63], 5);
    const tracks = new Mesh("compactedOutpostTracks", scene), trackData = new VertexData();
    trackData.positions = pathPositions; trackData.normals = pathNormals; trackData.colors = pathColors; trackData.indices = pathIndices;
    trackData.applyToMesh(tracks); tracks.material = pathMaterial; tracks.isPickable = false;
    // The owner's original Tunyard rocket provides a landmark at rest and
    // becomes the vehicle in the departure sequence.
    const shuttle = new TransformNode("outpostShuttle", scene); shuttle.position.set(-9, 0, -43);
    const rocket = createTunyardRocket(scene); rocket.parent = shuttle; rocket.scaling.setAll(2.5); rocket.rotation.y = Math.PI;
    const flame = sphere("launchFlame", 0, -0.65, 0, 2.2, amber, shuttle); flame.scaling.set(0.55, 1.8, 0.55);
    const gate = new TransformNode("outpostReturn", scene); gate.position.set(SPACE_WORLD.portal.x, 0, SPACE_WORLD.portal.z);
    for (const side of [-1, 1]) box("returnPost", side * 1.55, 2, 0, 0.25, 4, 0.25, metal, gate);
    box("returnTop", 0, 4, 0, 3.3, 0.25, 0.25, cyan, gate);
    box("returnLight", 0, 2, 0, 2.8, 3.4, 0.08, cyan, gate);
    // Connected footpath lights lead to cargo and relay without a painted line
    // across the natural-looking basin.
    for (const [x, z] of [[-11, -18], [-18, -8], [-23, -1], [5, -10], [12, 1], [18, 13], [22, 22]] as const) {
      cylinder("beaconStem", x, 0.45, z, 0.12, 0.9, dark); sphere("beaconLamp", x, 1, z, 0.32, amber);
    }
    // Small rocks are visual dressing away from the walking route; the main
    // collision objects remain explicit, so a tiny pebble never traps a player.
    for (let i = 0; i < 45; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = (seed / 4294967296 - 0.5) * 104;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const z = (seed / 4294967296 - 0.5) * 100 + 5;
      if (Math.abs(x) < 8 || !canWalkSpace(x, z) || Math.hypot(x - SPACE_WORLD.cell.x, z - SPACE_WORLD.cell.z) < 5 || Math.hypot(x - SPACE_WORLD.relay.x, z - SPACE_WORLD.relay.z) < 6) continue;
      const r = 0.25 + (i % 5) * 0.15, stone = sphere("moonStone", x, spaceHeight(x, z) + r * 0.3, z, r * 2, i % 3 ? shadow : lightRock);
      stone.scaling.set(1.4, 0.55, 0.9); stone.rotation.y = i;
    }
    // Shallow crater rims create surface landmarks without blocking movement.
    for (const [x, z, radius] of [[-42, -6, 5], [38, -4, 4], [-31, 37, 6], [8, 45, 3.5], [44, 24, 5]] as const) {
      const rim = MeshBuilder.CreateTorus("craterRim", { diameter: radius * 2, thickness: 0.18, tessellation: 36 }, scene);
      rim.position.set(x, 0.02, z); rim.material = shadow;
    }
    // A working geology yard gives the outpost a lived-in edge: stacked
    // sample cases, a maintenance bench and a short trail of instrument lights.
    for (const [x, z, tone] of [[-12, -15, metal], [-13.3, -15, white], [-12, -16.2, red], [-14.4, -15.5, dark]] as const) {
      box("sampleCase", x, 0.55, z, 1.15, 1.1, 1.0, tone);
      box("sampleCaseStripe", x, 0.75, z - 0.51, 0.75, 0.1, 0.04, amber);
    }
    box("workbench", -13, 0.86, -11.8, 3.2, 0.16, 1.1, metal);
    for (const x of [-14.3, -11.7]) for (const z of [-12.2, -11.4]) box("workbenchLeg", x, 0.4, z, 0.12, 0.8, 0.12, dark);
    box("benchDisplay", -13.6, 1.25, -11.8, 0.75, 0.6, 0.12, cyan);
    // Low open storage beside the bench stays outside the actual walkways.
    box("yardRackShelf", -18, 0.8, -12.8, 2.7, 0.12, 1, metal);
    for (const x of [-19.2, -16.8]) {
      box("yardRackPost", x, 0.8, -12.8, 0.12, 1.6, 1, dark);
      box("yardRackCase", x, 1.12, -12.8, 0.7, 0.5, 0.7, white);
    }
    cylinder("yardCanister", -17.3, 0.55, -9.7, 0.75, 1.1, metal);
    cylinder("yardCanisterCap", -17.3, 1.15, -9.7, 0.26, 0.12, amber);
    for (const [x, z] of [[-49, 42], [-57, 50], [-63, 60], [-38, 66], [-25, 73], [-10, 77]] as const) {
      const base = spaceHeight(x, z);
      cylinder("uplandBeaconStem", x, base + 0.55, z, 0.14, 1.1, dark);
      sphere("uplandBeacon", x, base + 1.15, z, 0.35, amber);
    }
    // Cargo cradle and antenna show the actual mission targets.
    const cellRoot = new TransformNode("outpostCell", scene); cellRoot.position.set(SPACE_WORLD.cell.x, 0, SPACE_WORLD.cell.z);
    box("cellCradle", 0, 0.35, 0, 2.4, 0.7, 1.8, dark, cellRoot);
    const cell = box("powerCell", 0, 1.12, 0, 1.15, 0.85, 1.1, amber, cellRoot);
    const relayRoot = new TransformNode("outpostRelay", scene); relayRoot.position.set(SPACE_WORLD.relay.x, 0, SPACE_WORLD.relay.z);
    addSpaceAsset(scene, "dish", SPACE_WORLD.relay.x, 0, SPACE_WORLD.relay.z, 1.2, 0.2);
    addSpaceAsset(scene, "solar", -27, 0, 14, 1, 0);
    addSpaceAsset(scene, "pod", 20, 0, -15, 1.2, 0);
    const signal = sphere("relaySignal", 0, 4.1, 0, 0.5, amber, relayRoot);
    const makePerson = (name: string, look: KitLook, x: number, z: number, yaw = 0): KitHuman => {
      const h = new KitHuman(scene, name, look, peopleMat); people.push(h); h.root.position.set(x, 0, z); h.root.rotation.y = yaw; h.sync(0); return h;
    };
    const hero = makePerson("chandHero", { archetype: "female", outfit: "casual_f", colors: { skin: "#b67651", top: "#e8f1f4", bottom: "#cedfe6" } }, SPACE_WORLD.start.x, SPACE_WORLD.start.z);
    // The travel link gives the same character an outpost body. The transparent
    // visor and backpack are owned by the character root and leave the face visible.
    const visorMat = mat("linkVisor", "#8ddcf1"); visorMat.alpha = 0.22; visorMat.specularColor = new Color3(0.9, 0.9, 0.9);
    sphere("linkHelmet", 0, 1.65 * hero.scale, 0, 0.8 * hero.scale, visorMat, hero.root);
    box("linkPack", 0, 1.05 * hero.scale, -0.22 * hero.scale, 0.55 * hero.scale, 0.7 * hero.scale, 0.23 * hero.scale, metal, hero.root);
    const pilot = makePerson("chandPilot", { archetype: "female", outfit: "casual_f", colors: { top: "#e38b5c", bottom: "#4c6479" } }, SPACE_WORLD.pilot.x, SPACE_WORLD.pilot.z, Math.PI);
    const fox = createTunyardFox(scene); fox.position.set(SPACE_WORLD.fox.x, 0, SPACE_WORLD.fox.z); fox.rotation.y = Math.PI / 2;
    // An authored science crater beyond the settlement: mineral strata, a
    // drillable bright seam and route markers provide a destination for a drive.
    const engineer = makePerson("chandEngineer", { archetype: "female", outfit: "casual_f", colors: { top: "#e0a748", bottom: "#526a78" } }, SPACE_WORLD.engineer.x, SPACE_WORLD.engineer.z, Math.PI);
    const rover = addSpaceAsset(scene, "rover", SPACE_WORLD.rover.x, 0, SPACE_WORLD.rover.z, 1.45, 0);
    const wheels = rover.getChildTransformNodes().filter((node) => /\.wheel-[fmr][rl]$/.test(node.name));
    const sample = SPACE_WORLD.sample;
    const seamMat = mat("craterMineral", "#9cd7d6"), craterFloor = mat("craterFloor", "#77727c");
    const crater = MeshBuilder.CreateCylinder("scienceCraterFloor", { diameter: 25, height: 0.05, tessellation: 36 }, scene);
    crater.position.set(sample.x, 0.025, sample.z); crater.material = craterFloor;
    for (const b of SPACE_CRATER_ROCKS) {
      const boulder = sphere("scienceCraterRim", b.x, 0.35, b.z, 2.3 + b.i % 3 * 0.35, b.i % 3 ? shadow : lightRock);
      boulder.scaling.set(1.25, 0.42 + b.i % 3 * 0.07, 0.8);
    }
    for (let i = 0; i < 7; i++) {
      const shard = MeshBuilder.CreateCylinder("mineralOutcrop", { diameterTop: 0, diameterBottom: 0.5 + i % 3 * 0.16, height: 1.1 + i % 2 * 0.4, tessellation: 5 }, scene);
      shard.position.set(sample.x + (i % 3 - 1) * 0.7, 0.6, sample.z + Math.floor(i / 3) * 0.6 - 0.5); shard.material = seamMat;
    }
    for (const [x, z] of [[29, -4], [39, 12], [48, 29], [54, 47], [57, 59]] as const) {
      cylinder("surveyMarker", x, 0.5, z, 0.14, 1, dark); sphere("surveyMarkerLight", x, 1.15, z, 0.4, cyan);
    }
    // The displayed core is a visible record of the expedition once returned.
    const archive = box("scienceArchive", 11.5, 0.7, -18, 1, 1.4, 0.8, dark);
    const archivedCore = sphere("archivedCore", 11.5, 1.55, -18, 0.5, seamMat);
    // The departure set is separate from the outpost, so the lunar base only
    // becomes visible during descent. Keep original visibility for safe skip.
    const lunarMeshes = scene.meshes.filter((mesh) => !mesh.isDescendantOf(shuttle)).map((mesh) => ({ mesh, visibility: mesh.visibility }));
    const showLunar = (show: boolean): void => { for (const item of lunarMeshes) item.mesh.visibility = show ? item.visibility : 0; };
    showLunar(false);
    const departure = new TransformNode("departureSet", scene), flightStars = new TransformNode("flightStars", scene);
    const launchGrass = mat("launchGrass", "#65865b"), launchConcrete = mat("launchConcrete", "#666e70");
    box("launchGround", 0, -0.55, 0, 1000, 1, 1000, launchGrass, departure);
    box("launchPad", -9, -0.04, -43, 20, 0.3, 20, launchConcrete, departure);
    const departurePad = addSpaceAsset(scene, "pad", -9, 0.12, -43, 1.5, 0); departurePad.parent = departure;
    for (const mesh of departurePad.getChildMeshes()) mesh.visibility = 1;
    box("launchTower", -16, 5.5, -43, 0.7, 11, 0.7, metal, departure);
    for (let y = 1; y <= 10; y += 2) box("launchTowerCrossbar", -16, y, -43, 2.1, 0.18, 0.2, red, departure);
    for (let i = 0; i < 75; i++) {
      const x = ((i * 67) % 260) - 130, y = ((i * 37) % 100) - 20;
      box("flightStar", x, y, 130 + (i % 3) * 8, i % 9 === 0 ? 0.8 : 0.36, i % 9 === 0 ? 0.8 : 0.36, 0.1, white, flightStars);
    }
    flightStars.setEnabled(false);

    overlay.dataset.spaceWorld = ""; overlay.setAttribute("role", "region"); overlay.setAttribute("aria-label", "Chand Outpost lunar world");
    Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "10000", color: "#fff8ee", fontFamily: "system-ui, sans-serif", pointerEvents: "auto", touchAction: "none" });
    const status = document.createElement("div"); status.dataset.spaceStatus = ""; status.setAttribute("aria-live", "polite");
    Object.assign(status.style, { position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: "12px", background: "rgba(30,34,54,.92)", border: "2px solid #e6c79a", borderRadius: "8px", padding: "7px 11px", fontSize: "14px", lineHeight: "1.35", maxWidth: "min(65vw, 460px)", whiteSpace: "pre-line", pointerEvents: "none" });
    overlay.appendChild(status);
    const back = document.createElement("button"); back.type = "button"; back.dataset.spaceReturn = ""; back.textContent = "Return to Ranggarh";
    Object.assign(back.style, { position: "absolute", right: "12px", top: "max(10px, env(safe-area-inset-top))", border: "2px solid #e6c79a", borderRadius: "7px", padding: "8px 10px", color: "#fff", background: "#644b5b", cursor: "pointer", fontWeight: "700" });
    overlay.appendChild(back);
    const held = new Set<string>(), controls = document.createElement("div");
    Object.assign(controls.style, { position: "absolute", left: "12px", bottom: "max(12px, env(safe-area-inset-bottom))", display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: "3px", opacity: "0.9" });
    const control = (label: string, code: string, col: string, row: string): void => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("aria-label", `Move ${code}`);
      Object.assign(b.style, { gridColumn: col, gridRow: row, width: "44px", height: "44px", color: "#fff", background: "#495264", border: "2px solid #e6c79a", borderRadius: "7px", fontSize: "20px", touchAction: "none" });
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); held.add(code); b.setPointerCapture(e.pointerId); }, { signal: abort.signal });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) b.addEventListener(name, () => held.delete(code), { signal: abort.signal });
      controls.appendChild(b);
    };
    control("▲", "up", "2", "1"); control("◀", "left", "1", "2"); control("▼", "down", "2", "2"); control("▶", "right", "3", "2"); overlay.appendChild(controls);
    const action = document.createElement("button"); action.type = "button"; action.dataset.spaceInteract = ""; action.textContent = "Interact";
    Object.assign(action.style, { position: "absolute", right: "12px", bottom: "max(18px, env(safe-area-inset-bottom))", border: "2px solid #e6c79a", borderRadius: "8px", padding: "12px", color: "#fff", background: "#644b5b", fontWeight: "700", touchAction: "none" }); overlay.appendChild(action);
    const jump = document.createElement("button"); jump.type = "button"; jump.dataset.spaceJump = ""; jump.textContent = "Jump";
    Object.assign(jump.style, { position: "absolute", right: "12px", bottom: "max(75px, calc(env(safe-area-inset-bottom) + 66px))", border: "2px solid #e6c79a", borderRadius: "8px", padding: "12px", color: "#fff", background: "#495264", fontWeight: "700", touchAction: "none" }); overlay.appendChild(jump);
    const hint = document.createElement("div"); hint.dataset.spaceHint = "";
    Object.assign(hint.style, { position: "absolute", left: "50%", bottom: "max(78px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", padding: "7px 12px", borderRadius: "6px", background: "rgba(30,34,54,.92)", border: "1px solid #e6c79a", fontSize: "14px", display: "none", pointerEvents: "none" }); overlay.appendChild(hint);
    for (const el of [status, back, controls, action, jump, hint]) el.style.visibility = "hidden";
    parent.appendChild(overlay);
    const travel = document.createElement("div"); travel.dataset.spaceTravel = "";
    Object.assign(travel.style, { position: "absolute", inset: "0", background: "linear-gradient(transparent 55%, rgba(9, 13, 34, .86))", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "12vh", pointerEvents: "auto" });
    const travelCard = document.createElement("div");
    Object.assign(travelCard.style, { textAlign: "center", background: "rgba(20, 27, 53, .91)", padding: "12px 22px", border: "1px solid #9edcea", borderRadius: "10px", maxWidth: "80vw" });
    const travelText = document.createElement("div"); travelText.setAttribute("aria-live", "polite");
    travelText.textContent = "Launching for Chand Outpost…";
    const skip = document.createElement("button"); skip.type = "button"; skip.textContent = "Skip flight"; skip.dataset.spaceSkip = "";
    Object.assign(skip.style, { marginTop: "10px", padding: "8px 14px", color: "white", background: "#425e79", border: "1px solid #a9dbea", borderRadius: "6px", cursor: "pointer" });
    const cancelTravel = skip.cloneNode(false) as HTMLButtonElement; delete cancelTravel.dataset.spaceSkip; cancelTravel.textContent = "Return to Ranggarh"; cancelTravel.style.marginLeft = "8px";
    travelCard.append(travelText, skip, cancelTravel); travel.appendChild(travelCard); overlay.appendChild(travel);
    const player: { x: number; z: number } = { ...SPACE_WORLD.start }, targets: Array<{ id: SpaceTarget; label: string; x: number; z: number }> = [
      { id: "pilot", label: "Talk to Noor", ...SPACE_WORLD.pilot }, { id: "cell", label: "Inspect cargo cradle", ...SPACE_WORLD.cell },
      { id: "relay", label: "Inspect relay", ...SPACE_WORLD.relay }, { id: "fox", label: "Talk to Cosmo", ...SPACE_WORLD.fox },
    ];
    let stage = normalizeSpaceProgress(options).stage, walking = false, elapsed = 0, jumpY = 0, jumpV = 0;
    let expeditionStage = normalizeExpeditionStage(options.expeditionStage), driving = false, roverSpeed = 0, roverYaw = 0;
    const saveProgress = (): void => options.onProgress?.({ stage, expeditionStage });
    let travelTime = 0, travelling = true, dashTime = 0, dashCooldown = 0, facingX = 0, facingZ = 1;
    let notice = stage === 4 ? "Outpost online. Explore, or return when you are ready." : stage === 3 ? "Return to Noor at the landing pad." : stage === 2 ? "Take the cell to the eastern relay." : stage === 1 ? "Find the cargo cradle west of the landing pad." : "Talk to Pilot Noor at the landing pad, or Zoya about the rover.";
    const updateStatus = (): void => {
      status.textContent = `Chand Outpost · ${stage === 4 ? "explorer stamp earned" : "restore the signal"}\n${notice}\n${driving ? "Rover: W/S drive · A/D steer · E exits or drills" : "Lunar body: Space floats · Q bursts"}`;
      overlay.dataset.spaceStage = String(stage); overlay.dataset.spaceExpeditionStage = String(expeditionStage);
      overlay.dataset.spaceDriving = String(driving); cell.setEnabled(stage < 2); signal.material = stage >= 3 ? cyan : amber;
      archivedCore.setEnabled(expeditionStage === 3); archive.material = expeditionStage === 3 ? metal : dark;
      action.textContent = driving ? "Exit / Drill" : "Interact";
      jump.style.display = driving ? "none" : ""; burst.style.display = driving ? "none" : "";
    };
    const exit = (): void => { if (closed) return; closed = true; held.clear(); release(); onExit(); };
    cancelTravel.addEventListener("click", exit, { signal: abort.signal });
    const finishTravel = (): void => { travelling = false; showLunar(true); departure.setEnabled(false); flightStars.setEnabled(false); scene.clearColor = new Color4(0.035, 0.035, 0.095, 1); shuttle.position.set(-9, 0, -43); flame.setEnabled(false); travel.remove(); for (const el of [status, back, controls, action, jump, hint, burst]) el.style.visibility = "visible"; held.clear(); overlay.dataset.spaceReady = "true"; };
    skip.addEventListener("click", finishTravel, { signal: abort.signal });
    const nearest = () => targets.filter((p) => Math.hypot(player.x - p.x, player.z - p.z) < 2.7).sort((a, b) => Math.hypot(player.x - a.x, player.z - a.z) - Math.hypot(player.x - b.x, player.z - b.z))[0];
    const interact = (): void => {
      if (travelling) return;
      const sampleDistance = Math.hypot(player.x - sample.x, player.z - sample.z);
      if (sampleDistance < 4) {
        const result = expeditionInteraction(expeditionStage, "sample", driving);
        if (result.stage !== expeditionStage) { expeditionStage = result.stage; saveProgress(); }
        notice = result.text; updateStatus(); return;
      }
      if (driving) {
        if (Math.abs(roverSpeed) > 0.6) { notice = "Stop the rover before climbing out."; updateStatus(); return; }
        // Try either side and behind, never place the player inside a building.
        const spots = [[2.8, 0], [-2.8, 0], [0, -3], [0, 3]];
        const spot = spots.find(([x, z]) => canWalkSpace(player.x + x!, player.z + z!));
        if (!spot) { notice = "Move the rover into open ground before exiting."; updateStatus(); return; }
        player.x += spot[0]!; player.z += spot[1]!; driving = false; roverSpeed = 0; hero.root.setEnabled(true);
        notice = "Rover parked. E boards it again."; updateStatus(); return;
      }
      if (Math.hypot(player.x - SPACE_WORLD.portal.x, player.z - SPACE_WORLD.portal.z) < 2.7) { exit(); return; }
      if (Math.hypot(player.x - SPACE_WORLD.engineer.x, player.z - SPACE_WORLD.engineer.z) < 2.7) {
        const result = expeditionInteraction(expeditionStage, "engineer");
        if (result.stage !== expeditionStage) { expeditionStage = result.stage; saveProgress(); }
        notice = result.text; updateStatus(); return;
      }
      if (Math.hypot(player.x - rover.position.x, player.z - rover.position.z) < 3.2) {
        driving = true; jumpY = 0; jumpV = 0; dashTime = 0; player.x = rover.position.x; player.z = rover.position.z; hero.root.setEnabled(false);
        notice = "Rover online. Follow the cyan markers to the crater; E uses its drill at the bright seam."; updateStatus(); return;
      }
      const target = nearest();
      if (!target) { notice = "Follow the amber lamps to the cargo cradle and relay. E interacts; Space jumps."; updateStatus(); return; }
      const result = spaceInteraction(stage, target.id);
      if (result.stage !== stage) { stage = result.stage; saveProgress(); }
      notice = result.text; updateStatus();
    };
    back.addEventListener("click", exit, { signal: abort.signal }); action.addEventListener("click", interact, { signal: abort.signal });
    jump.addEventListener("click", () => { if (!travelling && !driving && jumpY === 0) jumpV = 3.3; }, { signal: abort.signal });
    const dash = (): void => { if (!travelling && !driving && dashCooldown <= 0) { dashTime = 0.3; dashCooldown = 1.6; } };
    const burst = document.createElement("button"); burst.type = "button"; burst.textContent = "Burst"; burst.setAttribute("aria-label", "Lunar burst");
    Object.assign(burst.style, { position: "absolute", right: "90px", bottom: "max(18px, env(safe-area-inset-bottom))", border: "2px solid #e6c79a", borderRadius: "8px", padding: "12px", color: "#fff", background: "#495264", fontWeight: "700", touchAction: "none", visibility: "hidden" });
    overlay.insertBefore(burst, travel); burst.addEventListener("click", dash, { signal: abort.signal });
    const key = (e: KeyboardEvent, down: boolean): void => {
      const map: Record<string, string> = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
      const direction = map[e.code];
      if (direction || e.code === "KeyE" || e.code === "KeyQ" || e.code === "Space" || e.code === "Escape") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (direction) { if (down && !travelling) held.add(direction); else held.delete(direction); }
        else if (down && !e.repeat) { if (e.code === "Escape") exit(); else if (e.code === "KeyE") interact(); else if (e.code === "KeyQ") dash(); else if (!travelling && !driving && jumpY === 0) jumpV = 3.3; }
      }
    };
    window.addEventListener("keydown", (e) => key(e, true), { capture: true, signal: abort.signal });
    window.addEventListener("keyup", (e) => key(e, false), { capture: true, signal: abort.signal });
    window.addEventListener("blur", () => held.clear(), { signal: abort.signal });
    updateStatus(); const target = new Vector3();
    loop = (): void => {
      if (closed) return;
      try {
        const dt = Math.min(Math.max(engine.getDeltaTime() / 1000, 0), 0.05); elapsed += dt;
        if (travelling) {
          travelTime += dt;
          // Launch from an Earth-side set, cross a starfield, then descend to
          // the outpost. The same rocket anchors each shot across the cut.
          const leaving = travelTime < 2.5, crossing = travelTime >= 2.5 && travelTime < 4.5;
          departure.setEnabled(leaving); flightStars.setEnabled(crossing); showLunar(!leaving && !crossing);
          scene.clearColor = leaving ? new Color4(0.28, 0.48, 0.66, 1) : new Color4(0.035, 0.035, 0.095, 1);
          const height = leaving ? travelTime * travelTime * 3 : crossing ? 18 : Math.max(0, (6.6 - travelTime) ** 2 * 4);
          shuttle.position.set(-9, height, -43);
          flame.scaling.y = 1.6 + Math.sin(travelTime * 19) * 0.3;
          camera.position.set(shuttle.position.x + 12, shuttle.position.y + 7, shuttle.position.z - 16);
          target.set(shuttle.position.x, shuttle.position.y + 4, shuttle.position.z); camera.setTarget(target);
          travelText.textContent = leaving ? "Launch confirmed · leaving Ranggarh" : crossing ? "Crossing space · lunar body synchronising" : "Chand Outpost · preparing for landing";
          scene.render();
          if (travelTime >= 6.6) finishTravel();
          return;
        }
        if (driving) {
          const throttle = Number(held.has("up")) - Number(held.has("down"));
          const steering = Number(held.has("right")) - Number(held.has("left"));
          roverSpeed += throttle * 7 * dt;
          if (!throttle) roverSpeed *= Math.max(0, 1 - dt * 3.2);
          roverSpeed = Math.max(-4, Math.min(10, roverSpeed));
          roverYaw += steering * Math.min(1, Math.abs(roverSpeed) / 2) * Math.sign(roverSpeed) * 1.7 * dt;
          const nx = player.x + Math.sin(roverYaw) * roverSpeed * dt, nz = player.z + Math.cos(roverYaw) * roverSpeed * dt;
          const clear = canDriveSpace(nx, nz);
          if (clear) { player.x = nx; player.z = nz; for (const wheel of wheels) wheel.rotation.x += roverSpeed * dt / (0.31 * 1.45); } else roverSpeed = 0;
          const elevation = spaceHeight(player.x, player.z);
          rover.position.set(player.x, elevation + (Math.abs(roverSpeed) > 0.4 ? Math.sin(elapsed * 12) * 0.025 : 0), player.z); rover.rotation.y = roverYaw;
          camera.position.set(player.x - Math.sin(roverYaw) * 11, elevation + 6, player.z - Math.cos(roverYaw) * 11);
          target.set(player.x + Math.sin(roverYaw) * 3, elevation + 1.3, player.z + Math.cos(roverYaw) * 3); camera.setTarget(target);
          pilot.sync(dt); engineer.sync(dt);
          overlay.dataset.spaceX = player.x.toFixed(2); overlay.dataset.spaceZ = player.z.toFixed(2); overlay.dataset.spaceY = "0.00"; overlay.dataset.spaceRoverYaw = roverYaw.toFixed(3);
          const text = Math.hypot(player.x - sample.x, player.z - sample.z) < 4 ? "E · Drill mineral seam" : Math.abs(roverSpeed) < 0.6 ? "E · Leave rover" : "Release throttle to stop";
          hint.style.display = "block"; hint.textContent = text;
          scene.render(); return;
        }
        let dx = Number(held.has("right")) - Number(held.has("left")), dz = Number(held.has("up")) - Number(held.has("down"));
        const length = Math.hypot(dx, dz); let moved = false;
        dashCooldown = Math.max(0, dashCooldown - dt);
        const dashing = dashTime > 0;
        if (length && !dashing) { facingX = dx / length; facingZ = dz / length; }
        if (dashing) { dashTime = Math.max(0, dashTime - dt); dx = facingX * 3; dz = facingZ * 3; }
        if (length || dashing) {
          const divisor = dashing ? 1 : length;
          dx = dx / divisor * dt * 4.5; dz = dz / divisor * dt * 4.5;
          if (canWalkSpace(player.x + dx, player.z)) { player.x += dx; moved ||= Math.abs(dx) > 0; }
          if (canWalkSpace(player.x, player.z + dz)) { player.z += dz; moved ||= Math.abs(dz) > 0; }
          if (moved) hero.root.rotation.y = Math.atan2(dx, dz);
        }
        if (walking !== moved) { walking = moved; hero.ch.play(walking ? "walk" : "idle", { fade: 0.15 }); }
        if (jumpY > 0 || jumpV > 0) { jumpY += jumpV * dt; jumpV -= 2.1 * dt; if (jumpY < 0) { jumpY = 0; jumpV = 0; } }
        const elevation = spaceHeight(player.x, player.z);
        hero.root.position.set(player.x, elevation + jumpY, player.z); hero.sync(dt); pilot.sync(dt); engineer.sync(dt);
        signal.scaling.setAll(0.9 + Math.sin(elapsed * 2) * 0.1);
        camera.position.set(player.x + 3.5, elevation + 5.5 + jumpY * 0.25, player.z - 11); target.set(player.x, elevation + 1.5 + jumpY, player.z + 3); camera.setTarget(target);
        overlay.dataset.spaceX = player.x.toFixed(2); overlay.dataset.spaceZ = player.z.toFixed(2); overlay.dataset.spaceY = jumpY.toFixed(2);
        const near = nearest(), returnNear = Math.hypot(player.x - SPACE_WORLD.portal.x, player.z - SPACE_WORLD.portal.z) < 2.7;
        const h = returnNear ? "E · Return to Ranggarh" : Math.hypot(player.x - sample.x, player.z - sample.z) < 4 ? "E · Inspect mineral seam" : Math.hypot(player.x - SPACE_WORLD.engineer.x, player.z - SPACE_WORLD.engineer.z) < 2.7 ? "E · Talk to Zoya" : Math.hypot(player.x - rover.position.x, player.z - rover.position.z) < 3.2 ? "E · Board rover" : near ? `E · ${near.label}` : "";
        hint.style.display = h ? "block" : "none"; if (hint.textContent !== h) hint.textContent = h;
        scene.render();
      } catch (error) { console.error("Chand Outpost could not render", error); exit(); }
    };
    started = true; engine.runRenderLoop(loop);
    return { dispose: exit };
  } catch (error) { closed = true; release(); throw error; }
}
