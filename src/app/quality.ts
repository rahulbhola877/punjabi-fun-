/**
 * Graphics presets. One choice ("Low", "High", "Ultra") moves every knob that
 * costs frames or battery together: shadow maps, post-processing, render
 * resolution, how far the countryside is drawn, how many vehicles, animals and
 * people are simulated, how busy the mix is allowed to get, and a frame cap.
 *
 * Phones throttle (and get hot) long before they run out of GPU, so "Low" caps
 * the frame rate as well as the work per frame — a steady 30 stays cool where
 * an unlocked 55-then-25 does not.
 */
import type { ShadowQuality } from "../world/World";
import type { AudioDetail } from "../audio/Audio";

export type Quality = "low" | "medium" | "high" | "ultra";
export const QUALITIES: Quality[] = ["low", "medium", "high", "ultra"];

export interface QualityPreset {
  label: string;
  note: string;
  shadows: ShadowQuality;
  post: boolean;
  renderScale: number;
  /** Metres at which countryside scenery stops being drawn. */
  drawDistance: number;
  /** Traffic population: open road, inside the bazaar walls, police patrols. */
  traffic: { road: number; town: number; patrol: number };
  /** Autos parked at stands and crawling through the crowded markets. */
  cityAutos: number;
  animals: { dog: number; cat: number; buffalo: number; cow: number };
  /** How many engines may sound at once (the rest are silenced, not stopped). */
  engines: number;
  audio: AudioDetail;
  /** Frames per second to aim for; 0 = uncapped. */
  fpsCap: number;
  /**
   * Fraction of each area's street folk that is actually spawned. The folk
   * lists are written for Ultra; the lighter presets thin them out.
   */
  crowdScale: number;
  /** People near the camera drawn as full kit characters (face, clips), and within how many metres. */
  kitPeople: number;
  kitRange: number;
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low: {
    label: "Low — coolest and fastest (older phones)",
    note: "No shadows, 70% resolution, 30 fps cap, lighter crowds. Use this if your phone gets hot.",
    shadows: "off", post: false, renderScale: 0.7, drawDistance: 220,
    traffic: { road: 9, town: 3, patrol: 1 }, cityAutos: 3,
    animals: { dog: 3, cat: 1, buffalo: 2, cow: 1 },
    engines: 4, audio: "low", fpsCap: 30, crowdScale: 0.45, kitPeople: 10, kitRange: 24,
  },
  medium: {
    label: "Medium — most phones and laptops",
    note: "Hard shadows, 85% resolution, 45 fps cap. The best balance if Low looks too bare.",
    shadows: "low", post: false, renderScale: 0.85, drawDistance: 320,
    traffic: { road: 13, town: 4, patrol: 2 }, cityAutos: 5,
    animals: { dog: 4, cat: 2, buffalo: 3, cow: 2 },
    engines: 5, audio: "high", fpsCap: 45, crowdScale: 0.62, kitPeople: 14, kitRange: 28,
  },
  high: {
    label: "High — the normal game",
    note: "Soft shadows, full resolution, busy streets.",
    shadows: "low", post: true, renderScale: 1, drawDistance: 420,
    traffic: { road: 18, town: 6, patrol: 2 }, cityAutos: 7,
    animals: { dog: 6, cat: 3, buffalo: 4, cow: 3 },
    engines: 6, audio: "high", fpsCap: 0, crowdScale: 0.8, kitPeople: 22, kitRange: 34,
  },
  ultra: {
    label: "Ultra — packed streets (PC)",
    note: "Sharp shadows, the fullest crowds and traffic. Needs a real GPU.",
    shadows: "high", post: true, renderScale: 1, drawDistance: 650,
    traffic: { road: 30, town: 10, patrol: 3 }, cityAutos: 12,
    animals: { dog: 8, cat: 4, buffalo: 6, cow: 4 },
    engines: 9, audio: "ultra", fpsCap: 0, crowdScale: 1, kitPeople: 28, kitRange: 40,
  },
};

export function preset(q: Quality): QualityPreset {
  return PRESETS[q] ?? PRESETS.high;
}
