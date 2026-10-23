import {
  Quaternion, Color4, ColorCurves, DefaultRenderingPipeline, SSAO2RenderingPipeline, ImageProcessingConfiguration, Matrix, Mesh, Scene, SceneInstrumentation, Vector3,
} from "../babylon";
import { FIXED_DT, MAX_STEPS_PER_FRAME, WORLD_BOUNDS, Group, FREE_PLAY } from "./config";
import { FixedClock } from "./FixedClock";
import { Input, REBINDABLE, type Action } from "../input/Input";
import { Physics } from "../physics/Physics";
import { World } from "../world/World";
import { Weather } from "../world/Weather";
import { CameraRig } from "../camera/CameraRig";
import { Player } from "../characters/Player";
import { PLAYER_LOOKS } from "../characters/appearances";
import { KitHuman, type KitLook } from "../characters/KitHuman";
import { KitAnimator } from "../characters/KitAnimator";

/** Where the heroes stand on the character-select screen: mid-bazaar, on the road. */
const LINEUP_Z = -20;
import { B } from "../characters/HumanBuilder";
import { Vehicle } from "../vehicles/Vehicle";
import { buildVehicleModel } from "../vehicles/models";
import { PAINTS, SPECS, VEHICLE_SOUNDS, VEHICLE_TYPES, type VehicleType } from "../vehicles/specs";
import { Crowd, residentDefs, type VehicleThreat } from "../crowds/Crowd";
import { Missions, INTRO } from "../missions/Missions";
import { REHRI_FOOD, SHOPS, TRADE, goodsItem, type ShopDef, type ShopItem } from "../missions/Shops";
import { CITY_SHOPS } from "../world/cityShops";
import { Kites } from "../crowds/kites";
import { Gossip } from "../crowds/Gossip";
import { DayNight } from "../world/DayNight";
import { Home } from "../missions/Home";
import { Morning, SHRINES } from "../crowds/Morning";
import { HOME, type Spot } from "../world/home";
import { Processions, type ProcKind } from "../crowds/Processions";
import { OPEN_HOUSES, houseToWorld, openHouseAt } from "../world/openHouses";
import type { Appearance } from "../characters/HumanBuilder";
import { AudioSystem, type EngineVoice } from "../audio/Audio";
import { Ui, DEFAULT_SETTINGS, withQuality, type Settings } from "../ui/Ui";
import { preset, type QualityPreset } from "./quality";
import { TouchControls } from "../ui/TouchControls";
import { drawMap, type MapMarker } from "../ui/MapRenderer";
import { Marker, buildFood, buildTiffin } from "../world/Markers";
import { buildRoadGraph, type NavGraph } from "../world/nav";
import { randomAppearance as randomLook } from "../characters/appearances";
import { POIS, PLAYER_START, VEHICLE_SPAWNS, SAFE_SPOTS, isOpenGround, dhabaLocal, inRect, footprint, building } from "../world/layout";
import { DESTINATIONS, REP_TIERS } from "../missions/Missions";
import { newSave, readSave, writeSave, SETTINGS_KEY, type SaveData, type SavedVehicle } from "../save/schema";
import { Color3 } from "../babylon";
import { Combat } from "../combat/Combat";
import { createEngine, markRendererHealthy, webgpuAvailable, type Backend } from "./engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Police } from "../combat/Police";
import { Jhagde } from "../combat/Jhagde";
import { Posts, POSTS } from "../combat/Posts";
import { Traffic, type TrafficCar } from "../traffic/Traffic";
import { countryFolk, type FolkGroup } from "../crowds/countryFolk";
import { Barkers, GREET_CLIPS } from "../crowds/Barkers";
import { VoiceDirector, priority, type Speaker, type VoiceContext, type VoiceWhen } from "../audio/VoiceDirector";
import VOICE_MAP from "../audio/voiceMap.json";
import { BRICK_PILES, CITY, LUDHIANA, MOBILE_SHOP, REHRIS, SITES, surfaceAt } from "../world/region";
import { Animals } from "../animals/Animals";
import { Rides, STANDS } from "../missions/Rides";
import { Buses, type BusRun } from "../traffic/Buses";
import { BUS_STOPS } from "../world/busRoutes";
import { FAMOUS_PLACES, fare, placeAt } from "../missions/Travel";
import type { Resident, ResidentDef } from "../crowds/Crowd";

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
  naka: { name: "Naka Havaldar", sub: "police naka", color: "#9fb4ff" },
  events: { name: "Try a street event", sub: "free roam (T)", color: "#ffd54f" },
  bag: { name: "Your bag", sub: "things you bought (B)", color: "#a5d6a7" },
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
const TRANSIENT = /^(traffic_|police_|show_|bus_)/;

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
  "safari_kanjar", "aunty_fight_1", "aunty_fight_2", "police_gaddi_rok", "fuddu", "sawari_lak",
  "panga_bhen", "khad_dasda", "ki_ho_gaya", "player_uncle_gitte"];
/**
 * Optional recordings for the street. Each is used if the file is present in
 * public/audio/voice and silently replaced by the synthesised cry if it is
 * not, so the game is complete either way and new takes are a drop-in.
 * See docs/ASSETS.md for the line each one should say.
 */
const STREET_CLIPS = ["call_sabzi", "call_fruit", "call_doodh", "call_chaat", "call_kabadi", "call_auto_gill", "call_auto_ludhiana", "call_bus"];

export class Game {
  engine!: AbstractEngine;
  /** Which rendering backend actually came up (shown in Settings). */
  backend: Backend = "webgl";
  private rendererNote: string | null = null;
  scene!: Scene;
  physics = new Physics();
  world!: World;
  weather!: Weather;
  input!: Input;
  cam!: CameraRig;
  player!: Player;
  crowd!: Crowd;
  private kites!: Kites;
  private dayNight!: DayNight;
  private home!: Home;
  private morning!: Morning;
  /** Sitting at home (sofa or dining chair): the capsule is parked, the body sits there. */
  private homeSeated = false;
  private hourSaveT = 0;
  private gossip!: Gossip;
  processions!: Processions;
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
  /** Subtle ambient occlusion (High/Ultra only). */
  private ssao: SSAO2RenderingPipeline | null = null;
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
  /** Eating something just bought: the dish in hand, health coming back. */
  private eating: { t: number; heal: number; prop: Mesh | null } | null = null;
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
  posts!: Posts;
  animals!: Animals;
  rides!: Rides;
  buses!: Buses;
  /** Riding a route bus as a passenger, to the end of leg `to`. */
  private busRide: { run: BusRun; to: number } | null = null;
  private folk: Array<FolkGroup & { live: Resident[] }> = [];
  private folkT = 0;
  private barkers!: Barkers;
  private shakeT = 0;

  constructor(private canvas: HTMLCanvasElement, private uiRoot: HTMLDivElement) {}

