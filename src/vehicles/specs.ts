/** Data describing each vehicle's dimensions and handling. Local frame: +Z forward, origin on the ground at the body centre. */
export const VEHICLE_TYPES = ["scooter", "auto", "bicycle", "motorcycle", "car", "jeep", "tractor", "truck"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface WheelSpec { x: number; y: number; z: number; r: number; steer: boolean; drive: boolean }
export interface BoxSpec { c: [number, number, number]; s: [number, number, number] }

export interface VehicleSpec {
  type: VehicleType;
  label: string;
  mass: number;
  com: [number, number, number];
  colliders: BoxSpec[];
  wheels: WheelSpec[];
  suspRest: number;
  suspK: number;
  suspC: number;
  engineForce: number;
  maxSpeed: number;
  reverseMax: number;
  brakeForce: number;
  steerMax: number;
  steerRate: number;
  /** Fraction of lateral slip removed per step (grip). */
  grip: number;
  twoWheeler: boolean;
  wheelbase: number;
  /** Seat: where the rider's hip joint sits, local. */
  seat: [number, number, number];
  pose: "ride" | "drive";
  halfWidth: number;
  /** Where carried cargo sits (rack). */
  rack: [number, number, number];
  camera: "twoWheeler" | "car";
  hornHz: [number, number];
  /** Engine sound; null for pedal power. */
  engine: { idle: number; top: number; pulse: number; tone: number } | null;
  /** Steering-wheel vehicles turn the wheel further than the road wheels. */
  steerVisual?: number;
  /** Bicycles ring a bell instead of a horn. */
  bell?: boolean;
  defaultPaint: string;
}

export const SPECS: Record<VehicleType, VehicleSpec> = {
  scooter: {
    type: "scooter", label: "Scooter", mass: 120, com: [0, 0.48, -0.05],
    colliders: [
      { c: [0, 0.56, -0.12], s: [0.56, 0.56, 1.5] },
      { c: [0, 0.92, 0.42], s: [0.5, 0.36, 0.22] },
    ],
    wheels: [
      { x: 0, y: 0.58, z: 0.62, r: 0.225, steer: true, drive: false },
      { x: 0, y: 0.58, z: -0.62, r: 0.225, steer: false, drive: true },
    ],
    suspRest: 0.36, suspK: 14000, suspC: 1500,
    engineForce: 1450, maxSpeed: 16, reverseMax: 2.4, brakeForce: 2400, steerMax: 0.5, steerRate: 3.2, grip: 0.55,
    twoWheeler: true, wheelbase: 1.24, seat: [0, 0.86, -0.3], pose: "ride", halfWidth: 0.4, rack: [0, 0.9, -0.86],
    camera: "twoWheeler", hornHz: [440, 554], engine: { idle: 22, top: 95, pulse: 0.35, tone: 1600 }, defaultPaint: "mint",
  },
  auto: {
    type: "auto", label: "Auto-rickshaw", mass: 420, com: [0, 0.5, -0.25],
    colliders: [
      { c: [0, 0.62, -0.12], s: [1.24, 0.72, 2.5] },
      { c: [0, 1.38, -0.3], s: [1.26, 0.8, 1.9] },
      { c: [0, 1.15, 0.95], s: [0.7, 0.5, 0.35] },
    ],
    wheels: [
      { x: 0, y: 0.56, z: 1.0, r: 0.21, steer: true, drive: false },
      { x: -0.56, y: 0.56, z: -0.95, r: 0.21, steer: false, drive: true },
      { x: 0.56, y: 0.56, z: -0.95, r: 0.21, steer: false, drive: true },
    ],
    suspRest: 0.36, suspK: 26000, suspC: 3200,
    engineForce: 2600, maxSpeed: 13.5, reverseMax: 3.5, brakeForce: 5200, steerMax: 0.62, steerRate: 2.2, grip: 0.5,
    twoWheeler: false, wheelbase: 1.95, seat: [0, 0.78, 0.3], pose: "drive", halfWidth: 0.68, rack: [0, 0.78, -0.45],
    camera: "car", hornHz: [330, 392], engine: { idle: 15, top: 55, pulse: 0.65, tone: 900 }, defaultPaint: "cng",
  },
  bicycle: {
    type: "bicycle", label: "Bicycle", mass: 18, com: [0, 0.62, 0],
    colliders: [{ c: [0, 0.62, 0], s: [0.36, 0.5, 1.5] }],
    wheels: [
      { x: 0, y: 0.64, z: 0.53, r: 0.34, steer: true, drive: false },
      { x: 0, y: 0.64, z: -0.53, r: 0.34, steer: false, drive: true },
    ],
    suspRest: 0.3, suspK: 6000, suspC: 600,
    engineForce: 520, maxSpeed: 7.5, reverseMax: 1.2, brakeForce: 900, steerMax: 0.6, steerRate: 3.4, grip: 0.6,
    twoWheeler: true, wheelbase: 1.06, seat: [0, 1.02, -0.26], pose: "ride", halfWidth: 0.3, rack: [0, 0.95, -0.55],
    camera: "twoWheeler", hornHz: [2350, 4120], engine: null, bell: true, defaultPaint: "black",
  },
  motorcycle: {
    type: "motorcycle", label: "Motorcycle", mass: 190, com: [0, 0.55, 0],
    colliders: [
      { c: [0, 0.6, 0], s: [0.5, 0.55, 1.9] },
      { c: [0, 0.98, 0.25], s: [0.42, 0.25, 0.6] },
    ],
    wheels: [
      { x: 0, y: 0.66, z: 0.72, r: 0.32, steer: true, drive: false },
      { x: 0, y: 0.66, z: -0.7, r: 0.32, steer: false, drive: true },
    ],
    suspRest: 0.34, suspK: 17000, suspC: 1900,
    engineForce: 2700, maxSpeed: 25, reverseMax: 1.8, brakeForce: 3400, steerMax: 0.42, steerRate: 3.0, grip: 0.6,
    twoWheeler: true, wheelbase: 1.42, seat: [0, 0.9, -0.25], pose: "ride", halfWidth: 0.42, rack: [0, 0.95, -0.85],
    camera: "twoWheeler", hornHz: [400, 500], engine: { idle: 13, top: 70, pulse: 0.85, tone: 650 }, defaultPaint: "black",
  },
  car: {
    type: "car", label: "Hatchback car", mass: 820, com: [0, 0.45, 0],
    colliders: [
      { c: [0, 0.68, 0], s: [1.5, 0.72, 3.5] },
      { c: [0, 1.3, -0.25], s: [1.32, 0.56, 1.9] },
    ],
    wheels: [
      { x: -0.66, y: 0.62, z: 1.15, r: 0.28, steer: true, drive: true },
      { x: 0.66, y: 0.62, z: 1.15, r: 0.28, steer: true, drive: true },
      { x: -0.66, y: 0.62, z: -1.15, r: 0.28, steer: false, drive: false },
      { x: 0.66, y: 0.62, z: -1.15, r: 0.28, steer: false, drive: false },
    ],
    suspRest: 0.34, suspK: 42000, suspC: 4800,
    engineForce: 4300, maxSpeed: 27, reverseMax: 5, brakeForce: 9500, steerMax: 0.58, steerRate: 2.4, grip: 0.62,
    twoWheeler: false, wheelbase: 2.3, seat: [0.33, 0.56, -0.15], pose: "drive", halfWidth: 0.78, rack: [-0.33, 0.78, -0.1],
    camera: "car", hornHz: [370, 466], engine: { idle: 18, top: 82, pulse: 0.18, tone: 1150 }, steerVisual: 3, defaultPaint: "silver",
  },
  jeep: {
    type: "jeep", label: "Open jeep", mass: 1300, com: [0, 0.6, 0],
    colliders: [
      { c: [0, 0.95, 0], s: [1.66, 0.78, 3.6] },
      { c: [0, 1.6, 1.0], s: [1.6, 0.5, 0.15] },
    ],
    wheels: [
      { x: -0.76, y: 0.8, z: 1.25, r: 0.38, steer: true, drive: true },
      { x: 0.76, y: 0.8, z: 1.25, r: 0.38, steer: true, drive: true },
      { x: -0.76, y: 0.8, z: -1.15, r: 0.38, steer: false, drive: true },
      { x: 0.76, y: 0.8, z: -1.15, r: 0.38, steer: false, drive: true },
    ],
    suspRest: 0.42, suspK: 62000, suspC: 7200,
    engineForce: 6800, maxSpeed: 25, reverseMax: 5, brakeForce: 13000, steerMax: 0.55, steerRate: 2.2, grip: 0.66,
    twoWheeler: false, wheelbase: 2.4, seat: [0.4, 0.95, -0.35], pose: "drive", halfWidth: 0.88, rack: [-0.4, 1.0, -0.3],
    camera: "car", hornHz: [300, 380], engine: { idle: 12, top: 62, pulse: 0.5, tone: 620 }, steerVisual: 3, defaultPaint: "olive",
  },
  tractor: {
    type: "tractor", label: "Tractor", mass: 2200, com: [0, 0.7, -0.4],
    colliders: [
      { c: [0, 1.15, 0.35], s: [0.95, 0.95, 2.6] },
      { c: [0, 1.05, -0.95], s: [2.0, 1.1, 1.3] },
    ],
    wheels: [
      { x: -0.72, y: 0.67, z: 1.35, r: 0.42, steer: true, drive: false },
      { x: 0.72, y: 0.67, z: 1.35, r: 0.42, steer: true, drive: false },
      { x: -0.82, y: 1.0, z: -0.95, r: 0.75, steer: false, drive: true },
      { x: 0.82, y: 1.0, z: -0.95, r: 0.75, steer: false, drive: true },
    ],
    suspRest: 0.25, suspK: 120000, suspC: 14000,
    engineForce: 9500, maxSpeed: 11, reverseMax: 3, brakeForce: 16000, steerMax: 0.6, steerRate: 1.8, grip: 0.78,
    twoWheeler: false, wheelbase: 2.3, seat: [0, 1.62, -0.75], pose: "drive", halfWidth: 1.05, rack: [0, 1.15, -1.75],
    camera: "car", hornHz: [280, 350], engine: { idle: 9, top: 34, pulse: 0.95, tone: 480 }, steerVisual: 3, defaultPaint: "tractorRed",
  },
  truck: {
    type: "truck", label: "Truck", mass: 6200, com: [0, 0.9, -0.6],
    colliders: [
      { c: [0, 2.0, -1.8], s: [2.4, 2.4, 6.0] },
      { c: [0, 1.6, 2.4], s: [2.3, 1.9, 2.2] },
      { c: [0, 0.8, 0], s: [2.0, 0.6, 8.2] },
    ],
    wheels: [
      { x: -0.95, y: 0.95, z: 2.4, r: 0.52, steer: true, drive: false },
      { x: 0.95, y: 0.95, z: 2.4, r: 0.52, steer: true, drive: false },
      { x: -0.95, y: 0.95, z: -2.6, r: 0.52, steer: false, drive: true },
      { x: 0.95, y: 0.95, z: -2.6, r: 0.52, steer: false, drive: true },
    ],
    suspRest: 0.42, suspK: 300000, suspC: 32000,
    engineForce: 21000, maxSpeed: 19, reverseMax: 3.5, brakeForce: 60000, steerMax: 0.5, steerRate: 1.5, grip: 0.7,
    twoWheeler: false, wheelbase: 5.0, seat: [0.55, 1.75, 2.35], pose: "drive", halfWidth: 1.22, rack: [0, 2.0, -2.0],
    camera: "car", hornHz: [233, 311], engine: { idle: 8, top: 42, pulse: 0.7, tone: 420 }, steerVisual: 3, defaultPaint: "truckOrange",
  },
};

/** Paint colours available as cosmetic rewards. */
export const PAINTS: Array<{ id: string; label: string; body: string; accent: string; cost: number; shop?: false }> = [
  { id: "mint", label: "Mint Classic", body: "#8fcfb7", accent: "#f3efe2", cost: 0 },
  { id: "cng", label: "Ranggarh Green & Yellow", body: "#2f8f3a", accent: "#f2c230", cost: 0 },
  { id: "mustard", label: "Mustard Field", body: "#e0a92a", accent: "#2b2b2b", cost: 150 },
  { id: "phulkari", label: "Phulkari Pink", body: "#d63a7a", accent: "#f7c948", cost: 250 },
  { id: "royal", label: "Royal Blue", body: "#2346a0", accent: "#e8e8e8", cost: 200 },
  { id: "black", label: "Classic Black", body: "#1f1f22", accent: "#c9c9c9", cost: 120 },
  { id: "silver", label: "Silver", body: "#b8bcc2", accent: "#2b2b2b", cost: 180 },
  { id: "olive", label: "Army Olive", body: "#5b6b3a", accent: "#d8d2b8", cost: 160 },
  { id: "tractorRed", label: "Tractor Red", body: "#c62828", accent: "#f2efe6", cost: 140 },
  { id: "truckOrange", label: "Highway Orange", body: "#e8641c", accent: "#f2c230", cost: 200 },
  { id: "police", label: "Police", body: "#f0f0ee", accent: "#1e3a8a", cost: 0, shop: false },
];

/** Recorded horn and engine-loop clips per vehicle (public/audio/sfx; see docs/ASSETS.md). */
export const VEHICLE_SOUNDS: Record<VehicleType, { horn: string | null; engine: string | null; rate: number }> = {
  scooter: { horn: "horn_scooter", engine: "eng_scooter", rate: 1 },
  auto: { horn: "horn_auto", engine: "eng_auto", rate: 1 },
  bicycle: { horn: null, engine: null, rate: 1 },
  motorcycle: { horn: "horn_scooter", engine: "eng_bullet", rate: 1 },
  car: { horn: "horn_car", engine: "eng_car", rate: 1 },
  jeep: { horn: "horn_jeep", engine: "eng_car", rate: 0.8 },
  tractor: { horn: "horn_jeep", engine: "eng_diesel", rate: 1 },
  truck: { horn: "truck_horn", engine: "eng_diesel", rate: 0.82 },
};
