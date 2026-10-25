/**
 * DOM-based interface. Uses native <button>/<input> elements so keyboard
 * focus, Enter/Space activation and screen readers work out of the box.
 */
import { DEV_TOOLS, GAME_NAME, GAME_NAME_PA } from "../app/config";
import { PRESETS, QUALITIES, preset, type Quality } from "../app/quality";

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
  private renderedHtml = new WeakMap<HTMLElement, string>();
  /** HUD setters run every frame; only rebuild DOM when the displayed value changes. */
  private setHtml(node: HTMLElement, html: string): void {
    if (this.renderedHtml.get(node) === html) return;
    node.innerHTML = html;
    this.renderedHtml.set(node, html);
  }
  readonly root: HTMLDivElement;
  /** Which rendering backend came up, for the Settings note. */
  backendLabel = "WebGL";
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
  private matchEl: HTMLDivElement;
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
  /** Tapping the minimap (touch screens). */
  onMapTap: (() => void) | null = null;
  /** Tapping the bus/auto stand button under the minimap. */
  onTravelTap: (() => void) | null = null;
  private travelBtn!: HTMLButtonElement;
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
    // Bus & auto stand: travel to a famous place, so the far side of a 1.4 km
    // map is not a ten-minute walk. Lives in the wallet row because that is
    // the one strip of HUD that is laid out on every screen size.
    this.travelBtn = el("button", "chip travelbtn", "🚌 <span>Stand</span>");
    this.travelBtn.title = "Bus & auto stand — travel to a famous place";
    this.travelBtn.setAttribute("aria-label", "Bus and auto stand: travel to a famous place");
    this.travelBtn.onclick = () => this.onTravelTap?.();
    this.clockEl = el("div", "chip", "08:30");
    this.clockEl.setAttribute("aria-label", "Time of day");
    wallet.append(m, r, this.clockEl, this.healthEl, this.wantedEl, this.buffEl, this.travelBtn);
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
    this.matchEl = el("div", "job match hidden");
    this.recoverEl = el("div", "recover hidden");
    this.hintsEl = el("div", "hints hidden");
    this.perfEl = el("div", "perf hidden");
    this.minimap = el("canvas", "minimap");
    this.minimap.width = this.minimap.height = 190;
    // Touch: tapping the minimap opens the full map (GTA-style).
    this.minimap.addEventListener("pointerdown", (e) => {
      if (!this.onMapTap) return;
      e.preventDefault();
      this.onMapTap();
    });
    this.hud.append(wallet, this.objEl, this.compassEl, this.promptEl, this.speedoEl, this.toastsEl, this.jobEl, this.matchEl, this.recoverEl, this.hintsEl, this.perfEl, this.minimap);
    root.append(this.hud);
    root.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) this.onClick?.();
    });
  }

  showHud(v: boolean): void {
    this.hud.classList.toggle("hidden", !v);
  }

  /** The time of day, with a sun or moon. */
  setClock(text: string, night: boolean, date?: string): void {
    const t = `${night ? "🌙" : "☀️"} ${text}${date ? ` · ${date}` : ""}`;
    if (this.clockEl.textContent !== t) this.clockEl.textContent = t;
  }

  setMoney(n: number): void {
    this.moneyEl.textContent = `₹${n.toLocaleString("en-IN")}`;
  }

  private clockEl!: HTMLElement;

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
    // A new objective shows its full text for 20 s, then shrinks to the title and the distance.
    if (title !== this.objTitle) { this.objTitle = title; this.objFullUntil = performance.now() + 20000; }
    this.objEl.classList.toggle("compact", performance.now() > this.objFullUntil);
    const html = `<div class="t">${esc(title)}</div>${detail ? `<div class="d">${detail}</div>` : ""}${dist !== null ? `<div class="dist">${Math.round(dist)} m</div>` : ""}`;
    if (html !== this.objHtml) { this.objHtml = html; this.objEl.innerHTML = html; }
  }
  private objTitle = "";
  private objHtml = "";
  private objFullUntil = 0;

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
    if (html) this.setHtml(this.promptEl, html);
  }

  setSpeed(kmh: number | null, label = "", hint = "", fuel: number | null = null): void {
    if (kmh === null) {
      this.speedoEl.classList.add("hidden");
      return;
    }
    this.speedoEl.classList.remove("hidden");
    this.setHtml(this.speedoEl, `<div class="n">${esc(label)}</div><div class="v">${Math.round(kmh)}</div><div class="u">km/h</div>${fuel === null ? "" : `<div class="fuel${fuel <= 0.15 ? " low" : ""}" title="Fuel"><i style="width:${Math.round(fuel * 100)}%"></i></div>`}${hint ? `<div class="hint">${hint}</div>` : ""}`);
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

  /** The scoreboard of a match or a game (kabaddi, cricket): a title, a few lines, and one meter. */
  setMatch(m: { title: string; lines: string[]; meter?: { label: string; frac: number } } | null): void {
    if (!m) { this.matchEl.classList.add("hidden"); return; }
    this.matchEl.classList.remove("hidden");
    const bar = m.meter ? `<div style="font-size:13px;margin-top:4px">${esc(m.meter.label)}</div><div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, m.meter.frac)) * 100)}%"></i></div>` : "";
    this.matchEl.innerHTML = `<div>${esc(m.title)}</div>${m.lines.map((l) => `<div style="font-size:14px;margin-top:2px">${esc(l)}</div>`).join("")}${bar}`;
  }

  setRecover(html: string | null): void {
    this.recoverEl.classList.toggle("hidden", !html);
    if (html) this.setHtml(this.recoverEl, html);
  }

  setHints(html: string | null): void {
    this.hintsEl.classList.toggle("hidden", !html);
    if (html) this.setHtml(this.hintsEl, html);
    this.perfEl.classList.toggle("withhints", !!html);
  }

  setPerf(text: string | null): void {
    this.perfEl.classList.toggle("hidden", !text);
    if (text) this.perfEl.textContent = text;
  }

  /** A caption for a spoken line, at the bottom of the screen, whoever says it and wherever they are. */
  caption(who: string, text: string, ms = 3600): void {
    if (!this.captionEl) {
      this.captionEl = el("div", "caption");
      this.captionEl.setAttribute("aria-live", "polite");
      this.hud.append(this.captionEl);
    }
    this.captionEl.innerHTML = `<b>${esc(who)}</b> ${esc(text)}`;
    this.captionEl.classList.add("on");
    clearTimeout(this.captionT);
    this.captionT = window.setTimeout(() => this.captionEl?.classList.remove("on"), ms);
  }
  private captionEl: HTMLDivElement | null = null;
  private captionT = 0;

  /** Interface size (the text-size setting). */
  setTextSize(k: number): void {
    (this.root.style as CSSStyleDeclaration & { zoom: string }).zoom = k === 1 ? "" : String(k);
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
    const d = el("div", "loading", `
      <svg class="ld-scene" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs><linearGradient id="ldsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1640"/><stop offset=".55" stop-color="#c2463a"/><stop offset="1" stop-color="#f6a63c"/></linearGradient></defs>
        <rect width="800" height="300" fill="url(#ldsky)"/>
        <circle cx="560" cy="210" r="58" fill="#ffd36b" opacity=".95"/>
        <g class="ld-kite"><path d="M180 70 l22 26 -22 26 -22 -26z" fill="#e53935"/><path d="M180 122 q-30 60 40 150" stroke="#fff3" fill="none"/></g>
        <path fill="#1b130c" d="M0 300V232h40v-24h44v24h18v-40h52v40h26v-18h30v-30h8v-14h8v14h8v30h30v48h40v-26h56v-22h12v22h36v26h30v-56c0-26 22-46 44-46s44 20 44 46v56h28v-30h64v-20h12v20h30v50h40v-36h50v36h30v-60h10v-10h20v10h10v60h40V300z"/>
      </svg>
      <div class="ld-logo"><div class="en">${esc(GAME_NAME)}</div><div class="pa">${esc(GAME_NAME_PA)}</div></div>
      <div class="ld-text">${esc(text)}</div><div class="bar"><i></i></div><div class="ld-tip"></div>`);
    const tips = [
      "Tip: buses stop at every shelter — stand by the front door and press E.",
      "Tip: a chhatri won't save your scooter from a knee-deep Dal Bazaar.",
      "Tip: say Sat Sri Akal to anyone — most will answer, some will fight.",
      "Tip: the naka constable wants your kaagaz. Or chai-paani.",
      "Tip: patang season — look up at the colony roofs in the evening.",
    ];
    let k = Math.floor(Math.random() * tips.length);
    const tip = d.querySelector(".ld-tip")!;
    tip.textContent = tips[k]!;
    const iv = window.setInterval(() => { k = (k + 1) % tips.length; tip.textContent = tips[k]!; }, 3500);
    const rm = d.remove.bind(d);
    d.remove = () => { window.clearInterval(iv); d.classList.add("done"); window.setTimeout(rm, 450); };
    this.root.append(d);
    return d;
  }

  /** Fill the loading bar (0..1) and say what is being built. */
  loadingProgress(d: HTMLDivElement, frac: number, text?: string): void {
    const i = d.querySelector<HTMLElement>(".bar i");
    if (i) { i.style.animation = "none"; i.style.marginLeft = "0"; i.style.width = `${Math.round(Math.max(0.04, Math.min(1, frac)) * 100)}%`; }
    if (text) d.querySelector(".ld-text")!.textContent = text;
  }

  /** Title screen. Resolves with the chosen action. */
  /**
   * First-run graphics picker. Shown once, before the title, because the right
   * answer depends on the device and a player whose phone is cooking should
   * not have to find Settings to discover there was a choice.
   */
  chooseQuality(current: Quality): Promise<Quality> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel quality-pick");
      p.innerHTML = `<h2>Graphics</h2><div class="settings-note">Pick what suits your device — you can change it any time in Settings. Lower settings also drop the render resolution, which is what makes the game run fast.</div>`;
      const col = el("div", "col");
      for (const q of QUALITIES) {
        const d = PRESETS[q];
        const b = el("button", `btn ${q === current ? "" : "secondary"}`,
          `<b>${esc(d.label)}</b><small>${esc(d.note)} · ${Math.round(d.renderScale * 100)}% resolution${d.fpsCap ? ` · ${d.fpsCap} fps` : ""}</small>`);
        b.classList.add("quality-opt");
        b.onclick = () => { this.closeModal(); resolve(q); };
        col.append(b);
      }
      p.append(col);
      this.openModal(p);
      this.onModalKeys(["Escape"], () => { this.closeModal(); resolve(current); });
    });
  }

  showTitle(hasSave: boolean, saveInfo: string, looks: Array<{ id: string; label: string; blurb?: string }>, saveError?: string,
    hooks?: { choosing(open: boolean): void; focus(id: string): void }): Promise<{ action: "continue" } | { action: "new"; look: string } | { action: "settings" } | { action: "controls" }> {
    return new Promise((resolve) => {
      const t = el("div");
      t.id = "title";
      t.innerHTML = `<div class="logo"><div class="en">${esc(GAME_NAME)}</div><div class="pa">${esc(GAME_NAME_PA)}</div><div class="tag">A gedi round Ranggarh — rides, deliveries and mischief in the bazaar, city, pind &amp; on the G.T. Road</div></div>`;
      const menu = el("div", "menu panel");
      t.append(menu);
      const done = (v: Parameters<typeof resolve>[0]) => {
        if (t.classList.contains("choosing")) hooks?.choosing(false);
        this.releaseTrap?.();
        this.releaseTrap = null;
        t.remove();
        resolve(v);
      };
      const main = () => {
        if (t.classList.contains("choosing")) { t.classList.remove("choosing"); hooks?.choosing(false); }
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
        // The two heroes stand in the bazaar behind the menu (Game draws them).
        t.classList.add("choosing");
        hooks?.choosing(true);
        menu.innerHTML = `<h2>Who are you?</h2>`;
        if (hasSave) menu.append(el("div", "saveinfo", "Starting a new game replaces your current save when you next save."));
        const row = el("div", "looks");
        for (const l of looks) {
          const [name, rest] = l.label.split(" — ");
          const b = el("button", "btn look-card", `<b>${esc(name ?? l.label)}</b>${rest ? `<small>${esc(rest)}</small>` : ""}${l.blurb ? `<small class="blurb">${esc(l.blurb)}</small>` : ""}`);
          b.onclick = () => done({ action: "new", look: l.id });
          b.onfocus = () => hooks?.focus(l.id);
          b.onmouseenter = () => b.focus();
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

  private fadeEl: HTMLDivElement | null = null;

  /** Fade the screen to black (with a line of text) or back; resolves when the fade is done. */
  fade(on: boolean, text = "", ms = 900): Promise<void> {
    if (!this.fadeEl) {
      const f = el("div", "fade") as HTMLDivElement;
      f.style.cssText = "position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:60;display:flex;align-items:center;justify-content:center;color:#f3e6c4;font:600 20px system-ui,sans-serif;text-align:center;padding:16px;transition:opacity 0.9s ease";
      this.root.append(f);
      this.fadeEl = f;
    }
    const f = this.fadeEl;
    f.style.transitionDuration = `${ms}ms`;
    if (on) f.textContent = text;
    void f.offsetWidth;
    f.style.opacity = on ? "1" : "0";
    return new Promise((r) => setTimeout(r, ms));
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

  shop(title: string, intro: string, items: Array<{ id: string; label: string; cost: number; owned: boolean; swatch?: string; note?: string; icon?: string }>, money: number): Promise<string> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel");
      p.innerHTML = `<h2>${esc(title)}</h2><div style="margin-bottom:8px">${intro}</div><div style="margin-bottom:6px">Your money: <b style="color:#ffe39a">₹${money}</b></div>`;
      for (const it of items) {
        const row = el("div", "shop-item");
        row.append(el("span", it.swatch ? "swatch" : "", it.swatch ? "" : it.icon ?? "🔧"));
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
        return () => { inp.value = String(v[key]); out.textContent = String(v[key]); };
      };
      const check = (label: string, key: "invertY" | "muted" | "showFps" | "post" | "driveHints" | "gentleFlash" | "freePlay") => {
        const row = el("label", "settings-row");
        const inp = el("input") as HTMLInputElement;
        inp.type = "checkbox";
        inp.checked = v[key];
        inp.onchange = () => { v[key] = inp.checked; onChange({ ...v }); };
        row.append(el("span", "", label), inp, el("span"));
        p.append(row);
        return () => { inp.checked = v[key]; };
      };
      // Graphics preset first: one choice that moves everything below it.
      {
        const row = el("label", "settings-row");
        const sel = el("select") as HTMLSelectElement;
        for (const q of QUALITIES) { const o = el("option"); o.value = q; o.textContent = PRESETS[q].label; sel.append(o); }
        sel.value = v.quality;
        const note = el("div", "settings-note", esc(preset(v.quality).note));
        sel.onchange = () => {
          Object.assign(v, withQuality(v, sel.value as Quality));
          note.textContent = preset(v.quality).note;
          onChange({ ...v });
          // The detail controls below now show the preset's values.
          refreshDetail();
        };
        row.append(el("span", "", "Graphics"), sel, el("span"));
        p.append(row, note);
      }
      const detailRefresh: Array<() => void> = [];
      const refreshDetail = () => { for (const f of detailRefresh) f(); };
      slider("Master volume", "master", 0, 1, 0.05);
      slider("Effects", "sfx", 0, 1, 0.05);
      slider("Ambience", "ambience", 0, 1, 0.05);
      slider("Music stings", "music", 0, 1, 0.05);
      check("Mute all", "muted");
      {
        const srow = el("label", "settings-row");
        const ssel = el("select") as HTMLSelectElement;
        for (const [val, label] of [["bubbles", "Words over the speaker"], ["captions", "Words and a caption line"], ["off", "No subtitles"]] as const) {
          const o = el("option"); o.value = val; o.textContent = label; ssel.append(o);
        }
        ssel.value = v.subtitles;
        ssel.onchange = () => { v.subtitles = ssel.value as Settings["subtitles"]; onChange({ ...v }); };
        srow.append(el("span", "", "Subtitles"), ssel, el("span"));
        p.append(srow);
        const trow = el("label", "settings-row");
        const tsel = el("select") as HTMLSelectElement;
        for (const [val, label] of [["1", "Normal"], ["1.15", "Large"], ["1.3", "Extra large"]] as const) {
          const o = el("option"); o.value = val; o.textContent = label; tsel.append(o);
        }
        tsel.value = String(v.textSize);
        tsel.onchange = () => { v.textSize = Number(tsel.value); onChange({ ...v }); };
        trow.append(el("span", "", "Text size"), tsel, el("span"));
        p.append(trow);
      }
      check("Softer lightning", "gentleFlash");
      check("Free play: nothing costs money", "freePlay");
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
      detailRefresh.push(() => (sel.value = v.shadows));
      detailRefresh.push(check("Post-processing (bloom, tone)", "post"));
      detailRefresh.push(slider("Resolution scale", "renderScale", 0.4, 1, 0.05));
      {
        // Changing the backend needs a fresh engine, so it takes effect on
        // the next load rather than tearing the scene down underneath us.
        const rrow = el("label", "settings-row");
        const rsel = el("select") as HTMLSelectElement;
        for (const [val, label] of [["auto", "Automatic"], ["webgpu", "WebGPU"], ["webgl", "WebGL"]] as const) {
          const o = el("option"); o.value = val; o.textContent = label; rsel.append(o);
        }
        rsel.value = v.renderer;
        const rnote = el("div", "settings-note", "");
        const paint = () => {
          rnote.textContent = `Now running on ${this.backendLabel}. ${v.renderer === "auto" ? "Automatic uses WebGL, which works everywhere" : "Applies the next time the game loads"}.`;
        };
        paint();
        rsel.onchange = () => { v.renderer = rsel.value as Settings["renderer"]; onChange({ ...v }); paint(); };
        rrow.append(el("span", "", "Renderer"), rsel, el("span"));
        p.append(rrow, rnote);
      }
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
        <div>${k("G")} / ${k("X")}</div><div>Kick — or a knee in close, or swing the brick you are holding</div>
        <h3>Riding & driving</h3>
        <div>${k("W")} / ${k("S")} (or ${k("↑")} ${k("↓")})</div><div>Throttle / brake — keep holding S when stopped to reverse</div>
        <div>${k("A D")}</div><div>Steer</div>
        <div>${k("Space")}</div><div>Handbrake</div>
        <div>${k("H")}</div><div>Horn — people step aside</div>
        <div>${k("E")}</div><div>Get off (when slow)</div>
        <div>${k("R")}</div><div>Recover a flipped or stuck vehicle</div>
        <div>${k("N")}</div><div>Radio: next station (Punjab Beats, Purane Gaane, Gurbani Radio, Vividh Bharati, off)</div>
        <h3>Camera & menus</h3>
        <div>Mouse</div><div>Drag to look &middot; click once to capture the pointer &middot; wheel to zoom</div>
        <div>${k("J L I K")}</div><div>Rotate camera with keys</div>
        <div>${k("C")}</div><div>Look behind</div>
        <div>Wheel</div><div>Zoom</div>
        <div>${k("M")} / ${k("Tab")}</div><div>Map (＋ / － to zoom)</div>
        <div>${k("Esc")} / ${k("P")}</div><div>Pause, save, settings</div>
        <div>${k("F1")}</div><div>This help</div>
        ${DEV_TOOLS ? `<div>${k("T")}</div><div>Try a street event here (tipping e-rickshaw, crash, colony fight, police chase) or go to a naka / chowki</div>` : ""}
        <div>${k("B")}</div><div>Your bag: snacks to eat later, and goods to give someone as a gift (buy them at any shop)</div>
        <h3>Where things happen by themselves</h3>
        <div>City streets</div><div>Autos and e-rickshaws full of passengers; one tips on a pothole now and then (every 1½–2½ min at most)</div>
        <div>Any road with traffic</div><div>Crashes between two vehicles; police patrols (jeeps and bikes) chasing speeders</div>
        <div>Houses / galis</div><div>Colony fights and aunty quarrels</div>
        <div>G.T. Road, Kotli Road</div><div>Police nakas: stop for your papers, or drive through (they will remember)</div>
        <div>Ghanta Ghar, Bus Adda</div><div>Lafangas looking for trouble</div>
        <h3>Gamepad</h3>
        <div>Left stick / D-pad</div><div>Move · steer (menus: navigate)</div>
        <div>Right stick</div><div>Look</div>
        <div>RT / LT</div><div>Throttle / brake & reverse (on foot, LT kicks)</div>
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
  /**
   * The big map. With `route`: a "Route to…" row of places (picking one sets
   * the route and closes the map), a clear button while a route is set, and a
   * tap / click on the map itself routes to that point (fx, fy are 0..1 across the canvas).
   */
  map(draw: (c: HTMLCanvasElement, zoom: number) => void, legend: Array<[string, string]>, startZoom = 2, route?: {
    places: Array<{ id: string; label: string }>; current: string | null;
    pick: (id: string) => void; pickPoint: (fx: number, fy: number, zoom: number) => void; clear: () => void;
  }): Promise<void> {
    return new Promise((resolve) => {
      const p = el("div", "panel mapwrap");
      const c = el("canvas");
      const short = window.innerHeight < 520;
      // Leave room for the route row under the map when there is one.
      const h = Math.max(150, Math.min(window.innerHeight * 0.72, 660, window.innerHeight - (short ? 84 : 190) - (route ? 52 : 0)));
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
      if (route) {
        const done = () => { this.closeModal(); resolve(); };
        const row = el("div", "routebar");
        // As wide as the map and no wider: the places scroll sideways.
        row.style.width = `${c.width}px`;
        row.append(el("span", "routehead", route.current ? `Route: <b>${esc(route.current)}</b>` : "Route to…"));
        if (route.current) { const x = el("button", "btn", "✕ Clear route"); x.onclick = () => { route.clear(); done(); }; row.append(x); }
        for (const pl of route.places) { const b = el("button", "btn chip", esc(pl.label)); b.onclick = () => { route.pick(pl.id); done(); }; row.append(b); }
        p.append(row);
        requestAnimationFrame(() => { row.scrollLeft = 0; });
        // Tap / click anywhere on the map: a route to that spot.
        c.addEventListener("click", (e) => {
          const r = c.getBoundingClientRect();
          route.pickPoint((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, zoom);
          done();
        });
        c.style.cursor = "crosshair";
      }
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
  /** Overall graphics preset; picking one resets the detail settings below. */
  quality: Quality;
  shadows: "off" | "low" | "high"; post: boolean; showFps: boolean;
  /** Render resolution as a fraction of the window (1 = native). */
  renderScale: number;
  /** Keep the compact control strip visible whenever driving. */
  driveHints: boolean;
  /** Rendering backend. "auto" is WebGL; WebGPU only when picked. */
  renderer: "auto" | "webgl" | "webgpu";
  /** What a spoken line shows: words over the speaker, the same plus a caption line at the bottom, or nothing. */
  subtitles: "bubbles" | "captions" | "off";
  /** Interface size: 1, 1.15 or 1.3. */
  textSize: number;
  /** Softer lightning. */
  gentleFlash: boolean;
  /** Prices are shown but nothing is charged (shops, fuel, fares, the tiffin ingredients, the family's dues). */
  freePlay: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, sfx: 0.9, ambience: 0.5, music: 0.7, muted: false,
  sensitivity: 1, keySpeed: 1, invertY: false,
  quality: "high", shadows: "low", post: true, showFps: false, renderScale: 1, driveHints: false, renderer: "auto", subtitles: "bubbles", textSize: 1, gentleFlash: false, freePlay: false,
};

/** Fold a preset's rendering knobs into a settings object. */
export function withQuality(s: Settings, q: Quality): Settings {
  const p = preset(q);
  return { ...s, quality: q, shadows: p.shadows, post: p.post, renderScale: p.renderScale };
}
