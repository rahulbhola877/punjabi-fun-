/** Browsers do not consistently synthesize click for a second touch while a
 * movement finger is held. Keep native clicks for primary touch/mouse/keyboard,
 * and complete only a stationary secondary-touch release inside this button. */
export function secondaryTouchClick(button: HTMLButtonElement, signal: AbortSignal): void {
  let touch: { id: number; x: number; y: number; moved: boolean } | null = null;
  let clicked: { id: number; at: number } | null = null;
  const options = { signal };
  button.addEventListener("pointerdown", event => {
    clicked = null;
    if (event.pointerType !== "touch" || event.isPrimary || button.disabled) return;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    button.setPointerCapture(event.pointerId);
  }, options);
  button.addEventListener("pointermove", event => {
    if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 12) touch.moved = true;
  }, options);
  button.addEventListener("pointerup", event => {
    if (touch?.id !== event.pointerId) return;
    const released = touch; touch = null;
    const bounds = button.getBoundingClientRect();
    if (released.moved || button.disabled || Math.hypot(event.clientX - released.x, event.clientY - released.y) > 12
      || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    event.preventDefault();
    clicked = { id: event.pointerId, at: event.timeStamp };
    button.focus({ preventScroll: true });
    button.click();
  }, options);
  const cancel = (event: PointerEvent): void => { if (touch?.id === event.pointerId) touch = null; };
  button.addEventListener("pointercancel", cancel, options);
  button.addEventListener("lostpointercapture", cancel, options);
  // Some browsers also emit a compatibility click. Consume only that pointer's
  // click; another pointerdown or a keyboard/programmatic click remains native.
  button.addEventListener("click", event => {
    const pointer = event as PointerEvent;
    if (!clicked || event.detail === 0 || event.timeStamp - clicked.at > 800
      || (pointer.pointerType && pointer.pointerType !== "touch")
      || (typeof pointer.pointerId === "number" && pointer.pointerId !== clicked.id)) return;
    clicked = null; event.preventDefault(); event.stopImmediatePropagation();
  }, { signal, capture: true });
}
