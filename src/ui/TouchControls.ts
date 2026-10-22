import type { Action, Input } from "../input/Input";

export interface TouchContext {
  driving: boolean;
  canRecover: boolean;
  /** Label for the interact button (null hides it). */
  interact: string | null;
}

function btn(cls: string, label: string, aria: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `tbtn ${cls}`;
  b.innerHTML = label;
  b.setAttribute("aria-label", aria);
  return b;
}

/**
 * On-screen controls for phones and tablets:
 *  - left: floating analog joystick (move / throttle + steer);
 *  - right: drag anywhere to look;
 *  - buttons: interact, jump/handbrake, horn, recover, map, pause, fullscreen.
 * Everything feeds the same logical actions as the keyboard.
 */
export class TouchControls {
  readonly root: HTMLDivElement;
  private stickZone: HTMLDivElement;
  private lookZone: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private bInteract: HTMLButtonElement;
  private bJump: HTMLButtonElement;
  private bHorn: HTMLButtonElement;
  private bHit: HTMLButtonElement;
  private bKick: HTMLButtonElement;
  private bRecover: HTMLButtonElement;
  private bGas: HTMLButtonElement;
  private bBrake: HTMLButtonElement;
  private pad: HTMLDivElement;
  private visible = false;
  // Sentinel values so the first setContext() paints every button.
  private ctx: TouchContext = { driving: true, canRecover: true, interact: "" };
  /** Look sensitivity multiplier (from settings). */
  sensitivity = 1;

