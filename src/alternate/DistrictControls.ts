import { Input } from "../input/Input";
import { Vector3, type UniversalCamera } from "../babylon";
import { districtMapLayout, drawDistrictMap } from "./DistrictMap";
import {districtCameraEye}from './DistrictCamera';
import { secondaryTouchClick } from "../ui/secondaryTouchClick";

/** Districts use the same saved bindings and standard gamepad mapping as Punjab.
 * This input owner exists only while the main renderer is suspended. */
export class DistrictControls {
  readonly input: Input;
  private abort = new AbortController();
  private panel: HTMLDivElement;
  private mapPanel: HTMLDivElement;
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
  private worldId="pixel";
  private menuKeys: Array<"up" | "down" | "left" | "right" | "accept" | "back"> = [];

  constructor(overlay: HTMLElement, canvas: HTMLCanvasElement, private held: Set<string>, private interact: () => void, exit: () => void, private orbit = true) {
    this.input = new Input(canvas); this.input.gameplayActive = true;
    try {
      const s = JSON.parse(localStorage.getItem("pfs.settings.v1") ?? "{}");
      this.sensitivity = s.sensitivity ?? 1; this.invertY = !!s.invertY; this.keySpeed = s.keySpeed ?? 1;
    } catch { /* defaults */ }
    const panel = this.panel = document.createElement("div");
    panel.className = "district-pause"; panel.hidden = true; panel.dataset.districtPause = "";
    const title = document.createElement("h2"); title.textContent = "Journey paused";
    const text = document.createElement("p");
    text.textContent = `${this.input.describe("forward")} · forward, ${this.input.describe("interact")} · interact, ${this.input.describe("jump")} · jump, ${this.input.describe("sprint")} · run. Drag to look; ${this.input.describe("camLeft")} / ${this.input.describe("camRight")} or right stick turn the camera. Gamepad X interacts, A jumps, RB runs, Back opens the map. Changes in Settings apply to every world.`;
    const resume = document.createElement("button"); resume.textContent = "Resume"; resume.onclick = () => this.setPaused(false);
    const back = document.createElement("button"); back.textContent = "Return to Ranggarh"; back.onclick = exit;
    panel.append(title, text, resume, back); overlay.append(panel);
    const id=["japan","china","neon","space","pixel"].find(id=>overlay.hasAttribute(`data-${id}-world`))??"pixel";
    this.worldId=id;
    const mapPanel=this.mapPanel=document.createElement("div");mapPanel.className="district-pause district-map";mapPanel.hidden=true;mapPanel.dataset.districtMap="";
    const mapTitle=document.createElement("h2");mapTitle.textContent=`${districtMapLayout(id).name} · Map`;
    const mapCanvas=document.createElement("canvas");mapCanvas.setAttribute("aria-label","Local map: yellow is your position, blue is the return stop, pale areas are walkable.");
    const legend=document.createElement("p");legend.textContent="Yellow: you · Blue: return stop · Pale: walkable paths · Dark: buildings or boundary. Your journey is paused.";
    const closeMap=document.createElement("button");closeMap.textContent="Close map";closeMap.onclick=()=>this.setPaused(false);
    const returnMap=document.createElement("button");returnMap.textContent="Return to Ranggarh";returnMap.onclick=exit;mapPanel.append(mapTitle,mapCanvas,legend,closeMap,returnMap);overlay.append(mapPanel);
    const showMap=()=>{this.setPaused(true);this.panel.hidden=true;mapPanel.hidden=false;drawDistrictMap(mapCanvas,id,Number(overlay.getAttribute(`data-${id}-x`)??0),Number(overlay.getAttribute(`data-${id}-${id==="pixel"?"y":"z"}`)??0));closeMap.focus();};
    this.openMap=showMap;
    const mapButton=document.createElement("button");mapButton.textContent="Map";mapButton.className="district-map-button";mapButton.setAttribute("aria-label","Open local map");mapButton.onclick=showMap;overlay.append(mapButton);
    const help=document.createElement("div");help.className="district-bindings";help.dataset.districtBindings="";help.textContent=`${this.input.describe("forward")} move · ${this.input.describe("interact")} interact · ${this.input.describe("map")} map`;overlay.append(help);
    if(orbit&&!overlay.querySelector('[data-space-jump]')){const jump=document.createElement("button");jump.className="district-jump-button";jump.textContent="Jump";jump.setAttribute("aria-label","Jump");jump.addEventListener("pointerdown",e=>{e.preventDefault();if(!this.paused)this.input.tapVirtual("jump");},{signal:this.abort.signal});overlay.append(jump);}
    const pause = document.createElement("button"); pause.textContent = "❚❚"; pause.className = "district-pause-button"; pause.setAttribute("aria-label", "Pause journey");
    pause.addEventListener("click", () => this.setPaused(true), { signal: this.abort.signal }); overlay.append(pause);
    for (const button of [pause, mapButton, resume, back, closeMap, returnMap]) secondaryTouchClick(button, this.abort.signal);
    this.input.onFocusLost = () => this.setPaused(true);
    // Input finishes recording this poll's held buttons before a menu action
    // transfers ownership. Clearing then blocks the resume button until release.
    this.input.onPadMenu = key => { this.menuKeys.push(key); };
    overlay.addEventListener("pointerdown", e => {
      if ((e.target as HTMLElement).closest("button,.district-pause") || e.clientX < innerWidth * 0.45) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; overlay.setPointerCapture(e.pointerId);
    }, { signal: this.abort.signal });
    overlay.addEventListener("pointermove", e => {
      if (this.drag?.id !== e.pointerId) return;
      this.input.addLook(e.clientX - this.drag.x, e.clientY - this.drag.y); this.drag.x = e.clientX; this.drag.y = e.clientY;
    }, { signal: this.abort.signal });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) overlay.addEventListener(name, () => { this.drag = null; }, { signal: this.abort.signal });
    const stick=document.createElement("div"); stick.className="district-stick"; stick.dataset.districtStick="";
    const knob=document.createElement("span"); stick.append(knob); overlay.append(stick);
    let stickId:number|null=null;
    const setStick=(e:PointerEvent):void=>{
      const rect=stick.getBoundingClientRect(),dx=(e.clientX-rect.left-rect.width/2)/42,dy=-(e.clientY-rect.top-rect.height/2)/42;
      const length=Math.max(1,Math.hypot(dx,dy)); this.input.setStick(dx/length,dy/length);
      this.input.setVirtual("sprint",Math.hypot(dx,dy)>0.86);
      knob.style.transform=`translate(${dx/length*30}px,${-dy/length*30}px)`;
    };
    stick.addEventListener("pointerdown",e=>{e.preventDefault();stickId=e.pointerId;stick.setPointerCapture(e.pointerId);setStick(e);},{signal:this.abort.signal});
    stick.addEventListener("pointermove",e=>{if(e.pointerId===stickId)setStick(e);},{signal:this.abort.signal});
    for(const name of ["pointerup","pointercancel","lostpointercapture"] as const) stick.addEventListener(name,()=>{stickId=null;this.input.setStick(0,0);this.input.setVirtual("sprint",false);knob.style.transform="";},{signal:this.abort.signal});
    overlay.dataset.controls = "shared";
  }

  private setPaused(value: boolean): void {
    this.paused = value; this.panel.hidden = !value; this.mapPanel.hidden=true; this.held.clear(); this.input.clear(); this.input.gameplayActive = !value;this.drag=null;
    if (value) this.panel.querySelector("button")?.focus();
  }

  get isPaused(): boolean { return this.paused; }
  private openMap:()=>void=()=>{};
  hint(text:string):string { return text.replace(/\bE\b/g,this.input.describe("interact").split(" / ")[0]!); }
  resume(): void { this.setPaused(false); }

  private navigateMenu(key: "up" | "down" | "left" | "right" | "accept" | "back"): void {
    if (!this.paused) return;
    if (key === "back") { this.setPaused(false); return; }
    const panel = this.mapPanel.hidden ? this.panel : this.mapPanel;
    const buttons = [...panel.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (key === "accept") { (buttons[current] ?? buttons[0])?.click(); return; }
    const delta = key === "up" || key === "left" ? -1 : 1;
    const next = current < 0 ? 0 : (current + delta + buttons.length) % buttons.length;
    buttons[next]!.focus();
  }

  read(dt: number): { dx: number; dz: number; running: boolean; jump: boolean; attack: boolean; paused: boolean } {
    this.input.pollGamepad(dt);
    for (const key of this.menuKeys.splice(0)) this.navigateMenu(key);
    if(this.input.wasPressed("map")) {if(this.mapPanel.hidden)this.openMap();else this.setPaused(false);}
    else if(this.input.wasPressed("pause")) {if(!this.mapPanel.hidden)this.setPaused(false);else this.setPaused(!this.paused);}
    const mouse = this.input.consumeMouse();
    this.yaw = this.orbit ? this.yaw + mouse.dx * 0.0024 * this.sensitivity + this.input.axis("camLeft", "camRight") * dt * 2.2 * this.keySpeed : 0;
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
    const target=new Vector3(player.x,y+1.45,player.z),safe=districtCameraEye(this.worldId,target,eye);
    Vector3.LerpToRef(camera.position, safe, 1 - Math.exp(-dt * 8), camera.position);
    camera.position.copyFrom(districtCameraEye(this.worldId,target,camera.position));camera.setTarget(target);
  }

  dispose(): void { this.abort.abort(); this.input.clear(); this.input.dispose(); this.panel.remove();this.mapPanel.remove(); }
}
