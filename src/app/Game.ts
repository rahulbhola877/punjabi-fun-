import {
  Color4, DefaultRenderingPipeline, Engine, ImageProcessingConfiguration, Matrix, Mesh, Scene, SceneInstrumentation, Vector3,
} from "../babylon";
import { FIXED_DT, MAX_STEPS_PER_FRAME, WORLD_BOUNDS, Group } from "./config";
import { FixedClock } from "./FixedClock";
import { Input, REBINDABLE, type Action } from "../input/Input";
import { Physics } from "../physics/Physics";
import { World } from "../world/World";
import { CameraRig } from "../camera/CameraRig";
import { Player } from "../characters/Player";
import { PLAYER_LOOKS } from "../characters/appearances";
import { B } from "../characters/HumanBuilder";
import { Vehicle } from "../vehicles/Vehicle";
import { buildVehicleModel } from "../vehicles/models";
import { PAINTS, SPECS, VEHICLE_SOUNDS } from "../vehicles/specs";
import { Crowd, residentDefs, type VehicleThreat } from "../crowds/Crowd";
import { Missions, INTRO } from "../missions/Missions";
import { SHOPS, type ShopDef, type ShopItem } from "../missions/Shops";
import type { Appearance } from "../characters/HumanBuilder";
import { AudioSystem, type EngineVoice } from "../audio/Audio";
import { Ui, DEFAULT_SETTINGS, withQuality, type Settings } from "../ui/Ui";
import { preset, type QualityPreset } from "./quality";
import { TouchControls } from "../ui/TouchControls";
import { drawMap, type MapMarker } from "../ui/MapRenderer";
import { Marker, buildTiffin } from "../world/Markers";
import { buildRoadGraph, type NavGraph } from "../world/nav";
import { randomAppearance as randomLook } from "../characters/appearances";
import { POIS, PLAYER_START, VEHICLE_SPAWNS, SAFE_SPOTS, isOpenGround, dhabaLocal, inRect, footprint, building } from "../world/layout";
import { newSave, readSave, writeSave, SETTINGS_KEY, type SaveData, type SavedVehicle } from "../save/schema";
import { Color3 } from "../babylon";
import { Combat } from "../combat/Combat";
import { Police } from "../combat/Police";
import { Jhagde } from "../combat/Jhagde";
import { Traffic, type TrafficCar } from "../traffic/Traffic";
import { countryFolk, type FolkGroup } from "../crowds/countryFolk";
import { Barkers, GREET_CLIPS } from "../crowds/Barkers";
import { CITY, LUDHIANA, MOBILE_SHOP, defectAt } from "../world/region";
import { Animals } from "../animals/Animals";
import { Rides, STANDS } from "../missions/Rides";
import { FAMOUS_PLACES, fare, placeAt } from "../missions/Travel";
import type { Resident } from "../crowds/Crowd";

type State = "loading" | "title" | "playing" | "paused" | "busy";

interface Interaction {
  id: string; pos: Vector3; radius: number; label: string; run: () => void | Promise<void>;
  /** Optional custom distance (e.g. to a vehicle's outline rather than its centre). */
  dist?: (p: Vector3) => number;
}

const SPEAKERS: Record<string, { name: string; sub: string; color: string }> = {
  bhola: { name: "Bhola Singh", sub: "dhaba owner", color: "#ffb347" },
  gurnam: { name: "Gurnam Kaur", sub: "mechanic", color: "#7fc8ff" },
  pammi: { name: "Pammi", sub: "fruit seller", color: "#ff7fb6" },
  masterji: { name: "Masterji", sub: "tailor", color: "#e6c229" },
  sohal: { name: "Sohal", sub: "cycle shop", color: "#ff8a65" },
  mrsKaur: { name: "Mrs. Kaur", sub: "courtyard", color: "#b39ddb" },
  gill: { name: "Gill uncle", sub: "Gali 3", color: "#c5e1a5" },
  chemist: { name: "Dr. Sehgal", sub: "chemist", color: "#a5d6a7" },
  havaldar: { name: "Havaldar Ji", sub: "Ranggarh police", color: "#9fb4ff" },
  neighbours: { name: "Two neighbours", sub: "mid-jhagda", color: "#ffcc80" },
  aunties: { name: "Do aunties", sub: "gali da jhagda", color: "#f48fb1" },
  safari: { name: "Safari wala", sub: "tinted glass, gold chain", color: "#90a4ae" },
  lafanga: { name: "Lafanga", sub: "chowk loafer", color: "#ff8a80" },
  driver: { name: "Angry driver", sub: "you bumped his ride", color: "#ffab91" },
  ustad: { name: "Ustad Kartar Pehlwan", sub: "Kotli akhada", color: "#ffd180" },
  sukhi: { name: "Sukhi Bhaji", sub: "trucker, G.T. Road", color: "#c5e1a5" },
  jarnail: { name: "Jarnail Singh", sub: "kisaan", color: "#aed581" },
  sarpanch: { name: "Sarpanch Hardev Singh", sub: "Pind Kotli", color: "#fff59d" },
  conductor: { name: "Conductor Bittu", sub: "bus adda", color: "#90caf9" },
  munshi: { name: "Munshi Ji", sub: "anaj mandi", color: "#ffe082" },
  balwant: { name: "Havaldar Balwant", sub: "police chowki", color: "#9fb4ff" },
  ticketwala: { name: "Raju", sub: "Raj Talkies", color: "#f48fb1" },
  pumpwala: { name: "Pump attendant", sub: "Panj Aab Fuels", color: "#a5d6a7" },
};
/** Vehicles that are part of the world simulation rather than the save. */
const TRANSIENT = /^(traffic_|police_|show_)/;

/**
 * Application root. Owns the engine, the single render loop and the single
 * fixed-step simulation clock; every other system is stepped from here.
 */
/** Recorded lines (public/audio/voice) keyed to the dialogue text they voice. */
const VOICE_LINES: Array<{ who: string; match: RegExp; clip: string }> = [
  { who: "bhola", match: /Sat Sri Akal<\/b> ji! A new face/, clip: "bhola_hello" },
  { who: "bhola", match: /Hot food waits for no one/, clip: "bhola_hello" },
  { who: "gurnam", match: /^Finally!/, clip: "gurnam_finally" },
  { who: "pammi", match: /Kinnow from Abohar/, clip: "pammi_kinnow" },
];
const PRELOAD_CLIPS = [...new Set(VOICE_LINES.map((l) => l.clip)), "bump_oye", "police_rukk", "police_chai", "lafanga_chai", "quarrel_kaun", "rage_andha", "ustad_swagat",
  "safari_kanjar", "aunty_fight_1", "aunty_fight_2", "police_gaddi_rok", "fuddu", "sawari_lak"];
/**
 * Optional recordings for the street. Each is used if the file is present in
 * public/audio/voice and silently replaced by the synthesised cry if it is
 * not, so the game is complete either way and new takes are a drop-in.
 * See docs/ASSETS.md for the line each one should say.
 */
