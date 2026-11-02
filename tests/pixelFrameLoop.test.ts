import { afterEach, describe, expect, it, vi } from "vitest";
import { openPixelWorld } from "../src/alternate/PixelWorld";

const controls = vi.hoisted(() => ({
  dx: 1, dz: 0, running: false, paused: false, reads: [] as number[], renders: 0,
}));
vi.mock("../src/alternate/DistrictControls", () => ({
  DistrictControls: class {
    get isPaused(): boolean { return controls.paused; }
    read(dt: number) {
      controls.reads.push(dt);
      return { dx: controls.dx, dz: controls.dz, running: controls.running, paused: controls.paused || document.hidden, jump: false, attack: false };
    }
    hint(text: string): string { return text; }
    dispose(): void { /* input is mocked; the real frame owner still disposes */ }
  },
}));

/** Canvas commands are no-ops: this exercises the real scene loop without a
 * browser, GPU, asset requests or a second copy of its movement logic. */
class Element extends EventTarget {
  style = {};
  dataset: Record<string, string> = {};
  children: Element[] = [];
  width = 0;
  height = 0;
  textContent = "";
  setAttribute(): void { /* accessibility attributes do not affect timing */ }
  appendChild(child: Element): Element { this.children.push(child); return child; }
  append(...children: Element[]): void { this.children.push(...children); }
  remove(): void { /* removal is observed through cancellation below */ }
  getContext(): object {
    return new Proxy<Record<string, unknown>>({}, {
      get: (target, key: string) => key === "clearRect" ? () => controls.renders++ : target[key] ?? (() => {}),
    });
  }
}

function fixture(onProgress = vi.fn()) {
  Object.assign(controls, { dx: 1, dz: 0, running: false, paused: false, reads: [], renders: 0 });
  const page = Object.assign(new EventTarget(), { hidden: false, createElement: () => new Element() });
  const windowEvents = new EventTarget();
  let pending: FrameRequestCallback | undefined, requestId = 0;
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", windowEvents);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { pending = callback; return ++requestId; });
  vi.stubGlobal("cancelAnimationFrame", () => { pending = undefined; });
  const parent = new Element();
  const world = openPixelWorld(parent as unknown as HTMLElement, vi.fn(), { onProgress });
  const overlay = parent.children[0]!;
  const tick = (now: number): void => { const callback = pending!; pending = undefined; callback(now); };
  const position = (): number[] => [Number(overlay.dataset.pixelX), Number(overlay.dataset.pixelY)];
  return { world, page, windowEvents, tick, position, onProgress };
}

afterEach(() => vi.unstubAllGlobals());

describe("Pixel's actual animation frame loop", () => {
  it("covers the same walking distance at 1, 5 and 60 FPS while polling/rendering once per frame", () => {
    for (const fps of [1, 5, 60]) {
      const f = fixture();
      try {
        f.tick(0);
        for (let frame = 1; frame <= fps * 2; frame++) f.tick(frame * 1000 / fps);
        expect(f.position()).toEqual([14.1, 25.5]);
        expect(controls.reads).toHaveLength(fps * 2 + 1);
        expect(controls.renders).toBe(fps * 2 + 2); // Includes the initial render.
      } finally { f.world.dispose(); }
    }
  });

  it("does not move during pause, on resume, or after hidden and blur intervals", () => {
    const f = fixture();
    try {
      f.tick(0); f.tick(1000);
      expect(f.position()).toEqual([10.8, 25.5]);
      controls.paused = true; f.tick(30000);
      controls.paused = false; f.tick(60000);
      expect(f.position()).toEqual([10.8, 25.5]);
      f.page.hidden = true; f.page.dispatchEvent(new Event("visibilitychange")); f.tick(90000);
      f.page.hidden = false; f.page.dispatchEvent(new Event("visibilitychange")); f.tick(120000);
      expect(f.position()).toEqual([10.8, 25.5]);
      f.tick(120200);
      expect(f.position()).toEqual([11.46, 25.5]);
      f.windowEvents.dispatchEvent(new Event("blur")); f.tick(1800000);
      expect(f.position()).toEqual([11.46, 25.5]);
      expect(controls.reads.slice(2, 6)).toEqual([0, 0, 0, 0]);
    } finally { f.world.dispose(); }
  });

  it("collects a crossed lantern and saves progress once after the substeps", () => {
    const f = fixture();
    try {
      f.tick(0);
      controls.dx = 0; controls.dz = 1;
      const northTime = 3 / 3.3 * 1000;
      f.tick(northTime);
      controls.dx = 1; controls.dz = 0; controls.running = true;
      f.tick(northTime + 1800);
      expect(f.position()).toEqual([17.4, 22.5]);
      expect(f.onProgress).toHaveBeenCalledExactlyOnceWith({ found: [1], completed: false });
    } finally { f.world.dispose(); }
  });
});
