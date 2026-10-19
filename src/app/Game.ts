import {
  Color4, DefaultRenderingPipeline, Engine, ImageProcessingConfiguration, Matrix, Mesh, Scene, SceneInstrumentation, Vector3,
} from "../babylon";
import { FIXED_DT, MAX_STEPS_PER_FRAME, WORLD_BOUNDS, Group } from "./config";
import { FixedClock } from "./FixedClock";
import { Input } from "../input/Input";
import { Physics } from "../physics/Physics";
import { World } from "../world/World";
import { CameraRig } from "../camera/CameraRig";
import { Player } from "../characters/Player";
import { PLAYER_LOOKS } from "../characters/appearances";
import { Vehicle } from "../vehicles/Vehicle";
import { buildVehicleModel } from "../vehicles/models";
import { PAINTS, SPECS } from "../vehicles/specs";
import { Crowd, residentDefs, type VehicleThreat } from "../crowds/Crowd";
import { Missions, INTRO } from "../missions/Missions";
import { AudioSystem, type EngineVoice } from "../audio/Audio";
import { Ui, DEFAULT_SETTINGS, type Settings } from "../ui/Ui";
import { drawMap, type MapMarker } from "../ui/MapRenderer";
import { Marker, buildTiffin } from "../world/Markers";
import { buildRoadGraph, type NavGraph } from "../world/nav";
import { POIS, PLAYER_START, VEHICLE_SPAWNS, SAFE_SPOTS, isOpenGround, dhabaLocal, inRect, footprint, building } from "../world/layout";
import { newSave, readSave, writeSave, SETTINGS_KEY, type SaveData, type SavedVehicle } from "../save/schema";
import { Color3 } from "../babylon";

type State = "loading" | "title" | "playing" | "paused" | "busy";

interface Interaction { id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void> }

const SPEAKERS: Record<string, { name: string; sub: string; color: string }> = {
  bhola: { name: "Bhola Singh", sub: "dhaba owner", color: "#ffb347" },
  gurnam: { name: "Gurnam Kaur", sub: "mechanic", color: "#7fc8ff" },
  pammi: { name: "Pammi", sub: "fruit seller", color: "#ff7fb6" },
  masterji: { name: "Masterji", sub: "tailor", color: "#e6c229" },
  sohal: { name: "Sohal", sub: "cycle shop", color: "#ff8a65" },
  mrsKaur: { name: "Mrs. Kaur", sub: "courtyard", color: "#b39ddb" },
  gill: { name: "Gill uncle", sub: "Gali 3", color: "#c5e1a5" },
  chemist: { name: "Dr. Sehgal", sub: "chemist", color: "#a5d6a7" },
};

/**
 * Application root. Owns the engine, the single render loop and the single
 * fixed-step simulation clock; every other system is stepped from here.
 */
export class Game {
  engine!: Engine;
  scene!: Scene;
  physics = new Physics();
  world!: World;
  input!: Input;
  cam!: CameraRig;
  player!: Player;
  crowd!: Crowd;
  missions!: Missions;
  audio = new AudioSystem();
  ui!: Ui;
  clock = new FixedClock(FIXED_DT, MAX_STEPS_PER_FRAME);
  vehicles: Vehicle[] = [];
  private voices = new Map<string, EngineVoice>();
  private roadGraph!: NavGraph;
  state: State = "loading";
  save!: SaveData;
  settings: Settings = { ...DEFAULT_SETTINGS };
  /** ?gfx=low: temporary low-cost rendering for slow machines/tests; never saved. */
  private readonly gfxLow = new URLSearchParams(location.search).get("gfx") === "low";

