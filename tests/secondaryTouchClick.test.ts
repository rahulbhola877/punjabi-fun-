import { expect, it, vi } from "vitest";
import { secondaryTouchClick } from "../src/ui/secondaryTouchClick";

class ButtonStub extends EventTarget {
  disabled = false;
  focus = vi.fn();
  setPointerCapture = vi.fn();
  getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 50 });
  click(): void { this.dispatchEvent(Object.assign(new Event("click"), { detail: 0 })); }
}

function fixture() {
  const button = new ButtonStub(), abort = new AbortController();
  secondaryTouchClick(button as unknown as HTMLButtonElement, abort.signal);
  const activated = vi.fn(); button.addEventListener("click", activated);
  const pointer = (type: string, overrides: Record<string, unknown> = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerType: "touch", pointerId: 2, isPrimary: false, clientX: 50, clientY: 25, ...overrides,
    });
    button.dispatchEvent(event); return event;
  };
  return { button, abort, activated, pointer };
}

it("activates a secondary touch on release once, consuming its compatibility click", () => {
  const { pointer, activated, button } = fixture();
  expect(pointer("pointerdown").defaultPrevented).toBe(false);
  expect(activated).not.toHaveBeenCalled();
  pointer("pointerup");
  expect(activated).toHaveBeenCalledOnce();
  pointer("click", { detail: 1 });
  expect(activated).toHaveBeenCalledOnce();
  expect(button.focus).toHaveBeenCalledWith({ preventScroll: true });
});

it.each(["pointercancel", "lostpointercapture", "drag", "outside"])("does not activate a cancelled or scrolling touch (%s)", reason => {
  const { pointer, activated } = fixture();
  pointer("pointerdown");
  if (reason === "drag") {
    pointer("pointermove", { clientX: 75 });
    pointer("pointermove", { clientX: 50 }); // Returning to the button does not undo a drag.
  } else if (reason !== "outside") pointer(reason);
  pointer("pointerup", reason === "outside" ? { clientX: 110 } : {});
  expect(activated).not.toHaveBeenCalled();
});

it.each(["mouse", "touch"])("preserves a native primary %s click after a secondary tap", pointerType => {
  const { pointer, activated } = fixture();
  pointer("pointerdown"); pointer("pointerup");
  pointer("pointerdown", { pointerType, isPrimary: true, pointerId: 1 });
  pointer("pointerup", { pointerType, isPrimary: true, pointerId: 1 });
  expect(activated).toHaveBeenCalledOnce();
  pointer("click", { detail: 1, pointerType, isPrimary: true, pointerId: 1 });
  expect(activated).toHaveBeenCalledTimes(2);
});

it("preserves keyboard activation and removes listeners on disposal", () => {
  const { pointer, activated, button, abort } = fixture();
  pointer("pointerdown"); pointer("pointerup");
  button.click();
  expect(activated).toHaveBeenCalledTimes(2);
  abort.abort();
  pointer("pointerdown"); pointer("pointerup");
  expect(activated).toHaveBeenCalledTimes(2);
});

it("does not activate a disabled button", () => {
  const { pointer, activated, button } = fixture();
  pointer("pointerdown"); button.disabled = true; pointer("pointerup");
  expect(activated).not.toHaveBeenCalled();
});
