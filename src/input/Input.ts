/**
 * Keyboard and mouse input. Systems read logical actions rather than raw keys.
 * Held state is cleared on focus loss so nothing stays stuck.
 */
export type Action =
  | "forward" | "back" | "left" | "right"
  | "sprint" | "jump" | "interact" | "horn" | "recover" | "attack" | "heavy"
  | "camLeft" | "camRight" | "camUp" | "camDown"
  | "pause" | "map" | "help" | "lookBack";

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  sprint: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  interact: ["KeyE", "KeyF", "Enter"],
  horn: ["KeyH"],
  attack: ["KeyQ"],
  heavy: ["KeyG", "KeyX"],
  recover: ["KeyR"],
  camLeft: ["KeyJ"],
  camRight: ["KeyL"],
  camUp: ["KeyI"],
  camDown: ["KeyK"],
  pause: ["Escape", "KeyP"],
  map: ["KeyM", "Tab"],
  help: ["F1"],
  lookBack: ["KeyC"],
};

/** Actions players may rebind, with friendly names (order = settings list). */
export const REBINDABLE: Array<[Action, string]> = [
  ["forward", "Move forward / throttle"], ["back", "Move back / brake / reverse"], ["left", "Left / steer left"], ["right", "Right / steer right"],
  ["sprint", "Sprint"], ["jump", "Jump / handbrake"], ["interact", "Interact / get on & off"], ["horn", "Horn"], ["attack", "Punch / slap"], ["heavy", "Kick / brick swing"], ["recover", "Recover vehicle"],
  ["camLeft", "Camera left"], ["camRight", "Camera right"], ["camUp", "Camera up"], ["camDown", "Camera down"], ["lookBack", "Look behind"], ["map", "Map"],
];

export const KEYS_STORAGE = "pfs.keys.v1";

/** Pretty key name for UI. */
export function keyName(code: string): string {
  const map: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab" };
  if (map[code]) return map[code]!;
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/(Left|Right)$/, "");
}

/** Standard-mapping gamepad buttons. */
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;

