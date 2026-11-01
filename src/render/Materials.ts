import { Color3, DynamicTexture, PBRMaterial, Scene, Texture } from "../babylon";
import * as T from "./textures";
import { waterSky } from "./waterSky";

export type MatKey =
  | "plaster" | "brick" | "wood" | "shutter" | "fabric" | "asphalt" | "paver" | "dirt"
  | "leaf" | "concrete" | "metal" | "paint" | "glass" | "dark" | "rubber" | "chrome"
  | "skin" | "cloth" | "emissive" | "signs" | "interior" | "character" | "kit" | "matte" | "crop" | "water" | "grass" | "fieldCover" | "plant"
  | "tunyardBark" | "tunyardMoss" | "tunyardLeaves" | "tunyardGrass" | "tunyardNeedles"
  | "tunyardBenchPlanks" | "tunyardBenchWood"
  | "tunyardPickupCanvas" | "tunyardPickupIron" | "tunyardPickupPlate" | "tunyardPickupGlass"
  | "cottageCanvas" | "cottageIron" | "cottagePlanks" | "cottagePlaster"
  | "cottageShingles" | "cottageStone" | "cottageStoneWall" | "cottageWood"
  | "cornerRender" | "cornerConcrete" | "cornerPaintedMetal" | "cornerAluminium"
  | "cornerSign0" | "cornerSign1" | "cornerSign2" | "cornerStripes" | "cornerConcreteBase" | "cornerBrick"
  | "bungalowPalette" | "bungalowGlass" | "modernHousePalette" | "modernHouseGlass"
  | "sigRed0" | "sigAmber0" | "sigGreen0" | "sigRed1" | "sigAmber1" | "sigGreen1";

/**
 * Shared PBR material library. Every scenery mesh uses one of these, with
 * vertex colours providing per-piece tint. Keeping the set small lets the
 * district merge into a few dozen draw calls.
 */
export class Materials {
  private mats = new Map<MatKey, PBRMaterial>();
  readonly textures: Texture[] = [];

  constructor(private scene: Scene) {}

