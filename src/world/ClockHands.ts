import { TransformNode } from "../babylon";
import type { Scene } from "../babylon";
import { GeoBuilder, rgb } from "../render/GeoBuilder";
import type { Materials } from "../render/Materials";
import { SITES } from "./region";

/**
 * The hands of the Ghanta Ghar clocks. The dials are scenery (country.ts: ghantaGhar, ludhianaTower); the hands are
 * their own meshes, turned to the game clock, so each tower tells the time the player is living in. Every tower has a
 * dial on all four faces, at its own height and set out from the shaft by its own distance.
 */

/** Per tower: the dial's centre height and how far the face stands out from the shaft (country.ts). */
const DIALS: Record<string, { faceY: number; faceR: number }> = {
  // The chowk: dials at 15.6, set 2.52 out.
  ghantaGhar: { faceY: 15.6, faceR: 2.52 },
  // Ludhiana: H - 3.1 with H = 24, set 2.98 out.
  ludhGhanta: { faceY: 20.9, faceR: 2.98 },
};
const HOUR_LEN = 0.68, MINUTE_LEN = 0.95;

export class ClockHands {
  private hands: Array<{ hour: TransformNode; minute: TransformNode }> = [];
  private lastMinute = -1;

  constructor(scene: Scene, mats: Materials) {
    for (const s of SITES.filter((x) => x.kind === "ghantaGhar")) {
      const dial = DIALS[s.id];
      if (!dial) continue;
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      // Each face: a pivot at the dial's centre, turned to face out (a = 0 is +z, then +x, -z, -x).
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const pivot = new TransformNode(`clock_${s.id}_${i}`, scene);
        pivot.position.set(cx + Math.sin(a) * dial.faceR, dial.faceY, cz + Math.cos(a) * dial.faceR);
        pivot.rotation.y = a;
        const hour = new TransformNode(`clockHour_${s.id}_${i}`, scene);
        const minute = new TransformNode(`clockMinute_${s.id}_${i}`, scene);
        hour.parent = pivot; minute.parent = pivot;
        // Local +z is out of the face and +y is up: each hand lies in the face's plane, just off it.
        const hg = new GeoBuilder(1), mg = new GeoBuilder(1);
        hg.boxMinMax(-0.05, -0.06, 0.07, 0.05, HOUR_LEN, 0.1, rgb("#1a1a1a"));
        mg.boxMinMax(-0.035, -0.08, 0.07, 0.035, MINUTE_LEN, 0.1, rgb("#1a1a1a"));
        const hm = hg.toMesh(`clockHourMesh_${s.id}_${i}`, scene, mats.get("paint"));
        const mm = mg.toMesh(`clockMinuteMesh_${s.id}_${i}`, scene, mats.get("paint"));
        hm.parent = hour; mm.parent = minute;
        hm.isPickable = mm.isPickable = false;
        this.hands.push({ hour, minute });
      }
    }
  }

  /** Turn the hands to the clock: the hour hand creeps round the dial, the minute hand steps once a game minute. */
  update(hour: number): void {
    const m = Math.floor(hour * 60) % 720; // minutes into the twelve-hour dial
    if (m === this.lastMinute) return;
    this.lastMinute = m;
    // Clockwise from twelve as the face is seen from outside: Babylon turns a positive angle that way about the normal.
    const hourAngle = (m / 720) * Math.PI * 2, minuteAngle = ((m % 60) / 60) * Math.PI * 2;
    for (const h of this.hands) { h.hour.rotation.z = hourAngle; h.minute.rotation.z = minuteAngle; }
  }
}
