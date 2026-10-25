import { Engine } from "../babylon";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

export type Renderer = "auto" | "webgl" | "webgpu";
export type Backend = "webgl" | "webgpu";

/**
 * Set while a WebGPU boot is in flight and cleared once a frame has actually
 * rendered. If it is still set at startup, the last WebGPU attempt died
 * before showing anything — a driver crash, a blocklisted GPU, a browser
 * that advertises navigator.gpu and then falls over — so we quietly go back
 * to WebGL instead of handing the player a black screen twice.
 */
const PROBE = "pfs.webgpu.probe";

function probe(): string | null {
  try { return localStorage.getItem(PROBE); } catch { return null; }
}
function setProbe(v: string | null): void {
  try { v === null ? localStorage.removeItem(PROBE) : localStorage.setItem(PROBE, v); } catch { /* private mode */ }
}

/** Call once a frame has been presented: the backend works, stop distrusting it. */
export function markRendererHealthy(): void {
  if (probe()) setProbe(null);
}

export function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

/**
 * `navigator.gpu` existing is not the same as WebGPU working: a browser can
 * expose the object and then have no adapter it is willing to give you
 * (software renderers, blocklisted drivers, a headless Chromium). Asking
 * for the adapter first turns that into a quiet null instead of Babylon
 * logging a fatal initialisation error on the way to the fallback.
 */
async function webgpuUsable(): Promise<boolean> {
  if (!webgpuAvailable()) return false;
  try {
    const gpu = (navigator as Navigator & { gpu: { requestAdapter(o?: unknown): Promise<unknown> } }).gpu;
    return !!(await gpu.requestAdapter({ powerPreference: "high-performance" }));
  } catch {
    return false;
  }
}

const GL_OPTS = { preserveDrawingBuffer: false, stencil: true, antialias: true, powerPreference: "high-performance" as const };

/**
 * Create the requested rendering backend, with WebGL2 as the default
 * and the fallback when WebGPU initialization fails.
 *
 * The WebGPU engine is a dynamic import so that players on WebGL never
 * download it.
 */
export async function createEngine(canvas: HTMLCanvasElement, pref: Renderer): Promise<{ engine: AbstractEngine; backend: Backend; note: string | null }> {
  let note: string | null = null;
  // Keep "auto" on WebGL until WebGPU has broader mobile device coverage.
  // Desktop profiles exercise both; WebGPU remains available in Settings.
  const interrupted = probe() !== null;
  const wantGpu = pref === "webgpu" && !interrupted;
  if (pref === "webgpu" && interrupted) note = "The previous WebGPU startup did not finish — recovered using WebGL. Reload to retry WebGPU.";
  if (wantGpu) {
    if (!(await webgpuUsable())) note = "This browser has no usable WebGPU adapter — running on WebGL.";
    else {
      setProbe("trying");
      let pending: AbstractEngine | undefined;
      try {
        const { WebGPUEngine } = await import("@babylonjs/core/Engines/webgpuEngine");
        // Deep-importing the engine does not register MRT for SSAO's prepass.
        await import("@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender");
        const e = new WebGPUEngine(canvas, { antialias: true, stencil: true, enableAllFeatures: false,
          // Babylon filters unsupported features before requesting the device.
          deviceDescriptor: { requiredFeatures: new URLSearchParams(location.search).has("probe") ? ["timestamp-query"] : [] },
        });
        pending = e;
        await e.initAsync();
        if (new URLSearchParams(location.search).has("probe") && e.getCaps().timerQuery) e.enableGPUTimingMeasurements = true;
        return { engine: e as unknown as AbstractEngine, backend: "webgpu", note: null };
      } catch (err) {
        pending?.dispose();
        setProbe(null);
        note = `WebGPU could not start (${String(err).slice(0, 80)}) — running on WebGL.`;
      }
    }
  }
  setProbe(null);
  return { engine: new Engine(canvas, true, GL_OPTS, true) as unknown as AbstractEngine, backend: "webgl", note };
}