export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private keyToActions = new Map<string, Action[]>();
  private mouseDX = 0;
  private mouseDY = 0;
  /** Dragging with a button held, for browsers where pointer lock is refused. */
  private dragging = false;
  /** Pixels travelled during the current drag, to tell a click from a look. */
  private dragMoved = 0;
  /** Last cursor position, for drag deltas when the pointer is not captured. */
  private dragX = 0;
  private dragY = 0;
  private wheel = 0;
  /** True while gameplay (not a menu) should receive input. */
  gameplayActive = false;
  pointerLocked = false;
  private listeners: Array<[EventTarget, string, EventListener]> = [];
  /** Called on blur/visibility loss so the game can pause. */
  onFocusLost: (() => void) | null = null;
  /** Touch controls: virtual held/pressed actions and an analog stick. */
  private vHeld = new Set<Action>();
  private vPressed = new Set<Action>();
  private stickX = 0;
  private stickY = 0;
  /** True once the player has used a touch screen; disables pointer lock. */
  touchMode = false;
  /** Called on first user gesture (audio unlock). */
  onUserGesture: (() => void) | null = null;

  /** Current key bindings (defaults merged with the player's remaps). */
  bindings: Record<Action, string[]> = structuredClone(DEFAULT_BINDINGS);
  /** Gamepad state. */
  private padHeld = new Set<Action>();
  private padPrev: boolean[] = [];
  private padStickX = 0;
  private padStickY = 0;
  private padThrottle = 0;
  padConnected = false;
  /** Fired for gamepad presses while menus are open: "up" | "down" | "accept" | "back". */
  onPadMenu: ((k: "up" | "down" | "left" | "right" | "accept" | "back") => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.loadBindings();
    this.listen(window, "gamepadconnected", () => (this.padConnected = true));
    this.listen(window, "gamepaddisconnected", () => { this.padConnected = false; this.padHeld.clear(); this.padStickX = this.padStickY = this.padThrottle = 0; });
    this.listen(window, "keydown", (e) => this.onKeyDown(e as KeyboardEvent));
    this.listen(window, "keyup", (e) => this.held.delete((e as KeyboardEvent).code));
    this.listen(window, "blur", () => this.handleFocusLoss());
    this.listen(document, "visibilitychange", () => {
      if (document.hidden) this.handleFocusLoss();
    });
    this.listen(window, "mousemove", (e) => {
      if (!this.gameplayActive) return;
      const m = e as MouseEvent;
      // Captured: every movement turns the camera, as in any shooter.
      // Not captured: only while a button is held, so the pointer can still
      // be used for the HUD. movementX/Y are reported either way.
      if (this.pointerLocked) {
        this.mouseDX += m.movementX;
        this.mouseDY += m.movementY;
        return;
      }
      if (!this.dragging) return;
      // Deltas from the cursor itself rather than movementX/Y: those are 0
      // for synthesised events and unreliable on a few setups, and this is
      // the path that has to work when pointer lock is refused.
      const dx = m.clientX - this.dragX, dy = m.clientY - this.dragY;
      this.dragX = m.clientX;
      this.dragY = m.clientY;
      this.mouseDX += dx;
      this.mouseDY += dy;
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
    });
    this.listen(canvas, "wheel", (e) => {
      this.wheel += Math.sign((e as WheelEvent).deltaY);
      e.preventDefault();
    });
    this.listen(canvas, "mousedown", (e) => {
      this.onUserGesture?.();
      if (!this.gameplayActive || this.touchMode) return;
      // With the mouse captured, the left button throws a punch.
      if (this.pointerLocked) {
        if ((e as MouseEvent).button === 0) this.vPressed.add("attack");
        return;
      }
      // Otherwise begin a drag-look and ask for the pointer anyway: if the
      // browser grants it the next move switches to captured mode, and if it
      // refuses — which it does in an iframe, right after Escape, and on some
      // setups altogether — dragging still turns the camera.
      e.preventDefault();
      this.dragging = true;
      this.dragMoved = 0;
      this.dragX = (e as MouseEvent).clientX;
      this.dragY = (e as MouseEvent).clientY;
      this.requestPointerLock();
    });
    this.listen(window, "mouseup", (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      // A press that went nowhere is a click, not a look: throw the punch the
      // captured mode would have thrown.
      if (this.gameplayActive && !this.pointerLocked && (e as MouseEvent).button === 0 && this.dragMoved < 6) {
        this.vPressed.add("attack");
      }
    });
    // Dragging with the right button must not open the context menu.
    this.listen(canvas, "contextmenu", (e) => { if (this.gameplayActive) e.preventDefault(); });
    this.listen(document, "pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    this.listen(window, "pointerdown", () => this.onUserGesture?.());
  }

  private rebuildKeyMap(): void {
    this.keyToActions.clear();
    for (const [action, keys] of Object.entries(this.bindings) as [Action, string[]][]) {
      for (const k of keys) {
        const list = this.keyToActions.get(k) ?? [];
        list.push(action);
        this.keyToActions.set(k, list);
      }
    }
  }

  private loadBindings(): void {
    try {
      const raw = localStorage.getItem(KEYS_STORAGE);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Record<Action, string[]>>;
        for (const [a, keys] of Object.entries(saved)) {
          if (a in this.bindings && Array.isArray(keys) && keys.every((k) => typeof k === "string")) this.bindings[a as Action] = keys;
        }
      }
    } catch {
      /* defaults */
    }
    this.rebuildKeyMap();
  }

  /** Set the primary key of an action; the key is removed from other rebindable actions. */
  rebind(action: Action, code: string): void {
    for (const [a] of REBINDABLE) this.bindings[a] = this.bindings[a].filter((k) => k !== code);
    const rest = this.bindings[action].slice(1).filter((k) => k !== code);
    this.bindings[action] = [code, ...rest];
    this.rebuildKeyMap();
    this.saveBindings();
  }

  resetBindings(): void {
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.rebuildKeyMap();
    this.saveBindings();
  }

  private saveBindings(): void {
    try {
      localStorage.setItem(KEYS_STORAGE, JSON.stringify(this.bindings));
    } catch {
      /* not persisted */
    }
  }

  /** Poll the first connected gamepad (call once per frame). */
  pollGamepad(dt: number): void {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return;
    this.padConnected = true;
    const btn = (i: number) => !!gp.buttons[i]?.pressed;
    const val = (i: number) => gp.buttons[i]?.value ?? 0;
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    // Edge-triggered menu navigation and actions.
    const edges = gp.buttons.map((b) => b.pressed);
    const pressed = (i: number) => edges[i] && !this.padPrev[i];
    if (!this.gameplayActive) {
      if (pressed(PAD.UP)) this.onPadMenu?.("up");
      if (pressed(PAD.DOWN)) this.onPadMenu?.("down");
      if (pressed(PAD.LEFT)) this.onPadMenu?.("left");
      if (pressed(PAD.RIGHT)) this.onPadMenu?.("right");
      if (pressed(PAD.A)) this.onPadMenu?.("accept");
      if (pressed(PAD.B) || pressed(PAD.START)) this.onPadMenu?.("back");
    }
    this.padPrev = edges;
    const map: Array<[number, Action]> = [[PAD.A, "jump"], [PAD.X, "interact"], [PAD.B, "horn"], [PAD.B, "attack"], [PAD.LT, "heavy"], [PAD.Y, "recover"], [PAD.LB, "lookBack"], [PAD.START, "pause"], [PAD.BACK, "map"], [PAD.RB, "sprint"]];
    for (const [i, a] of map) {
      const down = btn(i);
      if (down && !this.padHeld.has(a)) { this.padHeld.add(a); if (this.gameplayActive || a === "pause") this.vPressed.add(a); }
      else if (!down) this.padHeld.delete(a);
    }
    // Left stick (or d-pad) moves / steers; triggers throttle and brake.
    let x = dz(gp.axes[0] ?? 0), y = -dz(gp.axes[1] ?? 0);
    if (btn(PAD.LEFT)) x = -1; if (btn(PAD.RIGHT)) x = 1;
    if (btn(PAD.UP)) y = 1; if (btn(PAD.DOWN)) y = -1;
    this.padStickX = x;
    this.padStickY = y;
    this.padThrottle = val(PAD.RT) - val(PAD.LT);
    // Right stick looks around.
    const lx = dz(gp.axes[2] ?? 0), ly = dz(gp.axes[3] ?? 0);
    if (this.gameplayActive && (lx || ly)) {
      this.mouseDX += lx * 900 * dt;
      this.mouseDY += ly * 600 * dt;
    }
  }

  private listen(target: EventTarget, type: string, fn: EventListener): void {
    const opts: AddEventListenerOptions | undefined = type === "wheel" ? { passive: false } : undefined;
    target.addEventListener(type, fn, opts);
    this.listeners.push([target, type, fn]);
  }

  requestPointerLock(): void {
    try {
      const p = this.canvas.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => undefined);
    } catch {
      /* pointer lock unavailable (e.g. iframe); mouse look falls back to keys */
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.onUserGesture?.();
    const actions = this.keyToActions.get(e.code);
    // Keep browser shortcuts out of the way during gameplay only.
    if (this.gameplayActive && actions && e.code !== "Escape") e.preventDefault();
    if (e.code === "Tab" && this.gameplayActive) e.preventDefault();
    if (e.code === "F1") e.preventDefault();
    if (!e.repeat) this.pressedThisFrame.add(e.code);
    this.held.add(e.code);
  }

  private handleFocusLoss(): void {
    this.clear();
    this.onFocusLost?.();
  }

  /** Drop all held keys and accumulated mouse motion. */
  clear(): void {
    this.held.clear();
    this.pressedThisFrame.clear();
    this.vHeld.clear();
    this.vPressed.clear();
    this.dragging = false;
    this.stickX = this.stickY = 0;
    this.mouseDX = this.mouseDY = this.wheel = 0;
  }

  /** Virtual button from the touch layer. */
  setVirtual(action: Action, down: boolean): void {
    if (down) {
      if (!this.vHeld.has(action)) this.vPressed.add(action);
      this.vHeld.add(action);
    } else this.vHeld.delete(action);
  }

  /** One-shot virtual press (tap). */
  tapVirtual(action: Action): void {
    this.vPressed.add(action);
  }

  /** Analog stick from the touch layer, each axis in [-1, 1] (y up = forward). */
  setStick(x: number, y: number): void {
    this.stickX = x;
    this.stickY = y;
  }

  /** True when the touch stick points mostly forward (safe for camera auto-follow). */
  get stickForwardish(): boolean {
    return this.stickY > 0.3 && Math.abs(this.stickX) < this.stickY * 0.45;
  }

  /** Magnitude of analog movement input (0..1), or 1 for keyboard. */
  get moveMagnitude(): number {
    const m = Math.hypot(this.stickX, this.stickY) || Math.hypot(this.padStickX, this.padStickY);
    return m > 0 ? Math.min(1, m) : 1;
  }

  /** Camera look from touch drags, in mouse-equivalent pixels. */
  addLook(dx: number, dy: number): void {
    if (!this.gameplayActive) return;
    this.mouseDX += dx;
    this.mouseDY += dy;
  }

  isDown(action: Action): boolean {
    if (!this.gameplayActive && action !== "pause" && action !== "map" && action !== "help") return false;
    if (this.vHeld.has(action) || this.padHeld.has(action)) return true;
    for (const k of this.bindings[action]) if (this.held.has(k)) return true;
    return false;
  }

  /** Edge-triggered press since the last `endFrame`. */
  wasPressed(action: Action): boolean {
    if (this.vPressed.has(action)) return true;
    for (const k of this.bindings[action]) if (this.pressedThisFrame.has(k)) return true;
    return false;
  }

  axis(neg: Action, pos: Action): number {
    if (this.gameplayActive) {
      if (neg === "left" && pos === "right") {
        if (this.stickX !== 0) return this.stickX;
        if (this.padStickX !== 0) return this.padStickX;
      }
      if (neg === "back" && pos === "forward") {
        if (this.stickY !== 0) return this.stickY;
        if (Math.abs(this.padThrottle) > 0.05) return this.padThrottle;
        if (this.padStickY !== 0) return this.padStickY;
      }
    }
    return (this.isDown(pos) ? 1 : 0) - (this.isDown(neg) ? 1 : 0);
  }

  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const r = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel };
    this.mouseDX = this.mouseDY = this.wheel = 0;
    return r;
  }

  /** Called once per rendered frame after all edge-triggered reads. */
  endFrame(): void {
    this.pressedThisFrame.clear();
    this.vPressed.clear();
  }

  describe(action: Action): string {
    return this.bindings[action].map(keyName).join(" / ");
  }

  dispose(): void {
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    this.listeners = [];
  }
}
