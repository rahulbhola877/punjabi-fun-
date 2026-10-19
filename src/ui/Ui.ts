/**
 * DOM-based interface. Uses native <button>/<input> elements so keyboard
 * focus, Enter/Space activation and screen readers work out of the box.
 */
export interface DialogueOption { label: string; value: string }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Keep Tab focus inside a modal. */
function trapFocus(root: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = [...root.querySelectorAll<HTMLElement>("button:not([disabled]), input, select")].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0]!, last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  };
  root.addEventListener("keydown", onKey);
  return () => root.removeEventListener("keydown", onKey);
}

export interface KeyRemap {
  list: Array<[string, string]>;
  get(action: string): string;
  rebind(action: string, code: string): void;
  reset(): void;
}

export interface JobPanel { title: string; timeLeft: number; total: number; condition: number; note?: string }

export class Ui {
  readonly root: HTMLDivElement;
  private hud: HTMLDivElement;
  private moneyEl: HTMLSpanElement;
  private repEl: HTMLSpanElement;
  private buffEl!: HTMLDivElement;
  private healthEl!: HTMLDivElement;
  private wantedEl!: HTMLDivElement;
  private objEl: HTMLDivElement;
  private compassEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private speedoEl: HTMLDivElement;
  private toastsEl: HTMLDivElement;
  private jobEl: HTMLDivElement;
  private recoverEl: HTMLDivElement;
  private hintsEl: HTMLDivElement;
  private perfEl: HTMLDivElement;
  readonly minimap: HTMLCanvasElement;
  private modal: HTMLDivElement | null = null;
  private releaseTrap: (() => void) | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;
  /** True while the key-remap UI waits for a key (modal keys are ignored). */
  private capturing = false;
  private dialogueEl: HTMLDivElement | null = null;
  /** Tapping the interaction prompt (touch screens). */
  onPromptTap: (() => void) | null = null;
  /** Called for every button activation (UI click sound). */
  onClick: (() => void) | null = null;

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.hud = el("div");
    this.hud.id = "hud";
    this.hud.classList.add("hidden");
    const wallet = el("div", "wallet");
    const m = el("div", "chip");
    m.setAttribute("aria-label", "Money");
    this.moneyEl = el("span", "", "₹0");
    m.append(this.moneyEl);
    const r = el("div", "chip");
    r.setAttribute("aria-label", "Reputation");
    this.repEl = el("span", "", "★ 0");
    r.append(this.repEl);
    this.buffEl = el("div", "chip buff hidden");
    this.healthEl = el("div", "chip health hidden");
    this.healthEl.setAttribute("aria-label", "Health");
    this.wantedEl = el("div", "chip wanted hidden");
    this.wantedEl.setAttribute("aria-label", "Police");
    wallet.append(m, r, this.healthEl, this.wantedEl, this.buffEl);
    this.objEl = el("div", "objective hidden");
    this.objEl.setAttribute("role", "status");
    this.compassEl = el("div", "compass hidden", `<svg viewBox="0 0 36 36" width="36" height="36"><path d="M18 3 L29 31 L18 24 L7 31 Z" fill="#ffd36b" stroke="#3a2209" stroke-width="2"/></svg>`);
    this.promptEl = el("div", "prompt hidden");
    this.promptEl.addEventListener("pointerdown", (e) => {
      if (!this.onPromptTap) return;
      e.preventDefault();
      this.onPromptTap();
    });
    this.speedoEl = el("div", "speedo hidden");
    this.toastsEl = el("div", "toasts");
    this.toastsEl.setAttribute("aria-live", "polite");
    this.jobEl = el("div", "job hidden");
    this.recoverEl = el("div", "recover hidden");
    this.hintsEl = el("div", "hints hidden");
    this.perfEl = el("div", "perf hidden");
    this.minimap = el("canvas", "minimap");
    this.minimap.width = this.minimap.height = 190;
    this.hud.append(wallet, this.objEl, this.compassEl, this.promptEl, this.speedoEl, this.toastsEl, this.jobEl, this.recoverEl, this.hintsEl, this.perfEl, this.minimap);
    root.append(this.hud);
    root.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) this.onClick?.();
    });
  }

  showHud(v: boolean): void {
    this.hud.classList.toggle("hidden", !v);
  }

  setMoney(n: number): void {
    this.moneyEl.textContent = `₹${n.toLocaleString("en-IN")}`;
  }

  setRep(n: number, level: string): void {
    this.repEl.innerHTML = `★ ${n}<small>${esc(level)}</small>`;
  }

  /** Health bar, shown while hurt or fighting. */
  setHealth(hp: number | null, max = 100): void {
    this.healthEl.classList.toggle("hidden", hp === null);
    if (hp === null) return;
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    const html = `❤ <span class="hb"><i style="width:${pct.toFixed(0)}%"></i></span>`;
    if (this.healthEl.innerHTML !== html) this.healthEl.innerHTML = html;
    this.healthEl.classList.toggle("low", pct < 30);
  }

  /** Police interest: 0 hides the chip. */
  setWanted(stars: number, chasing: boolean): void {
    this.wantedEl.classList.toggle("hidden", stars <= 0);
    const t = `🚨 ${"★".repeat(stars)}${"☆".repeat(Math.max(0, 3 - stars))}`;
    if (this.wantedEl.textContent !== t) this.wantedEl.textContent = t;
    this.wantedEl.classList.toggle("chasing", chasing);
  }

  setBuff(text: string | null): void {
    this.buffEl.classList.toggle("hidden", !text);
    if (text && this.buffEl.textContent !== text) this.buffEl.textContent = text;
  }

  setObjective(title: string | null, detail = "", dist: number | null = null): void {
    if (!title) {
      this.objEl.classList.add("hidden");
      return;
    }
    this.objEl.classList.remove("hidden");
    this.objEl.innerHTML = `<div class="t">${esc(title)}</div>${detail ? `<div class="d">${detail}</div>` : ""}${dist !== null ? `<div class="dist">${Math.round(dist)} m</div>` : ""}`;
  }

  /** Direction arrow toward the objective; angle relative to camera forward (radians), null hides. */
  setCompass(angle: number | null): void {
    if (angle === null) {
      this.compassEl.classList.add("hidden");
      return;
    }
    this.compassEl.classList.remove("hidden");
    this.compassEl.style.transform = `rotate(${angle}rad)`;
  }

  setPrompt(html: string | null): void {
    this.promptEl.classList.toggle("hidden", !html);
    if (html) this.promptEl.innerHTML = html;
  }

  setSpeed(kmh: number | null, label = "", hint = ""): void {
    if (kmh === null) {
      this.speedoEl.classList.add("hidden");
      return;
    }
    this.speedoEl.classList.remove("hidden");
    this.speedoEl.innerHTML = `<div class="n">${esc(label)}</div><div class="v">${Math.round(kmh)}</div><div class="u">km/h</div>${hint ? `<div class="hint">${hint}</div>` : ""}`;
  }

  setJob(j: JobPanel | null): void {
    if (!j) {
      this.jobEl.classList.add("hidden");
      return;
    }
    this.jobEl.classList.remove("hidden");
    const t = Math.max(0, j.timeLeft);
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60).toString().padStart(2, "0");
    const hot = Math.max(0, Math.min(1, j.timeLeft / j.total));
    this.jobEl.innerHTML = `<div>${esc(j.title)}</div><div style="font-size:13px">Food warmth ${mm}:${ss}</div><div class="bar"><i style="width:${hot * 100}%"></i></div><div style="font-size:13px;margin-top:4px">Condition ${Math.round(j.condition)}%</div><div class="bar"><i style="width:${j.condition}%"></i></div>${j.note ? `<div style="font-size:12px;margin-top:4px;opacity:.85">${esc(j.note)}</div>` : ""}`;
  }

  setRecover(html: string | null): void {
    this.recoverEl.classList.toggle("hidden", !html);
    if (html) this.recoverEl.innerHTML = html;
  }

  setHints(html: string | null): void {
    this.hintsEl.classList.toggle("hidden", !html);
    if (html) this.hintsEl.innerHTML = html;
    this.perfEl.classList.toggle("withhints", !!html);
  }

  setPerf(text: string | null): void {
    this.perfEl.classList.toggle("hidden", !text);
    if (text) this.perfEl.textContent = text;
  }

  toast(msg: string, kind: "info" | "warn" | "money" = "info", ms = 3200): void {
    const t = el("div", `toast ${kind === "info" ? "" : kind}`, esc(msg));
    this.toastsEl.append(t);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstElementChild?.remove();
    setTimeout(() => t.remove(), ms);
  }

  // ------------------------------------------------------------- Modals

  get modalOpen(): boolean {
    return !!this.modal;
  }

  closeModal(): void {
    if (this.escHandler) window.removeEventListener("keydown", this.escHandler, true);
    this.escHandler = null;
    this.releaseTrap?.();
    this.releaseTrap = null;
    this.modal?.remove();
    this.modal = null;
  }

  /**
   * Escape (and optional extra keys) close the modal regardless of where focus
   * currently is — e.g. a key pressed before focus moved into a new menu.
   */
  private onModalKeys(keys: string[], fn: (e: KeyboardEvent) => void): void {
    this.escHandler = (e: KeyboardEvent) => {
      if (this.capturing) return;
      if (keys.includes(e.key) || keys.includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        fn(e);
      }
    };
    window.addEventListener("keydown", this.escHandler, true);
  }

  private openModal(content: HTMLElement): HTMLDivElement {
    this.closeModal();
    const back = el("div", "modal-back");
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.append(content);
    this.root.append(back);
    this.modal = back;
    this.releaseTrap = trapFocus(back);
    // Focus the first control now (and again next frame in case layout was pending).
    const first = () => back.querySelector<HTMLElement>("button, input, select");
    first()?.focus();
    requestAnimationFrame(() => { if (!back.contains(document.activeElement)) first()?.focus(); });
    return back;
  }

  showLoading(text: string): HTMLDivElement {
    const d = el("div", "loading", `<div>${esc(text)}</div><div class="bar"><i></i></div>`);
    this.root.append(d);
    return d;
  }

  /** Title screen. Resolves with the chosen action. */
  showTitle(hasSave: boolean, saveInfo: string, looks: Array<{ id: string; label: string }>, saveError?: string): Promise<{ action: "continue" } | { action: "new"; look: string } | { action: "settings" } | { action: "controls" }> {
    return new Promise((resolve) => {
      const t = el("div");
      t.id = "title";
      t.innerHTML = `<div class="logo"><div class="en">Punjabi Fun Shun</div><div class="pa">ਪੰਜਾਬੀ ਫ਼ੰਕਸ਼ਨ</div><div class="tag">Rides, deliveries and mischief in Ranggarh bazaar</div></div>`;
      const menu = el("div", "menu panel");
      t.append(menu);
      const done = (v: Parameters<typeof resolve>[0]) => {
        this.releaseTrap?.();
        this.releaseTrap = null;
        t.remove();
        resolve(v);
      };
      const main = () => {
        menu.innerHTML = "";
        if (hasSave) {
          const c = el("button", "btn", "Continue");
          c.onclick = () => done({ action: "continue" });
          menu.append(c, el("div", "saveinfo", esc(saveInfo)));
        }
        if (saveError) menu.append(el("div", "saveinfo", `⚠ ${esc(saveError)}`));
        const n = el("button", `btn ${hasSave ? "secondary" : ""}`, "New Game");
        n.onclick = choose;
        const s = el("button", "btn secondary", "Settings");
        s.onclick = () => done({ action: "settings" });
        const k = el("button", "btn secondary", "Controls");
        k.onclick = () => done({ action: "controls" });
        menu.append(n, s, k);
        requestAnimationFrame(() => menu.querySelector("button")?.focus());
      };
      const choose = () => {
        menu.innerHTML = `<h2>Who are you?</h2>`;
        if (hasSave) menu.append(el("div", "saveinfo", "Starting a new game replaces your current save when you next save."));
        const row = el("div", "looks");
        for (const l of looks) {
          const b = el("button", "btn", esc(l.label));
          b.onclick = () => done({ action: "new", look: l.id });
          row.append(b);
        }
        const back = el("button", "btn secondary", "Back");
        back.onclick = main;
        menu.append(row, back);
        requestAnimationFrame(() => row.querySelector("button")?.focus());
      };
      this.root.append(t);
      this.releaseTrap = trapFocus(t);
      main();
    });
  }

  /** Simple vertical menu. */
  menu(title: string, items: Array<{ label: string; value: string; disabled?: boolean }>, note = ""): Promise<string> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel");
      p.innerHTML = `<h2>${esc(title)}</h2>${note ? `<div style="margin-bottom:8px">${note}</div>` : ""}`;
      const col = el("div", "col");
      for (const it of items) {
        const b = el("button", "btn", esc(it.label));
        b.disabled = !!it.disabled;
        b.onclick = () => { this.closeModal(); resolve(it.value); };
        col.append(b);
      }
      p.append(col);
      this.openModal(p);
      this.onModalKeys(["Escape"], () => { this.closeModal(); resolve("__escape"); });
    });
  }

  dialogue(speaker: string, color: string, sub: string, text: string, options: DialogueOption[]): Promise<string> {
    return new Promise((resolve) => {
      this.dialogueEl?.remove();
      const d = el("div", "panel dialogue");
      d.setAttribute("role", "dialog");
      d.innerHTML = `<div class="who" style="color:${color}">${esc(speaker)}<small>${esc(sub)}</small></div><div class="txt">${text}</div>`;
      const opts = el("div", "opts");
      const finish = (v: string) => {
        window.removeEventListener("keydown", onKey, true);
        d.remove();
        this.dialogueEl = null;
        resolve(v);
      };
      options.forEach((o, i) => {
        const b = el("button", "btn", `${options.length > 1 ? `<kbd>${i + 1}</kbd> ` : ""}${esc(o.label)}`);
        b.onclick = () => finish(o.value);
        opts.append(b);
      });
      const onKey = (e: KeyboardEvent) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) { e.preventDefault(); this.onClick?.(); finish(options[n - 1]!.value); }
        else if ((e.code === "KeyE" || e.code === "Space") && options.length === 1) { e.preventDefault(); this.onClick?.(); finish(options[0]!.value); }
        else if (e.key === "Escape" && options.length === 1) { e.preventDefault(); finish(options[0]!.value); }
      };
      window.addEventListener("keydown", onKey, true);
      d.append(opts);
      this.root.append(d);
      this.dialogueEl = d;
      requestAnimationFrame(() => opts.querySelector("button")?.focus());
    });
  }

  /** Gamepad navigation for whatever menu is on top. */
  padNav(k: "up" | "down" | "left" | "right" | "accept" | "back"): void {
    const root: HTMLElement | null = this.dialogueEl ?? this.modal ?? document.getElementById("title");
    if (!root) return;
    const items = [...root.querySelectorAll<HTMLElement>("button:not([disabled]), input, select")].filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const active = document.activeElement as HTMLElement | null;
    let i = active ? items.indexOf(active) : -1;
    if (k === "back") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      return;
    }
    if (k === "accept") {
      (i >= 0 ? items[i]! : items[0]!).click();
      return;
    }
    if (active instanceof HTMLInputElement && active.type === "range" && (k === "left" || k === "right")) {
      const step = Number(active.step) || 0.1;
      active.value = String(Number(active.value) + (k === "right" ? step : -step));
      active.dispatchEvent(new Event("input"));
      return;
    }
    i = k === "up" || k === "left" ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
    items[i]!.focus();
    items[i]!.scrollIntoView({ block: "nearest" });
  }

  get dialogueOpen(): boolean {
    return !!this.dialogueEl;
  }

  results(title: string, medal: string | null, rows: Array<[string, string]>, buttons: DialogueOption[]): Promise<string> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel results");
      const medalColor = medal === "gold" ? "#ffd700" : medal === "silver" ? "#d9e1e8" : medal === "bronze" ? "#d08a4c" : "#f25c2a";
      p.innerHTML = `<h2>${esc(title)}</h2>${medal ? `<div class="medal" style="color:${medalColor}">${medal === "fail" ? "✖ Failed" : `● ${medal[0]!.toUpperCase()}${medal.slice(1)} medal`}</div>` : ""}<table>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>`;
      const row = el("div", "opts");
      row.style.cssText = "display:flex;justify-content:flex-end;margin-top:12px;flex-wrap:wrap";
      for (const b of buttons) {
        const x = el("button", "btn", esc(b.label));
        x.onclick = () => { this.closeModal(); resolve(b.value); };
        row.append(x);
      }
      p.append(row);
      this.openModal(p);
    });
  }

  shop(title: string, intro: string, items: Array<{ id: string; label: string; cost: number; owned: boolean; swatch?: string; note?: string }>, money: number): Promise<string> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel");
      p.innerHTML = `<h2>${esc(title)}</h2><div style="margin-bottom:8px">${intro}</div><div style="margin-bottom:6px">Your money: <b style="color:#ffe39a">₹${money}</b></div>`;
      for (const it of items) {
        const row = el("div", "shop-item");
        row.append(el("span", it.swatch ? "swatch" : "", it.swatch ? "" : "🔧"));
        if (it.swatch) (row.firstElementChild as HTMLElement).style.background = it.swatch;
        row.append(el("div", "", `${esc(it.label)}${it.note ? `<div style="font-size:13px;opacity:.8">${esc(it.note)}</div>` : ""}`));
        const b = el("button", "btn", it.owned ? "Apply" : `₹${it.cost}`);
        b.disabled = !it.owned && it.cost > money;
        b.onclick = () => { this.closeModal(); resolve(it.id); };
        row.append(b);
        p.append(row);
      }
      const close = el("button", "btn secondary", "Done");
      close.onclick = () => { this.closeModal(); resolve("__close"); };
      p.append(close);
      this.openModal(p);
      this.onModalKeys(["Escape"], () => { this.closeModal(); resolve("__close"); });
    });
  }

  settings(values: Settings, onChange: (s: Settings) => void, keys?: KeyRemap): Promise<void> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel");
      p.innerHTML = `<h2>Settings</h2>`;
      const v = { ...values };
      const slider = (label: string, key: "master" | "sfx" | "ambience" | "music" | "sensitivity" | "keySpeed" | "renderScale", min: number, max: number, step: number) => {
        const row = el("label", "settings-row");
        const out = el("span", "", String(v[key]));
        const inp = el("input") as HTMLInputElement;
        inp.type = "range";
        inp.min = String(min); inp.max = String(max); inp.step = String(step);
        inp.value = String(v[key]);
        inp.oninput = () => { v[key] = Number(inp.value); out.textContent = inp.value; onChange({ ...v }); };
        row.append(el("span", "", label), inp, out);
        p.append(row);
      };
      const check = (label: string, key: "invertY" | "muted" | "showFps" | "post" | "driveHints") => {
        const row = el("label", "settings-row");
        const inp = el("input") as HTMLInputElement;
        inp.type = "checkbox";
        inp.checked = v[key];
        inp.onchange = () => { v[key] = inp.checked; onChange({ ...v }); };
        row.append(el("span", "", label), inp, el("span"));
        p.append(row);
      };
      slider("Master volume", "master", 0, 1, 0.05);
      slider("Effects", "sfx", 0, 1, 0.05);
      slider("Ambience", "ambience", 0, 1, 0.05);
      slider("Music stings", "music", 0, 1, 0.05);
      check("Mute all", "muted");
      slider("Mouse sensitivity", "sensitivity", 0.2, 3, 0.1);
      slider("Keyboard camera speed", "keySpeed", 0.3, 3, 0.1);
      check("Invert vertical look", "invertY");
      const row = el("label", "settings-row");
      const sel = el("select") as HTMLSelectElement;
      for (const q of ["off", "low", "high"]) { const o = el("option"); o.value = q; o.textContent = q; sel.append(o); }
      sel.value = v.shadows;
      sel.onchange = () => { v.shadows = sel.value as Settings["shadows"]; onChange({ ...v }); };
      row.append(el("span", "", "Shadows"), sel, el("span"));
      p.append(row);
      check("Post-processing (bloom, tone)", "post");
      slider("Resolution scale", "renderScale", 0.4, 1, 0.05);
      check("Show performance", "showFps");
      check("Always show driving controls", "driveHints");
      if (keys) {
        p.append(el("h2", "", "Keyboard"));
        p.append(el("div", "", `<span style="font-size:13px;opacity:.85">Select an action, then press the new key (Esc cancels). Gamepads work automatically: left stick move/steer, right stick look, RT/LT throttle/brake, A jump, X interact, B horn, Y recover, Start pause.</span>`));
        const rows: Array<() => void> = [];
        for (const [action, label] of keys.list) {
          const row = el("div", "settings-row");
          const b = el("button", "btn secondary keybtn", keys.get(action));
          const refresh = () => (b.textContent = keys.get(action));
          rows.push(refresh);
          b.onclick = () => {
            b.textContent = "Press a key…";
            this.capturing = true;
            const cap = (e: KeyboardEvent) => {
              e.preventDefault();
              e.stopPropagation();
              window.removeEventListener("keydown", cap, true);
              setTimeout(() => (this.capturing = false), 0);
              if (e.code !== "Escape") keys.rebind(action, e.code);
              rows.forEach((r) => r());
            };
            window.addEventListener("keydown", cap, true);
          };
          row.append(el("span", "", label), b, el("span"));
          p.append(row);
        }
        const reset = el("button", "btn secondary", "Reset keys to defaults");
        reset.onclick = () => { keys.reset(); rows.forEach((r) => r()); };
        p.append(reset);
      }
      const close = el("button", "btn", "Done");
      close.onclick = () => { this.closeModal(); resolve(); };
      p.append(close);
      this.openModal(p);
      this.onModalKeys(["Escape"], () => { this.closeModal(); resolve(); });
    });
  }

  controls(): Promise<void> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel");
      const k = (s: string) => s.split(" ").map((x) => `<kbd>${x}</kbd>`).join(" ");
      p.innerHTML = `<h2>Controls</h2><div class="controls-grid">
        <h3>On foot</h3>
        <div>${k("W A S D")} / ${k("↑ ← ↓ →")}</div><div>Move (camera-relative)</div>
        <div>${k("Shift")}</div><div>Sprint</div>
        <div>${k("Space")}</div><div>Jump</div>
        <div>${k("E")} / ${k("F")}</div><div>Talk, pick up, deliver, ride — or pull a driver out of his car</div>
        <div>${k("Q")} / left click</div><div>Punch, punch, chapet! (combo)</div>
        <h3>Riding & driving</h3>
        <div>${k("W")} / ${k("S")} (or ${k("↑")} ${k("↓")})</div><div>Throttle / brake — keep holding S when stopped to reverse</div>
        <div>${k("A D")}</div><div>Steer</div>
        <div>${k("Space")}</div><div>Handbrake</div>
        <div>${k("H")}</div><div>Horn — people step aside</div>
        <div>${k("E")}</div><div>Get off (when slow)</div>
        <div>${k("R")}</div><div>Recover a flipped or stuck vehicle</div>
        <h3>Camera & menus</h3>
        <div>Mouse</div><div>Look (click the game to capture the mouse)</div>
        <div>${k("J L I K")}</div><div>Rotate camera with keys</div>
        <div>${k("C")}</div><div>Look behind</div>
        <div>Wheel</div><div>Zoom</div>
        <div>${k("M")} / ${k("Tab")}</div><div>Map (＋ / － to zoom)</div>
        <div>${k("Esc")} / ${k("P")}</div><div>Pause, save, settings</div>
        <div>${k("F1")}</div><div>This help</div>
        <h3>Gamepad</h3>
        <div>Left stick / D-pad</div><div>Move · steer (menus: navigate)</div>
        <div>Right stick</div><div>Look</div>
        <div>RT / LT</div><div>Throttle / brake & reverse</div>
        <div>A · X · B · Y</div><div>Jump/handbrake · interact · horn (on foot: punch) · recover</div>
        <div>RB · LB · Start · Back</div><div>Sprint · look behind · pause · map</div>
      </div><div style="font-size:13px;opacity:.8;margin-top:6px">All keys can be remapped in Settings → Keyboard.</div>`;
      const close = el("button", "btn", "Got it");
      close.style.marginTop = "12px";
      close.onclick = () => { this.closeModal(); resolve(); };
      p.append(close);
      this.openModal(p);
      this.onModalKeys(["Escape", "F1"], () => { this.closeModal(); resolve(); });
    });
  }

  /** Full map overlay; `draw` paints into the provided canvas. */
  /** Full map with zoom (buttons, mouse wheel, +/- keys). `draw` gets the zoom level. */
  map(draw: (c: HTMLCanvasElement, zoom: number) => void, legend: Array<[string, string]>, startZoom = 2): Promise<void> {
    return new Promise((resolve) => {
      const p = el("div", "panel mapwrap");
      const c = el("canvas");
      const short = window.innerHeight < 520;
      const h = Math.max(160, Math.min(window.innerHeight * 0.72, 660, window.innerHeight - (short ? 84 : 190)));
      c.width = Math.round(Math.min(window.innerWidth * 0.86, h * 1.15));
      c.height = Math.round(h);
      let zoom = startZoom;
      const redraw = () => draw(c, zoom);
      const setZoom = (z: number) => { zoom = Math.max(1, Math.min(16, z)); redraw(); };
      redraw();
      c.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 2 : 0.5)); }, { passive: false });
      const zb = el("div", "zoombar");
      const zin = el("button", "btn", "＋"), zout = el("button", "btn", "－");
      zin.onclick = () => setZoom(zoom * 2);
      zout.onclick = () => setZoom(zoom / 2);
      const close = el("button", "btn close", "Close");
      close.onclick = () => { this.closeModal(); resolve(); };
      zb.append(zout, zin, close);
      p.append(el("h2", "", "Ranggarh & around"), c, zb);
      const lg = el("div", "legend", legend.map(([col, t]) => `<span style="--c:${col}">${esc(t)}</span>`).join(""));
      p.append(lg);
      this.openModal(p);
      this.onModalKeys(["Escape", "KeyM", "Equal", "NumpadAdd", "Minus", "NumpadSubtract"], (e) => {
        if (e.code === "Equal" || e.code === "NumpadAdd") setZoom(zoom * 2);
        else if (e.code === "Minus" || e.code === "NumpadSubtract") setZoom(zoom / 2);
        else { this.closeModal(); resolve(); }
      });
    });
  }
}

export interface Settings {
  master: number; sfx: number; ambience: number; music: number; muted: boolean;
  sensitivity: number; keySpeed: number; invertY: boolean;
  shadows: "off" | "low" | "high"; post: boolean; showFps: boolean;
  /** Render resolution as a fraction of the window (1 = native). */
  renderScale: number;
  /** Keep the compact control strip visible whenever driving. */
  driveHints: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, sfx: 0.9, ambience: 0.7, music: 0.7, muted: false,
  sensitivity: 1, keySpeed: 1, invertY: false, shadows: "high", post: true, showFps: false, renderScale: 1, driveHints: true,
};
