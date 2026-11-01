import { clearWater } from "../render/ClearWater";
import { DistrictControls } from "./DistrictControls";
import { districtSurface, finishDistrict, worldSurfaceUV } from "../render/DistrictLook";
import { batchStatic } from "./batchStatic";
import { Color3, Color4, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, Scene, PBRMaterial, Texture, TransformNode, UniversalCamera, Vector3, VertexData } from "../babylon";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import bench from "../world/assets/rusticBench.json";
import { canWalkNeon, collectNeonBeacons, NEON_BEACONS, NEON_BUILDINGS, NEON_FOX, NEON_WORLD, neonFoxHint, normalizeNeonProgress, type NeonProgress } from "./neonMap";
import { createTunyardFox } from "./TunyardFox";
import { districtFrameDelta, moveInDistrict } from "./districtMovement";

/**
 * Neon Quay is an independent small toon-style 3D destination. The caller
 * pauses its own render loop first. This function owns a new Babylon scene,
 * its render loop, overlays and input; return disposes them before onExit.
 */
export function openNeonWorld(parent: HTMLElement, engine: AbstractEngine, onExit: () => void, options: Partial<NeonProgress> & { onProgress?: (progress: NeonProgress) => void } = {}): { dispose: () => void } {
  const scene = new Scene(engine);
  const overlay = document.createElement("div");
  const abort = new AbortController();
  let controlsInput: DistrictControls | undefined;
  let closed = false, started = false;
  let loop: (() => void) | undefined;
  const disposeScene = (): void => {
    controlsInput?.dispose();
    abort.abort();
    if (started && loop) engine.stopRenderLoop(loop);
    scene.dispose();
    overlay.remove();
  };
  try {
    scene.clearColor = new Color4(0.09, 0.075, 0.18, 1);
    const camera = new UniversalCamera("neonCamera", new Vector3(15, 22, -49), scene);
    camera.minZ = 0.1; camera.maxZ = 260; camera.fov = 0.82; scene.activeCamera = camera;
    const hemi = new HemisphericLight("neonSky", new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.4; hemi.diffuse = Color3.FromHexString("#dfd3ff"); hemi.groundColor = Color3.FromHexString("#41354e");
    const sun = new DirectionalLight("neonSun", new Vector3(-0.5, -1, 0.4), scene);
    sun.intensity = 1.7; sun.diffuse = Color3.FromHexString("#9fe8ff");
    const mat = (name: string, color: string, emissive = false): PBRMaterial => {
      const m = districtSurface(scene,name,color,/metal/i.test(name)?"metal":/dust|rock|stone/i.test(name)?"earth":"stone"), c=Color3.FromHexString(color);
      if(emissive) { m.unlit=true; m.emissiveColor=c; m.albedoColor=Color3.Black(); m.albedoTexture=null; m.bumpTexture=null; }
      return m;
    };
    const road = mat("quayRoad", "#34365a"), plate = mat("quayPlate", "#4c4d79"), dark = mat("quayDark", "#252941");
    const cyan = mat("quayCyan", "#55e8ed", true), pink = mat("quayPink", "#ff85c5", true), yellow = mat("quayYellow", "#ffd47e", true);
    const buildMaterials = NEON_BUILDINGS.map((b, i) => mat(`quayBuilding${i}`, b.color));
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: PBRMaterial, owner?: TransformNode): Mesh => {
      const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      m.position.set(x, y, z); m.material = material; worldSurfaceUV(m); if (owner) m.parent = owner; return m;
    };
    const sphere = (name: string, x: number, y: number, z: number, diameter: number, material: PBRMaterial, owner?: TransformNode): Mesh => {
      const m = MeshBuilder.CreateSphere(name, { diameter, segments: 8 }, scene);
      m.position.set(x, y, z); m.material = material; worldSurfaceUV(m); if (owner) m.parent = owner; return m;
    };
    // An island plaza above a violet sea; distinct colours and big shapes make
    // this a deliberately different scene from Ranggarh's rural terrain.
    const sea = clearWater(scene,"neonSea",{x:0,z:1,rx:32,rz:33,night:true,outside:true}), ground = mat("neonGround", "#545477");
    const water = MeshBuilder.CreateGround("neonSea", { width: 260, height: 260 }, scene); water.position.y = -0.65; water.material = sea;
    box("island", 0, -0.35, 1, 64, 0.7, 66, ground);
    box("mainStreet", 0, 0.012, 0, 11, 0.024, 60, road);
    box("crossStreet", 0, 0.014, 3, 58, 0.028, 9, road);
    // Cyan edges and dashed centre lines direct the eye towards the relay.
    for (const x of [-5.35, 5.35]) box("streetEdge", x, 0.035, 0, 0.14, 0.04, 59, cyan);
    for (let z = -24; z <= 26; z += 7) box("streetDash", 0, 0.045, z, 0.15, 0.05, 3, yellow);
    for (const z of [-1.3, 7.3]) box("crossEdge", 0, 0.035, z, 57, 0.04, 0.14, pink);
    // A deep sunset disc and geometric towers make a distinctive skyline.
    const moon = sphere("sunDisc", 0, 42, 105, 26, mat("sunDiscMat", "#e99aaf", true)); moon.scaling.z = 0.15;
    for (let i = 0; i < NEON_BUILDINGS.length; i++) {
      const b = NEON_BUILDINGS[i]!, m = buildMaterials[i]!;
      // Paved forecourts, lit entrances and rooftop equipment distinguish the
      // blocks at walking height rather than leaving them as plain towers.
      box(`forecourt${i}`, b.x, 0.025, b.z, b.w + 2, 0.05, b.d + 2, plate);
      box(`block${i}`, b.x, b.h / 2, b.z, b.w, b.h, b.d, m);
      box(`roof${i}`, b.x, b.h + 0.12, b.z, b.w + 0.35, 0.24, b.d + 0.35, dark);
      box(`door${i}`, b.x, 1.45, b.z - b.d / 2 - 0.035, 1.8, 2.9, 0.07, dark);
      box(`doorLight${i}`, b.x, 2.85, b.z - b.d / 2 - 0.08, 1.9, 0.12, 0.08, i % 2 ? cyan : pink);
      box(`awning${i}`, b.x, 3.25, b.z - b.d / 2 - 0.45, 2.6, 0.18, 1, i % 2 ? cyan : pink);
      box(`roofUnit${i}`, b.x + b.w * 0.18, b.h + 0.5, b.z, 1.6, 0.75, 1.3, dark);
      box(`antenna${i}`, b.x - b.w * 0.28, b.h + 1.1, b.z + 0.5, 0.12, 2, 0.12, dark);
      sphere(`antennaLight${i}`, b.x - b.w * 0.28, b.h + 2.15, b.z + 0.5, 0.25, i % 2 ? pink : cyan);
      for (const face of [-1, 1]) {
        for (let y = 2; y < b.h - 0.5; y += 2.4) {
          for (let x = -b.w / 2 + 1.2; x < b.w / 2 - 0.6; x += 2.2) {
            box("window", b.x + x, y, b.z + face * (b.d / 2 + 0.025), 1.05, 0.65, 0.05, (Math.floor(y + x + i) % 3 === 0 ? pink : cyan));
          }
        }
      }
      box("topTrim", b.x, b.h + 0.28, b.z - b.d / 2, b.w, 0.12, 0.12, i % 2 ? cyan : pink);
    }
    // The station, signs and plaza lamps sit outside the walkable road.
    for (const x of [-8, 8]) for (const z of [-25, -4, 14, 29]) {
      box("lampPole", x, 2, z, 0.2, 4, 0.2, dark);
      box("lampBar", x + (x < 0 ? 0.6 : -0.6), 4, z, 1.4, 0.18, 0.25, iColor(x, z) ? cyan : pink);
    }
    function iColor(x: number, z: number): boolean { return (x + z) % 2 === 0; }
    const plaza = MeshBuilder.CreateCylinder("relayPlaza", { diameter: 7, height: 0.12, tessellation: 8 }, scene); plaza.position.set(0, 0.06, 9); plaza.material = plate;
    const relayBody = box("relay", 0, 1.4, 9, 1.4, 2.8, 1.4, dark);
    const relayGlow = box("relayLight", 0, 2.1, 9, 1.5, 0.45, 1.5, pink);
    const saved = normalizeNeonProgress(options), found = new Set<number>(saved.found);
    let completed = saved.completed;
    if (completed) relayGlow.material = cyan;
    const beacons = NEON_BEACONS.map((p, i) => {
      const root = new TransformNode(`neonBeacon${i}`, scene); root.position.set(p.x, 0, p.z);
      box("beaconFoot", 0, 0.18, 0, 1.5, 0.36, 1.5, dark, root);
      const gem = sphere("beaconGem", 0, 1.4, 0, 1.1, i === 1 ? pink : cyan, root); gem.scaling.set(0.65, 1.3, 0.65);
      root.setEnabled(!found.has(i)); return root;
    });
    const portal = new TransformNode("returnPortal", scene); portal.position.set(NEON_WORLD.portal.x, 0, NEON_WORLD.portal.z);
    for (const x of [-1.7, 1.7]) box("portalPost", x, 2, 0, 0.35, 4, 0.35, cyan, portal);
    box("portalTop", 0, 4, 0, 3.7, 0.35, 0.35, cyan, portal);
    box("portalFace", 0, 2, 0.05, 3, 3.5, 0.1, mat("portalSurface", "#927de0", true), portal);

    // Original Tunyard rustic bench geometry, translated into this scene's
    // Babylon mesh; its own authored painted wood textures are used.
    const decoded = (s: string): Float32Array => {
      const text = atob(s), bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
      return new Float32Array(bytes.buffer);
    };
    const benchMaterials = new Map<string, PBRMaterial>();
    const benchParent = new TransformNode("quayBenches", scene);
    for (const source of bench.meshes) {
      const positions = decoded(source.position), normals = decoded(source.normal), uv = decoded(source.uv);
      for (const group of source.groups) {
        const key = `${group.mat}:${group.color}`;
        let material = benchMaterials.get(key);
        if (!material) {
          material = mat(`bench-${key}`, `#${group.color}`);
          material.albedoTexture = new Texture(`${import.meta.env.BASE_URL}tunyard/bench/${group.mat}-albedo.png`, scene);
          benchMaterials.set(key, material);
        }
        const data = new VertexData(), p: number[] = [], n: number[] = [], tex: number[] = [], indices: number[] = [];
        for (let i = group.start; i < group.start + group.count; i++) {
          p.push(-positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!);
          n.push(-normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!);
          tex.push(uv[i * 2]!, uv[i * 2 + 1]!); indices.push(i - group.start);
        }
        data.positions = p; data.normals = n; data.uvs = tex; data.indices = indices;
        const m = new Mesh(`quayBench-${key}`, scene); data.applyToMesh(m); m.material = material; m.parent = benchParent;
      }
    }
    benchParent.position.set(-6, 0, 12); benchParent.rotation.y = Math.PI / 2;

    // A friendly resident from the owner's Tunyard Toon Fox asset. This is a
    // static sitting pose; it offers directions through the interaction key.
    const fox = createTunyardFox(scene);
    fox.position.set(NEON_FOX.x, 0, NEON_FOX.z);
    fox.scaling.setAll(2.2);
    fox.rotation.y = -Math.PI / 2;

    // A deliberately simple robot protagonist belongs only to this prototype.
    const hero = new TransformNode("neonHero", scene);
    const heroBody = mat("heroBody", "#ecb0df"), heroDark = mat("heroDark", "#47446e"), heroFace = mat("heroFace", "#70e2ee", true);
    box("heroTorso", 0, 1.15, 0, 0.9, 1.1, 0.55, heroBody, hero);
    sphere("heroHead", 0, 2.08, 0, 0.92, heroBody, hero);
    box("heroVisor", 0, 2.1, 0.43, 0.62, 0.24, 0.08, heroFace, hero);
    for (const x of [-0.3, 0.3]) box("heroLeg", x, 0.32, 0, 0.25, 0.64, 0.3, heroDark, hero);
    for (const x of [-0.62, 0.62]) box("heroArm", x, 1.18, 0, 0.24, 0.8, 0.28, heroDark, hero);
    const player = { ...NEON_WORLD.start }; hero.position.set(player.x,0,player.z);

    overlay.dataset.neonWorld = ""; overlay.setAttribute("role", "region"); overlay.setAttribute("aria-label", "Neon Quay 3D world");
    Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "10000", color: "#f8efff", fontFamily: "system-ui, sans-serif", pointerEvents: "auto", touchAction: "none" });
    const top = document.createElement("div");
    Object.assign(top.style, { position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px", pointerEvents: "none" });
    const status = document.createElement("div"); status.dataset.neonStatus = ""; status.setAttribute("aria-live", "polite");
    Object.assign(status.style, { background: "rgba(30,25,56,.9)", border: "2px solid #62e5ea", borderRadius: "8px", padding: "7px 11px", fontSize: "14px", lineHeight: "1.35", maxWidth: "min(68vw, 420px)", whiteSpace: "pre-line" });
    const back = document.createElement("button"); back.type = "button"; back.dataset.neonReturn = ""; back.textContent = "Return to Ranggarh";
    Object.assign(back.style, { pointerEvents: "auto", border: "2px solid #62e5ea", borderRadius: "7px", padding: "8px 10px", color: "#fff", background: "#5c437b", cursor: "pointer", fontWeight: "700" });
    top.append(status, back); overlay.appendChild(top);
    const held = new Set<string>();
    const controls = document.createElement("div");
    Object.assign(controls.style, { position: "absolute", left: "12px", bottom: "max(12px, env(safe-area-inset-bottom))", display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: "3px", opacity: "0.9" });
    const control = (label: string, code: string, col: string, row: string): void => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("aria-label", `Move ${code}`);
      Object.assign(b.style, { gridColumn: col, gridRow: row, width: "44px", height: "44px", color: "#fff", background: "#454269", border: "2px solid #62e5ea", borderRadius: "7px", fontSize: "20px", touchAction: "none" });
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); held.add(code); b.setPointerCapture(e.pointerId); }, { signal: abort.signal });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) b.addEventListener(name, () => held.delete(code), { signal: abort.signal });
      controls.appendChild(b);
    };
    control("▲", "up", "2", "1"); control("◀", "left", "1", "2"); control("▼", "down", "2", "2"); control("▶", "right", "3", "2"); overlay.appendChild(controls);
    const action = document.createElement("button"); action.type = "button"; action.textContent = "Interact"; action.dataset.neonInteract = "";
    Object.assign(action.style, { position: "absolute", right: "12px", bottom: "max(18px, env(safe-area-inset-bottom))", border: "2px solid #62e5ea", borderRadius: "8px", padding: "12px", color: "#fff", background: "#5c437b", fontWeight: "700", touchAction: "none" });
    overlay.appendChild(action); parent.appendChild(overlay);
    let notice = completed ? "The relay is powered. Explore or return to Ranggarh." : found.size === NEON_BEACONS.length ? "All three signals found. Visit the central relay." : "Collect three signals, then activate the relay. Move with WASD or arrows; E near the fox for a hint.";
    const updateStatus = (): void => {
      status.textContent = `Neon Quay · ${found.size}/${NEON_BEACONS.length} signals\n${notice}`;
      overlay.dataset.neonSignals = String(found.size); overlay.dataset.neonCompleted = String(completed);
    };
    const save = (): void => options.onProgress?.({ found: [...found].sort((a, b) => a - b), completed });
    const exit = (): void => { if (closed) return; closed = true; held.clear(); disposeScene(); onExit(); };
    const interact = (): void => {
      if(controlsInput?.isPaused) return;
      if (Math.hypot(player.x - NEON_WORLD.portal.x, player.z - NEON_WORLD.portal.z) < 3) { exit(); return; }
      if (Math.hypot(player.x - NEON_FOX.x, player.z - NEON_FOX.z) < 3) {
        notice = neonFoxHint(found, completed); updateStatus(); return;
      }
      if (Math.hypot(player.x - NEON_WORLD.relay.x, player.z - NEON_WORLD.relay.z) < 3.2) {
        if (found.size === NEON_BEACONS.length) { if (!completed) { completed = true; relayGlow.material = cyan; save(); } notice = "The relay is powered! Neon Quay is online."; }
        else notice = `The relay needs ${NEON_BEACONS.length - found.size} more signals.`;
      } else notice = "Walk into signals to collect them. E at the relay or return portal.";
      updateStatus();
    };
    back.addEventListener("click", exit, { signal: abort.signal }); action.addEventListener("click", interact, { signal: abort.signal });
    controlsInput = new DistrictControls(overlay,engine.getRenderingCanvas()!,held,interact,exit);
    batchStatic(scene,new Set(scene.meshes.filter(m=>/^(block|roof|forecourt|door|street|window|habitat|doorGlow|beaconStem|moonStone|distantRidge|sampleCase|workbench|yardRack|craterRim)/.test(m.name)).map(m=>m.name)),24);
    finishDistrict(scene,sun,"neon");
    updateStatus();
    loop = (): void => {
      if (closed) return;
      try {
        const dt = districtFrameDelta(engine.getDeltaTime() / 1000);
        const {dx,dz,running,jump,paused}=controlsInput!.read(dt); if(closed) return; if(paused) {scene.render();return;}
        const length = Math.hypot(dx, dz);
        if (length) {
          moveInDistrict(player, dx, dz, running?6:3.6, paused?0:dt, canWalkNeon);
          hero.rotation.y = Math.atan2(dx, dz);
          for (const i of collectNeonBeacons(player.x, player.z, found)) { found.add(i); beacons[i]!.setEnabled(false); save(); notice = found.size === NEON_BEACONS.length ? "All signals found. Visit the central relay." : "Signal found. Explore the quay for the others."; updateStatus(); }
        }
        hero.position.set(player.x, controlsInput!.elevation(paused?0:dt,jump), player.z);
        controlsInput!.follow(camera,player,0,dt);
        overlay.dataset.neonX = player.x.toFixed(2); overlay.dataset.neonZ = player.z.toFixed(2);
        // Tiny motion gives the relay a readable glow without external shaders.
        relayBody.rotation.y += dt * 0.25;
        scene.render();
      } catch (error) {
        // Always return control to the original game if a renderer fails.
        console.error("Neon Quay could not render", error);
        exit();
      }
    };
    started = true; engine.runRenderLoop(loop);
    return { dispose: exit };
  } catch (e) {
    closed = true; disposeScene(); throw e;
  }
}
