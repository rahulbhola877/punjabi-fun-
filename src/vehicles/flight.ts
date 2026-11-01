/**
 * Lightweight arcade flight model for the high-wing light aircraft. Inputs
 * and outputs are in SI units; forces are applied at the aircraft's centre of
 * mass by the Havok vehicle. The wing needs forward airspeed to fly, so a
 * stopped plane cannot hover, and it loses lift below the stall speed.
 */
export interface FlightInput {
  mass: number;
  forwardSpeed: number;
  /** Forward-direction vertical component, positive with the nose up. */
  noseUp: number;
  /** Right-direction vertical component, negative in a right bank. */
  rightUp: number;
  throttle: number;
  /** -1 nose down, +1 nose up. */
  pitch: number;
  /** -1 left, +1 right. */
  turn: number;
}

export interface FlightForces {
  /** Lift in newtons, applied along the plane's up axis. */
  lift: number;
  /** Thrust minus aerodynamic drag, in newtons along the forward axis. */
  forward: number;
  /** Angular rates in radians per second around right, world up and forward. */
  pitchRate: number;
  yawRate: number;
  rollRate: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function flightForces(input: FlightInput): FlightForces {
  const v = Math.max(0, input.forwardSpeed);
  const throttle = clamp(input.throttle, 0, 1), pitch = clamp(input.pitch, -1, 1), turn = clamp(input.turn, -1, 1);
  // The controls become effective with air flowing over the wings, not while
  // parked. Lift falls quadratically with speed, naturally producing a stall.
  const authority = clamp((v - 8) / 10, 0, 1);
  const wing = clamp((v / 20) ** 2, 0, 2) * (0.72 + 0.32 * pitch);
  const lift = input.mass * 9.81 * wing;
  const thrust = 4500 * throttle * Math.max(0, 1 - (v / 46) ** 2);
  const drag = input.mass * 0.0011 * v * v;
  const targetPitch = pitch * 0.22;
  const targetRoll = -turn * 0.4;
  return {
    lift,
    forward: thrust - drag,
    pitchRate: -clamp((targetPitch - clamp(input.noseUp, -0.6, 0.6)) * 2, -0.5, 0.5) * authority,
    yawRate: turn * 0.2 * authority,
    rollRate: clamp((targetRoll - clamp(input.rightUp, -0.8, 0.8)) * 2, -0.6, 0.6) * authority,
  };
}

export interface FlightSavePosition { x: number; y: number; z: number; yaw: number }

/** Saves do not restore an occupied vehicle. Park an airborne plane safely at
 * the airfield on reload; ground saves keep the actual parked location. */
export function flightSavePosition(current: FlightSavePosition, groundY: number, airfield: FlightSavePosition): FlightSavePosition {
  return current.y > groundY + 2 ? { ...airfield } : { ...current };
}
