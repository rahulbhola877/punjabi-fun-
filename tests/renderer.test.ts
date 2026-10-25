import { afterEach, describe, expect, it, vi } from "vitest";
const made = vi.hoisted(() => vi.fn());
vi.mock("../src/babylon", () => ({Engine: class {constructor(...args: unknown[]) {made(...args);}}}));
import { createEngine, markRendererHealthy } from "../src/app/engine";
afterEach(() => {vi.unstubAllGlobals(); made.mockClear();});
describe("renderer recovery", () => {
  it("recovers an interrupted WebGPU startup without asking for another GPU adapter", async () => {
    const values = new Map([["pfs.webgpu.probe","trying"]]);
    vi.stubGlobal("localStorage", {getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
    const requestAdapter = vi.fn();
    vi.stubGlobal("navigator", {gpu:{requestAdapter}});
    const result = await createEngine({} as HTMLCanvasElement,"webgpu");
    expect(result.backend).toBe("webgl");
    expect(result.note).toContain("recovered");
    expect(requestAdapter).not.toHaveBeenCalled();
    expect(values.size).toBe(0);
    expect(made.mock.calls[0]?.[2]).toMatchObject({preserveDrawingBuffer:false});
  });
  it("falls back when the browser exposes WebGPU without an adapter", async () => {
    vi.stubGlobal("localStorage", {getItem:()=>null,removeItem:vi.fn()});
    vi.stubGlobal("navigator", {gpu:{requestAdapter:async()=>null}});
    expect((await createEngine({} as HTMLCanvasElement,"webgpu")).backend).toBe("webgl");
    expect(()=>markRendererHealthy()).not.toThrow();
  });
});