  async init(): Promise<void> {
    window.addEventListener("error", (e) => this.errors.push(String(e.message)));
    this.ui = new Ui(this.uiRoot);
    const loading = this.ui.showLoading("Loading Ranggarh — bazaar, city, pind & G.T. Road…");
    const step = (f: number, t: string) => this.ui.loadingProgress(loading, f, t);
    this.loadSettings();
    const made = await createEngine(this.canvas, this.settings.renderer);
    this.engine = made.engine;
    this.backend = made.backend;
    if (made.note) this.rendererNote = made.note;
    this.ui.backendLabel = made.backend === "webgpu" ? "WebGPU" : webgpuAvailable() ? "WebGL (WebGPU available)" : "WebGL";
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
    step(0.1, "Warming up the engine…");
    await this.physics.init(this.scene);
    step(0.25, "Laying the roads and raising the kothis…");
    this.cam = new CameraRig(this.scene, this.input, this.physics);
    this.scene.activeCamera = this.cam.camera;
    this.applyCamSettings();
    await new Promise((r) => setTimeout(r, 30));
    this.world = new World(this.scene, this.physics);
    this.world.build(this.shadowQuality);
    this.weather = new Weather(this.scene, this.world, this.gfx.audio === "low" ? "low" : "high");
    this.weather.onThunder = (delay, near) => this.audio.thunder(delay, near);
    this.dayNight = new DayNight(this.scene, this.world, this.savedHour());
    this.weather.base = this.dayNight.base;
    this.dayNight.onExposure = (e) => { if (this.pipeline) this.pipeline.imageProcessing.exposure = e; };
    // ?rain: pouring and flooded from the start (screenshots, testing).
    if (/[?&]rain\b/.test(location.search)) { this.weather.auto = false; this.weather.setRain(true, true); }
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
    this.kites = new Kites(this.scene, this.crowd);
    this.gossip = new Gossip(this.scene, this.crowd);
    this.morning = new Morning(this.scene, this.crowd);
    this.crowd.spawnAll(residentDefs(this.world.dhaba.seats, dhabaLocal), (m) => this.world.addCaster(m));
    this.crowd.removeCaster = (m) => this.world.removeCaster(m);
    this.crowd.kitMat = this.world.mats.get("kit");
    this.applyQuality();
    // The grown-ups' clips are baked now so the first kit people near you do not stutter; kids follow in play.
    step(0.85, "Dressing the people of Ranggarh…");
    for (let i = 0; i < 4; i++) { this.crowd.warmKit(); await new Promise((r) => setTimeout(r, 0)); }
    this.barkers = new Barkers(this.crowd, this.audio);
    this.barkers.speak = (w, r, from, street) => this.speak(w, r, from, street);
    // Cart and stall sellers call only from their cart (or the mandi heaps).
    this.barkers.atStall = (r) => {
      if (r.callKind !== "sabzi" && r.callKind !== "fruit" && r.callKind !== "chaat") return true;
      if (REHRIS.some((c) => Math.hypot(c.x - r.pos.x, c.z - r.pos.z) < 4)) return true;
      return SITES.some((st) => st.kind === "mandi" && r.pos.x > st.x0 && r.pos.x < st.x1 && r.pos.z > st.z0 && r.pos.z < st.z1);
    };
    this.crowd.onBump = (r, isPlayer) => {
      if (!isPlayer) return;
      this.counters.bumps++;
      // Who shouts what when bumped is in the voice map ("bumped").
      const now = performance.now();
      if (now - this.lastBark > 6000 && this.speak("bumped", r)) this.lastBark = now;
      this.save.rep = Math.max(0, this.save.rep - 1);
      this.ui.toast("Careful! People live here. (−1 reputation)", "warn", 2000);
      this.police?.crime("runover", 1);
      this.updateWallet();
    };
    this.player = new Player(this.scene, this.input);
    this.setupLife();
    this.player.onSplash = () => this.audio.impact(this.player.feet, 0.35);
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
      try { this.frame(); markRendererHealthy(); } catch (e) {
        if (this.errors.length < 50) this.errors.push(`frame: ${String((e as Error)?.stack ?? e).split("\n").slice(0, 3).join(" | ")}`);
        // Say so on screen once, so a black screen on someone's phone comes with a reason.
        if (this.errors.length === 1) this.ui.toast(`Graphics error: ${String((e as Error)?.message ?? e).slice(0, 140)}. Try Settings → Renderer.`, "warn", 12000);
        this.input.endFrame();
      }
    });
    window.addEventListener("resize", () => this.engine.resize());
    this.engine.onContextLostObservable.add(() => this.ui.toast("The graphics driver reset — reload the page if the picture stays black.", "warn", 12000));
    step(1, "Chalo!");
    loading.remove();
    if (this.rendererNote) this.ui.toast(this.rendererNote, "warn", 5000);
    if (new URLSearchParams(location.search).has("probe")) this.installProbe();
    await this.titleFlow();
  }

  // ------------------------------------------------------------------ Setup

  private setupPipeline(): void {
    const p = new DefaultRenderingPipeline("pp", true, this.scene, [this.cam.camera]);
    p.imageProcessingEnabled = true;
    p.imageProcessing.toneMappingEnabled = true;
    p.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    // Clear Punjab daylight with natural colour; exposure follows the time of
    // day (DayNight). The vignette is a light neutral edge, not a brown haze.
    p.imageProcessing.exposure = 1.0;
    p.imageProcessing.contrast = 1.1;
    p.imageProcessing.colorCurvesEnabled = true;
    const curves = new ColorCurves();
    // Natural, filmic colour (the user found the old +32 saturation too punchy):
    // a touch of warmth in the highlights, slightly cooler shadows.
    curves.globalSaturation = 2;
    curves.highlightsSaturation = -6;
    curves.highlightsHue = 40;
    curves.highlightsDensity = 8;
    curves.shadowsSaturation = 0;
    curves.shadowsHue = 220;
    curves.shadowsDensity = 6;
    p.imageProcessing.colorCurves = curves;
    p.imageProcessing.vignetteEnabled = true;
    p.imageProcessing.vignetteWeight = 0.5;
    p.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
    p.bloomEnabled = true;
    p.bloomThreshold = 0.9;
    p.bloomWeight = 0.12;
    p.bloomKernel = 32;
    // FXAA smears every texture to soften edges; multisampling smooths the
    // edges only, and a light sharpen brings the brick, signs and faces back.
    p.fxaaEnabled = false;
    p.sharpenEnabled = true;
    p.sharpen.edgeAmount = 0.3;
    p.sharpen.colorAmount = 1;
    this.pipeline = p;
    this.applyPost();
  }

  private applyPost(): void {
    // Render at the screen's real pixel density. setHardwareScalingLevel(1)
    // means one pixel per CSS pixel, which on a phone or a retina laptop
    // (2-3 device pixels per CSS pixel) is a half or a third of the screen's
    // resolution, stretched: the blur. The density used is capped per preset
    // so a phone on Low does not render 3x and cook.
    const scale = this.gfxLow ? 0.5 : this.settings.renderScale;
    const q = this.gfxLow ? "low" : this.settings.quality;
    const dprCap = q === "low" ? 1.5 : q === "medium" ? 1.75 : q === "high" ? 2 : 2.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    this.engine?.setHardwareScalingLevel(1 / Math.max(0.25, Math.min(2.5, scale * dpr)));
    if (!this.pipeline) return;
    const post = this.settings.post && !this.gfxLow;
    this.pipeline.bloomEnabled = post;
    this.pipeline.imageProcessing.vignetteEnabled = post;
    // Edge smoothing: 4x multisampling where there is GPU for it; the sharpen
    // pass everywhere but the lowest preset.
    this.pipeline.samples = post ? 4 : 1;
    this.pipeline.fxaaEnabled = false;
    this.pipeline.sharpenEnabled = q !== "low";
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    // Subtle ambient occlusion on High and Ultra: contact shadow where walls
    // meet the road, under rehris and charpais, in doorways. Never on phones,
    // Low or Medium. (?noao turns it off for comparison.)
    const wantAo = post && (q === "high" || q === "ultra") && !/[?&]noao\b/.test(location.search) && SSAO2RenderingPipeline.IsSupported;
    if (wantAo && !this.ssao) {
      const ao = new SSAO2RenderingPipeline("ssao", this.scene, { ssaoRatio: q === "ultra" ? 0.75 : 0.5, blurRatio: q === "ultra" ? 0.75 : 0.5 }, [this.cam.camera], false);
      ao.radius = 1.1;
      ao.totalStrength = 0.55;
      ao.base = 0.12;
      ao.samples = q === "ultra" ? 16 : 8;
      ao.maxZ = 90;
      ao.minZAspect = 0.4;
      ao.expensiveBlur = q === "ultra";
      ao.bilateralSamples = q === "ultra" ? 12 : 6;
      this.ssao = ao;
    } else if (!wantAo && this.ssao) {
      this.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline("ssao", [this.cam.camera]);
      this.ssao.dispose();
      this.ssao = null;
    }
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
    if (this.gossip) this.gossip.max = q.crowdScale < 0.5 ? 2 : 3;
    if (this.morning) this.morning.max = q.crowdScale < 0.5 ? 4 : q.crowdScale < 0.7 ? 6 : 8;
    this.crowdScale = q.crowdScale;
    if (this.crowd) {
      // ?oldcrowd: everyone keeps the old procedural body (to compare, or on a struggling device).
      this.crowd.kitMax = /[?&]oldcrowd\b/.test(location.search) ? 0 : q.kitPeople;
      this.crowd.kitRange = q.kitRange;
    }
    this.keptCache.clear();
  }

  /** Street-folk density multiplier from the preset (read by the crowd spawner). */
  private crowdScale = 1;

  // ------------------------------------------------------------------ Title / session

  private async titleFlow(): Promise<void> {
    this.state = "title";
    // Ask once, on the very first run, before anything else is on screen.
    if (this.firstRun && !this.gfxLow && !this.debugView) {
      this.firstRun = false;
      const q = await this.ui.chooseQuality(this.settings.quality);
      this.applySettings(withQuality(this.settings, q));
    }
    // Debug (?view=…&showroom): park every vehicle in a row for model screenshots.
    if (this.debugView && location.search.includes("showroom") && !this.vehicles.length) {
      VEHICLE_TYPES.forEach((t, i) => this.spawnVehicle({ id: `show_${t}`, type: t, x: -2.2 + (i % 2) * 4.4, y: 0.05, z: -62 + Math.floor(i / 2) * 10, yaw: 0, paint: SPECS[t].defaultPaint }));
    }
    this.ui.showHud(false);
    this.input.gameplayActive = false;
    const looks = PLAYER_LOOKS.map((l) => l.id);
    const r = readSave(localStorage, looks, WORLD_BOUNDS);
    for (;;) {
      const info = r.data ? `Saved ${new Date(r.data.savedAt).toLocaleString()} · ₹${r.data.money} · ★${r.data.rep}` : "";
      const choice = await this.ui.showTitle(!!r.data, info, PLAYER_LOOKS.map((l) => ({ id: l.id, label: l.label, blurb: l.blurb })), r.error, {
        choosing: (open) => (open ? this.showLineup() : this.hideLineup()),
        focus: (id) => this.focusLineup(id),
      });
      this.audio.unlock();
      this.audio.preloadVoices(PRELOAD_CLIPS);
      this.audio.probeClips([...new Set([...STREET_CLIPS, ...GREET_CLIPS, ...Object.keys(VOICE_MAP)])]);
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
    this.busRide = null;
    this.buses?.clear();
    this.stopEating();
    this.traffic.clear();
    this.combat.hp = this.combat.maxHp;
    this.police.stars = 0;
    // Any spawn missing from the save (new game, or an older save from before
    // the open world) is parked at its default spot.
    for (const sp of VEHICLE_SPAWNS) {
      if (data.vehicles.some((v) => v.id === sp.id)) continue;
      data.vehicles.push({ id: sp.id, type: sp.type, x: sp.x, y: 0.05, z: sp.z, yaw: sp.yaw, paint: sp.paint ?? SPECS[sp.type].defaultPaint });
    }
    // His own Bullet, black and gold, parked in the yard at home.
    if (HOME && !data.vehicles.some((v) => v.id === "bullet_ghar")) {
      data.vehicles.push({ id: "bullet_ghar", type: "motorcycle", x: HOME.bike.x, y: 0.05, z: HOME.bike.z, yaw: HOME.bike.yaw, paint: "bullet" });
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
    const kit = this.kitDressed(look.kit);
    this.player.spawn(this.dressed(look.look), this.world.mats.get(kit ? "kit" : "character"), new Vector3(data.player.x, data.player.y, data.player.z), data.player.yaw, kit);
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
      voice: (clip, who, when) => { const r = this.crowd.get(who); if (r) this.speak(when, r, [clip]); },
      persist: (reason) => this.persist(reason),
      roadGraph: this.roadGraph,
      spillFactor: () => (this.save.upgrades.includes("wrap") ? 0.75 : 1)
        * (this.driving && this.save.upgrades.includes("bungee") ? 0.5 : 1)
        * (this.driving && this.save.upgrades.includes("shocks1") ? 0.6 : 1),
      // People tip a name they know. 1.0 → 1.3 across the tiers.
      tipMultiplier: () => (this.save.upgrades.includes("data") ? 1.1 : 1) * REP_TIERS[this.repTier()]!.tip,
      repTier: () => this.repTier(),
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
    this.ui.toast(this.touchMode ? "Left thumb moves, drag on the right to look. ⛶ for fullscreen." : "Drag with the mouse to look around (or click once to capture it). Press F1 for controls.");
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

  /** The player's kit character in their bought colours (`?oldchar` keeps the old procedural body). */
  private kitDressed(base: KitLook): KitLook | undefined {
    if (new URLSearchParams(location.search).has("oldchar")) return undefined;
    const o = this.save.outfit;
    const c = { ...base.colors };
    if (o.top) c.top = o.top;
    if (o.bottom) c.bottom = o.bottom;
    if (o.head) c.head = o.head;
    if (o.drape) c.dupatta = o.drape;
    return { ...base, colors: c };
  }

  private restylePlayer(): void {
    const base = PLAYER_LOOKS.find((l) => l.id === this.save.player.look) ?? PLAYER_LOOKS[0]!;
    const carrying = this.carrying;
    this.setCarrying(false);
    this.world.removeCaster(this.player.human.mesh);
    const kit = this.kitDressed(base.kit);
    this.player.restyle(this.dressed(base.look), this.world.mats.get(kit ? "kit" : "character"), kit);
    this.world.addCaster(this.player.human.mesh);
    this.player.anim.onFootstep = (st) => this.audio.footstep(this.player.feet, st, this.surfaceAt(this.player.feet));
    if (carrying) this.setCarrying(true);
  }

  private async openStore(shop: ShopDef): Promise<void> {
    this.setBusy(true);
    const keeper = this.crowd.get(shop.keeper);
    if (keeper) { keeper.anim.play("greet", 1.6); this.crowd.say(keeper, shop.greeting); keeper.lookTarget = this.playerPos(); }
    const clip = VOICE_LINES.find((l) => l.who === shop.keeper && l.match.test(shop.greeting));
    if (clip && keeper) this.speak("talk", keeper, [clip.clip]);
    try {
      for (;;) {
        const items = shop.items.map((it) => {
          const owned = it.kind === "perk" ? this.save.upgrades.includes(it.id) : it.kind === "outfit" ? this.save.paints.includes(`outfit:${it.id}`) : false;
          if (it.kind === "goods") {
            const n = this.save.bag[it.id] ?? 0;
            return { id: it.id, label: it.label, cost: it.cost, owned: false, icon: it.snack ? "🍪" : "🛍", note: n ? `${it.note} · in your bag: ${n}` : it.note };
          }
          const icon = it.kind === "food" ? ({ thali: "🍛", glass: "🥛", kulhad: "☕", dona: "🥟", jalebi: "🍥", ganna: "🥤", kulfi: "🍦", fruit: "🍌" } as const)[it.prop ?? "dona"] : it.kind === "buff" ? "⚡" : it.kind === "warmth" ? "🔥" : undefined;
          return { id: it.id, label: it.label, cost: it.cost, owned, swatch: it.color, icon, note: owned && it.kind === "perk" ? "Owned ✓" : it.note };
        });
        const v = await this.ui.shop(shop.name, shop.greeting, items, this.save.money);
        if (v === "__close") break;
        const item = shop.items.find((i) => i.id === v);
        if (item) this.buy(item);
        // Food is eaten on the spot: close the menu so you see it.
        if (item?.kind === "food" && this.eating) break;
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
      if (!FREE_PLAY && s.money < item.cost) { this.audio.ui("error"); this.ui.toast("Not enough money — try a delivery job!", "warn"); return; }
      if (!FREE_PLAY) s.money -= item.cost;
      this.audio.ui("cash");
    }
    switch (item.kind) {
      case "food":
        this.eat(item);
        break;
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
      case "goods":
        s.bag[item.id] = Math.min(99, (s.bag[item.id] ?? 0) + 1);
        this.ui.toast(`🛍 ${item.label} — in your bag (${s.bag[item.id]}). Press B to open it.`, "money");
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

  /** Eat or drink it there and then: a few seconds with the dish, health back, maybe energy. */
  /** Sit the player down at home (the capsule is parked like in a vehicle; the body sits on the seat). */
  private sitPlayerAt(at: Spot): void {
    if (this.combat.brick) { this.combat.dropBrick(); this.ui.setBuff(null); }
    this.player.enterVehicle();
    const r = this.player.human.root;
    r.parent = null;
    r.position.set(at.x, at.y + 0.07 - 0.92 * this.player.human.scale, at.z);
    r.rotationQuaternion = Quaternion.RotationYawPitchRoll(at.yaw, 0, 0);
    this.player.pose = "sit";
    this.homeSeated = true;
  }

  private standPlayerAt(x: number, z: number, yaw: number): void {
    if (!this.homeSeated) return;
    this.homeSeated = false;
    this.stopEating();
    const hit = this.physics.raycast(new Vector3(x, 2.5, z), new Vector3(x, -1, z), Group.STATIC);
    this.player.exitVehicle(new Vector3(x, (hit ? hit.hitPointWorld.y : 0.45) + 0.05, z), yaw);
  }

  private eat(item: ShopItem): void {
    this.stopEating();
    let prop: Mesh | null = null;
    if (!this.carrying && !this.driving && !this.busRide) {
      prop = buildFood(this.scene, this.world.mats, item.prop ?? "dona");
      const h = this.player.human;
      prop.attachToBone(h.bones[B.handL]!, h.mesh);
      prop.position.set(0, -0.12, 0.04);
      prop.rotation.set(-1.5, 0, 0);
    }
    const T = 4;
    this.eating = { t: T, heal: (item.heal ?? 10) / T, prop };
    this.player.anim.play("eat", T);
    if (item.value) {
      const mul = item.value, until = this.time + (item.duration ?? 60);
      if (!this.buff || this.buff.mul <= mul || this.buff.until < this.time) this.buff = { mul, until, label: item.label };
      else this.buff.until = Math.max(this.buff.until, until);
    }
    this.ui.toast(`😋 ${item.label} — "${item.yum ?? "Wah!"}" (${item.note})`, "money", 4000);
  }

  /** Houses where you have already had chah this session (rep only once each). */
  private chahAt = new Set<string>();

  /** Sat Sri Akal to the one at home; they insist on chah (it heals), the first time a little respect too. */
  private async visitHome(id: string, host: Resident): Promise<void> {
    const elder = host.look.age === "elder";
    const v = await this.dialogue(host.name, elder ? "Jeonda reh puttar! Aa baith, chah bana dyan? Garam garam, adrak wali." : "Aao ji, aao! Kiven aaye? Chah peeyoge — hune bani ae.", [
      { label: "Haan ji, chah — thank you!", value: "chah" },
      { label: "Bas Sat Sri Akal kehan aaya si", value: "ssa" },
    ]);
    if (v === "chah") {
      const chai = SHOPS.flatMap((q) => q.items).find((q) => q.id === "chai");
      if (chai) this.eat({ ...chai, label: "Ghar di chah", yum: elder ? "Bebe ji di chah, wah!" : "Kadak chah, aunty ji!", note: "on the house", value: undefined });
      if (!this.chahAt.has(id)) { this.chahAt.add(id); this.reward(0, 1); }
      this.crowd.say(host, elder ? "Hor lavaan? Biscuit vi lai!" : "Mummy nu dassi, assi chah pilaayi!");
    } else {
      this.crowd.say(host, elder ? "Jeonda reh! Aunde rehna." : "Sat Sri Akal ji! Fer aaio.");
      host.anim.play("greet", 1.5);
    }
  }

  private stopEating(): void {
    if (!this.eating) return;
    this.eating.prop?.dispose();
    this.eating = null;
  }

  private updateEating(dt: number): void {
    const e = this.eating;
    if (!e) return;
    e.t -= dt;
    this.combat.hp = Math.min(this.combat.maxHp, this.combat.hp + e.heal * dt);
    // Running off, a fight or a vehicle ends the meal (what was eaten counts).
    if (e.t <= 0 || this.driving || this.combat.inFight || this.player.speed > 1.5) this.stopEating();
  }

  private spawnVehicle(sv: SavedVehicle): Vehicle {
    const paint = PAINTS.find((p) => p.id === sv.paint) ?? PAINTS[0]!;
    const model = buildVehicleModel(this.scene, this.world.mats, this.world.signs, sv.type, paint.body, paint.accent, sv.id);
    for (const m of model.meshes) this.world.addCaster(m);
    const pos = new Vector3(sv.x, Math.max(sv.y, 0.05), sv.z);
    const v = new Vehicle(sv.id, sv.type, this.scene, this.physics, model, pos, sv.yaw, paint.id);
    // The road under each wheel, and any standing water after the rain.
    v.surface = (x, z) => {
      const s = surfaceAt(x, z);
      const w = this.weather.floodAt(x, z);
      if (w < 0.03) return s;
      return { kind: s?.kind ?? "water", depth: s?.depth ?? 0, water: w };
    };
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
      v.powerBonus = up.includes("engine2") ? 1.22 : up.includes("engine1") ? 1.12 : 1;
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
      // One yelp at a time: voice() cuts the previous line, so a brawl never
      // turns into six people shouting over each other.
      voice: (clip, pos) => { if (!this.audio.voiceBusy()) this.audio.voice(clip, pos); },
      speak: (w, r) => { this.speak(w, r); },
      onFightStart: (r) => {
        this.speak("fight-start", r);
        // Squaring up to an old uncle: the player has something to say about it (once per fight).
        const female = (PLAYER_LOOKS.find((l) => l.id === this.save.player.look)?.look.sex ?? "m") === "f";
        if (r.look.age === "elder" && r.look.sex === "m" && !female) {
          setTimeout(() => { if (this.combat.fights.has(r)) this.speak("fight-elder", { group: "player", pos: this.playerPos() }); }, 2600);
        }
        // The nearest onlooker wants to know what is going on.
        setTimeout(() => {
          const p = this.playerPos();
          let best: Resident | null = null, bd = 15;
          for (const o of this.crowd.residents) {
            if (o === r || o.brain || o.pose === "down" || o.contact || this.combat.fights.has(o)) continue;
            const d = Math.hypot(o.pos.x - p.x, o.pos.z - p.z);
            if (d < bd) { bd = d; best = o; }
          }
          if (best) { best.lookTarget = p.clone(); this.speak("fight-onlooker", best); }
        }, 1600);
      },
      voicePick: (key, pool, pos) => {
        const have = this.audio.presentClips(pool);
        if (have.length && !this.audio.voiceBusy()) this.audio.voice(this.audio.pickFresh(key, have), pos);
      },
      onBrickLost: () => { this.ui.setBuff(null); this.ui.toast("The brick broke. Hands it is.", "warn", 1800); },
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
        if (!this.driving && !this.busRide) out.push({ pos: this.player.feet, r: 0.6 });
        for (const r of this.crowd.residents) if (r.pose !== "sit") out.push({ pos: r.pos, r: 0.5 });
        for (const a of this.animals?.animals ?? []) out.push({ pos: a.pos, r: a.kind === "buffalo" || a.kind === "cow" ? 1.2 : 0.4 });
        for (const o of this.processions?.obstacles() ?? []) out.push(o);
        return out;
      },
      calm: (pos) => this.processions?.holds(pos) ?? false,
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
      onSpill: (v, n) => this.spillRiders(v, n),
      siren: (pos) => this.audio.siren(pos, this.time),
      say: (w, group, pos) => { this.speak(w, { group, pos }); },
      mats: this.world.mats,
      addCaster: (m) => this.world.addCaster(m),
      removeCaster: (m) => this.world.removeCaster(m),
    }, this.roadGraph, this.scene, this.world.mats.get("character"));
    this.processions = new Processions({
      scene: this.scene, mats: this.world.mats, signs: this.world.signs, crowd: this.crowd, graph: this.roadGraph,
      playerPos: () => this.playerPos(),
      camera: () => ({ pos: this.cam.camera.position, fwd: this.cam.camera.getDirection(new Vector3(0, 0, 1)) }),
      vehicles: () => this.vehicles.map((v) => ({ pos: v.position, halfWidth: v.spec.halfWidth })),
      sound: (kind, pos) => this.audio.procession(kind, pos),
      toast: (msg) => { if (this.state === "playing") this.ui.toast(msg, "info", 3500); },
      addCaster: (m) => this.world.addCaster(m),
      removeCaster: (m) => this.world.removeCaster(m),
    });
    this.buses = new Buses({
      playerPos: () => this.playerPos(),
      // From below the shelter roof.
      groundY: (x, z) => this.physics.raycast(new Vector3(x, 1.2, z), new Vector3(x, -1, z), Group.STATIC)?.hitPointWorld.y ?? 0,
      call: (run, stop) => {
        const at = this.buses.where(run);
        const d = Math.hypot(at.x - this.playerPos().x, at.z - this.playerPos().z);
        if (d > 60) return;
        if (!this.audio.voiceBusy()) this.audio.clipAt("call_bus", new Vector3(at.x, 1.5, at.z), 0.7);
        if (d < 35 && !this.busRide) this.ui.toast(`🚌 ${stop.label} — ${run.plan.route.name}. "Aa jao, baith jao!"`, "info", 3500);
      },
    }, this.traffic, this.roadGraph);
    this.police = new Police({
      crowd: this.crowd, combat: this.combat, traffic: this.traffic,
      playerPos: () => this.playerPos(),
      playerDriving: () => (this.driving ? { speed: this.driving.speed } : null),
      money: () => this.save.money,
      pay: (a) => { if (!FREE_PLAY) this.save.money = Math.max(0, this.save.money - a); this.save.stats.bribes += a; this.audio.ui("cash"); this.updateWallet(); },
      dialogue: (w, t, o) => this.dialogue(w, t, o),
      toast: (m, k) => this.ui.toast(m, k),
      openSpot: (x, z, a, b) => this.openSpot(x, z, a, b),
      repLeniency: () => REP_TIERS[this.repTier()]!.leniency,
      siren: (on, p) => { if (on) this.audio.siren(p, this.time); },
      speak: (w, sp) => { this.speak(w, sp); },
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
      pay: (a) => { if (FREE_PLAY) { this.audio.ui("cash"); return true; } if (this.save.money < a) { this.audio.ui("error"); return false; } this.save.money -= a; this.audio.ui("cash"); this.updateWallet(); return true; },
      speak: (w, sp) => { this.speak(w, sp); },
      sting: (k) => (k === "fail" ? this.audio.fail() : this.audio.success(k === "big")),
      crashSound: (pos) => this.audio.impact(pos, 1),
      busy: () => this.state !== "playing",
      persist: (r) => this.persist(r),
    });
    const game = this;
    this.jhagde.init();
    this.gossip.quarrel = (a, b) => this.jhagde.quarrelBetween(a, b);
    this.home = new Home({
      crowd: this.crowd,
      playerPos: () => this.playerPos(),
      dialogue: (w, t, o) => this.dialogue(w, t, o),
      toast: (msg, kind, ms) => this.ui.toast(msg, kind ?? "info", ms ?? 3000),
      heal: (n) => { this.combat.hp = Math.min(this.combat.maxHp, this.combat.hp + n); },
      sitPlayer: (at) => this.sitPlayerAt(at),
      standPlayer: (x, z, yaw) => this.standPlayerAt(x, z, yaw),
      eatMeal: () => this.eat({ id: "ghar_khana", label: "Ghar da khana", cost: 0, kind: "food", note: "Mummy ji de haath da", heal: 100, prop: "thali", yum: "Maa de haath di roti — duniya ch sab ton vadhiya!" }),
      hour: () => this.dayNight.hour,
      setHour: (h) => this.dayNight.set(h),
      persist: () => this.persist("home"),
    });
    this.posts = new Posts({
      scene: this.scene, mats: this.world.mats, signs: this.world.signs, crowd: this.crowd,
      playerPos: () => this.playerPos(),
      playerVehicle: () => this.driving,
      spawnVehicle: (id, type, x, z, yaw, paint) => this.spawnVehicle({ id, type, x, y: 0.05, z, yaw, paint }),
      despawnVehicle: (v) => this.despawnVehicle(v),
      speak: (w, sp) => { this.speak(w, sp); },
      dialogue: (w, t, o) => this.dialogue(w, t, o),
      toast: (m, k) => this.ui.toast(m, k),
      pay: (a) => { if (!FREE_PLAY) { if (this.save.money < a) return false; this.save.money -= a; } this.audio.ui("cash"); this.updateWallet(); return true; },
      crime: (k) => this.police.crime(k),
      addCaster: (m) => this.world.addCaster(m),
      busy: () => this.state !== "playing",
    });
    this.posts.init();
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
      sound: () => { this.speak("ride-jolt", { group: "passenger", pos: this.playerPos() }); },
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

  /**
   * Say a recorded line through the voice map (docs/voice-map.xlsx): only a
   * clip the map gives this speaker for this moment, only within its distance
   * of the player, one dialogue voice at a time. Its words go in the bubble.
   * Returns the clip played, or null for silence.
   */
  speak(when: VoiceWhen, sp: Speaker, from?: readonly string[], street = false): string | null {
    const ctx = this.voiceCtx();
    const who = "group" in sp ? sp.group : sp.id;
    // One voice at a time: while a line is playing, an important next one waits
    // its turn (if it would be allowed at all); street talk is simply dropped.
    if (this.audio.voiceBusy() || (this.voiceQueue.length && !this.draining)) {
      if (priority(when) < 2) return this.voiceLog(when, who, null, "busy (street talk is not queued)");
      const clip = this.voiceDir.pick(when, sp, this.playerPos(), from, (c) => this.audio.hasClip(c), true, ctx);
      if (!clip || this.voiceQueue.length >= 3) return this.voiceLog(when, who, null, clip ? "queue full" : this.voiceDir.why);
      this.voiceQueue.push({ when, sp, from, street, until: this.time + 6 });
      this.voiceLog(when, who, null, `queued ${clip}`);
      return clip;
    }
    if (!("group" in sp) && !this.canSee(sp)) return this.voiceLog(when, who, null, "speaker not in view");
    const clip = this.voiceDir.pick(when, sp, this.playerPos(), from, (c) => this.audio.hasClip(c), false, ctx);
    if (!clip) return this.voiceLog(when, who, null, this.voiceDir.why);
    if (!("group" in sp)) {
      const say = VoiceDirector.rule(clip)?.say;
      if (say) this.crowd.say(sp, say);
    }
    if (street) this.audio.callClip(clip, sp.pos, 0.85);
    else this.audio.voice(clip, sp.pos);
    const d = Math.hypot(sp.pos.x - this.playerPos().x, sp.pos.z - this.playerPos().z);
    return this.voiceLog(when, who, clip, `${d.toFixed(1)} m away, player ${ctx.driving ? "driving" : "on foot"} ${ctx.speed.toFixed(1)} m/s`);
  }

  private voiceCtx(): VoiceContext {
    const v = this.driving ?? this.busRide?.run.car?.v;
    return { driving: !!v, speed: v ? Math.abs(v.speed) : this.player.speed };
  }

  /** `?voicelog`: say in the console why each line played or was refused. */
  private readonly voiceLogOn = new URLSearchParams(location.search).has("voicelog");
  readonly voiceLogLines: string[] = [];
  private voiceLog(when: string, who: string, clip: string | null, why: string): string | null {
    if (this.voiceLogOn) {
      const line = `[voice] ${this.time.toFixed(1)} ${when} ${who}: ${clip ? `PLAY ${clip}` : "silent"} — ${why}`;
      this.voiceLogLines.push(line);
      if (this.voiceLogLines.length > 200) this.voiceLogLines.shift();
      console.log(line);
    }
    return clip;
  }
  readonly voiceDir = new VoiceDirector();
  /**
   * Is this person somewhere you would notice them talking? Close by, or in
   * front of the camera with no wall in between. A voice from an aunty you
   * cannot see sounds like a random clip, so it stays quiet.
   */
  private canSee(r: Resident): boolean {
    const p = this.playerPos();
    if (Math.hypot(r.pos.x - p.x, r.pos.z - p.z) < 6) return true;
    const cam = this.cam.camera.position;
    const fwd = this.cam.camera.getDirection(new Vector3(0, 0, 1));
    const head = new Vector3(r.pos.x, r.pos.y + 1.5, r.pos.z);
    const to = head.subtract(cam);
    const d = to.length();
    if (Vector3.Dot(to.scale(1 / (d || 1)), fwd) < 0.35) return false;
    return !this.physics.raycast(cam, head, Group.STATIC);
  }
  private draining = false;
  private voiceQueue: Array<{ when: VoiceWhen; sp: Speaker; from?: readonly string[]; street: boolean; until: number }> = [];
  /** Play the next waiting voice line once the current one has finished. */
  private drainVoices(): void {
    while (this.voiceQueue.length && !this.audio.voiceBusy()) {
      const q = this.voiceQueue.shift()!;
      if (q.until < this.time || (!("group" in q.sp) && !this.crowd.residents.includes(q.sp))) continue;
      this.draining = true;
      const ok = this.speak(q.when, q.sp, q.from, q.street);
      this.draining = false;
      if (ok) break;
    }
  }

  /**
   * An overloaded auto or e-rickshaw has gone over: its riders end up on the
   * road, pick themselves up and give the driver a piece of their mind — the
   * "auto-tipped" lines (39-42 on the sheet), one after another.
   */
  /** You knocked a snake biker off: he is on the road, the bike is in the air. "Aaya maza, sapp!" */
  private snakeDown(at: Vector3, v: Vehicle): void {
    const r = this.crowd.spawn({ id: `snake${Math.floor(this.time * 10)}`, name: "Snake biker", role: "keeper", x: at.x + 1.2, z: at.z, yaw: Math.random() * 6, look: { ...randomLook(Math.floor(this.time * 7)), sex: "m", age: "adult" } });
    r.pose = "down";
    this.audio.impact(at, 1);
    this.shakeT = Math.max(this.shakeT, 0.6);
    const female = (PLAYER_LOOKS.find((l) => l.id === this.save.player.look)?.look.sex ?? "m") === "f";
    setTimeout(() => {
      this.speak("snake-hit", { group: female ? "player-f" : "player", pos: this.playerPos() });
      this.crowd.bubbles.push({ r: { human: this.player.human, look: { height: 1.8 } } as unknown as Resident, text: "Oye! Aaya maza, sapp!", t: 2.6 });
    }, 500);
    setTimeout(() => { if (this.crowd.residents.includes(r)) { r.pose = "stand"; r.lookTarget = v.position.clone(); r.anim.play("argue", 2); this.crowd.say(r, "Meri bike! Hai oye, meri bike!"); } }, 3500);
    setTimeout(() => { if (this.crowd.residents.includes(r)) this.crowd.remove(r); }, 25000);
  }

  private spillRiders(v: Vehicle, n: number): void {
    const k = Math.min(4, Math.max(2, n));
    const right = v.dir(new Vector3(1, 0, 0)), back = v.dir(new Vector3(0, 0, -1));
    const out: Resident[] = [];
    for (let i = 0; i < k; i++) {
      const side = i % 2 ? 1 : -1;
      const at = v.position.add(right.scale(side * (1.4 + Math.random()))).add(back.scale(-0.5 + i * 0.6));
      if (!isOpenGround(at.x, at.z)) continue;
      const r = this.crowd.spawn({ id: `sawari${Math.floor(this.time * 10)}_${i}`, name: "Sawari", role: "keeper", x: at.x, z: at.z, yaw: Math.random() * 6, look: randomLook(Math.floor(this.time * 13) + i) });
      r.pose = "down";
      out.push(r);
    }
    out.forEach((r, i) => {
      setTimeout(() => { if (this.crowd.residents.includes(r)) { r.pose = "stand"; r.lookTarget = v.position.clone(); r.anim.play("argue", 2); } }, 1400 + i * 300);
      setTimeout(() => {
        if (!this.crowd.residents.includes(r)) return;
        if (!this.speak("auto-tipped", r)) this.crowd.say(r, ["Oye! Dhyaan naal chala!", "Hai meri kamar!", "Andha ae ki?", "Paise vaapis kar!"][i % 4]!);
      }, 1800 + i * 2700);
    });
    // They hang about grumbling, then go their way.
    setTimeout(() => { for (const r of out) if (this.crowd.residents.includes(r)) this.crowd.remove(r); }, 30000);
  }

  /**
   * Meeting people: stop next to someone and face them, and your character
   * says "Sat Sri Akal ji! Tusi theek ho?"; they answer with a greeting (13-17
   * on the sheet) or, with no recording for them, just a bubble.
   */
  private meetT = 0;
  private met = new WeakMap<Resident, number>();
  private stillT = 0;
  private updateMeet(dt: number): void {
    this.meetT -= dt;
    // Only a real stop counts: standing still a moment, not every pause in a
    // crowded chowk (or the second you arrive somewhere).
    this.stillT = this.player.speed > 0.4 || this.driving ? 0 : this.stillT + dt;
    if (this.meetT > 0 || this.driving || this.state !== "playing" || this.stillT < 1.5) return;
    this.meetT = 0.3;
    const p = this.player.feet;
    const fx = Math.sin(this.player.yaw), fz = Math.cos(this.player.yaw);
    let best: Resident | null = null, bd = 2.6;
    for (const r of this.crowd.residents) {
      if (r.brain || r.pose === "down" || r.contact || r.look.age === "child" || this.combat.fights.has(r)) continue;
      const dx = r.pos.x - p.x, dz = r.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > bd || (dx * fx + dz * fz) / (d || 1) < 0.5) continue;
      if ((this.met.get(r) ?? -1e9) > this.time) continue;
      best = r; bd = d;
    }
    if (!best) return;
    const r = best;
    this.met.set(r, this.time + 90);
    this.meetT = 25;
    const female = (PLAYER_LOOKS.find((l) => l.id === this.save.player.look)?.look.sex ?? "m") === "f";
    const mine = this.speak("meet", { group: female ? "player-f" : "player", pos: p.clone() });
    this.crowd.bubbles.push({ r: { human: this.player.human, look: { height: 1.8 } } as unknown as Resident, text: "Sat Sri Akal ji! Tusi theek ho?", t: 2.4 });
    void mine;
    r.lookTarget = p.clone();
    setTimeout(() => {
      if (!this.crowd.residents.includes(r)) return;
      r.anim.play("greet", 1.8);
      if (!this.speak("meet-reply", r)) this.crowd.say(r, ["Haanji, bilkul theek! Tusi sunao?", "Sat Sri Akal! Rabb di mehar ae.", "Theek haan ji, chadhdi kala!"][Math.floor(Math.random() * 3)]!);
    }, 1900);
  }

  /** Spawn/despawn countryside groups as the player moves around (checked about once a second). */
  private updateFolk(dt: number): void {
    this.folkT -= dt;
    if (this.folkT > 0) return;
    this.folkT = 0.45;
    const p = this.playerPos();
    // Decide what SHOULD be loaded, then converge on it. Deciding per group
    // in isolation deadlocked: at the headcount ceiling nothing could spawn,
    // and nothing was over the ceiling so nothing was unloaded — you ended up
    // holding whichever cells you happened to walk through first while the
    // street in front of you stayed empty.
    //
    // The ceiling matters. Without one, crossing Ludhiana left every cell
    // behind you loaded: close to three hundred people alive to show you
    // twenty, with the animation, physics and shadow cost of the rest.
    const budget = Math.round(140 * this.crowdScale);
    // Thin each area out on the lighter presets. Shopkeepers, police and
    // street sellers are kept: they are what makes a place read as itself.
    const keep = (g: FolkGroup, def: ResidentDef, i: number) =>
      this.crowdScale >= 1 || def.contact || def.callKind || def.faction === "police" ||
      i < Math.max(1, Math.round(g.defs.length * this.crowdScale));
    // Memoised: this runs over every group twice a second.
    const keptCache = this.keptCache;
    const kept = (g: FolkGroup) => {
      let k = keptCache.get(g);
      if (!k) { k = g.defs.filter((d, i) => keep(g, d, i)); keptCache.set(g, k); }
      return k;
    };

    const order = [...this.folk].sort((a, b) =>
      (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
    const want = new Set<FolkGroup>();
    let cost = 0;
    for (const g of order) {
      if (Math.hypot(g.x - p.x, g.z - p.z) > g.radius) continue;
      const n = kept(g).length;
      if (cost + n > budget && want.size) break;
      want.add(g);
      cost += n;
    }
    // Unload what is no longer wanted — except a group holding someone who is
    // mid-fight with the player; yanking them away mid-punch is worse.
    for (const g of this.folk) {
      if (!g.live.length || want.has(g)) continue;
      if (g.live.some((r) => this.combat.fights.get(r)?.target === "player")) continue;
      this.unloadFolk(g);
    }
    // Fill in, nearest first. Building a person costs a mesh, so the budget
    // here is people rather than groups: a thirty-strong bus adda arriving in
    // one tick was a 32 ms hitch you could feel. Part-filled groups finish on
    // the next pass, and a pass comes twice a second.
    let spawned = 0;
    for (const g of order) {
      if (spawned >= 10) break;
      if (!want.has(g)) continue;
      const defs = kept(g);
      if (g.live.length >= defs.length) continue;
      for (const def of defs.slice(g.live.length)) {
        if (spawned >= 10) break;
        g.live.push(this.crowd.spawn(def));
        spawned++;
      }
    }
  }

  /** kept(group) under the current crowd scale; cleared when quality changes. */
  private keptCache = new Map<FolkGroup, ResidentDef[]>();

  private unloadFolk(g: FolkGroup & { live: Resident[] }): void {
    for (const r of g.live) { if (this.combat.fights.has(r)) this.combat.release(r); this.crowd.remove(r); }
    g.live = [];
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
    const lost = FREE_PLAY ? 0 : Math.min(this.save.money, 30);
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
    const bus = this.busRide?.run.car?.v;
    if (this.homeSeated) return this.player.human.root.position.clone();
    return this.driving ? this.driving.position.clone() : bus ? bus.position.clone() : this.player.feet;
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

  /**
   * Reputation tiers. These used to be titles and nothing else — the game
   * asked you to earn stars for an hour and then read the number nowhere.
   * Each tier now buys something you can feel: a better cut of every
   * delivery, the good kit at the workshop, and constables who will give a
   * known face the benefit of the doubt. See REP_TIERS.
   */
  private repTier(rep = this.save.rep): number {
    return rep >= 120 ? 4 : rep >= 60 ? 3 : rep >= 25 ? 2 : rep >= 8 ? 1 : 0;
  }

  private repLevel(rep: number): string {
    return REP_TIERS[this.repTier(rep)]!.name;
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

  /**
   * B: what you have bought and carry. A packet is eaten there and then; any
   * other thing is given to the person in front of you, who is glad of it
   * (reputation up, more for a costlier gift).
   */
  private async openBag(): Promise<void> {
    const bag = this.save.bag;
    const ids = Object.keys(bag).filter((id) => bag[id]! > 0 && goodsItem(id));
    if (!ids.length) { this.ui.toast("Your bag is empty. Buy something at a shop — kiryana, mobile, cloth, mithai…", "info"); return; }
    const near = this.giftTarget();
    const opts = ids.map((id) => {
      const it = goodsItem(id)!;
      return { label: `${it.label} ×${bag[id]} — ${it.snack ? "eat it" : near ? `give to ${near.name.toLowerCase() === "shopkeeper" ? "the shopkeeper" : near.name}` : "give (walk up to someone)"}`, value: id };
    });
    const v = await this.dialogue("bag", near ? "Your bag. Give something to the person in front of you, or have a snack." : "Your bag. Stand in front of someone to give them a gift.", [...opts, { label: "Close", value: "x" }]);
    const it = goodsItem(v);
    if (!it || !bag[v]) return;
    if (it.snack) {
      if (this.driving || this.busRide) { this.ui.toast("Get off first, then eat.", "warn"); return; }
      this.useBag(v);
      this.eat(it);
      return;
    }
    const r = this.giftTarget();
    if (!r) { this.ui.toast("Walk up to someone first — then press B and give it.", "warn"); return; }
    this.useBag(v);
    this.giveGift(r, it);
  }

  private useBag(id: string): void {
    const bag = this.save.bag;
    bag[id] = (bag[id] ?? 1) - 1;
    if (bag[id]! <= 0) delete bag[id];
    this.persist("bag");
  }

  /** The person just in front of you (close, roughly ahead, not in a fight). */
  private giftTarget(): Resident | null {
    if (this.driving || this.busRide) return null;
    const p = this.player.feet, fx = Math.sin(this.player.yaw), fz = Math.cos(this.player.yaw);
    // Far enough to reach a shopkeeper across the counter.
    let best: Resident | null = null, bd = 4.2;
    for (const r of this.crowd.residents) {
      if (r.brain || r.pose === "down" || r.look.age === "child" || this.combat.fights.has(r)) continue;
      const dx = r.pos.x - p.x, dz = r.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d < bd && (d < 1.2 || (dx * fx + dz * fz) / d > (d > 2.5 ? 0.7 : 0.3))) { best = r; bd = d; }
    }
    return best;
  }

  private giveGift(r: Resident, it: ShopItem): void {
    r.lookTarget = this.playerPos();
    r.anim.play("greet", 1.8);
    this.player.anim.play("greet", 1.2);
    const elder = r.look.age === "elder", woman = r.look.sex === "f";
    const say = r.id === "mrsKaur" ? "Puttar, tu taan mera apna ae! Aa, chah pee ke ja."
      : r.faction === "police" ? "Hmm… theek ae. Par eh rishvat taan nahi na?"
      : elder ? "Jeonde raho puttar! Rabb tainu sada khush rakhe!"
      : woman ? "Haaye, eh mere layi? Bahut shukriya ji!"
      : "Oye wah! Kamaal kar ditti, shukriya bai!";
    this.crowd.say(r, say);
    const rep = Math.max(1, Math.round(it.cost / 150));
    this.save.rep += rep;
    this.audio.ui("cash");
    this.ui.toast(`🎁 You gave ${it.label}. +${rep} reputation`, "money", 3500);
    this.updateWallet();
    this.persist("gift");
  }

  private async dialogue(who: string, text: string, opts: Array<{ label: string; value: string }>): Promise<string> {
    const s = SPEAKERS[who] ?? { name: who, sub: "", color: "#fff" };
    this.setBusy(true);
    this.audio.ui("open");
    const r = this.crowd.get(who);
    if (r) r.lookTarget = this.playerPos();
    const clip = VOICE_LINES.find((l) => l.who === who && l.match.test(text));
    if (clip && r) this.speak("talk", r, [clip.clip]);
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

  /**
   * What the player is actually working towards. The game kept medals and
   * personal bests per destination, and a reputation tier, and showed the
   * player none of it: you could put an hour in without ever learning there
   * were fifteen rounds to gold or that the stars bought anything.
   */
  private async showRound(): Promise<void> {
    const tier = this.repTier();
    const next = REP_TIERS[tier + 1];
    const medal = (id: string) => this.save.medals[`delivery_${id}`];
    const icon = (m?: string) => (m === "gold" ? "🥇" : m === "silver" ? "🥈" : m === "bronze" ? "🥉" : "—");
    const golds = DESTINATIONS.filter((d) => medal(d.id) === "gold").length;
    const rows: Array<[string, string]> = [
      ["Reputation", `★${this.save.rep} — ${REP_TIERS[tier]!.name}`],
      ["This buys you", REP_TIERS[tier]!.unlocks || "Nothing yet — get delivering"],
      ...(next ? [["Next: " + next.name, `★${next.at} — ${next.unlocks}`] as [string, string]] : []),
      ["Tips", `×${REP_TIERS[tier]!.tip.toFixed(2)} on every delivery`],
      ["Gold medals", `${golds} of ${DESTINATIONS.length}`],
      ["Deliveries", String(this.save.stats.deliveries)],
      ...DESTINATIONS.map((d) => {
        const best = this.save.bests[`delivery_${d.id}`];
        return [`${icon(medal(d.id))}  ${d.whoName}`, best === undefined ? "not yet run" : `best ${best.toFixed(1)} s`] as [string, string];
      }),
    ];
    await this.ui.results("Your round", null, rows, [{ label: "Back", value: "ok" }]);
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
        { label: "Your round", value: "round" },
        { label: "Settings", value: "settings" },
        { label: "Controls", value: "controls" },
      ];
      if (this.missions.job) items.push({ label: "Abandon delivery", value: "abandon" });
      items.push({ label: "Save & quit to title", value: "quit" });
      const v = await this.ui.menu("Paused", items, `<span style="opacity:.8">₹${this.save.money} · ★${this.save.rep} · ${this.save.stats.deliveries} deliveries</span>`);
      if (v === "save") { this.persist("manual"); continue; }
      if (v === "map") { await this.openMap(); continue; }
      if (v === "round") { await this.showRound(); continue; }
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
    for (const r of this.buses.runs) { const at = this.buses.where(r); m.push({ x: at.x, z: at.z, color: r.plan.route.livery === "prtc" ? "#ef5350" : "#42a5f5", label: `Bus: ${r.plan.route.name}`, kind: "bus" }); }
    for (const st of BUS_STOPS) m.push({ x: st.x, z: st.z, color: "#fff3c4", label: `🚏 ${st.label}`, kind: "stop" });
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
    if (this.busRide) { this.audio.ui("error"); this.ui.toast("You're already on a bus — get off at a stop first.", "warn", 2500); return; }
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
          return { label: `${q.label} (${q.area}) — ${far} · ₹${cost}`, value: q.id, disabled: !FREE_PLAY && this.save.money < cost };
        });
      const v = await this.ui.menu(
        "Bus & auto stand",
        [...items, { label: "Rehn de — paidal hi theek (close)", value: "__close" }],
        `<span style="opacity:.85">${here ? `You are at <b>${here.label}</b>. ` : ""}Pay the fare and the bus drops you there. ₹${this.save.money} in your pocket.</span>`,
      );
      const place = FAMOUS_PLACES.find((q) => q.id === v);
      if (!place) return;
      const cost = fare(p.x, p.z, place);
      if (!FREE_PLAY && this.save.money < cost) { this.audio.ui("error"); this.ui.toast("Not enough for the fare.", "warn"); return; }
      if (!FREE_PLAY) this.save.money -= cost;
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
    // Inside an open house is fine too (on its floor, not its roof).
    const home = openHouseAt(x, z);
    const spot = isOpenGround(x, z) || home ? { x, z } : this.openSpot(x, z, 2, 14) ?? { x, z };
    const hit = this.physics.raycast(new Vector3(spot.x, home ? 2 : 8, spot.z), new Vector3(spot.x, -2, spot.z), Group.STATIC);
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
      const span = 2000 / zoom;
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
        // Gurnam keeps his good kit for people he knows. This is what
        // reputation is FOR — before, the stars bought nothing at all.
        const tier = this.repTier();
        const owned = (id: string) => this.save.upgrades.includes(id);
        const shelf: Array<{ id: string; label: string; cost: number; note: string; needs: number }> = [
          { id: "brakes1", label: "Better brake pads", cost: 180, note: "+25% braking on all your rides", needs: 0 },
          { id: "grip1", label: "Softer tyres", cost: 220, note: "+15% grip in corners", needs: 0 },
          { id: "engine1", label: "Carburettor tune-up", cost: 320, note: "+12% pull and top speed", needs: 1 },
          { id: "shocks1", label: "Heavy-duty shock absorbers", cost: 400, note: "Potholes stop shaking your tiffin: −40% spills", needs: 2 },
          { id: "engine2", label: "Bored-out barrel (Gurnam's own)", cost: 900, note: "+22% pull and top speed — replaces the tune-up", needs: 3 },
        ];
        const items = [
          ...shelf.filter((i) => FREE_PLAY || tier >= i.needs).map((i) => ({ id: i.id, label: i.label, cost: i.cost, owned: owned(i.id), note: i.note })),
          ...shelf.filter((i) => !FREE_PLAY && tier < i.needs).map((i) => ({
            id: `locked:${i.id}`, label: `🔒 ${i.label}`, cost: i.cost, owned: false,
            note: `Gurnam keeps this for a ${REP_TIERS[i.needs]!.name.toLowerCase()} — ★${REP_TIERS[i.needs]!.at}`,
          })),
          ...(target ? PAINTS.filter((p) => p.shop !== false).map((p) => ({ id: `paint:${p.id}`, label: `${p.label} paint (${target.spec.label})`, cost: p.cost, owned: this.save.paints.includes(p.id), swatch: p.body })) : []),
        ];
        const v = await this.ui.shop("Gurnam Motor Works", target ? `Upgrades apply to all your rides. Paint goes on the ${target.spec.label.toLowerCase()} you last rode.` : "Upgrades apply to all your rides.", items, this.save.money);
        if (v === "__close") break;
        if (v.startsWith("locked:")) { this.audio.ui("error"); this.ui.toast("Gurnam: \"Thoda naam kama le pehlan, puttar.\"", "warn", 2500); continue; }
        const it = items.find((i) => i.id === v)!;
        if (!it.owned) {
          if (!FREE_PLAY && this.save.money < it.cost) { this.audio.ui("error"); continue; }
          if (!FREE_PLAY) this.save.money -= it.cost;
          if (v.startsWith("paint:")) this.save.paints.push(v.slice(6));
          else this.save.upgrades.push(v);
          this.audio.ui("cash");
          this.ui.toast(`Bought: ${it.label}`, "money");
        }
        if (v.startsWith("paint:") && target) {
          this.repaint(target, v.slice(6));
          this.ui.toast(`Painted: ${it.label.split(" paint")[0]}`);
        }
        if (!v.startsWith("paint:")) this.applyUpgrades();
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
    if (this.combat.brick) { this.combat.dropBrick(); this.ui.setBuff(null); }
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

  /** At a bus's front door: pick a stop ahead, pay the conductor, take a seat. */
  private async boardBus(run: BusRun): Promise<void> {
    if (this.police.stars > 0) { this.audio.ui("error"); this.ui.toast("Not with the police looking for you!", "warn", 2500); return; }
    const legs = this.buses.ahead(run);
    if (!legs.length) return;
    this.setBusy(true);
    try {
      const items = legs.map((i) => {
        const cost = this.buses.fare(run, i);
        return { label: `${run.plan.legs[i]!.to.label} — ₹${cost}`, value: String(i), disabled: !FREE_PLAY && this.save.money < cost };
      });
      const v = await this.ui.menu(
        `🚌 ${run.plan.route.name}`,
        [...items, { label: "Nahi ji (close)", value: "__close" }],
        `<span style="opacity:.85">"Kithe jaana? Tikat lao!" ₹${this.save.money} in your pocket.</span>`,
      );
      const to = Number(v);
      if (v === "__close" || !legs.includes(to)) return;
      // The bus may have pulled away while you dithered.
      const door = this.buses.door(run);
      if (!door || !this.buses.atStop(run) || Math.hypot(door.x - this.player.feet.x, door.z - this.player.feet.z) > 4) { this.ui.toast("Oho, bus nikal gayi!", "warn", 2500); return; }
      const cost = this.buses.fare(run, to);
      if (!FREE_PLAY && this.save.money < cost) return;
      if (!FREE_PLAY) this.save.money -= cost;
      this.updateWallet();
      this.audio.ui("cash");
      this.sitInBus(run, to);
      this.ui.toast(`🎟️ Ticket to ${run.plan.legs[to]!.to.label}, ₹${cost}. Sit back — get off at any stop with E.`, "money", 4000);
    } finally {
      this.setBusy(false);
    }
  }

  private sitInBus(run: BusRun, to: number): void {
    const v = run.car!.v;
    if (this.combat.brick) { this.combat.dropBrick(); this.ui.setBuff(null); }
    this.busRide = { run, to };
    run.carrying = true;
    this.player.enterVehicle();
    const r = this.player.human.root;
    r.parent = v.model.root;
    // A seat by a window on the kerb side, a few rows back.
    r.position.set(-0.7, 1.42 - 0.92 * this.player.human.scale, 1.2);
    r.rotationQuaternion = null;
    r.rotation.set(0, 0, 0);
    this.player.pose = "sit";
    this.cam.setMode("bus");
    this.cam.snapBehind(v.yaw, v.position);
  }

  /** Off at the front door, onto the kerb. */
  private leaveBus(): void {
    const ride = this.busRide;
    if (!ride) return;
    const v = ride.run.car?.v;
    this.busRide = null;
    ride.run.carrying = false;
    let p: Vector3 | null = null;
    if (v) {
      const door = v.toWorld(new Vector3(-2.0, 0, 3.6));
      const hit = this.physics.raycast(new Vector3(door.x, v.position.y + 2, door.z), new Vector3(door.x, -2, door.z), Group.STATIC);
      p = new Vector3(door.x, (hit ? hit.hitPointWorld.y : 0) + 0.05, door.z);
    }
    this.player.exitVehicle(p ?? this.lastSafe.clone(), v?.yaw ?? 0);
    this.player.pose = "stand";
    this.cam.setMode("foot");
    if (v) this.lastSafe.copyFrom(p!);
  }

  /** Riding: get off at your stop; if the bus vanished somehow, step off where it was. */
  private updateBusRide(): void {
    const ride = this.busRide;
    if (!ride) return;
    if (!ride.run.car) { this.leaveBus(); return; }
    if (ride.run.leg === ride.to && this.buses.atStop(ride.run) && ride.run.dwell < 11) {
      const stop = this.buses.atStop(ride.run)!;
      this.leaveBus();
      this.ui.toast(`🚌 ${stop.label}. Utro ji!`, "money", 2500);
      this.persist("travel");
    }
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
    // At home on the sofa or at the table: only what you can do from there.
    if (this.home.busy) return this.home.interactions();
    if (this.busRide) {
      const stop = this.buses.atStop(this.busRide.run);
      if (stop) out.push({ id: "bus_off", pos: this.playerPos(), radius: 99, label: `Get off at ${stop.label}`, run: () => this.leaveBus() });
      return out;
    }
    if (!this.driving) for (const run of this.buses.runs) {
      const door = this.buses.door(run);
      if (!door || !this.buses.atStop(run) || run.dwell < 1.5) continue;
      out.push({ id: `bus_${run.id}`, pos: door, radius: 2.2, label: `Board the bus (${run.plan.route.name})`, run: () => this.boardBus(run) });
    }
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
        if (tc && (tc.police || tc.bus || v.speed > 2)) continue;
        out.push({
          id: `veh_${v.id}`, pos: v.position, radius: 1.3,
          label: tc ? `Pull the driver out of the ${v.spec.label.toLowerCase()} (he won't like it)` : v.id === "bullet_ghar" ? "Ride your Bullet" : v.spec.twoWheeler ? `Ride the ${v.spec.label.toLowerCase()}` : `Drive the ${v.spec.label.toLowerCase()}`,
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
      // Signed shops in Nawan Shehar and Ludhiana: step up to the counter.
      for (const c of CITY_SHOPS) {
        if (Math.abs(c.cx - this.player.feet.x) > 3 || Math.abs(c.cz - this.player.feet.z) > 3) continue;
        const t = TRADE[c.trade]!;
        out.push({ id: `cshop_${c.id}`, pos: new Vector3(c.cx, 0, c.cz), radius: 1.6, label: `Shop at ${t.name}`, run: () => this.openStore({ keeper: c.keeper, ...t }) });
      }
      // Carts that sell something to eat on the spot.
      for (const r of REHRIS) {
        const menu = REHRI_FOOD[r.goods];
        if (!menu) continue;
        const pos = new Vector3(r.x + Math.sin(r.yaw) * 1.4, 0, r.z + Math.cos(r.yaw) * 1.4);
        if (Math.hypot(pos.x - this.player.feet.x, pos.z - this.player.feet.z) > 3) continue;
        const vendor = this.crowd.residents.find((q) => q.role === "keeper" && Math.hypot(q.home.x - r.x, q.home.z - r.z) < 2);
        out.push({ id: `rehri_${r.x}_${r.z}`, pos, radius: 2.0, label: `${menu.name} — eat something`, run: () => this.openStore({ keeper: vendor?.id ?? "", ...menu }) });
      }
      for (const j of this.posts.interactions()) out.push({ id: j.id, pos: j.pos, radius: j.radius, label: j.label, run: j.run });
      out.push(...this.home.interactions());
      // Inside an open house: the one at home on the sofa offers chah.
      const home = openHouseAt(this.player.feet.x, this.player.feet.z);
      const host = home ? this.crowd.get(`home_${home.id}`) : undefined;
      if (home && host && !host.brain && host.pose === "sit") out.push({ id: `home_${home.id}`, pos: new Vector3(home.talk.x, 0, home.talk.z), radius: 1.8, label: `Talk to ${host.name}`, run: () => this.visitHome(home.id, host) });
      for (const j of this.jhagde.interactions()) out.push({ id: `j_${j.id}`, pos: j.pos, radius: j.radius, label: j.label, run: j.run });
      // A half-brick off the nearest pile, if your hands are free.
      if (!this.combat.brick && !this.carrying) {
        const f = this.player.feet;
        for (const b of BRICK_PILES) {
          if (Math.hypot(b.x - f.x, b.z - f.z) > 2.2) continue;
          out.push({
            id: "brick", pos: new Vector3(b.x, 0, b.z), radius: 2.2, label: "Pick up a half-brick",
            run: () => {
              this.combat.takeBrick();
              this.player.anim.play("work", 0.6);
              this.ui.setBuff("🧱 Half-brick");
              this.ui.toast("Half-brick in hand. Two good swings in it.", "money", 2500);
            },
          });
          break;
        }
      }
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

  /**
   * The first time the player comes within reach of something that is not a
   * delivery, say what it is. The game has auto fares, street fights, the
   * akhada, intercity buses and half a dozen shops, and the only thing it
   * ever told you about was Bhola's deliveries.
   */
  private static readonly FIRST_TIME: Array<[RegExp, string]> = [
    [/^sawari$/, "Auto stand: pick up a sawari and run them across town for a fare."],
    [/^brick$/, "A half-brick. Two good swings in it — press G to swing."],
    [/^gurnam$/, "Gurnam does upgrades and paint. He keeps his best kit for people with a reputation."],
    [/^j_/, "A tamasha. Walk in and take a side, or stand and watch."],
    [/^shop_/, "Shops sell buffs that last a delivery and perks that last forever."],
    [/^chat_/, "Everyone in Ranggarh will talk to you. Some of them will fight you (Q and G)."],
  ];

  private hintFirstTime(it: Interaction): void {
    const rule = Game.FIRST_TIME.find(([re]) => re.test(it.id));
    if (!rule) return;
    const key = `hint_${rule[0].source}`;
    if (this.save.flags[key]) return;
    this.save.flags[key] = true;
    this.ui.toast(rule[1], "info", 5000);
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
    if (best) this.hintFirstTime(best);
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
    this.drainVoices();
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

  /** Character select: the heroes stand side by side in the bazaar, the one in focus greets you. */
  private lineup: { hs: KitHuman[]; anims: KitAnimator[]; focus: number } | null = null;
  private showLineup(): void {
    if (this.lineup) return;
    const hs: KitHuman[] = [], anims: KitAnimator[] = [];
    PLAYER_LOOKS.forEach((l, i) => {
      const h = new KitHuman(this.scene, `lineup${i}`, l.kit, this.world.mats.get("kit"));
      // The camera looks down -Z, so screen-left is +X: first card, leftmost hero.
      h.root.position.set(-(i - (PLAYER_LOOKS.length - 1) / 2) * 1.5, 0.02, LINEUP_Z);
      this.world.addCaster(h.mesh);
      hs.push(h);
      anims.push(new KitAnimator(h));
    });
    this.lineup = { hs, anims, focus: -1 };
  }
  private hideLineup(): void {
    for (const h of this.lineup?.hs ?? []) { this.world.removeCaster(h.mesh); h.dispose(); }
    this.lineup = null;
  }
  private focusLineup(id: string): void {
    const L = this.lineup;
    const i = PLAYER_LOOKS.findIndex((l) => l.id === id);
    if (!L || i < 0 || i === L.focus) return;
    L.focus = i;
    L.anims.forEach((a, k) => a.h.ch.setExpression(k === i ? "happy" : "neutral"));
    L.anims[i]!.play("greet", 2.2);
  }

  private titleFrame(dt: number): void {
    if (this.lineup) {
      // Framed on the two of them, a little off-centre toward the one in focus.
      const fx = this.lineup.focus >= 0 ? -(this.lineup.focus - (PLAYER_LOOKS.length - 1) / 2) * 0.35 : 0;
      // Aimed low so the two stand in the top half of the screen, above the menu.
      this.cam.camera.position.set(fx, 1.2, LINEUP_Z + 3.7);
      this.cam.camera.setTarget(new Vector3(fx, 0.35, LINEUP_Z));
      this.world.followShadows(new Vector3(0, 0, LINEUP_Z));
      this.world.update(dt);
      this.dayNight.update(dt);
      this.crowd.update(dt, 1, this.cam.camera.position);
      for (const a of this.lineup.anims) a.update(dt, { speed: 0, grounded: true, pose: "stand", carry: false, lookYaw: 0 });
      return;
    }
    if (this.debugView) {
      const [x, y, z, tx, ty, tz] = this.debugView as [number, number, number, number, number, number];
      this.cam.camera.position.set(x, y, z);
      this.cam.camera.setTarget(new Vector3(tx, ty, tz));
      this.world.followShadows(new Vector3(tx, 0, tz));
      this.world.update(dt);
      this.dayNight.update(dt);
      this.weather.update(dt, this.cam.camera.position);
      this.audio.setRain(this.weather.rain);
      this.crowd.update(dt, 1, this.cam.camera.position);
      return;
    }
    this.titleOrbit += dt * 0.05;
    const c = new Vector3(0, 2, -30);
    this.cam.camera.position.set(c.x + Math.sin(this.titleOrbit) * 14, 6 + Math.sin(this.titleOrbit * 0.7), c.z - 20 + Math.cos(this.titleOrbit) * 6);
    this.cam.camera.setTarget(c);
    this.world.followShadows(c);
    this.world.update(dt);
    this.dayNight.update(dt);
    this.crowd.update(dt, 1, this.cam.camera.position);
  }

  /** During dialogue: the world keeps animating gently but the sim is frozen. */
  private busyFrame(dt: number): void {
    this.world.update(dt);
    this.dayNight.update(dt);
    // Keep the rain's grey light on top of the time of day while a menu is open.
    this.weather.update(dt, this.cam.camera.position);
    this.crowd.update(dt, 1, this.cam.camera.position);
    this.player.animate(dt);
    this.objMarker.update(dt);
    this.updateBubbles();
    const v = this.driving ?? this.busRide?.run.car?.v ?? null;
    this.cam.update(dt, v ? v.model.root.position : this.player.human.root.position, v ? v.yaw : this.player.yaw, 0);
  }

  /**
   * T in free roam: make one of the street events happen right here, or go
   * to a naka or chowki — so each one can be seen without waiting for it.
   */
  private async tryEvents(): Promise<void> {
    const v = await this.dialogue("events", "Pick something to happen near you. (They also happen by themselves — see F1.)", [
      { label: "Nagar kirtan comes down the road", value: "p_kirtan" },
      { label: "Political rally with a loudspeaker jeep", value: "p_rally" },
      { label: "Baraat: dhol, bhangra, dulha on a ghodi", value: "p_baraat" },
      { label: "E-rickshaw tips over, passengers fall (39–42)", value: "tip" },
      { label: "Two vehicles crash, drivers argue (36, then police 33)", value: "crash" },
      { label: "Colony fight: two men, two women (35, 37, 38)", value: "colony" },
      { label: "Aunties quarrel in the street", value: "aunty" },
      { label: "Bapu ji and Bebe ji fall out in the gali", value: "elders" },
      { label: "Aunties gossiping at the gate (and it turns into a jhagda)", value: "gossip" },
      { label: "Police chase a speeder (31–33)", value: "chase" },
      { label: "Snake biker weaving in front of you (hit him!)", value: "snake" },
      { label: this.weather.raining ? "Stop the rain" : "Make it rain (baarish, flooded galis)", value: "rain" },
      { label: `Time of day (now ${this.dayNight.clock}): morning → noon → evening → night`, value: "time" },
      { label: "Go to the nearest police naka", value: "naka" },
      { label: "Go to the Ranggarh police chowki", value: "chowki" },
      { label: "Close", value: "x" },
    ]);
    this.runEvent(v);
  }

  /** Start an event by name; returns where it is happening (or null). */
  private runEvent(v: string): { x: number; z: number } | null {
    const p = this.playerPos();
    const fwd = this.cam.camera.getDirection(new Vector3(0, 0, 1));
    fwd.y = 0; fwd.normalize();
    const spot = (a: number, b: number) => this.traffic.roadSpot(p, a, b, fwd);
    const noRoad = () => this.ui.toast("Go stand near a road first.", "warn");
    switch (v) {
      case "tip": {
        const s = spot(18, 35);
        if (!s) { noRoad(); break; }
        const c = this.traffic.spawnCivil("erickshaw", s.x, s.z, s.yaw, 5);
        setTimeout(() => { if (this.traffic.cars.includes(c)) this.traffic.forceTip(c); }, 1800);
        return s;
      }
      case "ram": {
        // (Test only.) A car shunts a loaded e-rickshaw from behind.
        const s = spot(18, 35);
        if (!s) { noRoad(); break; }
        const c = this.traffic.spawnCivil("erickshaw", s.x, s.z, s.yaw, 5);
        c.ai.hold = true;
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        const car = this.traffic.spawnCivil("car", s.x - fx * 4.2, s.z - fz * 4.2, s.yaw);
        car.ai.hold = true;
        setTimeout(() => { car.v.body.setLinearVelocity(new Vector3(fx * 9, 0, fz * 9)); }, 1500);
        return s;
      }
      case "p_kirtan": case "p_rally": case "p_baraat": {
        const at = this.processions.start(v.slice(2) as ProcKind, p, true);
        if (!at) noRoad();
        return at;
      }
      case "crash": {
        const s = spot(22, 40);
        if (!s) { noRoad(); break; }
        const a = this.traffic.spawnCivil("car", s.x, s.z, s.yaw);
        const b = this.traffic.spawnCivil(Math.random() < 0.5 ? "jeep" : "car", s.x - Math.sin(s.yaw) * 7, s.z - Math.cos(s.yaw) * 7, s.yaw);
        setTimeout(() => { if (this.traffic.cars.includes(a) && this.traffic.cars.includes(b)) this.jhagde.crashPair(a, b); }, 1500);
        return s;
      }
      case "colony":
        if (this.driving || !this.jhagde.startColony(true)) this.ui.toast("Get off and walk somewhere with people around first.", "warn");
        break;
      case "elders": {
        const at = this.jhagde.stageElders(p);
        if (at) return { x: at.x, z: at.z };
        this.ui.toast("No one about to quarrel here — try a colony gali.", "warn");
        break;
      }
      case "gossip": {
        const at = this.gossip.force(p, fwd, true);
        if (at) return { x: at.x, z: at.z };
        this.ui.toast("No room here — try a colony gali.", "warn");
        break;
      }
      case "aunty": {
        const s = this.openSpot(p.x + fwd.x * 9, p.z + fwd.z * 9, 0, 6);
        if (s) { this.jhagde.stageAunties(s.x, s.z); return s; }
        this.ui.toast("No room here — try an open street.", "warn");
        break;
      }
      case "snake":
        this.traffic.forceSnake();
        this.ui.toast("A snake biker is coming. Get on a vehicle and knock him off!", "info");
        return null;
      case "chase":
        if (!this.traffic.forceChase(p, fwd)) noRoad();
        break;
      case "time": {
        const h = this.dayNight.hour;
        const next = h < 6 || h >= 21 ? 7 : h < 11 ? 13 : h < 16 ? 17.6 : 21.5;
        this.dayNight.set(next);
        this.ui.toast(`It is ${this.dayNight.clock} now.`, "info", 2500);
        break;
      }
      case "rain": {
        const on = !this.weather.raining;
        this.weather.setRain(on);
        this.ui.toast(on ? "Clouds are rolling in… Ludhiana's galis and the old colonies will flood in a minute or two." : "The rain is easing off. The water will take a while to drain.", "info", 4000);
        break;
      }
      case "naka":
      case "chowki": {
        if (this.driving) { this.ui.toast("Get off your vehicle first (E), then press T again.", "warn"); break; }
        const d = this.posts.nearest(p, v === "naka") ?? POSTS[0]!;
        const a = this.posts.approach(d);
        this.arriveAt(a.x, a.z, a.yaw);
        this.ui.toast(`${d.label}. Walk or drive up to it.`, "info");
        return { x: d.x, z: d.z };
      }
    }
    return null;
  }

  /** Roughly in front of the camera (spawning things out of sight). */
  private inView(x: number, z: number): boolean {
    const cam = this.cam.camera, f = cam.getDirection(Vector3.Forward());
    const dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1;
    return (dx * f.x + dz * f.z) / (d * (Math.hypot(f.x, f.z) || 1)) > 0.3;
  }

  /** Where the clock stood last time (kept per device, not in the save). */
  private savedHour(): number {
    const q = new URLSearchParams(location.search).get("hour");
    if (q && Number.isFinite(Number(q))) return Number(q);
    try { const h = Number(localStorage.getItem("gediroute.hour")); if (Number.isFinite(h) && h > 0) return h; } catch { /* private window */ }
    return 8.5;
  }

  /** Rain, wet roads and waterlogging: their effect on vehicles, walking and sound. */
  private updateWeather(dt: number): void {
    const w = this.weather, v = this.driving;
    const p = this.playerPos();
    w.update(dt, this.cam.camera.position, { pos: p, speed: v ? Math.abs(v.forwardSpeed) : this.player.speed });
    const grip = 1 - 0.18 * w.wet;
    for (const veh of this.vehicles) veh.wetGrip = grip;
    // Knee-deep water: wading is slow.
    const depth = v ? 0 : w.floodAt(p.x, p.z);
    this.wadeMul = depth > 0.05 ? Math.max(0.45, 1 - depth * 1.3) : 1;
    this.audio.setRain(w.rain);
    if (depth > 0.05 && !this.wadeToast) { this.wadeToast = true; this.ui.toast("Paani bhar gaya! The drains here are choked — knee-deep water.", "info", 3000); }
    if (depth < 0.01) this.wadeToast = false;
    this.rainTalk(dt, p);
  }

  /**
   * People react to the weather: as a downpour starts someone near you says
   * so (aunties caught without a chhatri, kapde on the roof), and in a flooded
   * gali an uncle curses the choked drains or an auto-wala refuses the ride.
   * A recorded line if the voice map has one switched on, else just the bubble.
   */
  private rainTalk(dt: number, p: Vector3): void {
    const w = this.weather;
    const pouring = w.rain > 0.35;
    if (pouring && !this.wasPouring) this.rainTalkT = 3 + Math.random() * 3;
    this.wasPouring = pouring;
    this.floodTalkT -= dt;
    let when: VoiceWhen | null = null;
    if (this.rainTalkT > 0 && (this.rainTalkT -= dt) <= 0) when = "rain-start";
    else if (this.floodTalkT <= 0 && w.flood > 0.3 && w.floodAt(p.x, p.z) + w.floodAt(p.x + 12, p.z) + w.floodAt(p.x - 12, p.z) + w.floodAt(p.x, p.z + 12) + w.floodAt(p.x, p.z - 12) > 0.05) {
      when = "flood"; this.floodTalkT = 45 + Math.random() * 30;
    }
    if (!when) return;
    let best: Resident | null = null, bd = 18;
    for (const r of this.crowd.residents) {
      if (r.contact || r.brain || r.pose === "down" || r.look.age === "child" || this.combat.fights.has(r)) continue;
      const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
      if (d < bd && this.canSee(r) && VoiceDirector.words(when, r)) { best = r; bd = d; }
    }
    if (!best) { if (when === "flood") this.floodTalkT = 8; return; }
    if (!this.speak(when, best)) { const say = VoiceDirector.words(when, best); if (say) this.crowd.say(best, say); }
  }
  private wasPouring = false;
  private rainTalkT = 0;
  private floodTalkT = 20;

  private wadeToast = false;
  /** Walking speed in standing water. */
  private wadeMul = 1;

  private playingFrame(dt: number): void {
    const inp = this.input;
    // ---- Edge-triggered actions (once per rendered frame).
    if (inp.wasPressed("pause")) { void this.pause(); return; }
    if (inp.wasPressed("help")) { this.setBusy(true); void this.ui.controls().then(() => this.setBusy(false)); return; }
    if (inp.wasPressed("map")) { this.setBusy(true); void this.openMap().then(() => this.setBusy(false)); return; }
    if (FREE_PLAY && inp.wasPressed("events")) { void this.tryEvents(); return; }
    if (inp.wasPressed("bag")) { void this.openBag(); return; }
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
    if (!this.driving && !this.busRide && inp.wasPressed("attack") && !this.carrying) this.combat.playerAttack();
    if (!this.driving && !this.busRide && inp.wasPressed("heavy") && !this.carrying) this.combat.playerAttack(true);
    else if (!this.driving && inp.wasPressed("attack") && this.carrying) this.ui.toast("Not with the tiffin in your hand!", "warn", 1200);
    if (this.combat.playerDown && this.player.down && this.combat.readyToWake) this.wakeUp();

    // ---- Snack/drink sprint boost.
    if (this.buff && this.time > this.buff.until) { this.buff = null; this.ui.toast("Your energy boost wore off."); }
    this.player.speedMul = (this.buff ? 1 + this.buff.mul : 1) * this.wadeMul;
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
    this.crowd.rain = this.weather.rain;
    // Nobody flies a patang in the dark: night grounds the kites like rain does.
    this.kites.update(dt, this.playerPos(), this.dayNight.isNight ? 1 : this.weather.rain);
    if (this.weather.rain < 0.3) this.gossip.update(dt, this.playerPos());
    this.home.update(dt);
    this.morning.update(dt, this.dayNight.hour, this.weather.rain, this.playerPos(), (x, z) => this.inView(x, z));
    // Gurbani from the gurdwaras' loudspeakers at amrit vela, aarti from the mandirs at dawn and dusk.
    for (const s of SHRINES) {
      const kind = s.kind === "gurdwara" ? "gurbani" : "aarti";
      const lvl = Morning.shrineLevel(kind, this.dayNight.hour);
      if (lvl > 0.02) this.audio.shrine(s.id, kind, new Vector3((s.x0 + s.x1) / 2, 0, (s.z0 + s.z1) / 2), lvl);
    }
    this.processions.update(dt, this.weather.rain, !this.busRide);
    this.traffic.update(dt, this.cam.camera.position);
    this.buses.update(dt, this.cam.camera.position);
    this.rides.update(dt);
    this.animals.update(dt, this.cam.camera.position);
    this.world.update(dt);
    this.dayNight.update(dt);

    // ---- Camera.
    const v = this.driving ?? this.busRide?.run.car?.v ?? null;
    if (!v) {
      const dh = footprint(building("w_dhaba"));
      const f = this.playerPos();
      this.cam.setMode(inRect(dh, f.x, f.z) || openHouseAt(f.x, f.z) ? "interior" : "foot");
    }
    this.cam.update(dt, v ? v.model.root.position : this.player.human.root.position, v ? v.yaw : this.player.yaw, v ? v.speed : this.player.speed);
    this.world.followShadows(this.playerPos());
    this.updateWeather(dt);
    this.ui.setClock(this.dayNight.clock, this.dayNight.isNight);
    this.hourSaveT -= dt;
    if (this.hourSaveT <= 0) { this.hourSaveT = 20; try { localStorage.setItem("gediroute.hour", this.dayNight.hour.toFixed(2)); } catch { /* ignore */ } }
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
      voice.set(rpm, veh.load, veh.hasDriver, veh.model.root.position, dt);
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
    this.buses.fixedUpdate(dt);
    this.updateBusRide();
    this.updateEating(dt);
    this.police.fixedUpdate(dt);
    this.jhagde.fixedUpdate(dt);
    this.posts.fixedUpdate(dt);
    this.animals.fixedUpdate(dt);
    this.updateFolk(dt);
    this.updateMeet(dt);
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
        // A loaded auto rammed by another vehicle (yours or anyone's) loses
        // its passengers. Sideways/fore-aft change only: speed breakers and
        // potholes jolt vertically and do not count.
        const dh = Math.hypot(lin.x - prev.x, lin.z - prev.z);
        if (dh > 2.0) {
          const c = this.traffic.find(v);
          const hitter = c && this.vehicles.find((o) => o !== v && Vector3.Distance(o.position, v.position) < o.spec.halfWidth + v.spec.halfWidth + 3.2);
          if (c && hitter) {
            const dir = new Vector3(lin.x - prev.x, 0, lin.z - prev.z).normalize();
            const landed = hitter === this.driving ? this.traffic.throwSnake(c, dir) : null;
            if (landed) this.snakeDown(landed, v);
            else this.traffic.knock(c, dir);
          }
        }
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
      if (upY < 0.5 && !v.wrecked && !this.flipped.has(v.id)) { this.flipped.add(v.id); this.counters.flips++; this.errors.push(`flip ${v.id} at ${v.position.x.toFixed(1)},${v.position.z.toFixed(1)} v=${v.forwardSpeed.toFixed(1)}`); }
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
    if (it.id === "brick") return "Brick";
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
      // A menu or dialogue is open: the bubble would sit on top of it.
      e.style.display = behind || far || this.state === "busy" ? "none" : "block";
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
      /**
       * Debug only (probe mode): drop the player somewhere. The one write on
       * this interface — it lets the audit harness sample every zone in one
       * session instead of booting the whole world per sample point.
       */
      event: (kind: string) => this.runEvent(kind),
      weather: (on: boolean, instant = true) => { this.weather.auto = false; this.weather.setRain(on, instant); },
      /** Debug only: where every bus is, and boarding one at its door without the fare menu. */
      buses: () => this.buses.runs.map((r) => { const w = this.buses.where(r); return { id: r.id, route: r.plan.route.id, leg: r.leg, real: !!r.car, x: Math.round(w.x), z: Math.round(w.z), yaw: r.car ? +r.car.v.yaw.toFixed(2) : null, dwell: +r.dwell.toFixed(1), stop: this.buses.atStop(r)?.id ?? null, speed: r.car ? +r.car.v.speed.toFixed(1) : null, door: r.car ? this.buses.door(r)!.asArray().map((n) => +n.toFixed(1)) : null, ahead: r.car ? Math.round(r.car.ai.clearAhead) : null, near: r.car ? [...this.crowd.residents.map((q) => ({ n: q.id, p: q.pos })), ...(this.animals?.animals ?? []).map((q) => ({ n: q.kind, p: q.pos })), ...this.vehicles.map((q) => ({ n: q.id, p: q.position }))].filter((o) => o.n !== r.id && Math.hypot(o.p.x - r.car!.v.position.x, o.p.z - r.car!.v.position.z) < 25).map((o) => `${o.n}@${o.p.x.toFixed(0)},${o.p.z.toFixed(0)}`) : null }; }),
      board: (id: string) => { const r = this.buses.runs.find((q) => q.id === id); const legs = r ? this.buses.ahead(r) : []; if (r?.car && legs.length) { this.sitInBus(r, legs[legs.length - 1]!); return true; } return false; },
      busWarp: (id: string, leg: number, sBack = 120) => { const r = this.buses.runs.find((q) => q.id === id); if (!r) return; this.buses.warp(r, leg, sBack); },
      busWaiters: () => this.buses.waiters(),
      /** Debug only: swing the camera round the player (radians), e.g. Math.PI to look at their face. */
      camYaw: (d: number) => { this.cam.yaw += d; },
      busRide: () => this.busRide ? { id: this.busRide.run.id, to: this.busRide.to, leg: this.busRide.run.leg } : null,
      /** Put the player on the nearest own vehicle of that type, placed at x,z facing yaw (driving tests). */
      driveAt: (type: string, x: number, z: number, yaw: number) => {
        if (this.state !== "playing" || this.driving) return false;
        const v = this.spawnVehicle({ id: `probe_${type}_${this.vehicles.length}`, type: type as VehicleType, x, y: 0.3, z, yaw, paint: "mint" });
        this.enterVehicle(v);
        return v.id;
      },
      /** The driven vehicle's state each call: position, tilt, rates (for ride-quality checks). */
      ride: () => {
        const v = this.driving;
        if (!v) return null;
        const up = v.dir(new Vector3(0, 1, 0)), f = v.dir(new Vector3(0, 0, 1));
        const a = v.body.getAngularVelocity(), l = v.body.getLinearVelocity();
        return { x: +v.position.x.toFixed(2), y: +v.position.y.toFixed(3), z: +v.position.z.toFixed(2), up: +up.y.toFixed(4), pitch: +f.y.toFixed(4), ang: +a.length().toFixed(3), vy: +l.y.toFixed(3), v: +v.forwardSpeed.toFixed(2), vis: +v.model.root.position.y.toFixed(3) };
      },
      teleport: (x: number, z: number, yaw = 0) => { if (this.state === "playing" && !this.driving) this.arriveAt(x, z, yaw); },
      /** Pick a fight with the nearest resident fitting `elder` (debug for fight voices). */
      fightNearest: (elder = true) => {
        const p = this.playerPos();
        const r = this.crowd.residents.filter((q) => !q.contact && !q.faction && q.pose !== "down" && (!elder || (q.look.age === "elder" && q.look.sex === "m")))
          .sort((a, b) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z))[0];
        if (!r) return null;
        this.arriveAt(r.pos.x + 2, r.pos.z, -Math.PI / 2);
        this.combat.engage(r, { side: "foe", target: "player" });
        return r.id;
      },
      /** `?voicelog` lines: why each voice line played or stayed silent. */
      voiceLog: () => this.voiceLogLines.slice(),
      /** Buy and eat a food item by id (any shop or cart). */
      eat: (id: string) => { const it = [...SHOPS, ...Object.values(REHRI_FOOD)].flatMap((q) => q.items).find((q) => q.id === id); if (it) this.buy(it); return !!it; },
      /** Open a shop's menu by keeper id. */
      bag: () => ({ ...this.save.bag }),
      kites: () => this.kites.state(),
      gossip: () => this.gossip.state(),
      morning: () => this.morning.state(),
      home: () => this.home.state(),
      /** Static-world raycast (debugging colliders): hit point and normal, or null. */
      ray: (x: number, y: number, z: number, x2: number, y2: number, z2: number) => {
        const h = this.physics.raycast(new Vector3(x, y, z), new Vector3(x2, y2, z2), Group.STATIC | Group.PROP);
        return h ? { p: [h.hitPointWorld.x, h.hitPointWorld.y, h.hitPointWorld.z].map((v) => +v.toFixed(2)), n: [h.hitNormalWorld.x, h.hitNormalWorld.y, h.hitNormalWorld.z].map((v) => +v.toFixed(2)) } : null;
      },
      homeAt: () => HOME && { gate: HOME.gate, bike: HOME.bike, sofaFront: HOME.sofaFront, tableSide: HOME.tableSide },
      hour: (h?: number) => { if (h !== undefined) this.dayNight.set(h); return this.dayNight.clock; },
      /** Start a procession near the player ("kirtan" | "rally" | "baraat"), or read its state. */
      procession: (kind: ProcKind) => this.processions.start(kind, this.playerPos(), true),
      /** Open houses (walk-in kothis), nearest first: door outside point and the inside. */
      openHouses: () => { const p = this.playerPos(); return OPEN_HOUSES.map((h) => ({ id: h.id, rot: h.rot, ox: h.ox, oz: h.oz, w: h.w, dd: h.d, yd: h.yd, talk: h.talk, host: h.host, rect: h.rect, gate: houseToWorld(h, h.w / 2, 0.8), d: Math.round(Math.hypot(h.talk.x - p.x, h.talk.z - p.z)) })).sort((a, b) => a.d - b.d); },
      procs: () => ({ ...(this.processions.state() as object), held: this.traffic.cars.filter((c) => c.ai.patient).map((c) => `${c.v.spec.type}~${c.v.speed.toFixed(1)}/${c.ai.clearAhead.toFixed(0)}`) }),
      procEnd: () => this.processions.end(true),
      pech: () => this.kites.forcePech(),
      openBag: () => { void this.openBag(); },
      cityShops: () => CITY_SHOPS.map((c) => ({ ...c })),
      buy: (id: string) => { const it = [...SHOPS, ...Object.values(TRADE), ...Object.values(REHRI_FOOD)].flatMap((q) => q.items).find((q) => q.id === id); if (it) this.buy(it); return !!it; },
      prompt: () => this.interaction?.label ?? null,
      shop: (keeper: string) => { const sh = SHOPS.find((q) => q.keeper === keeper); if (sh) void this.openStore(sh); },
      eating: () => this.eating ? { t: +this.eating.t.toFixed(1), hp: Math.round(this.combat.hp) } : null,
      /** Swing the camera round behind the player to face `yaw`. */
      face: (yaw: number) => this.cam.snapBehind(yaw, this.player.feet),
      snapshot: () => {
        const v = this.driving;
        const f = this.player?.feet;
        return {
          state: this.state,
          time: this.time,
          player: f ? { x: f.x, y: f.y, z: f.z, yaw: this.player.yaw, grounded: this.player.grounded, speed: this.player.speed, carrying: this.carrying } : null,
          camYaw: this.cam.yaw,
          weather: this.weather ? { rain: +this.weather.rain.toFixed(2), wet: +this.weather.wet.toFixed(2), flood: +this.weather.flood.toFixed(2), wade: f ? +this.weather.floodAt(f.x, f.z).toFixed(2) : 0 } : null,
          vehicle: v ? { id: v.id, type: v.spec.type, x: v.position.x, y: v.position.y, z: v.position.z, yaw: v.yaw, speed: v.forwardSpeed, upY: v.dir(new Vector3(0, 1, 0)).y } : null,
          vehicles: this.vehicles.map((x) => ({ id: x.id, x: x.position.x, y: x.position.y, z: x.position.z, yaw: x.yaw, paint: x.paint })),
          objective: this.missions ? (() => { const o = this.missions.objective(); return { title: o.title, detail: o.detail, target: o.target ? { x: o.target.x, y: o.target.y, z: o.target.z } : null }; })() : null,
          introStage: this.save?.introStage,
          money: this.save?.money,
          rep: this.save?.rep,
          job: this.missions?.job ? { dest: this.missions.job.dest.id, elapsed: this.missions.job.elapsed, condition: this.missions.job.condition, par: this.missions.job.par } : null,
          drivingType: this.driving?.spec.type ?? null,
          drivingSpeed: this.driving ? +this.driving.speed.toFixed(2) : null,
          prompt: this.interaction?.label ?? null,
          interactionId: this.interaction?.id ?? null,
          missionBusy: this.missions?.busy ?? null,
          route: this.route,
          bubbles: this.crowd.bubbles.map((b) => b.text),
          cameraPos: { x: this.cam.camera.position.x, y: this.cam.camera.position.y, z: this.cam.camera.position.z },
          dialogueOpen: this.ui.dialogueOpen,
          modalOpen: this.ui.modalOpen,
          fps: this.engine.getFps(),
          audio: { engines: this.voices.size, enginesRunning: [...this.voices.values()].filter((v) => v.running).length, oneShots: this.audio.oneShots, heard: this.audio.heard.splice(0), state: this.audio.ctx?.state, frameMs: this.engine.getDeltaTime() },
          drawCalls: this.instr.drawCallsCounter.current,
          frameTimeMs: this.instr.frameTimeCounter.lastSecAverage,
          activeMeshes: this.scene.getActiveMeshes().length,
          totalVertices: this.scene.getTotalVertices(),
          residents: this.crowd.residents.length,
          swimming: this.player.swimming,
          kit: this.crowd.kitInfo(),
          trees: this.world.treeCount,
          hp: this.combat.hp,
          playerDown: this.player.down,
          wanted: this.police.stars,
          fights: [...this.combat.fights.values()].filter((f) => f.side === "foe").length,
          traffic: this.traffic.cars.length,
          trafficTypes: this.traffic.cars.map((c) => `${c.v.spec.type}${c.riders?.length ? "+" + c.riders.length : ""}@${Math.round(c.v.position.x)},${Math.round(c.v.position.z)}~${c.v.speed.toFixed(1)}/${Math.min(99, Math.round(c.ai.clearAhead))}${(c.idleT ?? 0) > 6 ? "!" : ""}`),
          snakes: this.traffic.cars.filter((c) => c.snakeT !== undefined).map((c) => Math.round(Vector3.Distance(c.v.position, this.playerPos()))),
          trafficStopped: this.traffic.cars.filter((c) => c.v.speed < 0.5).length,
          // Stopped is normal (junctions, queues). Standing still for six
          // seconds is a car that has stopped being traffic.
          trafficWedged: this.traffic.cars.filter((c) => (c.idleT ?? 0) > 6).length,
          trafficNear: this.traffic.cars.filter((c) => Math.hypot(c.v.position.x - this.playerPos().x, c.v.position.z - this.playerPos().z) < 70).length,
          trafficIdleMax: Math.round(Math.max(0, ...this.traffic.cars.map((c) => c.idleT ?? 0))),
          patrols: this.traffic.cars.filter((c) => c.patrol).length,
          townTraffic: this.traffic.cars.filter((c) => Math.abs(c.v.position.x) < 30 && c.v.position.z > -76 && c.v.position.z < 52).length,
          constables: this.crowd.residents.filter((r) => r.faction === "police").length,
          vehicleCount: this.vehicles.length,
          animals: this.animals.animals.map((a) => a.kind),
          people: this.crowd.residents.filter((r) => Math.hypot(r.pos.x - this.playerPos().x, r.pos.z - this.playerPos().z) < 30).map((r) => ({ id: r.id, x: r.pos.x, y: +r.pos.y.toFixed(2), z: r.pos.z, pose: r.pose, role: r.role, faction: r.faction ?? "civilian", fight: this.combat.fights.get(r)?.side ?? null, hp: r.hp })),
          ride: this.rides.ride ? { drop: this.rides.ride.dropPoi, fare: this.rides.ride.fare, comfort: this.rides.ride.comfort } : null,
          stats: this.save?.stats,
          shadowCasters: this.world.casterCount,
          residentsStuck: this.crowd.residents.filter((r) => r.stuckCount > 0).length,
          clockDropped: this.clock.droppedTime,
          counters: this.counters,
          audioState: this.audio.ctx?.state ?? "none",
          hornCount: this.audio.hornCount,
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

