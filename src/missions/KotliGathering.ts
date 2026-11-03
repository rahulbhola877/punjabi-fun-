import type { TractorSponsorshipState } from "./TractorSponsorship";

/** The notice board at the front of Kotli's chaupal. */
export const KOTLI_NOTICE = { x: 28.5, z: 343 } as const;
export type KotliDedication = "team" | "care";
const STEP = "kotliGatherStep", CHOICE = "kotliGatherChoice";

/** 0 available, 1 consult Ustad, 2 prepare notice, 3 report, 4 complete. */
export function gatheringStep(home: Record<string, number>): 0 | 1 | 2 | 3 | 4 {
  const n = home[STEP];
  if ((n === 3 || n === 4) && home[CHOICE] !== 1 && home[CHOICE] !== 2) return 2;
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : 0;
}
export function gatheringChoice(home: Record<string, number>): KotliDedication | null {
  return home[CHOICE] === 1 ? "team" : home[CHOICE] === 2 ? "care" : null;
}
export function startGathering(home: Record<string, number>, race: TractorSponsorshipState): boolean {
  if (gatheringStep(home) !== 0 || race.stage !== "done" || !race.receipt) return false;
  home[STEP] = 1; return true;
}
export function consultGathering(home: Record<string, number>): boolean {
  if (gatheringStep(home) !== 1) return false;
  home[STEP] = 2; return true;
}
export function postGatheringNotice(home: Record<string, number>, choice: KotliDedication): boolean {
  if (gatheringStep(home) !== 2 || (choice !== "team" && choice !== "care")) return false;
  home[CHOICE] = choice === "team" ? 1 : 2; home[STEP] = 3; return true;
}
export function finishGathering(home: Record<string, number>): KotliDedication | null {
  const choice = gatheringChoice(home);
  if (gatheringStep(home) !== 3 || !choice) return null;
  home[STEP] = 4; return choice;
}

import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, type Mesh, type Scene } from "../babylon";

/** One small poster replaces the generic papers on the existing chaupal board. */
export class KotliNotice {
  private mesh: Mesh;
  private texture: DynamicTexture;
  private shown: KotliDedication | null = null;
  constructor(scene: Scene) {
    this.texture = new DynamicTexture("kotliNotice", { width: 512, height: 192 }, scene, false);
    const material = new StandardMaterial("kotliNoticeMaterial", scene);
    material.diffuseTexture = this.texture;
    material.specularColor = Color3.Black();
    material.backFaceCulling = false;
    this.mesh = MeshBuilder.CreatePlane("kotliNotice", { width: 2.05, height: 0.68 }, scene);
    this.mesh.position.set(28.5, 1.61, 341.62);
    this.mesh.rotation.y = Math.PI;
    this.mesh.material = material; this.mesh.isPickable = false; this.mesh.setEnabled(false);
    scene.onDisposeObservable.addOnce(() => { this.texture.dispose(); material.dispose(); });
  }
  sync(home: Record<string, number>): void {
    const choice = gatheringStep(home) >= 3 ? gatheringChoice(home) : null;
    this.mesh.setEnabled(!!choice);
    if (!choice || choice === this.shown) return;
    this.shown = choice;
    const c = this.texture.getContext() as CanvasRenderingContext2D;
    c.fillStyle = choice === "team" ? "#f7d77c" : "#cce2c7"; c.fillRect(0, 0, 512, 192);
    c.strokeStyle = "#624832"; c.lineWidth = 8; c.strokeRect(6, 6, 500, 180);
    c.textAlign = "center"; c.fillStyle = "#3d3025";
    c.font = "bold 35px sans-serif"; c.fillText("KOTLI SAYS THANK YOU", 256, 62);
    c.font = "bold 29px sans-serif"; c.fillText(choice === "team" ? "OUR TEAM & MENTORS" : "THOSE WHO CARE FOR US", 256, 112);
    c.font = "22px sans-serif"; c.fillText("Together at the chaupal", 256, 154);
    this.texture.update();
  }
}
