import { Input } from "../input/Input";
import { Vector3, type UniversalCamera } from "../babylon";

/** Districts use the same saved bindings and standard gamepad mapping as Punjab.
 * This input owner exists only while the main renderer is suspended. */
export class DistrictControls {
  readonly input: Input;
  private abort = new AbortController();
  private panel: HTMLDivElement;
  private paused = false;
  private yaw = 0;
  private pitch = 0.34;
  private distance = 8;
  private drag: { id: number; x: number; y: number } | null = null;
  private hop = 0;
  private velocity = 0;
  private sensitivity = 1;
  private invertY = false;
  private keySpeed = 1;

  constructor(overlay: HTMLElement, canvas: HTMLCanvasElement, private held: Set<string>, private interact: () => void, exit: () => void) {
    this.input = new Input(canvas); this.input.gameplayActive = true;
    try {
      const s = JSON.parse(localStorage.getItem("pfs.settings.v1") ?? "{}");
      this.sensitivity = s.sensitivity ?? 1; this.invertY = !!s.invertY; this.keySpeed = s.keySpeed ?? 1;
    } catch { /* defaults */ }
    const panel = this.panel = document.createElement("div");
    panel.className = "district-pause"; panel.hidden = true; panel.dataset.districtPause = "";
    const title = document.createElement("h2"); title.textContent = "Journey paused";
    const text = document.createElement("p");
    text.textContent = `${this.input.describe("forward")} · move forward, ${this.input.describe("interact")} · interact, ${this.input.describe("jump")} · jump. Drag to look; I/J/K/L or right stick turn the camera. Gamepad X interacts, A jumps, RB runs. Changes in Settings apply to every world.`;
    const resume = document.createElement("button"); resume.textContent = "Resume"; resume.onclick = () => this.setPaused(false);
    const back = document.createElement("button"); back.textContent = "Return to Ranggarh"; back.onclick = exit;
    panel.append(title, text, resume, back); overlay.append(panel);
    const pause = document.createElement("button"); pause.textContent = "❚❚"; pause.className = "district-pause-button"; pause.setAttribute("aria-label", "Pause journey");
    pause.addEventListener("click", () => this.setPaused(true), { signal: this.abort.signal }); overlay.append(pause);
    this.input.onFocusLost = () => this.setPaused(true);
    this.input.onPadMenu = key => { if (key === "back" || key === "accept") this.setPaused(false); };
    overlay.addEventListener("pointerdown", e => {
      if ((e.target as HTMLElement).closest("button,.district-pause") || e.clientX < innerWidth * 0.45) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; overlay.setPointerCapture(e.pointerId);
    }, { signal: this.abort.signal });
    overlay.addEventListener("pointermove", e => {
      if (this.drag?.id !== e.pointerId) return;
      this.input.addLook(e.clientX - this.drag.x, e.clientY - this.drag.y); this.drag.x = e.clientX; this.drag.y = e.clientY;
    }, { signal: this.abort.signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) overlay.addEventListener(name, () => { this.drag = null; }, { signal: this.abort.signal });
    overlay.dataset.controls = "shared";
  }

  private setPaused(value: boolean): void {
    this.paused = value; this.panel.hidden = !value; this.held.clear(); this.input.clear(); this.input.gameplayActive = !value;
    if (value) this.panel.querySelector("button")?.focus();
  }

  read(dt: number): { dx: number; dz: number; running: boolean; jump: boolean; attack: boolean; paused: boolean } {
    this.input.pollGamepad(dt);
    if (this.input.wasPressed("pause") || this.input.wasPressed("map")) this.setPaused(!this.paused);
    const mouse = this.input.consumeMouse();
    this.yaw += mouse.dx * 0.0024 * this.sensitivity + this.input.axis("camLeft", "camRight") * dt * 2.2 * this.keySpeed;
    this.pitch = Math.max(0.12, Math.min(0.9, this.pitch + mouse.dy * 0.0024 * this.sensitivity * (this.invertY ? -1 : 1) - this.input.axis("camDown", "camUp") * dt * 1.4 * this.keySpeed));
    this.distance = Math.max(4, Math.min(13, this.distance + mouse.wheel * 0.5));
    const jump = this.input.wasPressed("jump"), attack = this.input.wasPressed("attack");
    let x = this.input.axis("left", "right") + Number(this.held.has("right")) - Number(this.held.has("left"));
    let z = this.input.axis("back", "forward") + Number(this.held.has("up")) - Number(this.held.has("down"));
    if (this.paused || document.hidden) { x = z = 0; this.held.clear(); }
    if (this.input.wasPressed("interact") && !this.paused) this.interact();
    const running = this.input.isDown("sprint") || this.held.has("run");
    this.input.endFrame();
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return { dx: x * c + z * s, dz: z * c - x * s, running, jump, attack, paused: this.paused || document.hidden };
  }

  elevation(dt: number, jump: boolean): number {
    if (jump && this.hop === 0) this.velocity = 4.2;
    this.hop = Math.max(0, this.hop + this.velocity * dt); this.velocity = this.hop > 0 ? this.velocity - dt * 12 : 0;
    return this.hop;
  }

  follow(camera: UniversalCamera, player: { x: number; z: number }, y: number, dt: number): void {
    const horizontal = Math.cos(this.pitch) * this.distance;
    const eye = new Vector3(player.x - Math.sin(this.yaw) * horizontal, y + 1.7 + Math.sin(this.pitch) * this.distance, player.z - Math.cos(this.yaw) * horizontal);
    Vector3.LerpToRef(camera.position, eye, 1 - Math.exp(-dt * 8), camera.position);
    camera.setTarget(new Vector3(player.x, y + 1.45, player.z));
  }

  dispose(): void { this.abort.abort(); this.input.clear(); this.input.dispose(); this.panel.remove(); }
}
