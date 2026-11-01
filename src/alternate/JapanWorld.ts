import { visibleCinematicEye } from "../camera/CinematicOcclusion";
import { CinematicDirector, interactionShots } from "../camera/CinematicDirector";
import { DistrictControls } from "./DistrictControls";
import { districtSurface, districtPeople, finishDistrict, worldSurfaceUV } from "../render/DistrictLook";
import { Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight, Mesh, MeshBuilder, Scene, PBRMaterial, StandardMaterial, TransformNode, UniversalCamera, Vector3 } from "../babylon";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { KitHuman, type KitLook } from "../characters/KitHuman";
import { PLAYER_LOOKS } from "../characters/appearances";
import { addJapanAsset } from "./JapanAssets";
import { buildJapanGarden } from "./JapanGarden";
import { buildJapanPark } from "./JapanPark";
import { batchStatic } from "./batchStatic";
import { districtRoof } from "./DistrictRoof";
import { districtFrameDelta, moveInDistrict } from "./districtMovement";
import type { DistrictSoundscape } from "./regionalDialogue";
import { canWalkJapan, japanConversation, japanParkConversation, JAPAN_BUILDINGS, JAPAN_PARK, JAPAN_POND, JAPAN_WORLD, normalizeJapanProgress, type JapanPerson, type JapanProgress } from "./japanMap";

