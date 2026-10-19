/**
 * Keyboard and mouse input. Systems read logical actions rather than raw keys.
 * Held state is cleared on focus loss so nothing stays stuck.
 */
export type Action =
  | "forward" | "back" | "left" | "right"
  | "sprint" | "jump" | "interact" | "horn" | "recover"
  | "camLeft" | "camRight" | "camUp" | "camDown"
  | "pause" | "map" | "help" | "lookBack";

const DEFAULT_BINDINGS: Record<Action, string[]> = {
  forward: ["KeyW"],
  back: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  sprint: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  interact: ["KeyE", "KeyF"],
  horn: ["KeyH"],
  recover: ["KeyR"],
  camLeft: ["ArrowLeft"],
  camRight: ["ArrowRight"],
  camUp: ["ArrowUp"],
  camDown: ["ArrowDown"],
  pause: ["Escape", "KeyP"],
  map: ["KeyM", "Tab"],
  help: ["F1"],
  lookBack: ["KeyC"],
};

export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();
  private keyToActions = new Map<string, Action[]>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  /** True while gameplay (not a menu) should receive input. */
  gameplayActive = false;
  pointerLocked = false;
  private listeners: Array<[EventTarget, string, EventListener]> = [];
  /** Called on blur/visibility loss so the game can pause. */
  onFocusLost: (() => void) | null = null;
  /** Called on first user gesture (audio unlock). */
  onUserGesture: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    for (const [action, keys] of Object.entries(DEFAULT_BINDINGS) as [Action, string[]][]) {
      for (const k of keys) {
        const list = this.keyToActions.get(k) ?? [];
        list.push(action);
        this.keyToActions.set(k, list);
      }
    }
    this.listen(window, "keydown", (e) => this.onKeyDown(e as KeyboardEvent));
    this.listen(window, "keyup", (e) => this.held.delete((e as KeyboardEvent).code));
    this.listen(window, "blur", () => this.handleFocusLoss());
    this.listen(document, "visibilitychange", () => {
      if (document.hidden) this.handleFocusLoss();
    });
    this.listen(window, "mousemove", (e) => {
      if (!this.pointerLocked || !this.gameplayActive) return;
      const m = e as MouseEvent;
      this.mouseDX += m.movementX;
      this.mouseDY += m.movementY;
    });
    this.listen(canvas, "wheel", (e) => {
      this.wheel += Math.sign((e as WheelEvent).deltaY);
      e.preventDefault();
    });
    this.listen(canvas, "mousedown", () => {
      this.onUserGesture?.();
      if (this.gameplayActive && !this.pointerLocked) this.requestPointerLock();
    });
    this.listen(document, "pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    this.listen(window, "pointerdown", () => this.onUserGesture?.());
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
    this.mouseDX = this.mouseDY = this.wheel = 0;
  }

  isDown(action: Action): boolean {
    if (!this.gameplayActive && action !== "pause" && action !== "map" && action !== "help") return false;
    for (const k of DEFAULT_BINDINGS[action]) if (this.held.has(k)) return true;
    return false;
  }

  /** Edge-triggered press since the last `endFrame`. */
  wasPressed(action: Action): boolean {
    for (const k of DEFAULT_BINDINGS[action]) if (this.pressedThisFrame.has(k)) return true;
    return false;
  }

  axis(neg: Action, pos: Action): number {
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
  }

  static describe(action: Action): string {
    return DEFAULT_BINDINGS[action].map((k) => k.replace(/^Key/, "").replace(/Left$|Right$/, "")).join("/");
  }

  dispose(): void {
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    this.listeners = [];
  }
}