  private get shadowQuality(): Settings["shadows"] {
    return this.gfxLow ? "off" : this.settings.shadows;
  }
  private pipeline!: DefaultRenderingPipeline;
  private instr!: SceneInstrumentation;
  private driving: Vehicle | null = null;
  private lastRidden: Vehicle | null = null;
  private tiffin!: Mesh;
  private objMarker!: Marker;
  private interaction: Interaction | null = null;
  private hornCooldown = 0;
  private lastSafe = new Vector3(PLAYER_START.x, 0.2, PLAYER_START.z);
  private hintsUntil = 0;
  private time = 0;
  private autosaveT = 0;
  private prevVel = new Map<string, Vector3>();
  private bubbleEls = new Map<object, HTMLDivElement>();
  private route: Array<{ x: number; z: number }> = [];
  private routeT = 0;
  private titleOrbit = 0;
  private wasGrounded = true;
  private airPeak = 0;
  readonly errors: string[] = [];
  /** Diagnostics surfaced through the test probe. */
  readonly counters = { flips: 0, recoveries: 0, playerRecoveries: 0, bumps: 0, jolts: 0 };
  private flipped = new Set<string>();

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLDivElement) {}

  async init(): Promise<void> {
    window.addEventListener("error", (e) => this.errors.push(String(e.message)));
    this.ui = new Ui(this.uiRoot);
    const loading = this.ui.showLoading("Opening the bazaar…");
    this.loadSettings();
    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, powerPreference: "high-performance" }, true);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.scene.clearColor = new Color4(0.78, 0.84, 0.9, 1);
    this.input = new Input(this.canvas);
    await this.physics.init(this.scene);
    this.cam = new CameraRig(this.scene, this.input, this.physics);
    this.scene.activeCamera = this.cam.camera;
    this.applyCamSettings();
    await new Promise((r) => setTimeout(r, 30));
    this.world = new World(this.scene, this.physics);
    this.world.build(this.shadowQuality);
    this.setupPipeline();
    this.instr = new SceneInstrumentation(this.scene);
    this.instr.captureFrameTime = true;
    this.roadGraph = buildRoadGraph();
    this.tiffin = buildTiffin(this.scene, this.world.mats);
    this.tiffin.setEnabled(false);
    this.world.addCaster(this.tiffin);
    this.objMarker = new Marker(this.scene, new Color3(1, 0.78, 0.25), this.world.mats);
    this.objMarker.set(null);
    // Residents.
    this.crowd = new Crowd(this.scene, this.physics, this.world.mats.get("character"));
    this.crowd.spawnAll(residentDefs(this.world.dhaba.seats, dhabaLocal), (m) => this.world.addCaster(m));
    this.crowd.onBump = (_r, isPlayer) => {
      if (!isPlayer) return;
      this.counters.bumps++;
      this.save.rep = Math.max(0, this.save.rep - 1);
      this.ui.toast("Careful! People live here. (−1 reputation)", "warn", 2000);
      this.updateWallet();
    };
    this.player = new Player(this.scene, this.input);
    this.player.raycast = (a, b) => {
      const h = this.physics.raycast(a, b, Group.STATIC | Group.PROP | Group.VEHICLE);
      return h ? { y: h.hitPointWorld.y, ny: h.hitNormalWorld.y } : null;
    };
    this.player.onLand = (impact) => {
      if (impact > 0.5) this.missions?.onJolt(impact * 8);
    };
    this.audio.treePositions = [new Vector3(-5.3, 0, 7.8), new Vector3(5.3, 0, -42.8), new Vector3(5.3, 0, 42.5), new Vector3(-5.3, 0, -57), new Vector3(-41, 0, -4)];
    this.audio.workshopPos = new Vector3(14, 1.5, 24);
    this.audio.dhabaPos = new Vector3(dhabaLocal(6, -11).x, 1.5, dhabaLocal(6, -11).z);
    this.ui.onClick = () => this.audio.ui("click");
    this.input.onUserGesture = () => this.audio.unlock();
    this.input.onFocusLost = () => {
      if (this.state === "playing") void this.pause();
    };
    this.engine.runRenderLoop(() => this.frame());
    window.addEventListener("resize", () => this.engine.resize());
    loading.remove();
    if (new URLSearchParams(location.search).has("probe")) this.installProbe();
    await this.titleFlow();
  }

  // ------------------------------------------------------------------ Setup

  private setupPipeline(): void {
    const p = new DefaultRenderingPipeline("pp", true, this.scene, [this.cam.camera]);
    p.imageProcessingEnabled = true;
    p.imageProcessing.toneMappingEnabled = true;
    p.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    p.imageProcessing.exposure = 1.05;
    p.imageProcessing.contrast = 1.12;
    p.imageProcessing.vignetteEnabled = true;
    p.imageProcessing.vignetteWeight = 1.2;
    p.imageProcessing.vignetteColor = new Color4(0.25, 0.15, 0.05, 0);
    p.bloomEnabled = true;
    p.bloomThreshold = 0.85;
    p.bloomWeight = 0.18;
    p.bloomKernel = 48;
    p.fxaaEnabled = true;
    this.pipeline = p;
    this.applyPost();
  }

  private applyPost(): void {
    const scale = this.gfxLow ? 0.5 : this.settings.renderScale;
    this.engine?.setHardwareScalingLevel(1 / Math.max(0.25, Math.min(1, scale)));
    if (!this.pipeline) return;
    const post = this.settings.post && !this.gfxLow;
    this.pipeline.bloomEnabled = post;
    this.pipeline.imageProcessing.vignetteEnabled = post;
    this.pipeline.imageProcessing.toneMappingEnabled = true;
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };

    } catch {
      /* defaults */
    }
    this.audio.volumes = { master: this.settings.master, sfx: this.settings.sfx, ambience: this.settings.ambience, music: this.settings.music, muted: this.settings.muted };
  }

  private storeSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      this.ui.toast("Could not store settings (browser storage unavailable)", "warn");
    }
  }

  private applyCamSettings(): void {
    this.cam.settings = { sensitivity: this.settings.sensitivity, invertY: this.settings.invertY, keySpeed: this.settings.keySpeed };
  }

  private applySettings(s: Settings): void {
    const shadowsChanged = s.shadows !== this.settings.shadows;
    this.settings = s;
    this.audio.volumes = { master: s.master, sfx: s.sfx, ambience: s.ambience, music: s.music, muted: s.muted };
    this.audio.applyVolumes();
    this.applyCamSettings();
    this.applyPost();
    if (shadowsChanged) this.world.setShadowQuality(this.shadowQuality);
    this.storeSettings();
  }

  // ------------------------------------------------------------------ Title / session

  private async titleFlow(): Promise<void> {
    this.state = "title";
    this.ui.showHud(false);
    this.input.gameplayActive = false;
    const looks = PLAYER_LOOKS.map((l) => l.id);
    const r = readSave(localStorage, looks, WORLD_BOUNDS);
    for (;;) {
      const info = r.data ? `Saved ${new Date(r.data.savedAt).toLocaleString()} · ₹${r.data.money} · ★${r.data.rep}` : "";
      const choice = await this.ui.showTitle(!!r.data, info, PLAYER_LOOKS.map((l) => ({ id: l.id, label: l.label })), r.error);
      this.audio.unlock();
      if (choice.action === "settings") { await this.ui.settings(this.settings, (s) => this.applySettings(s)); continue; }
      if (choice.action === "controls") { await this.ui.controls(); continue; }
      if (choice.action === "continue" && r.data) this.startSession(r.data);
      else if (choice.action === "new") {
        const vehicles: SavedVehicle[] = VEHICLE_SPAWNS.map((v) => ({ id: v.id, type: v.type, x: v.x, y: 0.05, z: v.z, yaw: v.yaw, paint: v.type === "auto" ? "cng" : "mint" }));
        this.startSession(newSave(choice.look, PLAYER_START, vehicles));
      }
      return;
    }
  }

  private startSession(data: SaveData): void {
    this.save = data;
    for (const v of this.vehicles) v.dispose();
    this.vehicles = [];
    for (const vo of this.voices.values()) vo.dispose();
    this.voices.clear();
    for (const sv of data.vehicles) this.spawnVehicle(sv);
    const look = PLAYER_LOOKS.find((l) => l.id === data.player.look) ?? PLAYER_LOOKS[0]!;
    this.player.spawn(look.look, this.world.mats.get("character"), new Vector3(data.player.x, data.player.y, data.player.z), data.player.yaw);
    this.world.addCaster(this.player.human.mesh);
    this.player.anim.onFootstep = (s) => this.audio.footstep(this.player.feet, s, this.surfaceAt(this.player.feet));
    this.driving = null;
    this.missions = new Missions({
      save: this.save,
      playerPos: () => this.playerPos(),
      vehicleSpeed: () => (this.driving ? this.driving.speed : null),
      vehicleType: () => (this.driving ? this.driving.spec.type : null),
      setCarrying: (on) => this.setCarrying(on),
      dialogue: (who, text, opts) => this.dialogue(who, text, opts),
      results: async (t, m, rows, b) => { this.setBusy(true); const v = await this.ui.results(t, m, rows, b); this.setBusy(false); return v; },
      toast: (m, k, ms) => this.ui.toast(m, k, ms),
      reward: (money, rep) => this.reward(money, rep),
      sting: (k) => (k === "fail" ? this.audio.fail() : this.audio.success(k === "big")),
      residentSay: (id, t) => { const r = this.crowd.get(id); if (r) this.crowd.say(r, t); },
      residentGesture: (id, g) => this.crowd.get(id)?.anim.play(g, 2.2),
      persist: (reason) => this.persist(reason),
      roadGraph: this.roadGraph,
    });
    // An in-progress intro carry state is restored from the stage.
    this.setCarrying(this.save.introStage === INTRO.RIDE || this.save.introStage === INTRO.DELIVER);
    this.applyUpgrades();
    this.cam.setMode("foot");
    this.cam.snapBehind(data.player.yaw, this.player.feet);
    this.updateWallet();
    this.ui.showHud(true);
    this.clock.reset();
    this.state = "playing";
    this.input.gameplayActive = true;
    this.input.clear();
    if (this.save.introStage === INTRO.MEET && this.save.stats.deliveries === 0) {
      this.hintsUntil = this.time + 25;
    }
    this.ui.toast("Click the game view to use the mouse for the camera. Press F1 for controls.");
  }

  private spawnVehicle(sv: SavedVehicle): Vehicle {
    const paint = PAINTS.find((p) => p.id === sv.paint) ?? PAINTS[0]!;
    const model = buildVehicleModel(this.scene, this.world.mats, this.world.signs, sv.type, paint.body, paint.accent, sv.id);
    for (const m of model.meshes) this.world.addCaster(m);
    const pos = new Vector3(sv.x, Math.max(sv.y, 0.05), sv.z);
    const v = new Vehicle(sv.id, sv.type, this.scene, this.physics, model, pos, sv.yaw, paint.id);
    this.vehicles.push(v);
    const voice = this.audio.createEngine(SPECS[sv.type].engine);
    if (voice) this.voices.set(v.id, voice);
    return v;
  }

  private repaint(v: Vehicle, paintId: string): void {
    const paint = PAINTS.find((p) => p.id === paintId)!;
    for (const m of v.model.meshes) { this.world.removeCaster(m); }
    const oldRoot = v.model.root;
    const model = buildVehicleModel(this.scene, this.world.mats, this.world.signs, v.spec.type, paint.body, paint.accent, `${v.id}_${paintId}`);
    for (const m of model.meshes) this.world.addCaster(m);
    model.root.position.copyFrom(oldRoot.position);
    model.root.rotationQuaternion = oldRoot.rotationQuaternion!.clone();
    // Move rider/cargo children across.
    for (const child of [...oldRoot.getChildren()]) {
      if (child === this.player.human.root || child === this.tiffin) (child as Mesh).parent = model.root;
    }
    oldRoot.dispose();
    v.model = model;
    v.paint = paintId;
  }

  private applyUpgrades(): void {
    const up = this.save.upgrades;
    for (const v of this.vehicles) {
      v.brakeBonus = up.includes("brakes1") ? 1.25 : 1;
      v.gripBonus = up.includes("grip1") ? 1.15 : 1;
    }
  }

  // ------------------------------------------------------------------ Helpers

  playerPos(): Vector3 {
    return this.driving ? this.driving.position.clone() : this.player.feet;
  }

  private surfaceAt(p: Vector3): "stone" | "tile" | "dirt" {
    const dh = footprint(building("w_dhaba"));
    if (inRect(dh, p.x, p.z)) return "tile";
    if (p.x < -34) return "dirt";
    return "stone";
  }

  private setCarrying(on: boolean): void {
    this.player.carrying = on && !this.driving;
    this.tiffin.setEnabled(on);
    if (!on) { this.tiffin.parent = null; return; }
    if (this.driving) {
      this.tiffin.parent = this.driving.model.root;
      this.tiffin.position.set(...this.driving.spec.rack);
      this.tiffin.scaling.setAll(1);
      this.tiffin.rotation.set(0, 0, 0);
    } else {
      this.tiffin.parent = this.player.human.root;
      this.tiffin.position.set(0, 0.9, 0.33);
      this.tiffin.scaling.setAll(1 / this.player.human.scale);
      this.tiffin.rotation.set(0, 0, 0);
    }
  }

  private get carrying(): boolean {
    return this.tiffin.isEnabled();
  }

  private reward(money: number, rep: number): void {
    this.save.money += money;
    this.save.rep += rep;
    if (money) this.ui.toast(`+₹${money}`, "money");
    if (rep) this.ui.toast(`+${rep} reputation`, "money");
    this.audio.ui("cash");
    this.updateWallet();
  }

  private repLevel(rep: number): string {
    if (rep >= 120) return "Bazaar legend";
    if (rep >= 60) return "Trusted";
    if (rep >= 25) return "Known face";
    if (rep >= 8) return "Newcomer+";
    return "Newcomer";
  }

  private updateWallet(): void {
    this.ui.setMoney(this.save.money);
    this.ui.setRep(this.save.rep, this.repLevel(this.save.rep));
  }

  private setBusy(b: boolean): void {
    if (b) {
      this.ui.setPrompt(null);
      if (this.state === "playing") this.state = "busy";
      this.input.gameplayActive = false;
      this.input.clear();
      this.input.exitPointerLock();
    } else if (this.state === "busy") {
      this.state = "playing";
      this.input.gameplayActive = true;
      this.input.clear();
    }
  }

  private async dialogue(who: string, text: string, opts: Array<{ label: string; value: string }>): Promise<string> {
    const s = SPEAKERS[who] ?? { name: who, sub: "", color: "#fff" };
    this.setBusy(true);
    this.audio.ui("open");
    const r = this.crowd.get(who);
    if (r) r.lookTarget = this.playerPos();
    const v = await this.ui.dialogue(s.name, s.color, s.sub, text, opts);
    this.setBusy(false);
    return v;
  }

  persist(reason: string): void {
    if (!this.save) return;
    const s = this.save;
    // Player: never save mid-air or inside a vehicle seat; use a safe standing spot.
    if (this.driving) {
      const exit = this.findExit(this.driving) ?? this.lastSafe;
      s.player = { ...s.player, x: exit.x, y: exit.y, z: exit.z, yaw: this.driving.yaw };
    } else {
      const f = this.player.grounded ? this.player.feet : this.lastSafe;
      s.player = { ...s.player, x: f.x, y: Math.max(0, f.y), z: f.z, yaw: this.player.yaw };
    }
    s.vehicles = this.vehicles.map((v) => ({ id: v.id, type: v.spec.type, x: v.position.x, y: Math.max(0.05, v.position.y), z: v.position.z, yaw: v.yaw, paint: v.paint }));
    const res = writeSave(localStorage, s);
    if (!res.ok) this.ui.toast(`Save failed: ${res.error}`, "warn", 5000);
    else if (reason === "manual") this.ui.toast("Game saved.");
  }

  // ------------------------------------------------------------------ Pause & menus

  private async pause(): Promise<void> {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input.gameplayActive = false;
    this.input.clear();
    this.input.exitPointerLock();
    this.audio.setPaused(true);
    for (;;) {
      const items = [
        { label: "Resume", value: "resume" },
        { label: "Save game", value: "save" },
        { label: "District map", value: "map" },
        { label: "Settings", value: "settings" },
        { label: "Controls", value: "controls" },
      ];
      if (this.missions.job) items.push({ label: "Abandon delivery", value: "abandon" });
      items.push({ label: "Save & quit to title", value: "quit" });
      const v = await this.ui.menu("Paused", items, `<span style="opacity:.8">₹${this.save.money} · ★${this.save.rep} · ${this.save.stats.deliveries} deliveries</span>`);
      if (v === "save") { this.persist("manual"); continue; }
      if (v === "map") { await this.openMap(); continue; }
      if (v === "settings") { await this.ui.settings(this.settings, (s) => this.applySettings(s)); continue; }
      if (v === "controls") { await this.ui.controls(); continue; }
      if (v === "abandon") { this.missions.abandon(); continue; }
      if (v === "quit") {
        this.persist("quit");
        this.audio.setPaused(false);
        if (this.driving) this.exitVehicle(true);
        this.state = "title";
        await this.titleFlow();
        return;
      }
      break;
    }
    this.audio.setPaused(false);
    this.state = "playing";
    this.input.gameplayActive = true;
    this.input.clear();
    this.clock.reset();
  }

  private mapMarkers(): MapMarker[] {
    const m: MapMarker[] = [];
    const obj = this.missions.objective();
    if (obj.target) m.push({ x: obj.target.x, z: obj.target.z, color: "#ffd36b", label: obj.title, kind: "objective" });
    if (this.save.introStage === INTRO.DONE) {
      m.push({ x: POIS.dhabaCounter!.x, z: POIS.dhabaCounter!.z, color: "#ff8a3d", label: "Bhola — delivery jobs", kind: "job" });
      m.push({ x: 12.3, z: 21.6, color: "#7fc8ff", label: "Gurnam — upgrades", kind: "shop" });
    }
    for (const v of this.vehicles) if (v !== this.driving) m.push({ x: v.position.x, z: v.position.z, color: "#9fe3b0", label: v.spec.label, kind: "vehicle" });
    return m;
  }

  private async openMap(): Promise<void> {
    const p = this.playerPos();
    await this.ui.map((c) => drawMap(c, { cx: -6, cz: -11, scale: c.height / 136 }, { x: p.x, z: p.z, yaw: this.driving ? this.driving.yaw : this.player.yaw }, this.mapMarkers(), this.route, true), [
      ["#ffd36b", "Objective"], ["#ff8a3d", "Delivery jobs"], ["#7fc8ff", "Workshop"], ["#9fe3b0", "Vehicles"], ["#ffffff", "You"],
    ]);
  }

  private async openShop(): Promise<void> {
    this.setBusy(true);
    try {
      const target = this.lastRidden ?? this.nearestVehicle(this.playerPos(), 30);
      for (;;) {
        const items = [
          { id: "brakes1", label: "Better brake pads", cost: 180, owned: this.save.upgrades.includes("brakes1"), note: "+25% braking on all your rides" },
          { id: "grip1", label: "Softer tyres", cost: 220, owned: this.save.upgrades.includes("grip1"), note: "+15% grip in corners" },
          ...(target ? PAINTS.map((p) => ({ id: `paint:${p.id}`, label: `${p.label} paint (${target.spec.label})`, cost: p.cost, owned: this.save.paints.includes(p.id), swatch: p.body })) : []),
        ];
        const v = await this.ui.shop("Gurnam Motor Works", target ? `Upgrades apply to all your rides. Paint goes on the ${target.spec.label.toLowerCase()} you last rode.` : "Upgrades apply to all your rides.", items, this.save.money);
        if (v === "__close") break;
        const it = items.find((i) => i.id === v)!;
        if (!it.owned) {
          if (this.save.money < it.cost) { this.audio.ui("error"); continue; }
          this.save.money -= it.cost;
          if (v.startsWith("paint:")) this.save.paints.push(v.slice(6));
          else this.save.upgrades.push(v);
          this.audio.ui("cash");
          this.ui.toast(`Bought: ${it.label}`, "money");
        }
        if (v.startsWith("paint:") && target) {
          this.repaint(target, v.slice(6));
          this.ui.toast(`Painted: ${it.label.split(" paint")[0]}`);
        }
        if (v === "brakes1" || v === "grip1") this.applyUpgrades();
        this.updateWallet();
        this.persist("shop");
      }
    } finally {
      this.setBusy(false);
    }
  }

  // ------------------------------------------------------------------ Vehicles

  private nearestVehicle(p: Vector3, maxD: number): Vehicle | null {
    let best: Vehicle | null = null, bd = maxD;
    for (const v of this.vehicles) {
      const d = Vector3.Distance(p, v.position);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  private enterVehicle(v: Vehicle): void {
    if (v.spec.twoWheeler && v.dir(new Vector3(0, 1, 0)).y < 0.6) {
      v.placeAt(v.position.add(new Vector3(0, 0.3, 0)), v.yaw);
    }
    this.driving = v;
    this.lastRidden = v;
    v.hasDriver = true;
    this.player.enterVehicle();
    const r = this.player.human.root;
    r.parent = v.model.root;
    const seat = v.spec.seat;
    r.position.set(seat[0], seat[1] - 0.92 * this.player.human.scale, seat[2]);
    r.rotationQuaternion = null;
    r.rotation.set(0, 0, 0);
    this.player.pose = v.spec.pose;
    if (this.carrying) this.setCarrying(true);
    this.cam.setMode(v.spec.camera);
    this.cam.snapBehind(v.yaw, v.position);
    this.missions.onMount();
    this.hintsUntil = this.time + (this.save.stats.deliveries < 2 ? 14 : 6);
    this.prevVel.set(v.id, new Vector3());
  }

  /** Find a clear, supported spot beside the vehicle to step off. */
  private findExit(v: Vehicle): Vector3 | null {
    const hw = v.spec.halfWidth + 0.5;
    const halfLen = Math.max(...v.spec.colliders.map((c) => c.s[2] / 2)) + 0.6;
    const cands = [new Vector3(-hw, 0, 0), new Vector3(hw, 0, 0), new Vector3(-hw, 0, -0.6), new Vector3(hw, 0, 0.6), new Vector3(0, 0, -halfLen), new Vector3(0, 0, halfLen)];
    const center = v.position.add(new Vector3(0, 1.0, 0));
    for (const c of cands) {
      const p = v.toWorld(c);
      p.y = v.position.y + 1.0;
      const dir = p.subtract(center);
      const far = center.add(dir.normalize().scale(dir.length() + 0.35));
      if (this.physics.raycast(center, far, Group.STATIC | Group.VEHICLE | Group.PROP, v.body)) continue;
      // Shoulder-height check as well (awnings, poles).
      const c2 = center.add(new Vector3(0, 0.6, 0));
      if (this.physics.raycast(c2, far.add(new Vector3(0, 0.6, 0)), Group.STATIC | Group.VEHICLE, v.body)) continue;
      const down = this.physics.raycast(p.add(new Vector3(0, 0.8, 0)), p.add(new Vector3(0, -2.5, 0)), Group.STATIC | Group.VEHICLE, v.body);
      if (!down) continue;
      const gy = down.hitPointWorld.y;
      if (gy > v.position.y + 0.7 || gy < v.position.y - 1.0) continue;
      return new Vector3(p.x, gy + 0.02, p.z);
    }
    return null;
  }

  private exitVehicle(force = false): void {
    const v = this.driving;
    if (!v) return;
    if (!force && v.speed > 2.5) {
      this.ui.toast("Slow down to get off.", "warn", 1500);
      return;
    }
    let p = this.findExit(v);
    if (!p) {
      if (!force) {
        this.ui.toast("No room to get off here — move to open ground.", "warn", 2000);
        return;
      }
      p = this.lastSafe.clone();
    }
    v.hasDriver = false;
    v.controls = { throttle: 0, steer: 0, handbrake: false };
    this.driving = null;
    this.player.exitVehicle(p, v.yaw);
    this.player.pose = "stand";
    if (this.carrying) this.setCarrying(true);
    this.cam.setMode("foot");
  }

  private recoverVehicle(v: Vehicle): void {
    let pos = v.position.clone();
    if (!isOpenGround(pos.x, pos.z)) {
      let best = SAFE_SPOTS[0]!, bd = Infinity;
      for (const s of SAFE_SPOTS) { const d = (s.x - pos.x) ** 2 + (s.z - pos.z) ** 2; if (d < bd) { bd = d; best = s; } }
      pos = new Vector3(best.x, 0, best.z);
    }
    const hit = this.physics.raycast(new Vector3(pos.x, 6, pos.z), new Vector3(pos.x, -2, pos.z), Group.STATIC);
    pos.y = (hit ? hit.hitPointWorld.y : 0) + 0.25;
    v.placeAt(pos, v.yaw);
    this.counters.recoveries++;
    this.ui.toast(`${v.spec.label} recovered.`);
  }

  // ------------------------------------------------------------------ Interactions

  private gatherInteractions(): Interaction[] {
    const out: Interaction[] = [];
    const m = this.missions;
    const P = (k: keyof typeof POIS) => new Vector3(POIS[k]!.x, 0, POIS[k]!.z);
    if (!this.driving) {
      out.push({ id: "bhola", pos: P("dhabaCounter"), radius: 2.0, label: "Talk to Bhola", run: () => m.talkBhola() });
      if (m.stage === INTRO.PICKUP) out.push({ id: "pickup", pos: P("dhabaPickup"), radius: 1.8, label: "Pick up the tiffin", run: () => m.pickupIntro() });
      const g = this.crowd.get("gurnam")!;
      if (m.stage === INTRO.DONE) out.push({ id: "gurnam", pos: g.pos, radius: 2.4, label: "Talk to Gurnam (upgrades & paint)", run: () => this.openShop() });
      for (const v of this.vehicles) {
        out.push({ id: `veh_${v.id}`, pos: v.position, radius: v.spec.twoWheeler ? 1.7 : 2.2, label: v.spec.twoWheeler ? `Ride the ${v.spec.label.toLowerCase()}` : `Drive the ${v.spec.label.toLowerCase()}`, run: () => this.enterVehicle(v) });
      }
      // Casual chat with anyone nearby.
      for (const r of this.crowd.residents) {
        if (r.id === "bhola" || r.id === "gurnam") continue;
        out.push({ id: `chat_${r.id}`, pos: r.pos, radius: 1.6, label: `Say Sat Sri Akal to ${r.name}`, run: () => { this.crowd.say(r, this.crowd.greetLine(r)); r.anim.play("greet", 1.6); r.lookTarget = this.playerPos(); this.player.anim.play("greet", 1.4); } });
      }
    }
    const d = m.deliveryHere();
    if (d) out.push({ id: "deliver", pos: this.playerPos(), radius: 99, label: d.label, run: d.run });
    return out;
  }

  private pickInteraction(): Interaction | null {
    const p = this.playerPos();
    const fwd = new Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    let best: Interaction | null = null, bs = Infinity;
    for (const it of this.gatherInteractions()) {
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      // Prefer things in front of the player; deliveries always win.
      const facing = d > 0.01 ? (dx * fwd.x + dz * fwd.z) / d : 1;
      const score = it.id === "deliver" ? -1 : d - facing * 0.6 + (it.id.startsWith("chat_") ? 1.0 : 0);
      if (score < bs) { bs = score; best = it; }
    }
    return best;
  }

  // ------------------------------------------------------------------ Loop

  private frame(): void {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    this.time += dt;
    if (this.state === "playing") this.playingFrame(dt);
    else if (this.state === "title") this.titleFrame(dt);
    else if (this.state === "busy") this.busyFrame(dt);
    this.scene.render();
    this.input.endFrame();
  }

  private titleFrame(dt: number): void {
    this.titleOrbit += dt * 0.05;
    const c = new Vector3(0, 2, -30);
    this.cam.camera.position.set(c.x + Math.sin(this.titleOrbit) * 14, 6 + Math.sin(this.titleOrbit * 0.7), c.z - 20 + Math.cos(this.titleOrbit) * 6);
    this.cam.camera.setTarget(c);
    this.world.update(dt);
    this.crowd.update(dt, 1, this.cam.camera.position);
  }

  /** During dialogue: the world keeps animating gently but the sim is frozen. */
  private busyFrame(dt: number): void {
    this.world.update(dt);
    this.crowd.update(dt, 1, this.cam.camera.position);
    this.player.animate(dt);
    this.objMarker.update(dt);
    this.updateBubbles();
    const v = this.driving;
    this.cam.update(dt, v ? v.model.root.position : this.player.human.root.position, v ? v.yaw : this.player.yaw, 0);
  }

  private playingFrame(dt: number): void {
    const inp = this.input;
    // ---- Edge-triggered actions (once per rendered frame).
    if (inp.wasPressed("pause")) { void this.pause(); return; }
    if (inp.wasPressed("help")) { this.setBusy(true); void this.ui.controls().then(() => this.setBusy(false)); return; }
    if (inp.wasPressed("map")) { this.setBusy(true); void this.openMap().then(() => this.setBusy(false)); return; }
    this.player.frameInput();
    this.interaction = this.pickInteraction();
    if (inp.wasPressed("interact")) {
      if (this.interaction) {
        this.audio.ui("click");
        void this.interaction.run();
      } else if (this.driving) this.exitVehicle();
    }
    this.hornCooldown -= dt;
    if (this.driving && inp.wasPressed("horn") && this.hornCooldown <= 0) {
      this.hornCooldown = 0.5;
      const v = this.driving;
      this.audio.horn(v.spec.hornHz, v.position);
      this.crowd.horn(v.position, v.dir(new Vector3(0, 0, 1)));
    }
    if (this.driving && inp.wasPressed("recover") && (this.driving.stuckTime > 0.8 || this.driving.dir(new Vector3(0, 1, 0)).y < 0.5)) this.recoverVehicle(this.driving);
    if (!this.driving && inp.wasPressed("recover") && this.player.feet.y > 0.5 && !this.player.grounded) this.player.recoverToSafety();

    // ---- Fixed-step simulation.
    const alpha = this.clock.advance(dt, (h) => this.step(h));

    // ---- Visual interpolation and animation.
    for (const v of this.vehicles) v.syncVisual(alpha);
    this.player.syncVisual(alpha);
    if (this.driving) this.player.steer = this.driving.controls.steer;
    this.player.animate(dt);
    this.crowd.update(dt, alpha, this.cam.camera.position);
    this.world.update(dt);

    // ---- Camera.
    const v = this.driving;
    if (!v) {
      const dh = footprint(building("w_dhaba"));
      this.cam.setMode(inRect(dh, this.player.feet.x, this.player.feet.z) ? "interior" : "foot");
    }
    this.cam.update(dt, v ? v.model.root.position : this.player.human.root.position, v ? v.yaw : this.player.yaw, v ? v.speed : this.player.speed);

    // ---- Audio.
    const cp = this.cam.camera.position;
    const fwd = this.cam.camera.getDirection(new Vector3(0, 0, 1));
    this.audio.setListener(cp, fwd);
    for (const veh of this.vehicles) {
      const voice = this.voices.get(veh.id);
      if (!voice) continue;
      const rpm = Math.min(1, veh.speed / veh.spec.maxSpeed);
      voice.set(rpm, veh.load, veh.hasDriver, veh.model.root.position);
    }
    this.audio.update(this.time);
    this.objMarker.update(dt);
    this.updateHud(dt);
    this.updateBubbles();
    this.autosaveT += dt;
    if (this.autosaveT > 90 && !this.missions.job) { this.autosaveT = 0; this.persist("auto"); }
  }

  private step(dt: number): void {
    const inp = this.input;
    this.player.fixedUpdate(dt, this.cam.yaw);
    if (this.driving) {
      this.driving.controls = { throttle: inp.axis("back", "forward"), steer: inp.axis("left", "right"), handbrake: inp.isDown("jump") };
    }
    for (const v of this.vehicles) v.fixedUpdate(dt);
    const threats: VehicleThreat[] = this.vehicles.filter((v) => v.speed > 1.2).map((v) => ({
      pos: v.position, fwd: v.dir(new Vector3(0, 0, 1)).multiplyByFloats(1, 0, 1).normalize().scale(Math.sign(v.forwardSpeed) || 1),
      speed: v.speed, halfWidth: v.spec.halfWidth, halfLen: Math.max(...v.spec.colliders.map((c) => c.s[2])) / 2, isPlayer: v === this.driving,
    }));
    this.crowd.fixedUpdate(dt, this.driving ? null : this.player.feet, threats);
    this.physics.step(dt);
    for (const v of this.vehicles) {
      v.postStep(dt);
      // Jolt detection from velocity change (crashes, slamming speed breakers).
      const lin = v.body.getLinearVelocity();
      const prev = this.prevVel.get(v.id);
      if (prev) {
        const dv = lin.subtract(prev).length();
        if (v === this.driving && dv > 1.6) {
          this.missions.onJolt(dv);
          this.counters.jolts++;
          this.audio.impact(v.position, Math.min(1, dv / 8));
        } else if (dv > 2.5) this.audio.impact(v.position, Math.min(1, dv / 10));
        prev.copyFrom(lin);
      } else this.prevVel.set(v.id, lin.clone());
      v.consumeImpact();
      const upY = v.dir(new Vector3(0, 1, 0)).y;
      if (upY < 0.5 && !this.flipped.has(v.id)) { this.flipped.add(v.id); this.counters.flips++; this.errors.push(`flip ${v.id} at ${v.position.x.toFixed(1)},${v.position.z.toFixed(1)} v=${v.forwardSpeed.toFixed(1)}`); }
      else if (upY > 0.9) this.flipped.delete(v.id);
    }
    // Track a safe recovery point and airborne peaks (for hard landings).
    if (!this.driving) {
      const f = this.player.feet;
      if (this.player.grounded && (isOpenGround(f.x, f.z) || f.y < 0.5)) this.lastSafe.copyFrom(f);
      if (!this.player.grounded) this.airPeak = Math.max(this.airPeak, f.y);
      else if (!this.wasGrounded) this.airPeak = 0;
      this.wasGrounded = this.player.grounded;
    }
    this.missions.fixedUpdate(dt);
  }

  // ------------------------------------------------------------------ HUD

  private updateHud(dt: number): void {
    const ui = this.ui;
    const p = this.playerPos();
    const obj = this.missions.objective();
    let dist: number | null = null;
    if (obj.target) {
      dist = Math.hypot(obj.target.x - p.x, obj.target.z - p.z);
      this.objMarker.set(dist > 1.2 ? new Vector3(obj.target.x, this.groundAt(obj.target), obj.target.z) : null);
      const a = Math.atan2(obj.target.x - p.x, obj.target.z - p.z) - this.cam.yaw;
      ui.setCompass(dist > 4 ? Math.atan2(Math.sin(a), Math.cos(a)) : null);
    } else {
      this.objMarker.set(null);
      ui.setCompass(null);
    }
    ui.setObjective(obj.title, obj.detail, dist);
    // Route on the minimap, refreshed a few times per second.
    this.routeT -= dt;
    if (this.routeT <= 0) {
      this.routeT = 0.4;
      this.route = obj.target ? this.missions.routeLength(p, obj.target).pts : [];
    }
    const it = this.interaction;
    ui.setPrompt(it ? `<kbd>E</kbd> ${it.label}` : this.driving && this.driving.speed < 2.5 ? `<kbd>E</kbd> Get off` : null);
    if (this.driving) {
      const v = this.driving;
      const hint = v.reversing ? "Reversing" : v.spec.reverseMax === 0 ? "" : "";
      ui.setSpeed(v.speed * 3.6, v.spec.label, hint);
      ui.setRecover(v.stuckTime > 0.8 || v.dir(new Vector3(0, 1, 0)).y < 0.5 ? `Stuck? Press <kbd>R</kbd> to recover` : null);
    } else {
      ui.setSpeed(null);
      ui.setRecover(null);
    }
    const j = this.missions.job;
    ui.setJob(j ? { title: `→ ${j.dest.whoName}`, timeLeft: j.limit - j.elapsed, total: j.limit, condition: j.condition, note: `Par ${j.par}s · ${Math.round(j.elapsed)}s elapsed` } : null);
    if (this.time < this.hintsUntil) {
      ui.setHints(this.driving
        ? `<kbd>W</kbd> throttle · <kbd>S</kbd> brake${this.driving.spec.reverseMax ? " / reverse" : ""} · <kbd>A</kbd><kbd>D</kbd> steer<br><kbd>H</kbd> horn · <kbd>Space</kbd> handbrake · <kbd>E</kbd> get off (when slow)`
        : `<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>Shift</kbd> sprint · <kbd>Space</kbd> jump<br><kbd>E</kbd> interact · mouse / arrows: camera · <kbd>M</kbd> map · <kbd>Esc</kbd> pause`);
    } else ui.setHints(null);
    if (this.settings.showFps) {
      ui.setPerf(`${this.engine.getFps().toFixed(0)} fps · ${this.instr.drawCallsCounter.current} draws · ${this.scene.getActiveMeshes().length} meshes`);
    } else ui.setPerf(null);
    // Minimap (north up, centred on the player).
    drawMap(ui.minimap, { cx: p.x, cz: p.z, scale: 2.2 }, { x: p.x, z: p.z, yaw: this.driving ? this.driving.yaw : this.player.yaw }, this.mapMarkers(), this.route, false);
    if (this.player.recovered) this.counters.playerRecoveries++;
    if (this.player.recovered) ui.toast("Whoops — you've been put back somewhere safe.", "warn");
  }

  private groundAt(p: Vector3): number {
    const hit = this.physics.raycast(new Vector3(p.x, 3, p.z), new Vector3(p.x, -1, p.z), Group.STATIC);
    return hit ? hit.hitPointWorld.y : 0;
  }

  /** Speech bubbles projected from residents' heads to the screen. */
  private updateBubbles(): void {
    const live = new Set<object>();
    const w = this.engine.getRenderWidth(), h = this.engine.getRenderHeight();
    const scaleX = this.canvas.clientWidth / w, scaleY = this.canvas.clientHeight / h;
    for (const b of this.crowd.bubbles) {
      live.add(b);
      let e = this.bubbleEls.get(b);
      if (!e) {
        e = document.createElement("div");
        e.style.cssText = "position:fixed;transform:translate(-50%,-100%);background:#fff8e8;color:#2a1405;padding:3px 10px;border-radius:12px;font:600 15px 'Baloo Paaji 2';box-shadow:0 2px 6px rgba(0,0,0,.35);white-space:nowrap;pointer-events:none";
        e.textContent = b.text;
        this.uiRoot.append(e);
        this.bubbleEls.set(b, e);
      }
      const head = b.r.human.root.position.add(new Vector3(0, b.r.look.height + 0.35, 0));
      const sp = Vector3.Project(head, Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), this.cam.camera.viewport.toGlobal(w, h));
      const behind = Vector3.Dot(head.subtract(this.cam.camera.position), this.cam.camera.getDirection(new Vector3(0, 0, 1))) < 0;
      const far = Vector3.Distance(head, this.cam.camera.position) > 30;
      e.style.display = behind || far ? "none" : "block";
      e.style.left = `${sp.x * scaleX}px`;
      e.style.top = `${sp.y * scaleY}px`;
      e.style.opacity = String(Math.min(1, b.t * 2));
    }
    for (const [k, e] of this.bubbleEls) if (!live.has(k)) { e.remove(); this.bubbleEls.delete(k); }
  }

  // ------------------------------------------------------------------ Test probe (read-only)

  private installProbe(): void {
    (window as unknown as { __pfs: unknown }).__pfs = {
      snapshot: () => {
        const v = this.driving;
        const f = this.player?.feet;
        return {
          state: this.state,
          time: this.time,
          player: f ? { x: f.x, y: f.y, z: f.z, yaw: this.player.yaw, grounded: this.player.grounded, speed: this.player.speed, carrying: this.carrying } : null,
          camYaw: this.cam.yaw,
          vehicle: v ? { id: v.id, type: v.spec.type, x: v.position.x, y: v.position.y, z: v.position.z, yaw: v.yaw, speed: v.forwardSpeed, upY: v.dir(new Vector3(0, 1, 0)).y } : null,
          vehicles: this.vehicles.map((x) => ({ id: x.id, x: x.position.x, y: x.position.y, z: x.position.z, yaw: x.yaw, paint: x.paint })),
          objective: this.missions ? (() => { const o = this.missions.objective(); return { title: o.title, detail: o.detail, target: o.target ? { x: o.target.x, y: o.target.y, z: o.target.z } : null }; })() : null,
          introStage: this.save?.introStage,
          money: this.save?.money,
          rep: this.save?.rep,
          job: this.missions?.job ? { dest: this.missions.job.dest.id, elapsed: this.missions.job.elapsed, condition: this.missions.job.condition, par: this.missions.job.par } : null,
          prompt: this.interaction?.label ?? null,
          route: this.route,
          bubbles: this.crowd.bubbles.map((b) => b.text),
          cameraPos: { x: this.cam.camera.position.x, y: this.cam.camera.position.y, z: this.cam.camera.position.z },
          dialogueOpen: this.ui.dialogueOpen,
          modalOpen: this.ui.modalOpen,
          fps: this.engine.getFps(),
          drawCalls: this.instr.drawCallsCounter.current,
          frameTimeMs: this.instr.frameTimeCounter.lastSecAverage,
          activeMeshes: this.scene.getActiveMeshes().length,
          totalVertices: this.scene.getTotalVertices(),
          residents: this.crowd.residents.length,
          residentsStuck: this.crowd.residents.filter((r) => r.stuckCount > 0).length,
          clockDropped: this.clock.droppedTime,
          counters: this.counters,
          audioState: this.audio.ctx?.state ?? "none",
          toasts: [...document.querySelectorAll(".toast")].map((t) => t.textContent),
          errors: this.errors.slice(-10),
          stats: this.save?.stats,
          medals: this.save?.medals,
          bests: this.save?.bests,
        };
      },
    };
  }
}