/** A small, independently managed Japan-inspired neighborhood and tea errand. */
export function openJapanWorld(parent: HTMLElement, engine: AbstractEngine, onExit: () => void, options: Partial<JapanProgress> & { look?: KitLook; soundscape?: DistrictSoundscape; onProgress?: (progress: JapanProgress) => void } = {}): { dispose: () => void } {
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
    scene.clearColor = new Color4(0.76, 0.85, 0.9, 1);
    const camera = new UniversalCamera("japanCamera", new Vector3(2, 5, -28), scene);
    camera.minZ = 0.1; camera.maxZ = 180; camera.fov = 0.86; scene.activeCamera = camera;
    const hemi = new HemisphericLight("japanSky", new Vector3(0.1, 1, -0.15), scene);
    hemi.intensity = 0.45; hemi.diffuse = Color3.FromHexString("#f5f3eb"); hemi.groundColor = Color3.FromHexString("#8e8a7a");
    const sunlight = new DirectionalLight("japanSun", new Vector3(-0.55, -1, 0.35), scene);
    sunlight.intensity = 2.1; sunlight.diffuse = Color3.FromHexString("#fff0d5");
    const material = (name: string, color: string): PBRMaterial => districtSurface(scene,name,color,
      /glass/i.test(name)?"glass":/road/i.test(name)?"asphalt":/roof/i.test(name)?"tile":/timber|wood|basket|fence/i.test(name)?"wood":/ground|earth|shrub/i.test(name)?"earth":/wall|people/i.test(name)?"plaster":"stone");
    const ground = material("japanGround", "#bdb7a7"), sidewalk = material("japanSidewalk", "#c1bbb0"), road = material("japanRoad", "#777878");
    const dark = material("japanTimber", "#544b42"), roof = material("japanRoof", "#585e62"), glass = material("japanGlass", "#9eb2b1");
    const cream = material("japanTrim", "#eee8da"), white = material("japanLines", "#f2eee1"), red = material("japanAccent", "#a85f52");
    const heroMat = districtPeople(scene,"japanPeople");
    const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, m: PBRMaterial, owner?: TransformNode): Mesh => {
      const o = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); o.position.set(x, y, z); o.material = m; worldSurfaceUV(o); if (owner) o.parent = owner; return o;
    };
    box("ground", 0, -0.16, 4, 36, 0.3, 62, ground);
    box("road", 0, 0.015, 4, 7.2, 0.03, 60, road);
    for (const side of [-1, 1]) {
      box("pavement", side * 5.0, 0.07, 4, 2.8, 0.14, 60, sidewalk);
      box("curb", side * 3.64, 0.09, 4, 0.12, 0.18, 60, cream);
      for (let z = -24; z <= 32; z += 3) box("paverJoint", side * 5, 0.145, z, 2.75, 0.006, 0.018, ground);
    }
    for (let z = -21; z < 30; z += 8) box("roadMark", 0, 0.035, z, 0.1, 0.01, 3, white);
    for (let x = -3; x <= 3; x += 1.2) box("crossing", x, 0.04, 9, 0.62, 0.015, 2.7, white);

    const facades = JAPAN_BUILDINGS.map((b, i) => { const m = material(`japanWall${i}`, b.color); return m; });
    for (let i = 0; i < JAPAN_BUILDINGS.length; i++) {
      const b = JAPAN_BUILDINGS[i]!, wall = facades[i]!, side = Math.sign(b.x), front = b.x - side * b.w / 2;
      box(`building${i}`, b.x, b.h / 2, b.z, b.w, b.h, b.d, wall);
      box(`foundation${i}`, b.x, 0.2, b.z, b.w + 0.18, 0.4, b.d + 0.18, dark);
      districtRoof(scene,`roof${i}`,b.x,b.h+0.08,b.z,b.w+1.6,b.d+1.3,roof);
      for(let z=-b.d/2+0.45;z<b.d/2;z+=0.45) box("timberLattice",front-side*0.13,0.82,b.z+z,0.09,1.55,0.065,dark);
      box("timberLatticeRail",front-side*0.16,0.14,b.z,0.12,0.14,b.d,dark);
      box("timberLatticeRail",front-side*0.16,1.55,b.z,0.12,0.12,b.d,dark);
      box(`eave${i}`, front - side * 0.2, b.h - 0.28, b.z, 0.32, 0.22, b.d + 0.8, dark);
      // Timber beams and pale glazed panels face the pavement, not the road.
      for (const z of [-b.d / 2 + 0.5, 0, b.d / 2 - 0.5]) box("beam", front - side * 0.06, b.h / 2, b.z + z, 0.18, b.h, 0.18, dark);
      for (const z of [-2.2, 2.2]) {
        box("window", front - side * 0.08, 3.4, b.z + z, 0.08, 1.1, 2.3, glass);
        box("windowCross", front - side * 0.14, 3.4, b.z + z, 0.08, 1.1, 0.07, dark);
        box("windowCross", front - side * 0.14, 3.4, b.z + z, 0.08, 0.06, 2.3, dark);
      }
      box("entry", front - side * 0.1, 1.25, b.z, 0.12, 2.5, 1.55, dark);
      box("entryGlass", front - side * 0.18, 1.55, b.z, 0.06, 1.25, 1.15, glass);
      if (b.shop) {
        box("shopAwning", front - side * 0.48, 2.8, b.z, 0.85, 0.18, 4.6, red);
        for (let z = -1.8; z <= 1.8; z += 0.9) box("noren", front - side * 0.86, 2.45, b.z + z, 0.04, 0.58, 0.8, cream);
      }
    }

    // Shopfront lettering names the actual local businesses. Two lines keep
    // the native signs useful to visitors without replacing them with English.
    const streetSign = (name: string, x: number, y: number, z: number, native: string, translated: string, yaw: number): void => {
      const tex = new DynamicTexture(name, { width: 512, height: 192 }, scene, true);
      const c = tex.getContext() as CanvasRenderingContext2D;
      c.fillStyle = "#f1e8d3"; c.fillRect(0, 0, 512, 192);
      c.strokeStyle = "#675443"; c.lineWidth = 10; c.strokeRect(5, 5, 502, 182);
      c.textAlign = "center"; c.fillStyle = "#493d34"; c.font = "600 47px sans-serif"; c.fillText(native, 256, 80);
      c.font = "500 27px sans-serif"; c.fillText(translated, 256, 144); tex.update(false);
      const m = new StandardMaterial(`${name}Material`, scene);
      m.disableLighting = true; m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.White(); m.diffuseTexture = tex; m.emissiveTexture = tex; m.backFaceCulling = false;
      const sign = MeshBuilder.CreatePlane(name, { width: 3.1, height: 1.16 }, scene);
      sign.position.set(x, y, z); sign.rotation.y = yaw; sign.material = m; sign.isPickable = false;
    };
    streetSign("aikoTeaSign", -6.18, 3.55, 2, "茶の店 あいこ", "AIKO · TEA", -Math.PI / 2);
    streetSign("dailyGoodsSign", 6.18, 3.55, 1, "日用品", "DAILY GOODS", Math.PI / 2);
    streetSign("sakuraParkSign", 16.9, 1.9, -8, "さくら公園 →", "PARK · EAST LANE", Math.PI / 2);

    // Original Tunyard Japanese assets, baked from the user's source. The
    // teahouse faces the street from its garden at human scale. Cherry trees
    // shade the pavements while the gate marks the end of the neighborhood.
    addJapanAsset(scene, "teahouse", -11, 0, 27.5, 0.75, Math.PI / 2);
    addJapanAsset(scene, "cherry", -5.6, 0, 11, 1, 0);
    addJapanAsset(scene, "cherry", 5.8, 0, -9, 1, 0.8);
    addJapanAsset(scene, "torii", 0, 0, 31, 1, 0);
    addJapanAsset(scene, "lantern", -5.5, 0, 26, 0.85, 0);
    addJapanAsset(scene, "lantern", 5.7, 0, 30, 0.85, 1.1);
    const garden = buildJapanGarden(scene);
    const park = buildJapanPark(scene);
    // Utility poles, overhead cables, planters, a bicycle stand and vending
    // cabinet keep this an everyday street rather than a landmark diorama.
    for (const z of [-19, 4, 25]) {
      box("powerPole", -6.1, 4.5, z, 0.19, 9, 0.19, dark);
      box("crossbar", -6.1, 8.7, z, 1.3, 0.14, 0.14, dark);
      box("cable", -6.1, 8.72, z + 11.4, 0.045, 0.045, 22.8, dark);
    }
    for (const [x, z] of [[-6, -8], [6, 7], [-6, 21]] as const) {
      box("planter", x, 0.25, z, 0.8, 0.5, 1.1, roof);
      const bush = MeshBuilder.CreateSphere("planterLeaves", { diameter: 1.15, segments: 7 }, scene); bush.position.set(x, 0.86, z); bush.scaling.y = 0.65; bush.material = material(`japanBush${x}${z}`, "#6f8967");
    }
    box("vending", 6.4, 1.1, -5, 0.75, 2.2, 1.25, cream);
    box("vendingPanel", 5.99, 1.4, -5, 0.08, 1, 0.9, glass);
    for (const z of [-5.3, -5, -4.7]) box("vendingDrink", 5.94, 1.5, z, 0.04, 0.45, 0.12, red);

    const peopleMat = heroMat;
    const makePerson = (name: string, look: KitLook, x: number, z: number, yaw = 0): KitHuman => {
      const h = new KitHuman(scene, name, look, peopleMat); people.push(h); h.root.position.set(x, 0, z); h.root.rotation.y = yaw; h.sync(0); return h;
    };
    const hero = makePerson("japanHero", options.look ?? PLAYER_LOOKS[0]!.kit, JAPAN_WORLD.start.x, JAPAN_WORLD.start.z);
    const aiko = makePerson("japanAiko", { archetype: "female", outfit: "casual_f" }, JAPAN_WORLD.shopkeeper.x, JAPAN_WORLD.shopkeeper.z, Math.PI / 2);
    const ken = makePerson("japanKen", { archetype: "male", outfit: "office_casual" }, JAPAN_WORLD.resident.x, JAPAN_WORLD.resident.z, -Math.PI / 2);
    const yuna = makePerson("japanYuna", { archetype: "female", outfit: "casual_f", colors: { top: "#7b96aa" } }, JAPAN_WORLD.neighbor.x, JAPAN_WORLD.neighbor.z, Math.PI);
    const passerby = makePerson("japanPasserby", { archetype: "male", outfit: "street_casual" }, 1.8, -8, 0);
    passerby.ch.play("walk", { fade: 0 });
    const parcel = box("teaParcel", -0.25, 1.05, 0.45, 0.3, 0.26, 0.23, material("parcelPaper", "#c4a982"), hero.root);

    const nameplate = (name: string, x: number, z: number, caption: string): void => {
      const texture = new DynamicTexture(`${name}Label`, { width: 512, height: 128 }, scene, true);
      const c = texture.getContext() as CanvasRenderingContext2D;
      c.clearRect(0, 0, 512, 128);
      c.fillStyle = "rgba(55,48,43,.86)"; c.fillRect(12, 14, 488, 100);
      c.fillStyle = "#fff8e9"; c.font = "600 44px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(caption, 256, 66);
      texture.hasAlpha = true; texture.update();
      const m = new StandardMaterial(`${name}LabelMaterial`, scene);
      // With lighting disabled a StandardMaterial's diffuse texture is not
      // illuminated. Emit the label colors directly and use the same texture
      // for its alpha so the lettering stays legible at every time of day.
      m.disableLighting = true; m.diffuseColor = Color3.Black(); m.emissiveColor = Color3.White(); m.specularColor = Color3.Black();
      m.diffuseTexture = texture; m.emissiveTexture = texture; m.useAlphaFromDiffuseTexture = true; m.backFaceCulling = false;
      const p = MeshBuilder.CreatePlane(`${name}LabelPlane`, { width: 2.1, height: 0.52 }, scene);
      p.position.set(x, 2.45, z); p.billboardMode = Mesh.BILLBOARDMODE_Y; p.material = m; p.isPickable = false;
    };
    nameplate("aiko", JAPAN_WORLD.shopkeeper.x, JAPAN_WORLD.shopkeeper.z, "Aiko · Tea");
    nameplate("ken", JAPAN_WORLD.resident.x, JAPAN_WORLD.resident.z, "Ken");
    nameplate("yuna", JAPAN_WORLD.neighbor.x, JAPAN_WORLD.neighbor.z, "Yuna");
    // A simple sign makes the nearby return spot discoverable on foot.
    box("returnSignPole", -2.5, 1.5, -24, 0.1, 3, 0.1, dark);
    nameplate("return", -2.5, -24, "Return stop");

    // These are fixed street and facade details. Story items, koi, people,
    // labels and original Tunyard models remain independent and animated.
    batchStatic(scene, new Set([
      "pavement", "curb", "paverJoint", "roadMark", "crossing", "beam",
      "window", "windowCross", "entry", "entryGlass", "shopAwning", "noren", "timberLattice", "timberLatticeRail",
      "powerPole", "crossbar", "cable", "planter", "vendingDrink",
      "sandFurrow", "gardenPost", "gardenRail", "gardenMossPatch", "gardenBoundary", "gardenBoundaryCap", "pondEdgeStone", "submergedGardenStone", "steppingStone", "lilyPad",
      "parkFenceRail", "parkEdge", "parkBenchSeatSlat", "parkBenchBackSlat", "parkBenchLeg", "parkBenchBackSupport",
    ]));

    overlay.dataset.japanWorld = ""; overlay.dataset.japanKoi = String(garden.koiCount); overlay.setAttribute("role", "region"); overlay.setAttribute("aria-label", "Sakura Street neighborhood");
    Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "10000", color: "#fff8ee", fontFamily: "system-ui, sans-serif", pointerEvents: "auto", touchAction: "none" });
    const top = document.createElement("div");
    Object.assign(top.style, { position: "absolute", top: "max(10px, env(safe-area-inset-top))", left: "12px", right: "12px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px", pointerEvents: "none" });
    const status = document.createElement("div"); status.dataset.japanStatus = ""; status.setAttribute("aria-live", "polite");
    Object.assign(status.style, { background: "rgba(47,43,40,.90)", border: "2px solid #e6c6a5", borderRadius: "8px", padding: "7px 11px", fontSize: "14px", lineHeight: "1.35", maxWidth: "min(68vw, 440px)", maxHeight: "38vh", overflowY: "auto", pointerEvents: "auto", whiteSpace: "pre-line" });
    const back = document.createElement("button"); back.type = "button"; back.dataset.japanReturn = ""; back.textContent = "Return to Ranggarh";
    Object.assign(back.style, { pointerEvents: "auto", border: "2px solid #e6c6a5", borderRadius: "7px", padding: "8px 10px", color: "#fff", background: "#76564b", cursor: "pointer", fontWeight: "700" });
    top.append(status, back); overlay.appendChild(top);
    const held = new Set<string>(), controls = document.createElement("div");
    Object.assign(controls.style, { position: "absolute", left: "12px", bottom: "max(12px, env(safe-area-inset-bottom))", display: "grid", gridTemplateColumns: "repeat(3, 44px)", gap: "3px", opacity: "0.9" });
    const control = (label: string, code: string, col: string, row: string): void => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("aria-label", code === "run" ? "Hold to run" : `Move ${code}`);
      Object.assign(b.style, { gridColumn: col, gridRow: row, width: "44px", height: "44px", color: "#fff", background: "#69584f", border: "2px solid #e6c6a5", borderRadius: "7px", fontSize: code === "run" ? "12px" : "20px", touchAction: "none" });
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); held.add(code); b.setPointerCapture(e.pointerId); }, { signal: abort.signal });
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) b.addEventListener(name, () => held.delete(code), { signal: abort.signal });
      controls.appendChild(b);
    };
    control("Run", "run", "1", "1"); control("▲", "up", "2", "1"); control("◀", "left", "1", "2"); control("▼", "down", "2", "2"); control("▶", "right", "3", "2"); overlay.appendChild(controls);
    const action = document.createElement("button"); action.type = "button"; action.textContent = "Talk / Interact"; action.dataset.japanInteract = "";
    Object.assign(action.style, { position: "absolute", right: "12px", bottom: "max(18px, env(safe-area-inset-bottom))", border: "2px solid #e6c6a5", borderRadius: "8px", padding: "12px", color: "#fff", background: "#76564b", fontWeight: "700", touchAction: "none" });
    overlay.appendChild(action); parent.appendChild(overlay);
    const hint = document.createElement("div");
    Object.assign(hint.style, { position: "absolute", left: "50%", bottom: "max(78px, env(safe-area-inset-bottom))", transform: "translateX(-50%)", padding: "7px 12px", borderRadius: "6px", background: "rgba(47,43,40,.9)", border: "1px solid #e6c6a5", fontSize: "14px", display: "none", pointerEvents: "none" });
    overlay.appendChild(hint);
    const player = { ...JAPAN_WORLD.start }, listeners = abort.signal;
    const nearby: Array<{ kind: JapanPerson; name: string; x: number; z: number }> = [
      { kind: "shopkeeper", name: "Aiko", ...JAPAN_WORLD.shopkeeper },
      { kind: "resident", name: "Ken", ...JAPAN_WORLD.resident },
      { kind: "neighbor", name: "Yuna", ...JAPAN_WORLD.neighbor },
    ];
    const personNear = () => nearby.find((p) => Math.hypot(player.x - p.x, player.z - p.z) < 2.2);
    const savedProgress = normalizeJapanProgress(options);
    let stage = savedProgress.stage, parkStage = savedProgress.parkStage, locomotion = "idle", elapsed = 0, feedCount = 0;
    let notice = parkStage === 2 ? "Return Yuna’s camera to her near the koi pond." : parkStage === 1 ? "Find Yuna’s camera by the bench in the park east of the street." : stage === 3 ? "Your neighborhood postcard stamp is saved. Explore or return to Ranggarh." : stage === 2 ? "Tell Aiko that Ken received the tea." : stage === 1 ? "Take Aiko’s tea to Ken farther up the street." : "Visit Aiko’s tea shop on the left pavement.";
    const updateStatus = (): void => {
      status.textContent = `Sakura Street · ${stage === 3 ? "postcard stamp earned" : "tea errand"}${parkStage === 3 ? " · park photo shared" : ""}\n${notice}`;
      overlay.dataset.japanStage = String(stage); overlay.dataset.japanParkStage = String(parkStage); overlay.dataset.japanFeeds = String(feedCount); parcel.setEnabled(stage === 1); park.setStory(parkStage);
    };
    const exit = (): void => { if (closed) return; closed = true; held.clear(); disposeScene(); onExit(); };
    const interact = (): void => {
      if(controlsInput?.isPaused) return;
      if(cinematic?.active) return;
      if (Math.hypot(player.x - JAPAN_WORLD.portal.x, player.z - JAPAN_WORLD.portal.z) < 2.2) { exit(); return; }
      const who = personNear();
      if (!who && Math.hypot(player.x - JAPAN_POND.feedX, player.z - JAPAN_POND.feedZ) < 1.7) {
        garden.feed(); moment(JAPAN_POND.x,0,JAPAN_POND.z,"Sakura garden · The koi gather beneath the clear water."); feedCount++; notice = "You scatter a little food for the koi."; updateStatus(); return;
      }
      if (!who && parkStage === 1 && Math.hypot(player.x - JAPAN_PARK.cameraX, player.z - JAPAN_PARK.cameraZ) < 1.5) {
        parkStage = 2; options.onProgress?.({ stage, parkStage }); notice = "You found Yuna’s camera by the bench. Take it back to her near the koi pond."; updateStatus(); return;
      }
      if (!who) { notice = "Walk close to a neighbor and press E to talk, or use Return to Ranggarh."; updateStatus(); return; }
      if (who.kind === "neighbor") {
        const result = japanParkConversation(parkStage);
        if (parkStage !== result.stage) { parkStage = result.stage; options.onProgress?.({ stage, parkStage }); moment(who.x,0,who.z,parkStage===3?"Yuna · A photograph to remember the neighborhood.":"Yuna · A lost camera, a new friendship."); }
        notice = result.text; options.soundscape?.playDialogue?.(result.line); updateStatus(); return;
      }
      const result = japanConversation(stage, who.kind);
      if (stage !== result.stage) { stage = result.stage; options.onProgress?.({ stage, parkStage }); moment(who.x,0,who.z,stage===3?"Aiko · Thank you for bringing us together.":stage===2?"Ken · Tea, delivered with care.":"Aiko · One parcel, a neighbor waiting."); }
      notice = result.text; options.soundscape?.playDialogue?.(result.line); updateStatus();
    };
    back.addEventListener("click", exit, { signal: listeners }); action.addEventListener("click", interact, { signal: listeners });
    updateStatus();
    controlsInput = new DistrictControls(overlay,engine.getRenderingCanvas()!,held,interact,exit);
    cinematic = new CinematicDirector(overlay,camera,(at,eye)=>visibleCinematicEye(scene,at,eye,false));
    const moment = (tx:number,ty:number,tz:number,text:string): void => {
      hero.ch.greet({fade:0.15});
      void cinematic!.play(interactionShots(player.x,hero.root.position.y,player.z,tx,ty,tz,text)).then(()=>{
        held.clear(); controlsInput?.input.clear(); if(!closed) hero.ch.play("idle",{fade:0.15});
      });
    };
    batchStatic(scene,new Set(scene.meshes.filter(m=>/^japan-(cherry|lantern|torii|teahouse|bamboo)/.test(m.name)).map(m=>m.name)),8,true);
    finishDistrict(scene,sunlight,"japan");
    let lastHint = "";
    loop = (): void => {
      if (closed) return;
      try {
        const dt = districtFrameDelta(engine.getDeltaTime() / 1000);
        if(cinematic!.active) { cinematic!.update(dt); for(const h of people) h.sync(dt); garden.update(dt); scene.render(); return; }
        const frameInput=controlsInput!.read(dt); if(closed) return; if(frameInput.paused) {scene.render();return;}
        elapsed += dt;
        garden.update(dt);
        const {dx,dz,running,jump,paused} = frameInput;
        const moved = moveInDistrict(player,dx,dz,running?6:3.6,paused?0:dt,canWalkJapan);
        if (moved) hero.root.rotation.y = Math.atan2(dx, dz);
        const nextLocomotion = moved ? running ? "run" : "walk" : "idle";
        if (locomotion !== nextLocomotion) { locomotion = nextLocomotion; hero.ch.play(locomotion, { fade: 0.15 }); }
        options.soundscape?.update(player.x, player.z, dt);
        hero.root.position.set(player.x, controlsInput!.elevation(paused?0:dt,jump), player.z);
        // One neighbor walks a short pavement route while the two quest
        // characters remain easy to find and speak to.
        const pace = Math.sin(elapsed * 0.12), previous = Math.sin((elapsed - dt) * 0.12);
        passerby.root.position.z = -8 + pace * 7; passerby.root.rotation.y = pace >= previous ? 0 : Math.PI;
        for (const h of [hero, aiko, ken, yuna, passerby]) h.sync(dt);
        controlsInput!.follow(camera,player,0,dt);
        overlay.dataset.japanLocomotion = locomotion; overlay.dataset.japanX = player.x.toFixed(2); overlay.dataset.japanZ = player.z.toFixed(2);
        const near = personNear();
        const nearReturn = Math.hypot(player.x - JAPAN_WORLD.portal.x, player.z - JAPAN_WORLD.portal.z) < 2.2;
        const nearPond = Math.hypot(player.x - JAPAN_POND.feedX, player.z - JAPAN_POND.feedZ) < 1.7;
        const nearCamera = parkStage === 1 && Math.hypot(player.x - JAPAN_PARK.cameraX, player.z - JAPAN_PARK.cameraZ) < 1.5;
        const nextHint = nearReturn ? "E · Return to Ranggarh" : near ? `E · Talk to ${near.name}` : nearPond ? "E · Feed the koi" : nearCamera ? "E · Pick up Yuna’s camera" : "";
        if (nextHint !== lastHint) { lastHint = nextHint; hint.textContent = controlsInput!.hint(nextHint); hint.style.display = nextHint ? "block" : "none"; }
        overlay.dataset.japanNear = nearReturn ? "return" : near?.kind ?? (nearPond ? "pond" : nearCamera ? "camera" : "");
        scene.render();
      } catch (error) { console.error("Sakura Street could not render", error); exit(); }
    };
    started = true; engine.runRenderLoop(loop);
    return { dispose: exit };
  } catch (error) { closed = true; disposeScene(); throw error; }
}