  private tex(name: string, c: HTMLCanvasElement, wrap = true): DynamicTexture {
    const t = new DynamicTexture(name, c, this.scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    if (wrap) {
      t.wrapU = Texture.WRAP_ADDRESSMODE;
      t.wrapV = Texture.WRAP_ADDRESSMODE;
    }
    t.anisotropicFilteringLevel = 16;
    t.update(false);
    this.textures.push(t);
    return t;
  }

  private make(key: MatKey, opts: { pair?: T.TexturePair; bump?: number; rough: number; metal?: number; albedo?: Color3; uvScale?: number }): PBRMaterial {
    const m = new PBRMaterial(`m_${key}`, this.scene);
    m.albedoColor = opts.albedo ?? Color3.White();
    m.metallic = opts.metal ?? 0;
    m.roughness = opts.rough;
    m.environmentIntensity = 0.6;
    m.directIntensity = 1.0;
    m.useRadianceOverAlpha = false;
    m.maxSimultaneousLights = 6;
    // No environment map is used, so skip the BRDF lookup texture (its async
    // load could keep newly compiled shader variants, e.g. instanced trees, waiting).
    m.environmentBRDFTexture = null;
    if (opts.pair) {
      m.albedoTexture = this.tex(`t_${key}`, opts.pair.albedo);
      if (opts.pair.height && opts.bump) {
        const nrm = this.tex(`n_${key}`, T.heightToNormal(opts.pair.height, opts.bump));
        m.bumpTexture = nrm;
        m.bumpTexture.level = 0.8;
      }
    }
    this.mats.set(key, m);
    return m;
  }

  init(): void {
    this.make("plaster", { pair: T.plasterTexture(), bump: 2.5, rough: 0.92 });
    this.make("brick", { pair: T.brickTexture(), bump: 3, rough: 0.9 });
    this.make("wood", { pair: T.woodTexture(), bump: 2, rough: 0.75 });
    this.make("shutter", { pair: T.shutterTexture(), bump: 4, rough: 0.55, metal: 0.35 });
    this.make("fabric", { pair: T.fabricTexture(), bump: 1.5, rough: 0.95 });
    this.make("asphalt", { pair: T.asphaltTexture(), bump: 2, rough: 0.95 });
    this.make("paver", { pair: T.paverTexture(), bump: 3, rough: 0.9 });
    this.make("dirt", { pair: T.dirtTexture(), bump: 2, rough: 1 });
    this.make("leaf", { pair: T.leafTexture(), bump: 3, rough: 0.8 });
    this.make("concrete", { pair: T.concreteTexture(), bump: 1.5, rough: 0.9 });
    this.make("crop", { pair: T.cropTexture(), bump: 2, rough: 0.9 });
    this.make("grass", { pair: T.turfTexture(), bump: 2.5, rough: 1 });
    this.make("fieldCover", { pair: T.fieldCoverTexture(), bump: 1.2, rough: 1 });
    // Crop plants: a cut-out atlas of stalks, ears, flowers and leaves, seen from both sides.
    const plant = this.make("plant", { rough: 1 });
    const pt = this.tex("t_plant", T.plantAtlas());
    pt.hasAlpha = true;
    plant.albedoTexture = pt;
    plant.useAlphaFromAlbedoTexture = true;
    plant.transparencyMode = 1; // alpha test
    plant.alphaCutOff = 0.45;
    plant.backFaceCulling = false;
    plant.twoSidedLighting = false;
    plant.environmentIntensity = 0.9;
    // Original Tunyard grass baked into a transparent, two-variant sprite so
    // the nearby meadow retains the existing crossed-card performance budget.
    const meadow = this.make("tunyardGrass", { rough: 1 });
    const grassAtlas = new Texture(`${import.meta.env.BASE_URL}tunyard/grass/tuft.png`, this.scene);
    grassAtlas.hasAlpha = true;
    grassAtlas.wrapU = Texture.CLAMP_ADDRESSMODE;
    grassAtlas.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.textures.push(grassAtlas);
    meadow.albedoTexture = grassAtlas;
    meadow.useAlphaFromAlbedoTexture = true;
    meadow.transparencyMode = 1;
    meadow.alphaCutOff = 0.32;
    meadow.backFaceCulling = false;
    meadow.twoSidedLighting = false;
    // The sprite already contains lighting from its bake. Add a little fill so
    // it doesn't become nearly black when the scene lights it a second time.
    meadow.emissiveTexture = grassAtlas;
    meadow.emissiveColor = new Color3(0.2, 0.2, 0.2);
    // Original Tunyard broadleaf textures, baked from the user's procedural
    // asset. Their geometry is batched with the rest of the world scenery.
    for (const [key, source] of [["tunyardBark", "bark"], ["tunyardMoss", "moss"], ["tunyardLeaves", "leaves"]] as const) {
      const m = this.make(key, { rough: source === "leaves" ? 0.7 : 0.92 });
      const albedo = new Texture(`${import.meta.env.BASE_URL}tunyard/tree/${source}-albedo.png`, this.scene);
      const normal = new Texture(`${import.meta.env.BASE_URL}tunyard/tree/${source}-normal.png`, this.scene);
      this.textures.push(albedo, normal);
      m.albedoTexture = albedo;
      m.bumpTexture = normal;
      if (source === "leaves") {
        albedo.hasAlpha = true;
        m.useAlphaFromAlbedoTexture = true;
        m.transparencyMode = 1;
        m.alphaCutOff = 0.5;
        m.backFaceCulling = false;
      }
    }
    // Snowy conifer branches use the author's transparent needle texture.
    const needles = this.make("tunyardNeedles", { rough: 0.85 });
    const needleAlbedo = new Texture(`${import.meta.env.BASE_URL}tunyard/pine/needles-albedo.png`, this.scene);
    const needleNormal = new Texture(`${import.meta.env.BASE_URL}tunyard/pine/needles-normal.png`, this.scene);
    this.textures.push(needleAlbedo, needleNormal);
    needleAlbedo.hasAlpha = true;
    needles.albedoTexture = needleAlbedo;
    needles.bumpTexture = needleNormal;
    needles.useAlphaFromAlbedoTexture = true;
    needles.transparencyMode = 1;
    needles.alphaCutOff = 0.5;
    needles.backFaceCulling = false;
    needles.twoSidedLighting = true;
    // Original material maps generated by Tunyard's cottage asset.
    for (const [key, source] of [["cottageCanvas", "canvas"], ["cottageIron", "iron"], ["cottagePlanks", "planks"], ["cottagePlaster", "plaster"], ["cottageShingles", "shingles"], ["cottageStone", "stone"], ["cottageStoneWall", "stoneWall"], ["cottageWood", "wood"]] as const) {
      const m = this.make(key, { rough: source === "iron" ? 0.5 : 0.86, metal: source === "iron" ? 0.3 : 0 });
      const albedo = new Texture(`${import.meta.env.BASE_URL}tunyard/cottage/${source}-albedo.png`, this.scene);
      const normal = new Texture(`${import.meta.env.BASE_URL}tunyard/cottage/${source}-normal.png`, this.scene);
      this.textures.push(albedo, normal);
      m.albedoTexture = albedo;
      m.bumpTexture = normal;
    }
    // Tunyard's authored corner shop, including each unique painted sign.
    // Materials that differ only by tint reuse one material and vertex colours.
    for (const [key, albedoId, normalId, rough, metal, twoSided] of [
      ["cornerRender", 0, 1, 0.93, 0, false],
      ["cornerConcrete", 2, 3, 0.9, 0, false],
      ["cornerPaintedMetal", 4, 5, 0.42, 0.35, true],
      ["cornerAluminium", 6, 7, 0.36, 0.85, false],
      ["cornerSign0", 8, null, 0.5, 0.05, false],
      ["cornerSign1", 9, null, 0.5, 0.05, false],
      ["cornerSign2", 12, null, 0.5, 0.05, false],
      ["cornerStripes", 13, 14, 0.92, 0, true],
      ["cornerConcreteBase", 15, 16, 0.92, 0, false],
      ["cornerBrick", 17, 18, 0.88, 0, false],
    ] as const) {
      const m = this.make(key, { rough, metal });
      const albedo = new Texture(`${import.meta.env.BASE_URL}tunyard/corner-shop/${albedoId}.png`, this.scene);
      this.textures.push(albedo);
      m.albedoTexture = albedo;
      if (normalId !== null) {
        const normal = new Texture(`${import.meta.env.BASE_URL}tunyard/corner-shop/${normalId}.png`, this.scene);
        this.textures.push(normal);
        m.bumpTexture = normal;
      }
      if (twoSided) m.backFaceCulling = false;
    }
    // The Tunyard low-poly bungalow uses one palette ramp for both finishes.
    // The source palette has narrow swatches and explicitly disables mipmaps;
    // mipmapping would blend neighbouring colors when the house is distant.
    const bungalowMap = new Texture(`${import.meta.env.BASE_URL}tunyard/bungalow/0.png`, this.scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
    bungalowMap.wrapU = bungalowMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.textures.push(bungalowMap);
    const bungalowPalette = this.make("bungalowPalette", { rough: 0.88 });
    bungalowPalette.albedoTexture = bungalowMap;
    const bungalowGlass = this.make("bungalowGlass", { rough: 0.08, metal: 0.2 });
    bungalowGlass.albedoTexture = bungalowMap;
    const modernHouseMap = new Texture(`${import.meta.env.BASE_URL}tunyard/modern-house/0.png`, this.scene, true, true, Texture.BILINEAR_SAMPLINGMODE);
    modernHouseMap.wrapU = modernHouseMap.wrapV = Texture.CLAMP_ADDRESSMODE;
    this.textures.push(modernHouseMap);
    const modernHousePalette = this.make("modernHousePalette", { rough: 0.88 });
    modernHousePalette.albedoTexture = modernHouseMap;
    const modernHouseGlass = this.make("modernHouseGlass", { rough: 0.08, metal: 0.2 });
    modernHouseGlass.albedoTexture = modernHouseMap;
    for (const [key, source] of [["tunyardBenchPlanks", "planks"], ["tunyardBenchWood", "wood"]] as const) {
      const m = this.make(key, { rough: 0.78 });
      const albedo = new Texture(`${import.meta.env.BASE_URL}tunyard/bench/${source}-albedo.png`, this.scene);
      const normal = new Texture(`${import.meta.env.BASE_URL}tunyard/bench/${source}-normal.png`, this.scene);
      this.textures.push(albedo, normal);
      m.albedoTexture = albedo;
      m.bumpTexture = normal;
    }
    // Original material maps baked with the Tunyard pickup; the glass keeps
    // its own translucency while the remaining surfaces share game materials.
    for (const [key, source, normalMap] of [["tunyardPickupCanvas", "canvas", true], ["tunyardPickupIron", "iron", true], ["tunyardPickupPlate", "carPlate", false]] as const) {
      const m = this.make(key, { rough: source === "iron" ? 0.5 : 0.85, metal: source === "iron" ? 0.3 : 0 });
      const albedo = new Texture(`${import.meta.env.BASE_URL}tunyard/pickup/${source}-albedo.png`, this.scene);
      this.textures.push(albedo);
      m.albedoTexture = albedo;
      if (normalMap) {
        const normal = new Texture(`${import.meta.env.BASE_URL}tunyard/pickup/${source}-normal.png`, this.scene);
        this.textures.push(normal);
        m.bumpTexture = normal;
      }
    }
    const pickupGlass = this.make("tunyardPickupGlass", { rough: 0.15 });
    pickupGlass.alpha = 0.62;
    // A tiny procedural sky cubemap supplies grazing-angle reflection without
    // rendering the world a second time. It affects water only.
    const water = this.make("water", { pair: T.waterTexture(), bump: 2, rough: 0.16 });
    water.reflectivityColor = new Color3(0.3, 0.34, 0.34);
    water.reflectionTexture = waterSky(this.scene);
    water.environmentIntensity = 0.7;
    this.make("metal", { rough: 0.45, metal: 0.6 });
    this.make("paint", { rough: 0.35, metal: 0.05 });
    this.make("matte", { rough: 0.85 });
    this.make("rubber", { rough: 0.9, albedo: new Color3(0.03, 0.03, 0.03) });
    this.make("chrome", { rough: 0.2, metal: 0.95 });
    this.make("skin", { rough: 0.65 });
    // The user's character kit: vertex-coloured, with single-layer cloth (dupattas).
    const kit = this.make("kit", { rough: 0.82 });
    kit.backFaceCulling = false;
    kit.sheen.isEnabled = true;
    kit.sheen.intensity = 0.12;
    const ch = this.make("character", { pair: T.characterTexture(), rough: 0.78 });
    (ch.albedoTexture as Texture).wrapU = Texture.CLAMP_ADDRESSMODE;
    ch.sheen.isEnabled = true;
    ch.sheen.intensity = 0.15;
    this.make("cloth", { pair: T.fabricTexture(), bump: 1, rough: 0.9 });
    // Interior surfaces get a little self-illumination to stand in for bounce light.
    const interior = this.make("interior", { pair: T.plasterTexture(), bump: 1.5, rough: 0.9 });
    interior.emissiveColor = new Color3(0.32, 0.27, 0.2);
    interior.emissiveTexture = interior.albedoTexture;
    const glass = this.make("glass", { rough: 0.1, metal: 0.1, albedo: new Color3(0.08, 0.1, 0.11) });
    glass.reflectivityColor = new Color3(0.4, 0.4, 0.4);
    this.make("dark", { rough: 0.95, albedo: new Color3(0.06, 0.05, 0.045) });
    // Signal lamps: two classes of junction, each with its own three, lit by the Signals system.
    for (const c of [0, 1]) {
      for (const [name, col] of [["Red", [1, 0.12, 0.08]], ["Amber", [1, 0.62, 0.05]], ["Green", [0.1, 1, 0.35]]] as const) {
        const m = this.make(`sig${name}${c}` as MatKey, { rough: 0.4, albedo: new Color3(col[0] * 0.3, col[1] * 0.3, col[2] * 0.3) });
        m.emissiveColor = new Color3(col[0], col[1], col[2]);
        m.emissiveIntensity = 0.08;
      }
    }
    const em = this.make("emissive", { rough: 0.5 });
    em.emissiveColor = new Color3(1, 0.95, 0.85);
    em.emissiveIntensity = 1.2;
  }

  get(key: MatKey): PBRMaterial {
    const m = this.mats.get(key);
    if (!m) throw new Error(`material ${key} not initialised`);
    return m;
  }

  register(key: MatKey, m: PBRMaterial): void {
    this.mats.set(key, m);
  }

  dispose(): void {
    for (const m of this.mats.values()) m.dispose(true, true);
    this.mats.clear();
  }
}
