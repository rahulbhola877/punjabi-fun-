/** Data describing each vehicle's dimensions and handling. Local frame: +Z forward, origin on the ground at the body centre. */
export type VehicleType = "scooter" | "auto";

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
  engine: { idle: number; top: number; pulse: number; tone: number };
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
    camera: "twoWheeler", hornHz: [440, 554], engine: { idle: 22, top: 95, pulse: 0.35, tone: 1600 },
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
    camera: "car", hornHz: [330, 392], engine: { idle: 15, top: 55, pulse: 0.65, tone: 900 },
  },
};

/** Paint colours available as cosmetic rewards. */
export const PAINTS: Array<{ id: string; label: string; body: string; accent: string; cost: number }> = [
  { id: "mint", label: "Mint Classic", body: "#8fcfb7", accent: "#f3efe2", cost: 0 },
  { id: "cng", label: "Ranggarh Green & Yellow", body: "#2f8f3a", accent: "#f2c230", cost: 0 },
  { id: "mustard", label: "Mustard Field", body: "#e0a92a", accent: "#2b2b2b", cost: 150 },
  { id: "phulkari", label: "Phulkari Pink", body: "#d63a7a", accent: "#f7c948", cost: 250 },
  { id: "royal", label: "Royal Blue", body: "#2346a0", accent: "#e8e8e8", cost: 200 },
];
