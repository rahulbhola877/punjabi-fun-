/** Gurnam's riding trial. Hosts persist every changed checkpoint before showing UI. */
export type TrialMode = "steady" | "precision";
export interface BulletTrialState {
  version: 1;
  stage: "available" | "preparation" | "active" | "failed" | "return" | "done";
  mode: TrialMode;
  vehicleId: string;
  vehicleType: string;
  checkpoint: number;
  receipt: boolean;
}
/** Authored road centres: nav.ts apron/bazaar joins; region.ts kotli/nehar. */
export const BULLET_TRIAL_POINTS = [
  { x: 0, z: 80, action: "pass", label: "Ride north out of the bazaar" },
  { x: 0, z: 136, action: "approach", label: "Slow before the Nehar Road junction" },
  { x: 20, z: 150, action: "pass", label: "Turn east onto Nehar Road" },
  { x: 100, z: 150, action: "brake", label: "Accelerate, then brake and hold still" },
  { x: 20, z: 150, action: "pass", label: "Turn around and ride west" },
  { x: 0, z: 136, action: "pass", label: "Turn south onto Kotli Road" },
  { x: 0, z: 80, action: "approach", label: "Slow before entering the bazaar" },
  { x: 0, z: 50, action: "stop", label: "Stop near Gurnam's workshop" },
] as const;
export function freshBulletTrial(): BulletTrialState {
  return { version: 1, stage: "available", mode: "steady", vehicleId: "", vehicleType: "", checkpoint: 0, receipt: false };
}
/** Unknown/legacy data defaults to an unstarted trial; unrelated save fields are never touched. */
export function normalizeBulletTrial(raw: unknown, vehicles?: ReadonlyArray<{ id: string; type: string }>): BulletTrialState {
  const s = freshBulletTrial();
  if (!raw || typeof raw !== "object") return s;
  const q = raw as Partial<BulletTrialState>;
  if (q.version !== 1) return s;
  s.mode = q.mode === "precision" ? "precision" : "steady";
  s.receipt = q.receipt === true;
  if (s.receipt) { s.stage = "done"; s.checkpoint = BULLET_TRIAL_POINTS.length; return s; }
  if (typeof q.vehicleId !== "string" || !q.vehicleId || q.vehicleId.length > 100 || typeof q.vehicleType !== "string" || !q.vehicleType || q.vehicleType.length > 40) return s;
  if (q.vehicleId !== "bullet_ghar" || q.vehicleType !== "motorcycle") return s;
  s.vehicleId = q.vehicleId; s.vehicleType = q.vehicleType;
  if (q.stage === "preparation" || q.stage === "active" || q.stage === "failed" || q.stage === "return") s.stage = q.stage;
  if (vehicles && !vehicles.some(v => v.id === s.vehicleId && v.type === s.vehicleType) && (s.stage === "active" || s.stage === "preparation")) s.stage = "failed";
  s.checkpoint = Number.isInteger(q.checkpoint) && q.checkpoint! >= 0 && q.checkpoint! <= BULLET_TRIAL_POINTS.length ? q.checkpoint! : 0;
  if (s.stage === "return" && s.checkpoint !== BULLET_TRIAL_POINTS.length) s.stage = "failed";
  if (s.stage === "active" && s.checkpoint === BULLET_TRIAL_POINTS.length) s.stage = "return";
  // The game restores the player on foot, never seated in a vehicle.
  // Remount before sampling motion, retaining completed checkpoints.
  if (s.stage === "active") s.stage = "preparation";
  return s;
}
export function startBulletTrial(state: BulletTrialState, mode: TrialMode, vehicle: { id: string; type: string }): BulletTrialState | null {
  if ((state.stage !== "available" && state.stage !== "failed") || state.receipt || vehicle.id !== "bullet_ghar" || vehicle.type !== "motorcycle") return null;
  return { ...freshBulletTrial(), stage: "preparation", mode, vehicleId: vehicle.id, vehicleType: vehicle.type };
}
/** Explicit cancellation releases the job slot; retries start at the first checkpoint. */
export function abortBulletTrial(s: BulletTrialState): BulletTrialState | null {
  if (s.stage !== "preparation" && s.stage !== "active" && s.stage !== "failed") return null;
  return { ...s, stage: "available", checkpoint: 0 };
}
export interface TrialSample { x: number; z: number; speed: number | null; vehicleId: string | null; vehicleType: string | null }
/** Transient evidence deliberately resets on reload/pause. Never serialize this object. */
export interface TrialMotion { dwell: number; accelerated: boolean; previous: { x: number; z: number } | null }
export const freshTrialMotion = (): TrialMotion => ({ dwell: 0, accelerated: false, previous: null });
export interface TrialTick { state: BulletTrialState; changed: boolean; reason?: string }
export function advanceBulletTrial(s: BulletTrialState, m: TrialMotion, p: TrialSample, dt: number): TrialTick {
  const unchanged = { state: s, changed: false };
  if (s.stage === "preparation") {
    Object.assign(m, freshTrialMotion());
    if (p.vehicleId === null || p.speed === null) return unchanged;
    if (p.vehicleId !== s.vehicleId || p.vehicleType !== s.vehicleType) return { state: { ...s, stage: "failed" }, changed: true, reason: "Mount the agreed Bullet. Return to Gurnam to retry." };
    if (![p.x, p.z, p.speed].every(Number.isFinite)) return unchanged;
    m.previous = { x: p.x, z: p.z };
    return { state: { ...s, stage: "active" }, changed: true };
  }
  if (s.stage !== "active") return unchanged;
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) { Object.assign(m, freshTrialMotion()); return unchanged; }
  if (p.vehicleId !== s.vehicleId || p.vehicleType !== s.vehicleType || p.speed === null || ![p.x, p.z, p.speed].every(Number.isFinite)) {
    Object.assign(m, freshTrialMotion());
    return { state: { ...s, stage: "failed" }, changed: true, reason: "The trial requires the same Bullet throughout. Return to Gurnam to retry." };
  }
  const speed = Math.abs(p.speed);
  if (m.previous && Math.hypot(p.x - m.previous.x, p.z - m.previous.z) > Math.max(3, speed * dt + 2)) {
    Object.assign(m, freshTrialMotion());
    return { state: { ...s, stage: "failed" }, changed: true, reason: "Ride the route continuously. Return to Gurnam to retry." };
  }
  m.previous = { x: p.x, z: p.z };
  const point = BULLET_TRIAL_POINTS[s.checkpoint]!;
  const distance = Math.hypot(p.x - point.x, p.z - point.z);
  if (point.action === "brake" && distance > 8 && distance < 75 && speed >= 6) m.accelerated = true;
  const radius = point.action === "stop" ? 3 : 5;
  const fullStop = point.action === "stop" || point.action === "brake" || point.action === "approach" && s.mode === "precision";
  const allowed = distance < radius && (fullStop ? speed < 0.5 : point.action === "approach" ? speed <= 4 : true);
  m.dwell = allowed ? m.dwell + dt : 0;
  const seconds = point.action === "brake" || point.action === "stop" ? 2 : fullStop ? 1 : 0;
  if (!allowed || m.dwell + 1e-8 < seconds || point.action === "brake" && !m.accelerated) return unchanged;
  const checkpoint = s.checkpoint + 1;
  m.dwell = 0; m.accelerated = false;
  return { state: { ...s, checkpoint, stage: checkpoint === BULLET_TRIAL_POINTS.length ? "return" : "active" }, changed: true };
}
/** Hook driving collision impulses only; ordinary braking is not a collision. */
export function impactBulletTrial(s: BulletTrialState, vehicleId: string | null, deltaV: number): TrialTick {
  if (s.stage !== "active" || vehicleId !== s.vehicleId || !Number.isFinite(deltaV) || deltaV < 5) return { state: s, changed: false };
  return { state: { ...s, stage: "failed" }, changed: true, reason: "Hard impact: Gurnam needs another clean test ride." };
}
/** Apply returned state AND reward in one save checkpoint before awaited dialogue. */
export function finishBulletTrial(s: BulletTrialState): { state: BulletTrialState; reward: { money: number; rep: number } } | null {
  if (s.stage !== "return" || s.receipt || s.checkpoint !== BULLET_TRIAL_POINTS.length) return null;
  return { state: { ...s, stage: "done", receipt: true }, reward: s.mode === "precision" ? { money: 300, rep: 8 } : { money: 180, rep: 5 } };
}
