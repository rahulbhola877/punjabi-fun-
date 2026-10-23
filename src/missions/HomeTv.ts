import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, type Mesh, type Scene } from "../babylon";
import type { Spot } from "../world/home";

export type Channel = "news" | "cricket" | "gurbani" | "songs";
export const CHANNELS: Channel[] = ["news", "cricket", "songs", "gurbani"];
export const CHANNEL_NAMES: Record<Channel, string> = { news: "Punjab News", cricket: "Cricket (live)", songs: "Punjabi songs", gurbani: "Gurbani (live from Darbar Sahib)" };

const TICKER = [
  "Ludhiana: navi sadak da kamm agle mahine ton",
  "Mandi vich kanak di boli shuru, kisan khush",
  "Monsoon: agle do din Punjab vich meeh",
  "Petrol de bhaa phir vadhe",
  "Ranggarh Mor te navi traffic light lagegi",
];

/**
 * The TV in the baithak at home: a lit screen drawn over the set's dark glass,
 * repainted a few times a second while it is on (news with a ticker, a cricket
 * match, Punjabi songs, Gurbani from Darbar Sahib). Off, it is hidden and the
 * set's own dark screen shows.
 */
export class HomeTv {
  private mesh: Mesh;
  private tex: DynamicTexture;
  private t = 0;
  private redraw = 0;
  channel: Channel = "news";
  on = false;

  constructor(scene: Scene, at: Spot & { w: number; h: number }) {
    this.tex = new DynamicTexture("homeTv", { width: 256, height: 144 }, scene, false);
    const m = new StandardMaterial("homeTvMat", scene);
    m.disableLighting = true;
    m.emissiveTexture = this.tex;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    this.mesh = MeshBuilder.CreatePlane("homeTvScreen", { width: at.w, height: at.h }, scene);
    this.mesh.material = m;
    this.mesh.position.set(at.x, at.y, at.z);
    this.mesh.rotation.y = at.yaw;
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);
  }

  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.mesh.setEnabled(on);
    this.redraw = 0;
  }

  next(): Channel {
    this.channel = CHANNELS[(CHANNELS.indexOf(this.channel) + 1) % CHANNELS.length]!;
    this.redraw = 0;
    return this.channel;
  }

  update(dt: number): void {
    if (!this.on) return;
    this.t += dt;
    this.redraw -= dt;
    if (this.redraw > 0) return;
    this.redraw = 0.2;
    const c = this.tex.getContext() as CanvasRenderingContext2D;
    const t = this.t;
    c.save();
    if (this.channel === "news") {
      c.fillStyle = "#123a6b"; c.fillRect(0, 0, 256, 144);
      c.fillStyle = "#1d5aa0"; c.fillRect(150, 18, 96, 70);
      // The anchor: shoulders, head, a dastar.
      c.fillStyle = "#2b2b33"; c.beginPath(); c.ellipse(80, 118, 46, 30, 0, Math.PI, 0); c.fill();
      c.fillStyle = "#c68a5a"; c.beginPath(); c.arc(80, 66, 18, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#1565c0"; c.beginPath(); c.ellipse(80, 52, 20, 11, 0, Math.PI, 0); c.fill();
      c.fillStyle = "#3a2418"; c.fillRect(70, 74 + (Math.sin(t * 9) > 0 ? 1 : 0), 20, 3);
      c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.fillText("BREAKING", 160, 34);
      c.font = "10px sans-serif"; c.fillText("Punjab News", 160, 50);
      c.fillStyle = "#c62828"; c.fillRect(0, 112, 256, 14);
      c.fillStyle = "#f2c94c"; c.fillRect(0, 126, 256, 18);
      c.fillStyle = "#111"; c.font = "bold 11px sans-serif";
      const line = TICKER.join("   •   ");
      const w = c.measureText(line).width;
      c.fillText(line, 256 - ((t * 40) % (w + 256)), 139);
      c.fillStyle = "#fff"; c.fillText("LIVE", 6, 123);
    } else if (this.channel === "cricket") {
      c.fillStyle = "#2f7d32"; c.fillRect(0, 0, 256, 144);
      c.fillStyle = "#3f9442"; for (let i = 0; i < 8; i++) c.fillRect(i * 32, 0, 16, 144);
      c.fillStyle = "#d8c48a"; c.fillRect(108, 10, 40, 110);
      // Bowler running in, the ball, the batter.
      const ph = (t % 3) / 3;
      c.fillStyle = "#f5f5f5"; c.fillRect(124, 100, 8, 18);
      c.fillStyle = "#1e88e5"; c.fillRect(126, 112 - ph * 90, 6, 16);
      c.fillStyle = "#c62828"; c.beginPath(); c.arc(129, 104 - ph * 70, 2.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(0, 124, 256, 20);
      c.fillStyle = "#fff"; c.font = "bold 11px sans-serif";
      const runs = 187 + Math.floor(t / 6);
      c.fillText(`IND ${runs}/4   ${32 + Math.floor(t / 30)}.${Math.floor(t / 5) % 6} ov   Kohli ${74 + Math.floor(t / 9)}*`, 6, 138);
    } else if (this.channel === "songs") {
      const hue = (t * 40) % 360;
      c.fillStyle = `hsl(${hue},70%,35%)`; c.fillRect(0, 0, 256, 144);
      for (let i = 0; i < 12; i++) {
        const h = 20 + 40 * Math.abs(Math.sin(t * 3 + i));
        c.fillStyle = `hsl(${(hue + i * 30) % 360},80%,60%)`;
        c.fillRect(i * 22, 144 - h, 16, h);
      }
      // A singer doing bhangra, arms up on the beat.
      const up = Math.sin(t * 6) > 0;
      c.fillStyle = "#f2f2f2"; c.fillRect(120, 60, 18, 34);
      c.fillStyle = "#c68a5a"; c.beginPath(); c.arc(129, 50, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ef8f1b"; c.beginPath(); c.ellipse(129, 43, 10, 6, 0, Math.PI, 0); c.fill();
      c.strokeStyle = "#f2f2f2"; c.lineWidth = 4; c.beginPath();
      c.moveTo(120, 64); c.lineTo(108, up ? 38 : 60); c.moveTo(138, 64); c.lineTo(150, up ? 38 : 60); c.stroke();
      c.fillStyle = "#fff"; c.font = "bold 10px sans-serif"; c.fillText("♪ Punjabi Hits", 6, 16);
    } else {
      // Darbar Sahib at dawn: gold on the sarovar.
      c.fillStyle = "#9fc6e8"; c.fillRect(0, 0, 256, 80);
      c.fillStyle = "#4f7fa8"; c.fillRect(0, 80, 256, 64);
      c.fillStyle = "#e9e2d0"; c.fillRect(0, 70, 256, 12);
      c.fillStyle = "#d4a017"; c.fillRect(98, 46, 60, 30);
      c.beginPath(); c.ellipse(128, 46, 18, 16, 0, Math.PI, 0); c.fill();
      c.fillRect(126, 22, 4, 10);
      c.fillStyle = "rgba(212,160,23,0.5)"; c.fillRect(98, 84 + Math.sin(t * 2) * 2, 60, 24);
      c.fillStyle = "#fff"; c.font = "bold 10px sans-serif"; c.fillText("Gurbani Kirtan — Live", 6, 138);
    }
    c.restore();
    this.tex.update(false);
  }
}