  constructor(parent: HTMLElement, private input: Input) {
    const r = document.createElement("div");
    r.id = "touch";
    r.className = "hidden";
    this.root = r;
    this.lookZone = document.createElement("div");
    this.lookZone.className = "tzone look";
    this.stickZone = document.createElement("div");
    this.stickZone.className = "tzone stick";
    this.base = document.createElement("div");
    this.base.className = "tstick-base";
    this.knob = document.createElement("div");
    this.knob.className = "tstick-knob";
    this.base.append(this.knob);
    this.stickZone.append(this.base);
    const pad = document.createElement("div");
    pad.className = "tpad";
    this.bInteract = btn("big interact", "E", "Interact");
    this.bJump = btn("jump", "⤒", "Jump");
    this.bHorn = btn("horn", "📯", "Horn");
    this.bHit = btn("hit", "👊<small>Hit</small>", "Punch");
    this.bKick = btn("kick", "🦵<small>Kick</small>", "Kick");
    this.bRecover = btn("recover", "↻", "Recover vehicle");
    this.bGas = btn("pedal gas", "▲<small>Gas</small>", "Accelerate");
    this.bBrake = btn("pedal brake", "▼<small>Brake / Rev</small>", "Brake and reverse");
    pad.append(this.bRecover, this.bHorn, this.bHit, this.bKick, this.bJump, this.bInteract, this.bBrake, this.bGas);
    // Match the sentinel context (driving) so the first setContext() repaints.
    this.bHit.classList.add("gone");
    this.bKick.classList.add("gone");
    this.pad = pad;
    const top = document.createElement("div");
    top.className = "ttop";
    const bPause = btn("small", "❚❚", "Pause");
    const bMap = btn("small", "🗺", "Map");
    const bFull = btn("small", "⛶", "Fullscreen");
    const bBag = btn("small", "🎒", "Your bag");
    top.append(bPause, bMap, bBag, bFull);
    const rotate = document.createElement("div");
    rotate.className = "rotate-hint";
    rotate.textContent = "↻ Turn your phone sideways for the best view";
    r.append(this.lookZone, this.stickZone, pad, top, rotate);
    parent.prepend(r);

    this.hold(this.bJump, "jump");
    this.tap(this.bHit, "attack");
    this.tap(this.bKick, "heavy");
    this.bHorn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.setVirtual("horn", true);
      this.bHorn.classList.add("on");
    });
    const hornUp = (e: PointerEvent) => { e.preventDefault(); this.input.setVirtual("horn", false); this.bHorn.classList.remove("on"); };
    this.bHorn.addEventListener("pointerup", hornUp);
    this.bHorn.addEventListener("pointercancel", hornUp);
    this.hold(this.bGas, "forward");
    this.hold(this.bBrake, "back");
    this.tap(this.bInteract, "interact");
    this.tap(this.bRecover, "recover");
    this.tap(bPause, "pause");
    this.tap(bMap, "map");
    this.tap(bBag, "bag");
    bFull.addEventListener("click", () => this.toggleFullscreen());
    this.bindStick();
    this.bindLook();
  }

  private tap(b: HTMLButtonElement, a: Action): void {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.tapVirtual(a);
    });
  }

  private hold(b: HTMLButtonElement, a: Action): void {
    const up = (e: PointerEvent) => {
      e.preventDefault();
      this.input.setVirtual(a, false);
      b.classList.remove("on");
    };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      this.input.setVirtual(a, true);
      b.classList.add("on");
    });
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
  }

  private bindStick(): void {
    const z = this.stickZone;
    const R = 56;
    const move = (x: number, y: number) => {
      let dx = x - this.stickOrigin.x, dy = y - this.stickOrigin.y;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / R, ny = -dy / R;
      const m = Math.hypot(nx, ny);
      // Dead zone, then rescale so small pushes still register smoothly.
      const k = m < 0.14 ? 0 : (m - 0.14) / (0.86 * m);
      // Driving: the stick only steers; the pedals handle throttle and brake.
      this.input.setStick(nx * k, this.ctx.driving ? 0 : ny * k);
    };
    z.addEventListener("pointerdown", (e) => {
      if (this.stickId !== null) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      z.setPointerCapture(e.pointerId);
      const zr = z.getBoundingClientRect();
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX - zr.left}px`;
      this.base.style.top = `${e.clientY - zr.top}px`;
      this.base.classList.add("active");
      move(e.clientX, e.clientY);
    });
    z.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.stickId) move(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.input.setStick(0, 0);
      this.knob.style.transform = "";
      this.base.classList.remove("active");
    };
    z.addEventListener("pointerup", end);
    z.addEventListener("pointercancel", end);
  }

  private bindLook(): void {
    const z = this.lookZone;
    z.addEventListener("pointerdown", (e) => {
      if (this.lookId !== null) return;
      e.preventDefault();
      this.lookId = e.pointerId;
      z.setPointerCapture(e.pointerId);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    z.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.lookId) return;
      const k = 1.6 * this.sensitivity;
      this.input.addLook((e.clientX - this.lookLast.x) * k, (e.clientY - this.lookLast.y) * k);
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    z.addEventListener("pointerup", end);
    z.addEventListener("pointercancel", end);
  }

  private toggleFullscreen(): void {
    const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement || d.webkitFullscreenElement) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else d.webkitExitFullscreen?.();
      return;
    }
    if (el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: "hide" }).then(() => {
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        o.lock?.("landscape").catch(() => undefined);
      }).catch(() => undefined);
    } else el.webkitRequestFullscreen?.();
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.classList.toggle("hidden", !v);
    if (!v) {
      this.stickId = this.lookId = null;
      this.input.setStick(0, 0);
      this.knob.style.transform = "";
      this.base.classList.remove("active");
    }
  }

  /** Update context-dependent buttons (cheap; called every frame). */
  setContext(c: TouchContext): void {
    if (c.driving !== this.ctx.driving) {
      this.bJump.innerHTML = c.driving ? "⏸︎<small>Brake</small>" : "⤒<small>Jump</small>";
      this.bJump.setAttribute("aria-label", c.driving ? "Handbrake" : "Jump");
      // Horn belongs to the car; the fight buttons belong on foot. They used
      // to share one button, so on a phone there was nothing on screen that
      // said you could fight at all.
      this.bHorn.classList.toggle("gone", !c.driving);
      this.bHit.classList.toggle("gone", c.driving);
      this.bKick.classList.toggle("gone", c.driving);
      this.pad.classList.toggle("driving", c.driving);
      this.bGas.classList.toggle("gone", !c.driving);
      this.bBrake.classList.toggle("gone", !c.driving);
      this.input.setVirtual("forward", false);
      this.input.setVirtual("back", false);
    }
    if (c.canRecover !== this.ctx.canRecover) this.bRecover.classList.toggle("hidden", !c.canRecover);
    if (c.interact !== this.ctx.interact) {
      this.bInteract.classList.toggle("dim", !c.interact);
      this.bInteract.innerHTML = c.interact ? `✋<small>${c.interact}</small>` : "✋";
    }
    this.ctx = c;
  }
}