const STREET_CLIPS = ["call_sabzi", "call_fruit", "call_doodh", "call_chaat", "call_kabadi", "call_auto_gill", "call_auto_ludhiana", "call_bus"];

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
  /** No stored settings yet: ask for a graphics preset before the title. */
  private firstRun = true;

  private get shadowQuality(): Settings["shadows"] {
    return this.gfxLow ? "off" : this.settings.shadows;
  }

  /** The active graphics preset (?gfx=low forces the lightest one). */
  private get gfx(): QualityPreset {
    return preset(this.gfxLow ? "low" : this.settings.quality);
  }

  /** Frame-cap bookkeeping: time carried over since the last drawn frame. */
  private capAccum = 0;
  private pipeline!: DefaultRenderingPipeline;
  private instr!: SceneInstrumentation;
  private driving: Vehicle | null = null;
  private lastRidden: Vehicle | null = null;
  private tiffin!: Mesh;
  private objMarker!: Marker;
  private interaction: Interaction | null = null;
  /** The last interaction shown to the player, for a short tap/press grace window. */
  private lastShown: { it: Interaction; t: number } | null = null;
  private hornCooldown = 0;
  private lastSafe = new Vector3(PLAYER_START.x, 0.2, PLAYER_START.z);
  private hintsUntil = 0;
  private time = 0;
  private autosaveT = 0;
  private prevVel = new Map<string, Vector3>();
  private bubbleEls = new Map<object, HTMLDivElement>();
  private touch!: TouchControls;
  /** Active snack/drink sprint boost. */
  private buff: { mul: number; until: number; label: string } | null = null;
  /** Warmth seconds bought for the customer of the next delivery. */
  private pendingWarmth = 0;
  /** Phones/tablets: coarse pointer or a touch seen. */
  private get touchMode(): boolean {
    return this.input.touchMode;
  }
  private route: Array<{ x: number; z: number }> = [];
  private routeT = 0;
  private titleOrbit = 0;
  private wasGrounded = true;
  private airPeak = 0;
  readonly errors: string[] = [];
  /** Diagnostics surfaced through the test probe. */
  readonly counters = { flips: 0, recoveries: 0, playerRecoveries: 0, bumps: 0, jolts: 0, enters: 0, exits: 0 };
  private flipped = new Set<string>();
  combat!: Combat;
  police!: Police;
  traffic!: Traffic;
  jhagde!: Jhagde;
  animals!: Animals;
  rides!: Rides;
  private folk: Array<FolkGroup & { live: Resident[] }> = [];
  private folkT = 0;
  private barkers!: Barkers;
  private shakeT = 0;

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLDivElement) {}

  async init(): Promise<void> {
    window.addEventListener("error", (e) => this.errors.push(String(e.message)));
    this.ui = new Ui(this.uiRoot);
    const loading = this.ui.showLoading("Loading Ranggarh — bazaar, city, pind & G.T. Road…");
    this.loadSettings();
    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true, powerPreference: "high-performance" }, true);
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    this.scene.clearColor = new Color4(0.78, 0.84, 0.9, 1);
    this.input = new Input(this.canvas);
    this.touch = new TouchControls(this.uiRoot, this.input);
    const enableTouch = () => {
      if (this.input.touchMode) return;
      this.input.touchMode = true;
      document.body.classList.add("touch");
      this.input.exitPointerLock();
    };
    if (window.matchMedia("(pointer: coarse)").matches) enableTouch();
    window.addEventListener("touchstart", enableTouch, { capture: true, passive: true });
    window.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") enableTouch(); }, { capture: true });
    this.input.onPadMenu = (k) => this.ui.padNav(k);
    this.ui.onPromptTap = () => { if (this.state === "playing") this.input.tapVirtual("interact"); };
    this.ui.onMapTap = () => { if (this.state === "playing" && this.touchMode) this.input.tapVirtual("map"); };
    this.ui.onTravelTap = () => { if (this.state === "playing") void this.travel(); };
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
    this.crowd.removeCaster = (m) => this.world.removeCaster(m);
    this.barkers = new Barkers(this.crowd, this.audio);
    // Whoever says it — a startled pedestrian, a quarrelling aunty, a lafanga,
    // the driver you just bumped — "fuddu ho gia hai" gets its recording.
    this.crowd.onLine = (r, text) => {
      if (!/fuddu/i.test(text)) return;
      const now = this.time;
      if (now - this.lastFuddu < 20) return;
      this.lastFuddu = now;
      this.audio.callClip("fuddu", r.pos, 1);
    };
    this.crowd.onBump = (r, isPlayer) => {
      if (!isPlayer) return;
      this.counters.bumps++;
      // The recorded bark is a woman's voice; only adult women shout it, and not too often.
      const now = performance.now();
      if (r.look.sex === "f" && r.look.age !== "child" && now - this.lastBark > 12000) { this.lastBark = now; this.audio.voice("bump_oye", r.pos); }
      this.save.rep = Math.max(0, this.save.rep - 1);
      this.ui.toast("Careful! People live here. (−1 reputation)", "warn", 2000);
      this.police?.crime("runover", 1);
      this.updateWallet();
    };
    this.player = new Player(this.scene, this.input);
    this.setupLife();
    this.player.raycast = (a, b) => {
      const h = this.physics.raycast(a, b, Group.STATIC | Group.PROP | Group.VEHICLE);
      return h ? { y: h.hitPointWorld.y, ny: h.hitNormalWorld.y } : null;
    };
    this.player.onLand = (impact) => {
      if (impact > 0.5 && !this.save?.upgrades.includes("firstaid")) this.missions?.onJolt(impact * 8);
    };
    this.audio.treePositions = [new Vector3(-5.3, 0, 7.8), new Vector3(5.3, 0, -42.8), new Vector3(5.3, 0, 42.5), new Vector3(-5.3, 0, -57), new Vector3(-41, 0, -4)];
    this.audio.workshopPos = new Vector3(14, 1.5, 24);
    this.audio.dhabaPos = new Vector3(dhabaLocal(6, -11).x, 1.5, dhabaLocal(6, -11).z);
    this.ui.onClick = () => this.audio.ui("click");
    this.audio.installLifecycle();
    this.input.onUserGesture = () => this.audio.unlock();
    this.input.onFocusLost = () => {
      if (this.state === "playing") void this.pause();
    };
    this.engine.runRenderLoop(() => {
      // One bad frame must not stop the game: record it (the probe and tests see it) and carry on.
      try { this.frame(); } catch (e) { if (this.errors.length < 50) this.errors.push(`frame: ${String((e as Error)?.stack ?? e).split("\n").slice(0, 3).join(" | ")}`); this.input.endFrame(); }
    });
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
    // Phones and tablets start with lighter graphics (players can raise them in Settings).
    if (window.matchMedia("(pointer: coarse)").matches) this.settings = withQuality(this.settings, "low");
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) { this.settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }; this.firstRun = false; }

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

  private keyRemap() {
    return {
      list: REBINDABLE as Array<[string, string]>,
      get: (a: string) => this.input.describe(a as Action),
      rebind: (a: string, code: string) => this.input.rebind(a as Action, code),
      reset: () => this.input.resetBindings(),
    };
  }

  private applyCamSettings(): void {
    if (this.touch) this.touch.sensitivity = this.settings.sensitivity;
    this.cam.settings = { sensitivity: this.settings.sensitivity, invertY: this.settings.invertY, keySpeed: this.settings.keySpeed };
  }

  private applySettings(s: Settings): void {
    const shadowsChanged = s.shadows !== this.settings.shadows;
    const qualityChanged = s.quality !== this.settings.quality;
    this.settings = s;
    this.audio.volumes = { master: s.master, sfx: s.sfx, ambience: s.ambience, music: s.music, muted: s.muted };
    this.audio.applyVolumes();
    this.applyCamSettings();
    this.applyPost();
    if (shadowsChanged) this.world.setShadowQuality(this.shadowQuality);
    if (qualityChanged) this.applyQuality();
    this.storeSettings();
  }

  /**
   * Push the active preset into every system that has a population or a
   * distance to tune. Safe to call before the world exists (startup) and
   * whenever the player changes the setting.
   */
  private applyQuality(): void {
    const q = this.gfx;
    this.audio.detail = q.audio;
    this.world?.setDrawDistance(q.drawDistance);
    if (this.traffic) {
      this.traffic.target = q.traffic.road;
      this.traffic.townTarget = q.traffic.town;
      this.traffic.patrolTarget = q.traffic.patrol;
      this.traffic.autoTarget = q.cityAutos;
    }
    if (this.animals) this.animals.target = { ...q.animals };
    this.crowdScale = q.crowdScale;
  }

  /** Street-folk density multiplier from the preset (read by the crowd spawner). */
  private crowdScale = 1;

  // ------------------------------------------------------------------ Title / session

  private async titleFlow(): Promise<void> {
    this.state = "title";
    // Ask once, on the very first run, before anything else is on screen.
    if (this.firstRun && !this.gfxLow) {
      this.firstRun = false;
      const q = await this.ui.chooseQuality(this.settings.quality);
      this.applySettings(withQuality(this.settings, q));
    }
    // Debug (?view=…&showroom): park every vehicle in a row for model screenshots.
    if (this.debugView && location.search.includes("showroom") && !this.vehicles.length) {
      VEHICLE_SPAWNS.slice(0, 9).forEach((sp, i) => this.spawnVehicle({ id: `show_${sp.id}`, type: sp.type, x: -2.5 + (i % 2) * 5, y: 0.05, z: -60 + Math.floor(i / 2) * 6, yaw: Math.PI / 2, paint: sp.paint ?? SPECS[sp.type].defaultPaint }));
    }
    this.ui.showHud(false);
    this.input.gameplayActive = false;
    const looks = PLAYER_LOOKS.map((l) => l.id);
    const r = readSave(localStorage, looks, WORLD_BOUNDS);
    for (;;) {
      const info = r.data ? `Saved ${new Date(r.data.savedAt).toLocaleString()} · ₹${r.data.money} · ★${r.data.rep}` : "";
      const choice = await this.ui.showTitle(!!r.data, info, PLAYER_LOOKS.map((l) => ({ id: l.id, label: l.label })), r.error);
      this.audio.unlock();
      this.audio.preloadVoices(PRELOAD_CLIPS);
      this.audio.probeClips([...STREET_CLIPS, ...GREET_CLIPS]);
      this.audio.preloadSfx(["truck_horn", ...["car", "scooter", "auto", "jeep"].flatMap((k) => [`horn_${k}_1`, `horn_${k}_2`])]);
      if (choice.action === "settings") { await this.ui.settings(this.settings, (s) => this.applySettings(s), this.keyRemap()); continue; }
      if (choice.action === "controls") { await this.ui.controls(); continue; }
      if (choice.action === "continue" && r.data) this.startSession(r.data);
      else if (choice.action === "new") {
        this.startSession(newSave(choice.look, PLAYER_START, []));
      }
      return;
    }
  }

  private startSession(data: SaveData): void {
    this.save = data;
    this.traffic.clear();
    this.combat.hp = this.combat.maxHp;
    this.police.stars = 0;
    // Any spawn missing from the save (new game, or an older save from before
    // the open world) is parked at its default spot.
    for (const sp of VEHICLE_SPAWNS) {
      if (data.vehicles.some((v) => v.id === sp.id)) continue;
      data.vehicles.push({ id: sp.id, type: sp.type, x: sp.x, y: 0.05, z: sp.z, yaw: sp.yaw, paint: sp.paint ?? SPECS[sp.type].defaultPaint });
    }
    for (const v of this.vehicles) v.dispose();
    this.vehicles = [];
    for (const vo of this.voices.values()) vo.dispose();
    this.voices.clear();
    for (const sv of data.vehicles) this.spawnVehicle(sv);
    // A truck broken down on the G.T. Road shoulder (its crew is a folk group).
    this.spawnVehicle({ id: "show_breakdown", type: "truck", x: -150, y: 0.05, z: -168.7, yaw: -Math.PI / 2, paint: "truckOrange" });
    const look = PLAYER_LOOKS.find((l) => l.id === data.player.look) ?? PLAYER_LOOKS[0]!;
    // ?start=x,z — debug/playtest spawn, so a tester can start in Ludhiana or
    // out on the G.T. Road instead of walking there. Never saved.
    const startArg = new URLSearchParams(location.search).get("start");
    if (startArg) {
      const [sx, sz] = startArg.split(",").map(Number);
      if (Number.isFinite(sx) && Number.isFinite(sz)) { data.player.x = sx!; data.player.y = 0.2; data.player.z = sz!; }
    }
    this.player.spawn(this.dressed(look.look), this.world.mats.get("character"), new Vector3(data.player.x, data.player.y, data.player.z), data.player.yaw);
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
      voice: (clip, who) => { const r = this.crowd.get(who); this.audio.voice(clip, r ? r.pos : null); },
      persist: (reason) => this.persist(reason),
      roadGraph: this.roadGraph,
      spillFactor: () => (this.save.upgrades.includes("wrap") ? 0.75 : 1) * (this.driving && this.save.upgrades.includes("bungee") ? 0.5 : 1),
      tipMultiplier: () => (this.save.upgrades.includes("data") ? 1.1 : 1),
      takeWarmthBonus: () => { const w = this.pendingWarmth; this.pendingWarmth = 0; return w; },
    });
    // An in-progress intro carry state is restored from the stage.
    this.setCarrying(this.save.introStage === INTRO.RETURN);
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
    this.ui.toast(this.touchMode ? "Left thumb moves, drag on the right to look. ⛶ for fullscreen." : "Click the game view to use the mouse for the camera. Press F1 for controls.");
  }

  /** Apply purchased outfit colours to a base look. */
  private dressed(base: Appearance): Appearance {
    const o = this.save.outfit;
    const a = { ...base };
    if (o.top) { a.topColor = o.top; a.topTrim = o.top; }
    if (o.bottom) a.bottomColor = o.bottom;
    if (o.head) { if (a.headwear === "none" || a.headwear === "cap") a.headwear = a.sex === "m" ? "turban" : "patka"; a.headColor = o.head; }
    if (o.drape) a.dupatta = o.drape;
    return a;
  }

  private restylePlayer(): void {
    const base = PLAYER_LOOKS.find((l) => l.id === this.save.player.look) ?? PLAYER_LOOKS[0]!;
    const carrying = this.carrying;
    this.setCarrying(false);
    this.world.removeCaster(this.player.human.mesh);
    this.player.restyle(this.dressed(base.look), this.world.mats.get("character"));
    this.world.addCaster(this.player.human.mesh);
    this.player.anim.onFootstep = (st) => this.audio.footstep(this.player.feet, st, this.surfaceAt(this.player.feet));
    if (carrying) this.setCarrying(true);
  }

  private async openStore(shop: ShopDef): Promise<void> {
    this.setBusy(true);
    const keeper = this.crowd.get(shop.keeper);
    if (keeper) { keeper.anim.play("greet", 1.6); this.crowd.say(keeper, shop.greeting); keeper.lookTarget = this.playerPos(); }
    const clip = VOICE_LINES.find((l) => l.who === shop.keeper && l.match.test(shop.greeting));
    if (clip) this.audio.voice(clip.clip, keeper ? keeper.pos : null);
    try {
      for (;;) {
        const items = shop.items.map((it) => {
          const owned = it.kind === "perk" ? this.save.upgrades.includes(it.id) : it.kind === "outfit" ? this.save.paints.includes(`outfit:${it.id}`) : false;
          return { id: it.id, label: it.label, cost: it.cost, owned, swatch: it.color, note: owned && it.kind === "perk" ? "Owned ✓" : it.note };
        });
        const v = await this.ui.shop(shop.name, shop.greeting, items, this.save.money);
        if (v === "__close") break;
        const item = shop.items.find((i) => i.id === v);
        if (item) this.buy(item);
      }
    } finally {
      this.setBusy(false);
    }
  }

  private buy(item: ShopItem): void {
    const s = this.save;
    const ownedPerk = item.kind === "perk" && s.upgrades.includes(item.id);
    const ownedOutfit = item.kind === "outfit" && s.paints.includes(`outfit:${item.id}`);
    if (ownedPerk) { this.ui.toast(`You already have ${item.label}.`); return; }
    if (!ownedOutfit) {
      if (s.money < item.cost) { this.audio.ui("error"); this.ui.toast("Not enough money — try a delivery job!", "warn"); return; }
      s.money -= item.cost;
      this.audio.ui("cash");
    }
    switch (item.kind) {
      case "buff": {
        const mul = item.value ?? 0.1, until = this.time + (item.duration ?? 60);
        if (!this.buff || this.buff.mul <= mul || this.buff.until < this.time) this.buff = { mul, until, label: item.label };
        else this.buff.until = Math.max(this.buff.until, until);
        this.player.anim.play("cheer", 1.0);
        this.ui.toast(`${item.label}: ${item.note}`, "money");
        break;
      }
      case "warmth":
        this.pendingWarmth += item.value ?? 10;
        this.ui.toast(`${item.label} packed for your next customer (+${item.value} s warmth).`, "money");
        break;
      case "perk":
        s.upgrades.push(item.id);
        this.ui.toast(`Bought: ${item.label}. ${item.note}`, "money");
        break;
      case "outfit":
        if (!ownedOutfit) s.paints.push(`outfit:${item.id}`);
        s.outfit[item.part!] = item.color!;
        this.restylePlayer();
        this.ui.toast(ownedOutfit ? `Wearing ${item.label}.` : `New look: ${item.label}!`, "money");
        break;
    }
    this.updateWallet();
    this.persist("shop");
  }

  private spawnVehicle(sv: SavedVehicle): Vehicle {
    const paint = PAINTS.find((p) => p.id === sv.paint) ?? PAINTS[0]!;
    const model = buildVehicleModel(this.scene, this.world.mats, this.world.signs, sv.type, paint.body, paint.accent, sv.id);
    for (const m of model.meshes) this.world.addCaster(m);
    const pos = new Vector3(sv.x, Math.max(sv.y, 0.05), sv.z);
    const v = new Vehicle(sv.id, sv.type, this.scene, this.physics, model, pos, sv.yaw, paint.id);
    v.surface = defectAt;
    this.vehicles.push(v);
    const eng = SPECS[sv.type].engine;
    const snd = VEHICLE_SOUNDS[sv.type];
    const voice = eng ? this.audio.createEngine(eng, snd.engine ? { clip: snd.engine, rate: snd.rate } : undefined) : null;
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

  // ------------------------------------------------------------------ Open-world life

  /** Fights, police, traffic, street drama and the countryside population. */
  private setupLife(): void {
    const feet = () => (this.driving ? null : this.player.feet);
    this.combat = new Combat({
      player: this.player,
      crowd: this.crowd,
      playerFeet: feet,
      say: (r, t) => this.crowd.say(r, t),
      sound: (k, p, st) => this.audio.hit(k, p, st),
      onAssault: (r, ko) => {
        if (r.faction === "lafanga" || r.faction === "wrestler" || this.jhagde.isGangMember(r)) return;
        if (r.faction === "police") this.police.crime("police", 1);
        else this.police.crime(ko ? "ko" : "assault", 1);
      },
      onPlayerDown: () => {
        this.save.stats.knockedOut++;
        this.ui.toast("Dhishoom! You're seeing stars…", "warn", 3000);
        this.combat.calmAll();
      },
      onFoeDown: (r) => {
        if (r.faction === "police") return;
        if (Math.random() < 0.5) this.ui.toast(["Dhishoom!", "Kya chapet ae!", "Ek hi kaafi si!"][Math.floor(Math.random() * 3)]!, "money", 1500);
      },
      shake: (st) => { this.shakeT = Math.max(this.shakeT, st); },
    });
    this.traffic = new Traffic({
      spawnVehicle: (id, type, x, z, yaw, paint) => this.spawnVehicle({ id, type, x, y: 0.05, z, yaw, paint }),
      despawnVehicle: (v) => this.despawnVehicle(v),
      playerPos: () => this.playerPos(),
      camera: () => ({ pos: this.cam.camera.position, fwd: this.cam.camera.getDirection(new Vector3(0, 0, 1)) }),
      obstacles: () => {
        const out: Array<{ pos: Vector3; r: number; self?: Vehicle }> = [];
        for (const v of this.vehicles) out.push({ pos: v.position, r: v.spec.halfWidth + 0.6, self: v });
        if (!this.driving) out.push({ pos: this.player.feet, r: 0.6 });
        for (const r of this.crowd.residents) if (r.pose !== "sit") out.push({ pos: r.pos, r: 0.5 });
        for (const a of this.animals?.animals ?? []) out.push({ pos: a.pos, r: a.kind === "buffalo" || a.kind === "cow" ? 1.2 : 0.4 });
        return out;
      },
      honk: (v) => {
        const horn = VEHICLE_SOUNDS[v.spec.type].horn;
        if (v.spec.bell || !horn) this.audio.bell(v.position);
        else this.audio.vehicleHorn(horn, v.spec.hornHz, v.position, v.spec.type === "truck" ? 1 : 0.85);
        this.crowd.horn(v.position, v.dir(new Vector3(0, 0, 1)));
        this.animals?.horn(v.position);
      },
      onTopple: (v, hard) => {
        this.audio.impact(v.position, hard ? 1 : 0.5);
        if (!hard) return;
        this.audio.clipAt("truck_horn", v.position, 0.35);
        if (Vector3.Distance(v.position, this.playerPos()) < 60) {
          this.ui.toast(["Auto palat gaya! Sawariyan sadak te!", "Khadda! Auto wala ud gaya!", "Hai rabba — auto ulta pai gaya!"][Math.floor(Math.random() * 3)]!, "warn", 3000);
        }
      },
      mats: this.world.mats,
      addCaster: (m) => this.world.addCaster(m),
      removeCaster: (m) => this.world.removeCaster(m),
    }, this.roadGraph, this.scene, this.world.mats.get("character"));
    this.police = new Police({
      crowd: this.crowd, combat: this.combat, traffic: this.traffic,
      playerPos: () => this.playerPos(),
      playerDriving: () => (this.driving ? { speed: this.driving.speed } : null),
      money: () => this.save.money,
      pay: (a) => { this.save.money = Math.max(0, this.save.money - a); this.save.stats.bribes += a; this.audio.ui("cash"); this.updateWallet(); },
      dialogue: (w, t, o) => this.dialogue(w, t, o),
      toast: (m, k) => this.ui.toast(m, k),
      openSpot: (x, z, a, b) => this.openSpot(x, z, a, b),
      siren: (on, p) => { if (on) this.audio.siren(p, this.time); },
      voice: (n, p) => this.audio.voice(n, p),
      busy: () => this.state !== "playing",
    });
    this.jhagde = new Jhagde({
      crowd: this.crowd, combat: this.combat, traffic: this.traffic,
      get save() { return game.save; },
      playerFeet: feet,
      playerPos: () => this.playerPos(),
      playerDriving: () => !!this.driving,
      dialogue: (w, t, o) => this.dialogue(w, t, o),
      toast: (m, k) => this.ui.toast(m, k),
      reward: (m, r) => this.reward(m, r),
      pay: (a) => { if (this.save.money < a) { this.audio.ui("error"); return false; } this.save.money -= a; this.audio.ui("cash"); this.updateWallet(); return true; },
      voice: (n, p) => this.audio.voice(n, p),
      sting: (k) => (k === "fail" ? this.audio.fail() : this.audio.success(k === "big")),
      busy: () => this.state !== "playing",
      persist: (r) => this.persist(r),
    });
    const game = this;
    this.jhagde.init();
    // Pinka at Hello Mobile Zone, Chaura Bazaar — the first mission's shopkeeper.
    this.crowd.spawn({
      id: "mobileWala", name: "Pinka (Hello Mobile Zone)", role: "keeper", contact: true,
      x: MOBILE_SHOP.x - Math.sin(MOBILE_SHOP.yaw) * 0.7, z: MOBILE_SHOP.z, yaw: MOBILE_SHOP.yaw,
      look: { ...randomLook(4242), sex: "m", age: "adult", top: "shirt", topColor: "#d81b60", bottom: "jeans", bottomColor: "#1a237e", headwear: "none", beard: "stubble", hair: "short" },
      lines: ["Recharge, cover, screen-guard — sab milda!", "Naya model aaya ae, dekh lo ji!"],
    });
    this.animals = new Animals({
      playerPos: () => this.playerPos(),
      playerRide: () => (this.driving ? { pos: this.driving.position, speed: this.driving.speed, twoWheeler: this.driving.spec.twoWheeler } : null),
      movers: () => this.vehicles.filter((v) => v.speed > 2).map((v) => ({ pos: v.position, fwd: v.dir(new Vector3(0, 0, 1)).multiplyByFloats(1, 0, 1).normalize().scale(Math.sign(v.forwardSpeed) || 1), speed: v.speed })),
      sound: (n, p) => this.audio.clipAt(n, p, n === "buffalo_moo" ? 1 : 0.7),
      addCaster: (m) => this.world.addCaster(m),
      removeCaster: (m) => this.world.removeCaster(m),
    }, this.scene, this.world.mats, this.roadGraph);
    // The bazaar's own: Mrs. Kaur's cow in the courtyard and a dog asleep by the dhaba.
    this.animals.spawn("cow", -40, -10, true, "stand");
    this.animals.spawn("dog", -5.3, -26, true, "sleep");
    // Cows that have made the city streets their own.
    this.animals.seedStreetCattle([CITY, LUDHIANA], this.crowdScale >= 1 ? 4 : 2);
    this.rides = new Rides({
      get save() { return game.save; },
      scene: this.scene, mat: this.world.mats.get("character"),
      driving: () => this.driving,
      toast: (m, k, ms) => this.ui.toast(m, k, ms),
      reward: (m, r) => this.reward(m, r),
      say: (t) => this.ui.toast(`🛺 ${t}`, "info", 3000),
      sound: (clip) => this.audio.callClip(clip, this.playerPos(), 1),
      sting: (k) => this.audio.success(k === "big"),
      roadGraph: this.roadGraph,
      addCaster: (m) => this.world.addCaster(m),
      removeCaster: (m) => this.world.removeCaster(m),
      persist: (r) => this.persist(r),
    });
    const folk = countryFolk();
    this.folk = folk.groups.map((g) => ({ ...g, live: [] }));
    this.applyQuality();
  }

  /**
   * The first ride to Ludhiana and back is staged a little: two aunties go at
   * it at the roadside on the G.T. Road, and again in Chaura Bazaar, so the
   * player sees the show without having to go looking for it.
   */
  private routeShows = [
    { x: -312, z: -150.6, stage: INTRO.DELIVER, done: false },
    { x: -560, z: -150.6, stage: INTRO.DELIVER, done: false },
    { x: -571.5, z: -262, stage: INTRO.RETURN, done: false },
  ];
  private updateRouteShows(): void {
    const st = this.save.introStage;
    if (st !== INTRO.DELIVER && st !== INTRO.RETURN) return;
    const p = this.playerPos();
    for (const s of this.routeShows) {
      if (s.done || s.stage !== st) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d > 120 || d < 40 || !isOpenGround(s.x, s.z)) continue;
      s.done = true;
      this.jhagde.stageAunties(s.x, s.z);
    }
  }

  /** Spawn/despawn countryside groups as the player moves around (checked about once a second). */
  private updateFolk(dt: number): void {
    this.folkT -= dt;
    if (this.folkT > 0) return;
    this.folkT = 1;
    const p = this.playerPos();
    let spawned = 0;
    for (const g of this.folk) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      if (!g.live.length && d < g.radius && spawned < 1) {
        // Thin each area out on the lighter presets. Shopkeepers, police and
        // street sellers are kept: they are what makes a place read as itself.
        const keep = (def: (typeof g.defs)[number], i: number) =>
          this.crowdScale >= 1 || def.contact || def.callKind || def.faction === "police" ||
          i < Math.max(1, Math.round(g.defs.length * this.crowdScale));
        g.live = g.defs.filter(keep).map((def) => this.crowd.spawn(def));
        spawned++;
      } else if (g.live.length && d > g.radius + 90) {
        for (const r of g.live) { if (this.combat.fights.has(r)) this.combat.release(r); this.crowd.remove(r); }
        g.live = [];
      }
    }
  }

  /** A random open-ground point between minR and maxR from (x, z), preferably out of the camera's view. */
  private openSpot(x: number, z: number, minR: number, maxR: number): { x: number; z: number } | null {
    const cam = this.cam.camera;
    const fwd = cam.getDirection(new Vector3(0, 0, 1));
    let fallback: { x: number; z: number } | null = null;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!isOpenGround(px, pz)) continue;
      const hit = this.physics.raycast(new Vector3(px, 4, pz), new Vector3(px, -1, pz), Group.STATIC);
      if (!hit || hit.hitPointWorld.y > 0.3) continue;
      const ahead = (px - cam.position.x) * fwd.x + (pz - cam.position.z) * fwd.z;
      if (ahead < 0) return { x: px, z: pz };
      fallback ??= { x: px, z: pz };
    }
    return fallback;
  }

  private despawnVehicle(v: Vehicle): void {
    if (v === this.driving) return;
    for (const m of v.model.meshes) this.world.removeCaster(m);
    this.voices.get(v.id)?.dispose();
    this.voices.delete(v.id);
    this.prevVel.delete(v.id);
    this.vehicles = this.vehicles.filter((x) => x !== v);
    if (this.lastRidden === v) this.lastRidden = null;
    v.dispose();
  }

  /** Back on your feet after a knock-out: a little lighter in the pocket. */
  private wakeUp(): void {
    const lost = Math.min(this.save.money, 30);
    this.save.money -= lost;
    this.combat.revivePlayer(45);
    this.updateWallet();
    this.ui.toast(lost ? `Hosh aaya? Your pocket feels lighter… (−₹${lost})` : "Hosh aaya? Everything still attached. Chalo!", "warn", 3500);
  }

  /** Take a traffic vehicle: the driver is pulled out — and he is not pleased. */
  private jack(c: TrafficCar): void {
    const v = c.v;
    this.traffic.release(c, false);
    const at = v.toWorld(new Vector3(-(v.spec.halfWidth + 0.9), 0, 0));
    const r = this.crowd.spawn({ id: `jacked${this.time.toFixed(0)}`, name: "Driver", role: "keeper", x: at.x, z: at.z, yaw: 0, look: { ...randomLook(Math.floor(this.time * 7)) }, tough: 1.1 });
    this.crowd.say(r, ["Oye meri gaddi!", "Chor! Chor!", "Ruk ja tu!"][Math.floor(Math.random() * 3)]!);
    this.combat.engage(r, { side: "foe", target: "player" });
    this.police.crime("jack", 1);
    this.enterVehicle(v);
    // He gives up after a while.
    setTimeout(() => { if (this.crowd.residents.includes(r)) { this.combat.release(r); this.crowd.remove(r); } }, 45000);
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
    this.tiffin.detachFromBone();
    if (!on) { this.tiffin.parent = null; return; }
    if (this.driving) {
      this.tiffin.parent = this.driving.model.root;
      this.tiffin.position.set(...this.driving.spec.rack);
      this.tiffin.scaling.setAll(1);
      this.tiffin.rotation.set(0, 0, 0);
    } else {
      // Hang from the right hand by the handle (bone space follows the arm).
      const h = this.player.human;
      this.tiffin.attachToBone(h.bones[B.handR]!, h.mesh);
      this.tiffin.position.set(0, -0.5, 0);
      this.tiffin.rotation.set(0, Math.PI / 2, 0);
      this.tiffin.scaling.setAll(1);
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

  private lastBark = -1e9;
  private lastFuddu = -1e9;

  private async dialogue(who: string, text: string, opts: Array<{ label: string; value: string }>): Promise<string> {
    const s = SPEAKERS[who] ?? { name: who, sub: "", color: "#fff" };
    this.setBusy(true);
    this.audio.ui("open");
    const r = this.crowd.get(who);
    if (r) r.lookTarget = this.playerPos();
    const clip = VOICE_LINES.find((l) => l.who === who && l.match.test(text));
    if (clip) this.audio.voice(clip.clip, r ? r.pos : null);
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
    s.vehicles = this.vehicles.filter((v) => !TRANSIENT.test(v.id)).map((v) => ({ id: v.id, type: v.spec.type, x: v.position.x, y: Math.max(0.05, v.position.y), z: v.position.z, yaw: v.yaw, paint: v.paint }));
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
      if (v === "settings") { await this.ui.settings(this.settings, (s) => this.applySettings(s), this.keyRemap()); continue; }
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

  /** The current goal: a passenger's drop-off takes priority over the mission objective. */
  private currentObjective(): { title: string; detail: string; target: Vector3 | null } {
    const r = this.rides?.ride;
    if (r) return { title: `Sawari → ${this.rides.label}`, detail: `Fare ₹${r.fare} · passenger comfort ${Math.round(r.comfort)}%`, target: this.rides.target };
    return this.missions.objective();
  }

  private mapMarkers(): MapMarker[] {
    const m: MapMarker[] = [];
    const obj = this.currentObjective();
    if (this.driving?.spec.type === "auto" && !this.rides.ride) for (const st of STANDS) m.push({ x: st.x, z: st.z, color: "#ffe082", label: "Auto stand (sawari)", kind: "job" });
    if (obj.target) m.push({ x: obj.target.x, z: obj.target.z, color: "#ffd36b", label: obj.title, kind: "objective" });
    if (this.save.introStage === INTRO.DONE) {
      m.push({ x: POIS.dhabaCounter!.x, z: POIS.dhabaCounter!.z, color: "#ff8a3d", label: "Bhola — delivery jobs", kind: "job" });
      m.push({ x: 12.3, z: 21.6, color: "#7fc8ff", label: "Gurnam — upgrades", kind: "shop" });
      m.push({ x: POIS.akhada!.x, z: POIS.akhada!.z, color: "#ffb74d", label: "Akhada — dangal", kind: "activity" });
    }
    for (const v of this.vehicles) if (v !== this.driving && !TRANSIENT.test(v.id)) m.push({ x: v.position.x, z: v.position.z, color: "#9fe3b0", label: v.spec.label, kind: "vehicle" });
    for (const c of this.traffic.cars) if (c.police || c.patrol) m.push({ x: c.v.position.x, z: c.v.position.z, color: "#5c7cff", kind: "police" });
    return m;
  }

  /**
   * The stand: a bus or a shared auto to any of the district's famous places.
   * Blocked while a job is on the clock, a sawari is aboard or the police are
   * after you — fast travel should not be a way out of those.
   */
  private async travel(): Promise<void> {
    const p = this.playerPos();
    if (this.driving) { this.audio.ui("error"); this.ui.toast("Park your ride first — the bus won't take it.", "warn", 2500); return; }
    if (this.police.stars > 0) { this.audio.ui("error"); this.ui.toast("Not with the police looking for you!", "warn", 2500); return; }
    if (this.missions.job) { this.audio.ui("error"); this.ui.toast("The food is getting cold — finish the delivery first.", "warn", 3000); return; }
    const here = placeAt(p.x, p.z, 18);
    this.setBusy(true);
    this.audio.ui("open");
    try {
      const items = FAMOUS_PLACES
        .filter((q) => q !== here)
        .map((q) => {
          const cost = fare(p.x, p.z, q);
          const m = Math.hypot(q.x - p.x, q.z - p.z);
          const far = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`;
          return { label: `${q.label} (${q.area}) — ${far} · ₹${cost}`, value: q.id, disabled: this.save.money < cost };
        });
      const v = await this.ui.menu(
        "Bus & auto stand",
        [...items, { label: "Rehn de — paidal hi theek (close)", value: "__close" }],
        `<span style="opacity:.85">${here ? `You are at <b>${here.label}</b>. ` : ""}Pay the fare and the bus drops you there. ₹${this.save.money} in your pocket.</span>`,
      );
      const place = FAMOUS_PLACES.find((q) => q.id === v);
      if (!place) return;
      const cost = fare(p.x, p.z, place);
      if (this.save.money < cost) { this.audio.ui("error"); this.ui.toast("Not enough for the fare.", "warn"); return; }
      this.save.money -= cost;
      this.audio.ui("cash");
      this.updateWallet();
      this.arriveAt(place.x, place.z, place.yaw);
      this.ui.toast(`🚌 ${place.label}. Fare ₹${cost}. Chalo!`, "money", 3000);
      this.audio.success(false);
      this.persist("travel");
    } finally {
      this.setBusy(false);
    }
  }

  /** Put the player down on solid ground at a travel destination. */
  private arriveAt(x: number, z: number, yaw: number): void {
    const spot = isOpenGround(x, z) ? { x, z } : this.openSpot(x, z, 2, 14) ?? { x, z };
    const hit = this.physics.raycast(new Vector3(spot.x, 8, spot.z), new Vector3(spot.x, -2, spot.z), Group.STATIC);
    const y = (hit ? hit.hitPointWorld.y : 0) + 0.1;
    this.player.teleport(new Vector3(spot.x, y, spot.z), yaw);
    this.lastSafe.set(spot.x, y, spot.z);
    this.cam.setMode("foot");
    this.cam.snapBehind(yaw, this.player.feet);
    this.clock.reset();
    // Whatever was happening where you were is no longer your problem.
    this.folkT = 0;
  }

  private async openMap(): Promise<void> {
    const p = this.playerPos();
    const yaw = this.driving ? this.driving.yaw : this.player.yaw;
    await this.ui.map((c, zoom) => {
      // Zoom 1 shows the whole map; each step doubles the detail, centred on you.
      const span = 1400 / zoom;
      const cx = zoom <= 1 ? 0 : p.x, cz = zoom <= 1 ? 0 : p.z;
      drawMap(c, { cx, cz, scale: Math.min(c.width, c.height) / span }, { x: p.x, z: p.z, yaw }, this.mapMarkers(), this.route, true);
    }, [
      ["#ffd36b", "Objective"], ["#ff8a3d", "Delivery jobs"], ["#7fc8ff", "Workshop"], ["#9fe3b0", "Vehicles"], ["#ffb74d", "Akhada / dangal"], ["#ffffff", "You"],
    ], Math.hypot(p.x, p.z) < 80 ? 8 : 2);
  }

  private async openShop(): Promise<void> {
    this.setBusy(true);
    try {
      const target = this.lastRidden ?? this.nearestVehicle(this.playerPos(), 30);
      for (;;) {
        const items = [
          { id: "brakes1", label: "Better brake pads", cost: 180, owned: this.save.upgrades.includes("brakes1"), note: "+25% braking on all your rides" },
          { id: "grip1", label: "Softer tyres", cost: 220, owned: this.save.upgrades.includes("grip1"), note: "+15% grip in corners" },
          ...(target ? PAINTS.filter((p) => p.shop !== false).map((p) => ({ id: `paint:${p.id}`, label: `${p.label} paint (${target.spec.label})`, cost: p.cost, owned: this.save.paints.includes(p.id), swatch: p.body })) : []),
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
    this.counters.enters++;
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
    this.counters.exits++;
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
        const halfLen = Math.max(...v.spec.colliders.map((c) => c.s[2])) / 2;
        const tc = this.traffic.find(v);
        if (tc && (tc.police || v.speed > 2)) continue;
        out.push({
          id: `veh_${v.id}`, pos: v.position, radius: 1.3,
          label: tc ? `Pull the driver out of the ${v.spec.label.toLowerCase()} (he won't like it)` : v.spec.twoWheeler ? `Ride the ${v.spec.label.toLowerCase()}` : `Drive the ${v.spec.label.toLowerCase()}`,
          run: () => (tc ? this.jack(tc) : this.enterVehicle(v)),
          // Distance from the player to the vehicle's footprint rectangle.
          dist: (pp) => {
            const yaw = v.yaw, dx = pp.x - v.position.x, dz = pp.z - v.position.z;
            const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
            const ox = Math.max(0, Math.abs(lx) - v.spec.halfWidth), oz = Math.max(0, Math.abs(lz) - halfLen);
            return Math.hypot(ox, oz);
          },
        });
      }
      // Shops: stand at the counter to buy.
      for (const shop of SHOPS) {
        const k = this.crowd.get(shop.keeper);
        if (!k) continue;
        const pos = shop.keeper === "cook" ? P("dhabaPickup") : new Vector3(k.home.x + (k.home.x < 0 ? 1.7 : -1.7), 0, k.home.z);
        if (shop.keeper === "cook" && m.stage === INTRO.PICKUP) continue;
        out.push({ id: `shop_${shop.keeper}`, pos, radius: 1.9, label: `Shop at ${shop.name}`, run: () => this.openStore(shop) });
      }
      for (const j of this.jhagde.interactions()) out.push({ id: `j_${j.id}`, pos: j.pos, radius: j.radius, label: j.label, run: j.run });
      // Casual chat with anyone nearby.
      for (const r of this.crowd.residents) {
        if (r.id === "bhola" || r.id === "gurnam" || r.id === "ustad" || r.brain || r.pose === "down" || r.faction === "lafanga") continue;
        out.push({ id: `chat_${r.id}`, pos: r.pos, radius: 1.6, label: `Say Sat Sri Akal to ${r.name}`, run: () => { this.crowd.say(r, this.crowd.greetLine(r)); r.anim.play("greet", 1.6); r.lookTarget = this.playerPos(); this.player.anim.play("greet", 1.4); } });
      }
    }
    const d = m.deliveryHere();
    if (d) out.push({ id: "deliver", pos: this.playerPos(), radius: 99, label: d.label, run: d.run });
    const stand = this.rides.standHere(this.playerPos());
    if (stand) out.push({ id: "sawari", pos: this.playerPos(), radius: 99, label: `Pick up a sawari at the ${stand.label}`, run: () => this.rides.pickUp(stand.id) });
    if (this.rides.dropHere(this.playerPos())) out.push({ id: "deliver", pos: this.playerPos(), radius: 99, label: "Drop your passenger here", run: () => this.rides.dropOff() });
    return out;
  }

  private pickInteraction(): Interaction | null {
    const p = this.playerPos();
    const fwd = new Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    let best: Interaction | null = null, bs = Infinity;
    for (const it of this.gatherInteractions()) {
      const dx = it.pos.x - p.x, dz = it.pos.z - p.z;
      const d = it.dist ? it.dist(p) : Math.hypot(dx, dz);
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
    const raw = this.engine.getDeltaTime() / 1000;
    // Frame cap (Low preset): skip the frame entirely rather than render it
    // early. Doing less work per second is what keeps a phone from cooking.
    const cap = this.gfx.fpsCap;
    if (cap > 0) {
      this.capAccum += raw;
      if (this.capAccum < 1 / cap - 0.002) return;
      this.capAccum = 0;
    }
    const dt = Math.min(raw, 0.1);
    this.input.pollGamepad(dt);
    this.time += dt;
    this.touch.setVisible(this.state === "playing" && this.touchMode);
    if (this.state === "playing") this.playingFrame(dt);
    else if (this.state === "title") this.titleFrame(dt);
    else if (this.state === "busy") this.busyFrame(dt);
    this.scene.render();
    this.input.endFrame();
  }

  /** ?view=x,y,z,tx,ty,tz — fixed title-screen camera for scenery screenshots (debug). */
  private readonly debugView = (() => {
    const v = new URLSearchParams(location.search).get("view");
    const n = v ? v.split(",").map(Number) : [];
    return n.length === 6 && n.every(Number.isFinite) ? n : null;
  })();

  private titleFrame(dt: number): void {
    if (this.debugView) {
      const [x, y, z, tx, ty, tz] = this.debugView as [number, number, number, number, number, number];
      this.cam.camera.position.set(x, y, z);
      this.cam.camera.setTarget(new Vector3(tx, ty, tz));
      this.world.followShadows(new Vector3(tx, 0, tz));
      this.world.update(dt);
      this.crowd.update(dt, 1, this.cam.camera.position);
      return;
    }
    this.titleOrbit += dt * 0.05;
    const c = new Vector3(0, 2, -30);
    this.cam.camera.position.set(c.x + Math.sin(this.titleOrbit) * 14, 6 + Math.sin(this.titleOrbit * 0.7), c.z - 20 + Math.cos(this.titleOrbit) * 6);
    this.cam.camera.setTarget(c);
    this.world.followShadows(c);
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
    if (this.interaction) this.lastShown = { it: this.interaction, t: this.time };
    if (inp.wasPressed("interact")) {
      // Grace: honour what was on screen a moment ago if we drifted just out of range.
      if (!this.interaction && this.lastShown && this.time - this.lastShown.t < 0.6) {
        const it = this.lastShown.it, p = this.playerPos();
        const d = it.dist ? it.dist(p) : Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
        if (d < it.radius + 1.2) this.interaction = it;
      }
      if (this.interaction) {
        this.audio.ui("click");
        void this.interaction.run();
      } else if (this.driving) this.exitVehicle();
    }
    this.hornCooldown -= dt;
    if (this.driving && inp.wasPressed("horn") && this.hornCooldown <= 0) {
      this.hornCooldown = 0.5;
      const v = this.driving;
      const horn = VEHICLE_SOUNDS[v.spec.type].horn;
      if (v.spec.bell || !horn || (v.spec.twoWheeler && this.save.upgrades.includes("bell"))) this.audio.bell(v.position);
      else this.audio.vehicleHorn(horn, v.spec.hornHz, v.position, 0.8);
      this.crowd.horn(v.position, v.dir(new Vector3(0, 0, 1)));
      this.animals.horn(v.position);
    }
    if (this.driving && inp.wasPressed("recover") && (this.driving.stuckTime > 0.8 || this.driving.dir(new Vector3(0, 1, 0)).y < 0.5)) this.recoverVehicle(this.driving);
    if (!this.driving && inp.wasPressed("recover") && this.player.feet.y > 0.5 && !this.player.grounded) this.player.recoverToSafety();
    if (!this.driving && inp.wasPressed("attack") && !this.carrying) this.combat.playerAttack();
    else if (!this.driving && inp.wasPressed("attack") && this.carrying) this.ui.toast("Not with the tiffin in your hand!", "warn", 1200);
    if (this.combat.playerDown && this.player.down && this.combat.readyToWake) this.wakeUp();

    // ---- Snack/drink sprint boost.
    if (this.buff && this.time > this.buff.until) { this.buff = null; this.ui.toast("Your energy boost wore off."); }
    this.player.speedMul = this.buff ? 1 + this.buff.mul : 1;
    const left = this.buff ? Math.ceil(this.buff.until - this.time) : 0;
    this.ui.setBuff(this.buff ? `⚡ +${Math.round(this.buff.mul * 100)}% ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : this.pendingWarmth ? `🔥 +${this.pendingWarmth}s` : null);

    // ---- Fixed-step simulation.
    const alpha = this.clock.advance(dt, (h) => this.step(h));

    // ---- Visual interpolation and animation.
    for (const v of this.vehicles) v.syncVisual(alpha);
    this.player.syncVisual(alpha);
    if (this.driving) this.player.steer = this.driving.controls.steer;
    this.player.animate(dt);
    this.crowd.update(dt, alpha, this.cam.camera.position);
    this.traffic.update(dt, this.cam.camera.position);
    this.rides.update(dt);
    this.animals.update(dt, this.cam.camera.position);
    this.world.update(dt);

    // ---- Camera.
    const v = this.driving;
    if (!v) {
      const dh = footprint(building("w_dhaba"));
      this.cam.setMode(inRect(dh, this.player.feet.x, this.player.feet.z) ? "interior" : "foot");
    }
    this.cam.update(dt, v ? v.model.root.position : this.player.human.root.position, v ? v.yaw : this.player.yaw, v ? v.speed : this.player.speed);
    this.world.followShadows(this.playerPos());
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt * 2);
      const k = this.shakeT * 0.12;
      this.cam.camera.position.addInPlaceFromFloats((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }

    // ---- Audio.
    const cp = this.cam.camera.position;
    const fwd = this.cam.camera.getDirection(new Vector3(0, 0, 1));
    this.audio.setListener(cp, fwd);
    // Only the nearest few engines are allowed to sound: a jammed chowk with
    // twenty running engines sums into mush (and eats the voice budget).
    const budget = this.gfx.engines;
    const audible = this.vehicles
      .filter((veh) => this.voices.has(veh.id))
      .map((veh) => ({ veh, d: Vector3.DistanceSquared(veh.model.root.position, cp) }))
      .sort((a, b) => a.d - b.d);
    audible.forEach(({ veh, d }, i) => {
      const voice = this.voices.get(veh.id)!;
      voice.budget = i < budget && d < 110 * 110 ? (veh === this.driving ? 1 : 0.8) : 0;
      const rpm = Math.min(1, veh.speed / veh.spec.maxSpeed);
      voice.set(rpm, veh.load, veh.hasDriver, veh.model.root.position);
    });
    this.audio.update(this.time);
    this.barkers.enabled = this.state === "playing";
    this.barkers.update(dt, this.playerPos());
    this.barkers.greet(dt, this.playerPos(), this.driving ? this.driving.speed : this.player.speed);
    this.objMarker.update(dt);
    this.updateHud(dt);
    this.updateBubbles();
    this.autosaveT += dt;
    if (this.autosaveT > 90 && !this.missions.job) { this.autosaveT = 0; this.persist("auto"); }
  }

  private step(dt: number): void {
    const inp = this.input;
    this.player.fixedUpdate(dt, this.cam.yaw);
    this.combat.fixedUpdate(dt);
    this.traffic.fixedUpdate(dt);
    this.police.fixedUpdate(dt);
    this.jhagde.fixedUpdate(dt);
    this.animals.fixedUpdate(dt);
    this.updateFolk(dt);
    this.updateRouteShows();
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
          for (const c of this.traffic.cars) {
            if (Vector3.Distance(c.v.position, v.position) < c.v.spec.halfWidth + v.spec.halfWidth + 3) this.jhagde.bumped(c);
            if (c.police && Vector3.Distance(c.v.position, v.position) < 6) this.police.crime("ram", 1);
          }
          this.missions.onJolt(dv);
          this.rides.onJolt(dv);
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
    const obj = this.currentObjective();
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
    if (this.touchMode) {
      const v = this.driving;
      const short = it ? this.shortLabel(it) : v && v.speed < 2.5 ? "Get off" : null;
      this.touch.setContext({ driving: !!v, canRecover: !!v && (v.stuckTime > 0.8 || v.dir(new Vector3(0, 1, 0)).y < 0.5), interact: short });
    }
    const key = this.touchMode ? "✋" : "E";
    ui.setPrompt(it ? `<kbd>${key === "E" ? this.input.describe("interact").split(" / ")[0] : key}</kbd> ${it.label}` : this.driving && this.driving.speed < 2.5 ? `<kbd>${key}</kbd> Get off` : null);
    if (this.driving) {
      const v = this.driving;
      const hint = v.reversing ? "Reversing" : v.spec.reverseMax === 0 ? "" : "";
      ui.setSpeed(v.speed * 3.6, v.spec.label, hint);
      ui.setRecover(v.stuckTime > 0.8 || v.dir(new Vector3(0, 1, 0)).y < 0.5 ? `Stuck? Press <kbd>R</kbd> to recover` : null);
    } else {
      ui.setSpeed(null);
      ui.setRecover(null);
    }
    ui.setHealth(this.combat.hp < this.combat.maxHp - 0.5 || this.combat.inFight ? this.combat.hp : null, this.combat.maxHp);
    ui.setWanted(this.police.stars, this.police.chasing);
    const j = this.missions.job;
    ui.setJob(j ? { title: `→ ${j.dest.whoName}`, timeLeft: j.limit - j.elapsed, total: j.limit, condition: j.condition, note: `Par ${j.par}s · ${Math.round(j.elapsed)}s elapsed` } : null);
    if (this.time < this.hintsUntil && this.touchMode) {
      ui.setHints(this.driving
        ? `Left thumb: <b>up</b> throttle · <b>down</b> brake/reverse · <b>sideways</b> steer<br>📯 horn · ⏸︎ handbrake · ✋ get off when slow`
        : `Left thumb: <b>move</b> (push fully to run) · right side: <b>drag to look</b><br>⤒ jump · 👊 punch · ✋ talk / pick up / ride · tap the prompt too`);
    } else if (!this.touchMode && (this.time < this.hintsUntil || (this.driving && this.settings.driveHints))) {
      const K = (a: Action) => `<kbd>${this.input.describe(a).split(" / ")[0]}</kbd>`;
      ui.setHints(this.driving
        ? `${K("forward")} throttle · ${K("back")} brake / reverse · ${K("left")}${K("right")} steer · ${K("jump")} handbrake<br>${K("horn")} horn · ${K("interact")} get off (when slow) · ${K("recover")} recover${this.input.padConnected ? " · 🎮 RT/LT throttle/brake" : ""}`
        : `${K("forward")}${K("left")}${K("back")}${K("right")} or arrows: move · ${K("sprint")} sprint · ${K("jump")} jump · ${K("attack")} punch<br>${K("interact")} interact · mouse or ${K("camLeft")}${K("camRight")}: camera · ${K("map")} map · <kbd>Esc</kbd> pause`);
    } else ui.setHints(null);
    if (this.settings.showFps) {
      ui.setPerf(`${this.engine.getFps().toFixed(0)} fps · ${this.instr.drawCallsCounter.current} draws · ${this.scene.getActiveMeshes().length} meshes`);
    } else ui.setPerf(null);
    // Minimap (north up, centred on the player).
    drawMap(ui.minimap, { cx: p.x, cz: p.z, scale: this.driving && this.driving.speed > 8 ? 1.1 : 2.0 }, { x: p.x, z: p.z, yaw: this.driving ? this.driving.yaw : this.player.yaw }, this.mapMarkers(), this.route, false);
    if (this.player.recovered) this.counters.playerRecoveries++;
    if (this.player.recovered) ui.toast("Whoops — you've been put back somewhere safe.", "warn");
  }

  /** Short verb for the touch interact button. */
  private shortLabel(it: Interaction): string {
    if (it.id === "deliver") return "Deliver";
    if (it.id === "pickup") return "Pick up";
    if (it.id.startsWith("veh_")) return it.label.startsWith("Drive") ? "Drive" : "Ride";
    if (it.id.startsWith("chat_")) return "Say hi";
    if (it.id.startsWith("shop_")) return "Shop";
    if (it.id === "j_jhagda") return "Calm";
    if (it.id === "sawari") return "Sawari";
    if (it.id === "j_sorry") return "Sorry";
    if (it.id === "j_ustad") return "Dangal";
    return "Talk";
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
      /** Debug only (probe mode): the Babylon scene, for inspection from tests. */
      scene: () => this.scene,
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
          trees: this.world.treeCount,
          hp: this.combat.hp,
          playerDown: this.player.down,
          wanted: this.police.stars,
          fights: [...this.combat.fights.values()].filter((f) => f.side === "foe").length,
          traffic: this.traffic.cars.length,
          patrols: this.traffic.cars.filter((c) => c.patrol).length,
          townTraffic: this.traffic.cars.filter((c) => Math.abs(c.v.position.x) < 30 && c.v.position.z > -76 && c.v.position.z < 52).length,
          constables: this.crowd.residents.filter((r) => r.faction === "police").length,
          vehicleCount: this.vehicles.length,
          animals: this.animals.animals.map((a) => a.kind),
          people: this.crowd.residents.filter((r) => Math.hypot(r.pos.x - this.playerPos().x, r.pos.z - this.playerPos().z) < 30).map((r) => ({ id: r.id, x: r.pos.x, z: r.pos.z, pose: r.pose, role: r.role, faction: r.faction ?? "civilian", fight: this.combat.fights.get(r)?.side ?? null, hp: r.hp })),
          ride: this.rides.ride ? { drop: this.rides.ride.dropPoi, fare: this.rides.ride.fare, comfort: this.rides.ride.comfort } : null,
          stats: this.save?.stats,
          shadowCasters: this.world.casterCount,
          residentsStuck: this.crowd.residents.filter((r) => r.stuckCount > 0).length,
          clockDropped: this.clock.droppedTime,
          counters: this.counters,
          audioState: this.audio.ctx?.state ?? "none",
          lastVoice: this.audio.lastVoice,
          spoken: this.barkers?.spoken ?? 0,
          buff: this.buff ? { mul: this.buff.mul, left: this.buff.until - this.time } : null,
          speedMul: this.player?.speedMul,
          pendingWarmth: this.pendingWarmth,
          outfit: this.save?.outfit,
          upgrades: this.save?.upgrades,
          toasts: [...document.querySelectorAll(".toast")].map((t) => t.textContent),
          errors: this.errors.slice(-10),
          medals: this.save?.medals,
          bests: this.save?.bests,
        };
      },
    };
  }
}

