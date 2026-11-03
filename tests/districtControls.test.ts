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
  style = {};
  children: ElementStub[] = [];
  attributes = new Map<string, string>();
  onclick: (() => void) | null = null;
  constructor(readonly tagName: string) { super(); }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  hasAttribute(name: string): boolean { return this.attributes.has(name); }
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
