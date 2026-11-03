import { afterEach, expect, it, vi } from "vitest";
import { Input, KEYS_STORAGE } from "../src/input/Input";

afterEach(() => vi.unstubAllGlobals());

function fixture(saved?: Record<string, string[]>) {
  const storage = new Map<string, string>();
  if (saved) storage.set(KEYS_STORAGE, JSON.stringify(saved));
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", new EventTarget());
  const input = new Input(new EventTarget() as HTMLCanvasElement);
  input.gameplayActive = true;
  const press = (code: string) => {
    input.clear();
    window.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code, repeat: false }));
  };
  return { input, press, storage };
}

it.each(["KeyP", "Escape", "F1"])("rejects reserved %s without losing the existing movement key", code => {
  const { input, press } = fixture();
  try {
    input.rebind("forward", code);
    press(code);
    expect(input.wasPressed(code === "F1" ? "help" : "pause")).toBe(true);
    expect(input.wasPressed("forward")).toBe(false);
    press("KeyW");
    expect(input.isDown("forward")).toBe(true);
    expect(input.wasPressed("pause")).toBe(false);
  } finally { input.dispose(); }
});

it("repairs legacy reserved-key collisions while keeping valid movement and interaction alternatives", () => {
  const { input, press } = fixture({ forward: ["KeyP", "KeyZ"], attack: ["F1"], interact: ["KeyT"], pause: ["KeyL"], help: ["KeyH"] });
  try {
    press("KeyP"); expect(input.wasPressed("pause")).toBe(true); expect(input.isDown("forward")).toBe(false);
    press("Escape"); expect(input.wasPressed("pause")).toBe(true);
    press("F1"); expect(input.wasPressed("help")).toBe(true); expect(input.wasPressed("attack")).toBe(false);
    press("KeyZ"); expect(input.isDown("forward")).toBe(true);
    press("KeyQ"); expect(input.wasPressed("attack")).toBe(true);
    press("KeyT"); expect(input.wasPressed("interact")).toBe(true);
  } finally { input.dispose(); }
});

it("restores an unused default without taking another action's valid custom key", () => {
  const { input, press, storage } = fixture({ forward: ["KeyP"], back: ["KeyW"] });
  try {
    press("KeyW"); expect(input.isDown("back")).toBe(true); expect(input.isDown("forward")).toBe(false);
    press("ArrowUp"); expect(input.isDown("forward")).toBe(true); expect(input.wasPressed("pause")).toBe(false);
    input.dispose();
    const next = new Input(new EventTarget() as HTMLCanvasElement);
    next.gameplayActive = true;
    try {
      window.dispatchEvent(Object.assign(new Event("keydown"), { code: "ArrowUp", repeat: false }));
      expect(next.isDown("forward")).toBe(true);
      expect(JSON.parse(storage.get(KEYS_STORAGE)!).forward).not.toContain("KeyP");
    } finally { next.dispose(); }
  } finally { input.dispose(); }
});
