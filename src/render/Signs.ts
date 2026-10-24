import { Color3, DynamicTexture, PBRMaterial, Scene, Texture } from "../babylon";

export interface SignDef {
  key: string;
  gurmukhi: string;
  english: string;
  sub?: string;
  bg: string;
  fg: string;
  accent: string;
  /** Slot aspect: wide shop board or square board. */
  shape: "wide" | "square" | "small";
  icon?: "cross" | "wheel" | "spanner" | "cup" | "fruit" | "needle" | "phone" | "sweet" | "coin" | "mail";
}

/** All signage text is original. Gurmukhi first, with a short English label. */
export const SIGNS: SignDef[] = [
  { key: "dhaba", gurmukhi: "ਭੋਲੇ ਦਾ ਢਾਬਾ", english: "BHOLE DA DHABA", sub: "Pure Veg · Tandoor · Lassi", bg: "#b3261e", fg: "#ffd34d", accent: "#fff3d6", shape: "wide", icon: "cup" },
  { key: "workshop", gurmukhi: "ਗੁਰਨਾਮ ਮੋਟਰ ਵਰਕਸ", english: "GURNAM MOTOR WORKS", sub: "Repairs · Puncture · Paint", bg: "#1f4e79", fg: "#ffffff", accent: "#ffcc33", shape: "wide", icon: "spanner" },
  { key: "cycle", gurmukhi: "ਸੋਹਲ ਸਾਈਕਲ ਸਟੋਰ", english: "SOHAL CYCLE STORE", sub: "Sales · Service · Spares", bg: "#f2c230", fg: "#1d2a5c", accent: "#c0392b", shape: "wide", icon: "wheel" },
  { key: "textile", gurmukhi: "ਕੱਪੜਾ ਘਰ", english: "KAPDA GHAR", sub: "Suits · Dupattas · Turbans", bg: "#6a1b5a", fg: "#ffe1f2", accent: "#f5b700", shape: "wide", icon: "needle" },
  { key: "sweets", gurmukhi: "ਮਿੱਠੀ ਹੱਟੀ", english: "MITHI HATTI", sub: "Pinni · Jalebi · Barfi", bg: "#ff8c1a", fg: "#4a1600", accent: "#ffffff", shape: "wide", icon: "sweet" },
  { key: "chemist", gurmukhi: "ਸਿਹਤ ਕੈਮਿਸਟ", english: "SEHAT CHEMIST", sub: "Medicines · 24 Hours", bg: "#ffffff", fg: "#0b7a3e", accent: "#0b7a3e", shape: "wide", icon: "cross" },
  { key: "kiryana", gurmukhi: "ਲਾਲੀ ਕਰਿਆਨਾ", english: "LALI GENERAL STORE", sub: "Atta · Dal · Ghee", bg: "#2e7d32", fg: "#fff8e1", accent: "#ffeb3b", shape: "wide" },
  { key: "fruit", gurmukhi: "ਤਾਜ਼ੇ ਫਲ ਸਬਜ਼ੀ", english: "PAMMI FRUIT & SABZI", sub: "Fresh Daily", bg: "#f7f1d0", fg: "#2f6b1f", accent: "#e65100", shape: "wide", icon: "fruit" },
  { key: "tailor", gurmukhi: "ਮਾਸਟਰ ਜੀ ਟੇਲਰ", english: "MASTERJI TAILORS", sub: "Kurta · Pajama · Alterations", bg: "#263238", fg: "#ffecb3", accent: "#ff7043", shape: "wide", icon: "needle" },
  { key: "hardware", gurmukhi: "ਢਿੱਲੋਂ ਹਾਰਡਵੇਅਰ", english: "DHILLON HARDWARE", sub: "Paints · Pipes · Tools", bg: "#e3e3e3", fg: "#b71c1c", accent: "#212121", shape: "wide", icon: "spanner" },
  { key: "phone", gurmukhi: "ਰੰਗਗੜ੍ਹ ਮੋਬਾਈਲ", english: "RANGGARH MOBILE", sub: "Recharge · Repair · Covers", bg: "#00838f", fg: "#ffffff", accent: "#ffeb3b", shape: "wide", icon: "phone" },
  { key: "gate", gurmukhi: "ਰੰਗਗੜ੍ਹ ਬਾਜ਼ਾਰ", english: "RANGGARH BAZAAR", sub: "Welcome · ਜੀ ਆਇਆਂ ਨੂੰ", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "mainSt", gurmukhi: "ਮੇਨ ਬਾਜ਼ਾਰ", english: "MAIN BAZAAR", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "lane3", gurmukhi: "ਗਲੀ ਨੰ. 3", english: "GALI No. 3 →", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "barrier", gurmukhi: "ਚੌਂਕ ਦੀ ਮੁਰੰਮਤ", english: "CHOWK UNDER REPAIR", bg: "#ffca28", fg: "#212121", accent: "#212121", shape: "small" },
  { key: "yardGate", gurmukhi: "ਲੋਡਿੰਗ ਯਾਰਡ", english: "LOADING YARD · CLOSED", bg: "#ffca28", fg: "#212121", accent: "#212121", shape: "small" },
  { key: "menu", gurmukhi: "ਮੀਨੂ", english: "MENU", bg: "#2b1d14", fg: "#ffe0a3", accent: "#ff9f43", shape: "square" },
  { key: "poster1", gurmukhi: "ਮੇਲਾ", english: "VAISAKHI MELA", sub: "Bhangra · Giddha · Kabaddi", bg: "#f9a825", fg: "#4a148c", accent: "#c62828", shape: "square" },
  { key: "poster2", gurmukhi: "ਕਬੱਡੀ ਕੱਪ", english: "KABADDI CUP", sub: "Ranggarh Ground · Sunday", bg: "#1565c0", fg: "#ffffff", accent: "#ffeb3b", shape: "square" },
  // ---- Open country and Nawan Shehar (all names fictional).
  { key: "sherDhaba", gurmukhi: "ਸ਼ੇਰ-ਏ-ਪੰਜਾਬ ਢਾਬਾ", english: "SHER-E-PUNJAB DHABA", sub: "Truckers Welcome · 24 Hours", bg: "#1b5e20", fg: "#ffeb3b", accent: "#ffffff", shape: "wide", icon: "cup" },
  { key: "phatak", gurmukhi: "ਰੇਲਵੇ ਫਾਟਕ", english: "RAILWAY CROSSING", sub: "Train aa rahi hai · Ruko", bg: "#ffffff", fg: "#b3261e", accent: "#b3261e", shape: "square" },
  { key: "petrol", gurmukhi: "ਪੰਜ ਆਬ ਫ਼ਿਊਲਜ਼", english: "PANJ AAB FUELS", sub: "Petrol · Diesel · Air", bg: "#1b8a5a", fg: "#ffffff", accent: "#f6d743", shape: "square" },
  { key: "busAdda", gurmukhi: "ਬੱਸ ਅੱਡਾ", english: "BUS ADDA · NAWAN SHEHAR", sub: "Ludhiana · Jalandhar · Amritsar", bg: "#0d47a1", fg: "#ffffff", accent: "#ffca28", shape: "wide" },
  { key: "ghantaGhar", gurmukhi: "ਘੰਟਾ ਘਰ ਚੌਂਕ", english: "GHANTA GHAR CHOWK", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "small" },
  { key: "mandi", gurmukhi: "ਅਨਾਜ ਮੰਡੀ", english: "ANAJ MANDI · GRAIN MARKET", sub: "Market Committee Nawan Shehar", bg: "#f5f0e1", fg: "#1b5e20", accent: "#bf360c", shape: "wide" },
  { key: "naka", gurmukhi: "ਪੁਲਿਸ ਨਾਕਾ", english: "POLICE NAKA · RUKO", sub: "Kaagaz tayyar rakho", bg: "#0d2b6b", fg: "#ffffff", accent: "#e53935", shape: "wide" },
  { key: "chowkiTown", gurmukhi: "ਪੁਲਿਸ ਚੌਕੀ", english: "POLICE CHOWKI", sub: "Ranggarh", bg: "#0d2b6b", fg: "#ffffff", accent: "#e53935", shape: "wide" },
  { key: "thana", gurmukhi: "ਪੁਲਿਸ ਚੌਕੀ", english: "POLICE CHOWKI", sub: "Nawan Shehar", bg: "#0d2b6b", fg: "#ffffff", accent: "#e53935", shape: "wide" },
  { key: "cinemaPoster", gurmukhi: "ਸਰਦਾਰ ਸੁਪਰਸਟਾਰ", english: "SARDAR SUPERSTAR", sub: "Raj Talkies · Now Showing · 3 Shows Daily", bg: "#4a148c", fg: "#ffd54f", accent: "#ff4081", shape: "wide" },
  { key: "akhada", gurmukhi: "ਕੋਟਲੀ ਅਖਾੜਾ", english: "KOTLI AKHADA · DANGAL", bg: "#e65100", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "kotliRoad", gurmukhi: "ਕੋਟਲੀ ਰੋਡ", english: "KOTLI ROAD · NEHAR", sub: "Pind Kotli 4 km →", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "wide" },
  { key: "pindKotli", gurmukhi: "ਪਿੰਡ ਕੋਟਲੀ", english: "PIND KOTLI · WELCOME", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "toBazaar", gurmukhi: "ਰੰਗਗੜ੍ਹ ਬਾਜ਼ਾਰ ↑", english: "RANGGARH BAZAAR ↑", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "toCity", gurmukhi: "ਨਵਾਂ ਸ਼ਹਿਰ →", english: "NAWAN SHEHAR →", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "toKotli", gurmukhi: "ਪਿੰਡ ਕੋਟਲੀ ↑", english: "PIND KOTLI ↑ · NEHAR", bg: "#1b5e20", fg: "#ffffff", accent: "#ffffff", shape: "small" },
  { key: "hornOk", gurmukhi: "ਹਾਰਨ ਓਕੇ ਪਲੀਜ਼", english: "HORN OK PLEASE", bg: "#ffeb3b", fg: "#c62828", accent: "#1565c0", shape: "small" },
  { key: "school", gurmukhi: "ਸਰਕਾਰੀ ਸੀਨੀਅਰ ਸੈਕੰਡਰੀ ਸਕੂਲ", english: "GOVT. SENIOR SECONDARY SCHOOL", sub: "Nawan Shehar · Vidya Daan", bg: "#0d47a1", fg: "#ffffff", accent: "#ffca28", shape: "wide" },
  { key: "hospital", gurmukhi: "ਸਿਵਲ ਹਸਪਤਾਲ", english: "CIVIL HOSPITAL", sub: "Emergency 24 Hours · OPD 8–2", bg: "#ffffff", fg: "#c62828", accent: "#c62828", shape: "wide", icon: "cross" },
  // Colony and village welcome arches.
  { key: "gGnn", gurmukhi: "ਗੁਰੂ ਨਾਨਕ ਨਗਰ", english: "GURU NANAK NAGAR", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gSant", gurmukhi: "ਸੰਤ ਨਗਰ", english: "SANT NAGAR", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gModel", gurmukhi: "ਮਾਡਲ ਟਾਊਨ", english: "MODEL TOWN", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gEstate", gurmukhi: "ਅਰਬਨ ਅਸਟੇਟ", english: "URBAN ESTATE", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gSarabha", gurmukhi: "ਸਰਾਭਾ ਨਗਰ", english: "SARABHA NAGAR", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gKitchlu", gurmukhi: "ਕਿਚਲੂ ਨਗਰ", english: "KITCHLU NAGAR", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gKotli", gurmukhi: "ਪਿੰਡ ਕੋਟਲੀ", english: "PIND KOTLI", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gDhaliwal", gurmukhi: "ਪਿੰਡ ਧਾਲੀਵਾਲ", english: "PIND DHALIWAL", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "gBhangu", gurmukhi: "ਪਿੰਡ ਭੰਗੂ", english: "PIND BHANGU", sub: "ਜੀ ਆਇਆਂ ਨੂੰ · Welcome", bg: "#7b1f1f", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  // Ludhiana's own trades: hosiery and knitwear ("India's Manchester"), the
  // cycle industry, and the cloth market of Chaura Bazaar.
  { key: "lHosiery", gurmukhi: "ਸ਼ਰਮਾ ਹੌਜ਼ਰੀ", english: "SHARMA HOSIERY", sub: "Woollen · Inner · Export Surplus", bg: "#00695c", fg: "#ffffff", accent: "#ffd54f", shape: "wide", icon: "needle" },
  { key: "lKnit", gurmukhi: "ਪੰਜਾਬ ਨਿੱਟਵੀਅਰ", english: "PUNJAB KNITWEAR", sub: "Sweaters · Lower · T-Shirt", bg: "#ad1457", fg: "#ffffff", accent: "#fff59d", shape: "wide", icon: "needle" },
  { key: "lCycle", gurmukhi: "ਨਿਊ ਹੀਰੋ ਸਾਈਕਲ ਸਟੋਰ", english: "NEW HERO CYCLE STORE", sub: "Parts · Repair · Rickshaw", bg: "#1565c0", fg: "#ffffff", accent: "#ff6f00", shape: "wide", icon: "wheel" },
  { key: "lShawl", gurmukhi: "ਚੌੜਾ ਬਜ਼ਾਰ ਸ਼ਾਲ ਘਰ", english: "CHAURA BAZAAR SHAWL GHAR", sub: "Pashmina · Loi · Khes", bg: "#6a1b9a", fg: "#ffe082", accent: "#ffe082", shape: "wide" },
  { key: "lMachine", gurmukhi: "ਗਿੱਲ ਮਸ਼ੀਨ ਟੂਲਜ਼", english: "GILL MACHINE TOOLS", sub: "Hosiery Machinery · Spares", bg: "#37474f", fg: "#ffeb3b", accent: "#ffffff", shape: "wide" },
  { key: "cMithai", gurmukhi: "ਖੁਰਾਣਾ ਮਿਠਾਈ ਭੰਡਾਰ", english: "KHURANA MITHAI BHANDAR", sub: "Since 1971", bg: "#ff6f00", fg: "#ffffff", accent: "#fff3e0", shape: "wide", icon: "sweet" },
  { key: "cBank", gurmukhi: "ਪੰਜ ਆਬ ਬੈਂਕ", english: "PANJ AAB BANK", sub: "Savings · Loans · Locker", bg: "#0d47a1", fg: "#ffffff", accent: "#ffd54f", shape: "wide", icon: "coin" },
  { key: "cAtm", gurmukhi: "ਏ.ਟੀ.ਐਮ.", english: "ATM", sub: "Panj Aab Bank · 24 hours", bg: "#1565c0", fg: "#ffffff", accent: "#ffeb3b", shape: "wide", icon: "coin" },
  { key: "cPost", gurmukhi: "ਡਾਕ ਘਰ", english: "DAK GHAR · POST OFFICE", sub: "Speed Post · Money Order · Savings", bg: "#c62828", fg: "#fff3e0", accent: "#ffeb3b", shape: "wide", icon: "mail" },
  { key: "cMobile", gurmukhi: "ਹੈਲੋ ਮੋਬਾਈਲ ਜ਼ੋਨ", english: "HELLO MOBILE ZONE", sub: "Sales · Repair · Recharge", bg: "#d81b60", fg: "#ffffff", accent: "#ffeb3b", shape: "wide", icon: "phone" },
  { key: "cCloth", gurmukhi: "ਪੰਜਾਬ ਕਲਾਥ ਹਾਊਸ", english: "PUNJAB CLOTH HOUSE", sub: "Suits · Shirting · Phulkari", bg: "#4527a0", fg: "#ffffff", accent: "#ffc107", shape: "wide", icon: "needle" },
  { key: "cElectro", gurmukhi: "ਲੱਕੀ ਇਲੈਕਟ੍ਰਾਨਿਕਸ", english: "LUCKY ELECTRONICS", sub: "Coolers · Fans · TV", bg: "#0277bd", fg: "#ffffff", accent: "#ffeb3b", shape: "wide" },
  { key: "cJewel", gurmukhi: "ਸੋਨਾ ਜਿਊਲਰਜ਼", english: "SONA JEWELLERS", sub: "Hallmark Gold", bg: "#3e2723", fg: "#ffd54f", accent: "#ffd54f", shape: "wide" },
  { key: "cTyre", gurmukhi: "ਸਿੰਘ ਟਾਇਰ ਹਾਊਸ", english: "SINGH TYRE HOUSE", sub: "Tractor · Truck · Car", bg: "#212121", fg: "#ffeb3b", accent: "#ffffff", shape: "wide", icon: "wheel" },
  { key: "cHotel", gurmukhi: "ਹੋਟਲ ਮਹਾਰਾਜਾ", english: "HOTEL MAHARAJA", sub: "AC Rooms · Family Restaurant", bg: "#880e4f", fg: "#ffe082", accent: "#ffe082", shape: "wide" },
  { key: "cLassi", gurmukhi: "ਮਲਾਈ ਲੱਸੀ ਕਾਰਨਰ", english: "MALAI LASSI CORNER", sub: "Pedha Lassi · Kulfi", bg: "#fff8e1", fg: "#e65100", accent: "#2e7d32", shape: "wide", icon: "cup" },
  { key: "cDhaba", gurmukhi: "ਪਹਿਲਵਾਨ ਢਾਬਾ", english: "PEHLWAN DHABA", sub: "Desi Ghee Special", bg: "#bf360c", fg: "#fff3e0", accent: "#ffeb3b", shape: "wide", icon: "cup" },
  { key: "cMedical", gurmukhi: "ਜੀਵਨ ਮੈਡੀਕਲ ਹਾਲ", english: "JEEVAN MEDICAL HALL", sub: "Chemists · Druggists", bg: "#ffffff", fg: "#1565c0", accent: "#c62828", shape: "wide", icon: "cross" },
  { key: "cBooks", gurmukhi: "ਵਿਦਿਆ ਬੁੱਕ ਡਿਪੂ", english: "VIDYA BOOK DEPOT", sub: "Stationery · Photostat", bg: "#2e7d32", fg: "#ffffff", accent: "#ffeb3b", shape: "wide" },
  { key: "cSalon", gurmukhi: "ਸਟਾਈਲ ਹੇਅਰ ਸੈਲੂਨ", english: "STYLE HAIR SALOON", sub: "Gents · Shave · Massage", bg: "#37474f", fg: "#80deea", accent: "#ffffff", shape: "wide" },
];

const SIZE = 2048;
const SLOT = { wide: [640, 140], square: [384, 384], small: [448, 112] } as const;
/** Shelf-pack every sign (tallest first); returns slot positions and the atlas height (a power of two). */
function packSigns(): { pos: Map<string, [number, number]>; H: number } {
  const order = [...SIGNS].sort((a, b) => SLOT[b.shape][1] - SLOT[a.shape][1]);
  const rows: Array<{ y: number; h: number; x: number }> = [];
  const pos = new Map<string, [number, number]>();
  let top = 0;
  for (const s of order) {
    const [w, h] = SLOT[s.shape];
    let row = rows.find((r) => r.h >= h && r.x + w <= SIZE);
    if (!row) { row = { y: top, h, x: 0 }; rows.push(row); top += h; }
    pos.set(s.key, [row.x, row.y]);
    row.x += w;
  }
  let H = 512;
  while (H < top) H *= 2;
  return { pos, H };
}

/** UV rectangle (Babylon convention, v up). */
export interface Uv { u0: number; v0: number; u1: number; v1: number; aspect: number }

/**
 * Packs every sign into one atlas texture so all signage shares one material.
 */
export class SignAtlas {
  readonly uvs = new Map<string, Uv>();
  material!: PBRMaterial;

  build(scene: Scene): void {
    const canvas = document.createElement("canvas");
    const { pos, H } = packSigns();
    canvas.width = SIZE;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, SIZE, H);
    for (const s of SIGNS) {
      const [w, h] = SLOT[s.shape];
      const [x, y] = pos.get(s.key)!;
      this.draw(ctx, s, x, y, w, h);
      // Inset slightly to avoid bleeding between neighbours under mipmapping.
      const i = 3;
      this.uvs.set(s.key, { u0: (x + i) / SIZE, u1: (x + w - i) / SIZE, v0: 1 - (y + h - i) / H, v1: 1 - (y + i) / H, aspect: w / h });
    }
    const tex = new DynamicTexture("signAtlas", canvas, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
    tex.anisotropicFilteringLevel = 8;
    tex.update(true);
    const m = new PBRMaterial("m_signs", scene);
    m.environmentBRDFTexture = null;
    m.albedoTexture = tex;
    m.emissiveTexture = tex;
    m.emissiveColor = new Color3(0.22, 0.2, 0.18);
    m.roughness = 0.6;
    m.metallic = 0;
    this.material = m;
  }

  get(key: string): Uv {
    const uv = this.uvs.get(key);
    if (!uv) throw new Error(`no sign ${key}`);
    return uv;
  }

  private fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxPx: number): number {
    let px = maxPx;
    ctx.font = font(px);
    while (ctx.measureText(text).width > maxW && px > 8) {
      px -= 2;
      ctx.font = font(px);
    }
    return px;
  }

  private draw(ctx: CanvasRenderingContext2D, s: SignDef, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.translate(x, y);
    // Painted board with a weathered border.
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(255,255,255,0.10)");
    grad.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = Math.max(4, h * 0.035);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const gur = (px: number) => `700 ${px}px "Baloo Paaji 2", "Noto Sans Gurmukhi", sans-serif`;
    const lat = (px: number) => `800 ${px}px "Baloo Paaji 2", sans-serif`;
    const iconSpace = s.icon && s.shape === "wide" ? h * 0.9 : 0;
    const cx = (w + iconSpace) / 2;
    const avail = w - iconSpace - w * 0.08;
    if (s.key === "menu") {
      this.menu(ctx, s, w, h);
    } else if (s.shape === "wide") {
      ctx.fillStyle = s.fg;
      this.fit(ctx, s.gurmukhi, gur, avail, h * 0.46);
      ctx.fillText(s.gurmukhi, cx, h * 0.36);
      this.fit(ctx, s.english, lat, avail, h * 0.22);
      ctx.fillText(s.english, cx, h * 0.68);
      if (s.sub) {
        ctx.fillStyle = s.accent;
        ctx.font = `600 ${Math.round(h * 0.1)}px "Baloo Paaji 2", sans-serif`;
        ctx.fillText(s.sub, cx, h * 0.87);
      }
      if (s.icon) this.icon(ctx, s, h * 0.5, h * 0.5, h * 0.32);
    } else if (s.shape === "small") {
      ctx.fillStyle = s.fg;
      this.fit(ctx, s.gurmukhi, gur, w * 0.9, h * 0.42);
      ctx.fillText(s.gurmukhi, w / 2, h * 0.36);
      this.fit(ctx, s.english, lat, w * 0.9, h * 0.26);
      ctx.fillText(s.english, w / 2, h * 0.74);
    } else {
      ctx.fillStyle = s.fg;
      this.fit(ctx, s.gurmukhi, gur, w * 0.85, h * 0.28);
      ctx.fillText(s.gurmukhi, w / 2, h * 0.3);
      this.fit(ctx, s.english, lat, w * 0.85, h * 0.12);
      ctx.fillText(s.english, w / 2, h * 0.55);
      if (s.sub) {
        ctx.fillStyle = s.accent;
        this.fit(ctx, s.sub, lat, w * 0.85, h * 0.07);
        ctx.fillText(s.sub, w / 2, h * 0.72);
      }
      ctx.fillStyle = s.accent;
      for (let i = 0; i < 9; i++) ctx.fillRect(w * 0.1 + i * w * 0.09, h * 0.84, w * 0.05, h * 0.05);
    }
    ctx.restore();
  }

  private menu(ctx: CanvasRenderingContext2D, s: SignDef, w: number, h: number): void {
    ctx.fillStyle = s.fg;
    ctx.font = `700 ${h * 0.12}px "Baloo Paaji 2", sans-serif`;
    ctx.fillText("ਮੀਨੂ · MENU", w / 2, h * 0.11);
    const items: Array<[string, string, string]> = [
      ["ਦਾਲ ਮੱਖਣੀ", "Dal Makhani", "₹120"],
      ["ਸਰ੍ਹੋਂ ਦਾ ਸਾਗ", "Sarson Saag", "₹140"],
      ["ਮੱਕੀ ਦੀ ਰੋਟੀ", "Makki Roti", "₹25"],
      ["ਆਲੂ ਪਰੌਂਠਾ", "Aloo Paratha", "₹50"],
      ["ਲੱਸੀ", "Lassi", "₹60"],
      ["ਚਾਹ", "Chai", "₹15"],
    ];
    items.forEach(([g, e, p], i) => {
      const yy = h * (0.25 + i * 0.12);
      ctx.textAlign = "left";
      ctx.fillStyle = s.fg;
      ctx.font = `600 ${h * 0.055}px "Baloo Paaji 2", sans-serif`;
      ctx.fillText(g, w * 0.07, yy);
      ctx.fillStyle = "#e9c48a";
      ctx.font = `500 ${h * 0.04}px "Baloo Paaji 2", sans-serif`;
      ctx.fillText(e, w * 0.07, yy + h * 0.045);
      ctx.textAlign = "right";
      ctx.fillStyle = s.accent;
      ctx.font = `700 ${h * 0.06}px "Baloo Paaji 2", sans-serif`;
      ctx.fillText(p, w * 0.93, yy + h * 0.02);
    });
    ctx.textAlign = "center";
  }

  private icon(ctx: CanvasRenderingContext2D, s: SignDef, cx: number, cy: number, r: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = s.accent;
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    switch (s.icon) {
      case "cross":
        ctx.fillRect(-r * 0.25, -r * 0.8, r * 0.5, r * 1.6);
        ctx.fillRect(-r * 0.8, -r * 0.25, r * 1.6, r * 0.5);
        break;
      case "wheel":
        ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 8; i++) {
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(i * 0.785) * r * 0.8, Math.sin(i * 0.785) * r * 0.8);
          ctx.lineWidth = r * 0.05; ctx.stroke();
        }
        break;
      case "spanner":
        ctx.rotate(-0.7);
        ctx.fillRect(-r * 0.12, -r * 0.7, r * 0.24, r * 1.4);
        ctx.beginPath(); ctx.arc(0, -r * 0.75, r * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = s.bg; ctx.fillRect(-r * 0.1, -r * 1.1, r * 0.2, r * 0.4);
        break;
      case "cup":
        ctx.fillRect(-r * 0.5, -r * 0.4, r * 0.8, r * 0.9);
        ctx.beginPath(); ctx.arc(r * 0.35, 0, r * 0.25, -1.4, 1.4); ctx.stroke();
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.25 - r * 0.1, -r * 0.55); ctx.quadraticCurveTo(i * r * 0.25, -r * 0.8, i * r * 0.25 - r * 0.1, -r * 1.0); ctx.lineWidth = r * 0.07; ctx.stroke(); }
        break;
      case "fruit":
        ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2e7d32"; ctx.beginPath(); ctx.ellipse(r * 0.25, -r * 0.6, r * 0.3, r * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
        break;
      case "needle":
        ctx.rotate(0.6);
        ctx.fillRect(-r * 0.06, -r * 0.9, r * 0.12, r * 1.8);
        ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.5, 0.3, 2.6); ctx.lineWidth = r * 0.06; ctx.stroke();
        break;
      case "phone":
        ctx.fillRect(-r * 0.4, -r * 0.75, r * 0.8, r * 1.5);
        ctx.fillStyle = s.bg; ctx.fillRect(-r * 0.3, -r * 0.6, r * 0.6, r * 1.05);
        break;
      case "coin":
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.lineWidth = r * 0.12; ctx.stroke();
        ctx.font = `800 ${Math.round(r * 1.1)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("₹", 0, r * 0.05);
        break;
      case "mail":
        ctx.fillRect(-r * 0.8, -r * 0.5, r * 1.6, r * 1.0);
        ctx.strokeStyle = s.bg; ctx.lineWidth = r * 0.1;
        ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.5); ctx.lineTo(0, r * 0.1); ctx.lineTo(r * 0.8, -r * 0.5); ctx.stroke();
        break;
      case "sweet":
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * 0.45 + i * r * 0.45, r * 0.1 - (i % 2) * r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fill(); }
        break;
    }
    ctx.restore();
  }
}
