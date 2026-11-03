import { afterEach, expect, it, vi } from "vitest";
import { DistrictControls } from "../src/alternate/DistrictControls";

vi.mock("../src/alternate/DistrictMap", () => ({
  districtMapLayout: () => ({ name: "Test district" }),
  drawDistrictMap: vi.fn(),
}));

class ElementStub extends EventTarget {
  hidden = false;
  className = "";
  textContent = "";
  dataset: Record<string, string> = {};
  style = { transform: "" };
  children: ElementStub[] = [];
  parent: ElementStub | null = null;
  captures = new Set<number>();
  attributes = new Map<string, string>();
  onclick: (() => void) | null = null;
  constructor(readonly tagName: string) { super(); }
  append(...children: ElementStub[]): void { for (const child of children) child.parent = this; this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
  closest(selector: string): ElementStub | null {
    if (selector.split(",").some(part => part.startsWith(".") ? this.className.split(" ").includes(part.slice(1)) : this.tagName === part)) return this;
    return this.parent?.closest(selector) ?? null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 200 }; }
  setPointerCapture(id: number): void { this.captures.add(id); }
  hasPointerCapture(id: number): boolean { return this.captures.has(id); }
  releasePointerCapture(id: number): void { this.captures.delete(id); }
  querySelector(selector: string): ElementStub | null {
    for (const child of this.children) {
      if (child.tagName === selector) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
  querySelectorAll(selector: string): ElementStub[] {
    return this.children.flatMap(child => [
      ...(selector === "button:not([disabled])" && child.tagName === "button" ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  click(): void { this.onclick?.(); }
  focus(): void { Object.assign(document, { activeElement: this }); }
  remove(): void {}
}

afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const doc = Object.assign(new EventTarget(), {
    hidden: false, activeElement: null,
    createElement: (tag: string) => new ElementStub(tag),
  });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("localStorage", { getItem: () => null });
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  vi.stubGlobal("navigator", { getGamepads: () => [{ connected: true, buttons, axes: [0, 0, 0, 0] }] });
  const overlay = new ElementStub("div");
  overlay.setAttribute("data-japan-world", "");
  const exit = vi.fn(), interact = vi.fn();
  const controls = new DistrictControls(overlay as unknown as HTMLElement, new ElementStub("canvas") as unknown as HTMLCanvasElement, new Set(), interact, exit);
  const frame = () => controls.read(1 / 60);
  return { controls, buttons, frame, overlay, exit, interact };
}

// Node's EventTarget has no DOM tree: explicitly deliver the same bubbling
// pointer event to the parent, retaining its original target and pointer ID.
function pointer(target: ElementStub, type: string, id: number, x: number, y: number): void {
  const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
    pointerType: "touch", pointerId: id, clientX: x, clientY: y,
  });
  Object.defineProperty(event, "target", { value: target });
  for (let node: ElementStub | null = target; node; node = node.parent) node.dispatchEvent(event);
}

function touchFixture() {
  const base = fixture();
  const stick = base.overlay.children.find(child => child.className === "district-stick")!;
  const knob = stick.children[0]!;
  const start = () => {
    pointer(stick, "pointerdown", 1, 100, 58);
    pointer(base.overlay, "pointerdown", 2, 700, 200);
    expect(base.controls.input.axis("back", "forward")).toBe(1);
  };
  return { ...base, stick, knob, start };
}

it.each(["pointerup", "pointercancel", "lostpointercapture"])("keeps the right look thumb active when the left stick emits %s", type => {
  const { controls, overlay, stick, start } = touchFixture();
  try {
    start();
    pointer(stick, type, 1, 100, 58);
    expect(controls.input.axis("back", "forward")).toBe(0);
    pointer(overlay, "pointermove", 2, 730, 200);
    expect(controls.input.consumeMouse().dx).toBe(30);
  } finally { controls.dispose(); }
});

it.each(["pointerup", "pointercancel", "lostpointercapture"])("ignores an unrelated pointer's %s in both gesture owners", type => {
  const { controls, overlay, stick, start } = touchFixture();
  try {
    start();
    pointer(stick, type, 99, 100, 100);
    expect(controls.input.axis("back", "forward")).toBe(1);
    pointer(overlay, "pointermove", 2, 730, 200);
    expect(controls.input.consumeMouse().dx).toBe(30);
    pointer(overlay, type, 2, 730, 200);
    pointer(overlay, "pointermove", 2, 760, 200);
    expect(controls.input.consumeMouse().dx).toBe(0);
    expect(controls.input.axis("back", "forward")).toBe(1);
  } finally { controls.dispose(); }
});

it("does not let another contact steal either active gesture", () => {
  const { controls, overlay, stick, start } = touchFixture();
  try {
    start();
    pointer(stick, "pointerdown", 3, 100, 142);
    pointer(stick, "pointermove", 3, 100, 130);
    expect(controls.input.axis("back", "forward")).toBe(1);
    pointer(overlay, "pointerdown", 4, 800, 300);
    pointer(overlay, "pointermove", 4, 850, 300);
    expect(controls.input.consumeMouse().dx).toBe(0);
    pointer(overlay, "pointermove", 2, 730, 200);
    expect(controls.input.consumeMouse().dx).toBe(30);
    pointer(stick, "pointermove", 1, 100, 79);
    expect(controls.input.axis("back", "forward")).toBe(0.5);
  } finally { controls.dispose(); }
});

it.each(["pause", "blur", "dispose"])("clears gesture ownership on %s and ignores stale moves", reason => {
  const { controls, overlay, stick, knob, start, buttons, frame } = touchFixture();
  try {
    start();
    pointer(overlay, "pointermove", 2, 730, 200);
    if (reason === "pause") { buttons[9]!.pressed = true; frame(); buttons[9]!.pressed = false; }
    else if (reason === "blur") window.dispatchEvent(new Event("blur"));
    else controls.dispose();
    expect(controls.input.axis("back", "forward")).toBe(0);
    expect(controls.input.consumeMouse().dx).toBe(0);
    expect(knob.style.transform).toBe("");
    expect(stick.hasPointerCapture(1)).toBe(false);
    expect(overlay.hasPointerCapture(2)).toBe(false);
    if (reason !== "dispose") {
      pointer(stick, "pointerdown", 3, 100, 58);
      pointer(overlay, "pointerdown", 4, 700, 200);
      controls.resume();
    }
    pointer(stick, "pointermove", 1, 100, 58);
    pointer(overlay, "pointermove", 2, 760, 200);
    pointer(stick, "pointermove", 3, 100, 58);
    pointer(overlay, "pointermove", 4, 760, 200);
    expect(controls.input.axis("back", "forward")).toBe(0);
    expect(controls.input.consumeMouse().dx).toBe(0);
    if (reason !== "dispose") {
      pointer(stick, "pointerdown", 5, 100, 58);
      pointer(overlay, "pointerdown", 6, 700, 200);
      pointer(overlay, "pointermove", 6, 730, 200);
      expect(controls.input.axis("back", "forward")).toBe(1);
      expect(controls.input.consumeMouse().dx).toBe(30);
    }
  } finally { controls.dispose(); }
});

it.each([[9, "Start"], [0, "A"], [1, "B"]] as const)("resumes a district with %s (%s) without replaying the menu button", (index, _label) => {
  const { controls, buttons, frame } = fixture();
  try {
    // Open by Start, release, then press a fresh menu button to resume.
    buttons[9]!.pressed = true;
    expect(frame().paused).toBe(true);
    buttons[9]!.pressed = false;
    frame();
    buttons[index]!.pressed = true;
    const resumed = frame();
    expect(resumed.paused).toBe(false);
    expect(resumed.jump).toBe(false);
    expect(resumed.attack).toBe(false);
    const held = frame();
    expect(held.paused).toBe(false);
    expect(held.jump).toBe(false);
    expect(held.attack).toBe(false);
    buttons[index]!.pressed = false;
    frame();
    buttons[index]!.pressed = true;
    const fresh = frame();
    if (index === 9) expect(fresh.paused).toBe(true);
    if (index === 0) expect(fresh.jump).toBe(true);
    if (index === 1) expect(fresh.attack).toBe(true);
  } finally { controls.dispose(); }
});

it.each(["pause", "map"])("lets the controller select Return from the %s panel", (panel) => {
  const { controls, buttons, frame, exit } = fixture();
  try {
    const open = panel === "map" ? 8 : 9;
    buttons[open]!.pressed = true;
    expect(frame().paused).toBe(true);
    buttons[open]!.pressed = false;
    frame();
    buttons[13]!.pressed = true; // D-pad down: Resume/Close map -> Return.
    frame();
    buttons[13]!.pressed = false;
    buttons[0]!.pressed = true;
    frame();
    expect(exit).toHaveBeenCalledOnce();
  } finally { controls.dispose(); }
});

it("keeps the district paused after focus loss and resumes without an attack", () => {
  const { controls, buttons, frame } = fixture();
  try {
    window.dispatchEvent(new Event("blur"));
    expect(frame().paused).toBe(true);
    buttons[1]!.pressed = true;
    expect(frame()).toMatchObject({ paused: false, attack: false, jump: false });
  } finally { controls.dispose(); }
});
