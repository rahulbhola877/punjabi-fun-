import { secondaryTouchClick } from "./secondaryTouchClick";
/**
 * DOM-based interface. Uses native <button>/<input> elements so keyboard
 * focus, Enter/Space activation and screen readers work out of the box.
 */
import { DEV_TOOLS, GAME_NAME, GAME_NAME_PA } from "../app/config";
import { PRESETS, QUALITIES, preset, type Quality } from "../app/quality";
import { reservedBindingMessage } from "../input/Input";

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
  onStoriesTap: (() => void) | null = null;
  /** Open the destination selector directly from the game HUD. */
  /** Opt into the low-cost preset without navigating the settings menu. */
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
    const storiesBtn = el("button", "chip travelbtn", "📖 <span>Stories</span>");
    storiesBtn.title = "Punjab stories — choose a mission to follow";
    storiesBtn.setAttribute("aria-label", "Punjab stories: choose a mission");
    storiesBtn.onclick = () => this.onStoriesTap?.();
    this.clockEl = el("div", "chip", "08:30");
    this.clockEl.setAttribute("aria-label", "Time of day");
    wallet.append(m, r, this.clockEl, this.healthEl, this.wantedEl, this.buffEl, storiesBtn, this.travelBtn);
    this.objEl = el("div", "objective hidden");
    this.objEl.setAttribute("role", "status");
    this.compassEl = el("div", "compass hidden", `<svg viewBox="0 0 36 36" width="36" height="36"><path d="M18 3 L29 31 L18 24 L7 31 Z" fill="#ffd36b" stroke="#3a2209" stroke-width="2"/></svg>`);
    // Keep the direction arrow below the actual objective height, including
    // wrapped text and larger accessibility text sizes.
    const objectiveDock = el("div", "objective-dock");
    objectiveDock.append(this.objEl, this.compassEl);
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
    this.hud.append(wallet, objectiveDock, this.promptEl, this.speedoEl, this.toastsEl, this.jobEl, this.matchEl, this.recoverEl, this.hintsEl, this.perfEl, this.minimap);
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
    this.moneyEl.textContent = Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "₹∞";
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
      <svg class="ld-scene" viewBox="0 0 1200 750" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="ldsky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111b35"/><stop offset=".52" stop-color="#3f2856"/><stop offset="1" stop-color="#b45c4a"/></linearGradient>
          <radialGradient id="ldglow"><stop stop-color="#f9d486" stop-opacity=".42"/><stop offset="1" stop-color="#e89b6e" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1200" height="750" fill="url(#ldsky)"/>
        <circle cx="970" cy="240" r="300" fill="url(#ldglow)"/>
        <g fill="#ffe5af" opacity=".7"><circle cx="102" cy="91" r="2"/><circle cx="274" cy="166" r="2"/><circle cx="440" cy="70" r="1.5"/><circle cx="735" cy="105" r="2"/><circle cx="917" cy="76" r="1.5"/><circle cx="1087" cy="158" r="2"/><circle cx="1150" cy="72" r="1.5"/></g>
        <g class="ld-orbit" fill="none" stroke="#f5cc98" stroke-opacity=".25"><ellipse cx="962" cy="276" rx="195" ry="68" transform="rotate(-21 962 276)"/><ellipse cx="962" cy="276" rx="139" ry="139" stroke-opacity=".18"/></g>
        <circle cx="962" cy="276" r="106" fill="#eec381" opacity=".16"/><circle cx="962" cy="276" r="71" fill="#edb37f" opacity=".35"/>
        <path fill="#6a5163" d="M0 548l120-67 79 42 117-102 104 99 123-89 107 85 100-59 116 91 89-65 145 65v202H0z"/>
        <path fill="#263246" d="M0 588l105-31 87 27 107-46 105 51 117-40 100 32 110-48 93 51 126-36 102 40 148-30v192H0z"/>
        <path fill="#141c2c" d="M0 750V624h58v-38h62v38h30v-26h43v26h29v-49h40v49h27v-34h65v34h26v-44h36v44h28v-24h59v24h31v-39h67v39h30v-20h45v20h27v-51h43v51h29v-31h61v31h25v-42h51v42h26v-28h54v28h30v-38h42v38h39v126z"/>
        <path d="M0 718C270 664 401 660 580 696s379 34 620-33v87H0z" fill="#0e1725"/>
        <path d="M484 750c70-35 138-35 208 0" fill="none" stroke="#f2bd72" stroke-width="3" stroke-dasharray="16 14" opacity=".65"/>
      </svg>
      <div class="ld-content"><div class="ld-eyebrow">ONE RIDE · MANY WORLDS</div>
        <div class="ld-logo"><div class="en">${esc(GAME_NAME)}</div><div class="pa">${esc(GAME_NAME_PA)}</div></div>
        <div class="ld-caption">From Ranggarh to wherever the road leads.</div>
        <div class="ld-progress"><div class="ld-text" role="status">${esc(text)}</div><div class="bar" role="progressbar" aria-label="Loading game" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="ld-tip"></div></div>
      </div>`);
    const tips = [
      "The North Airfield is your gateway to new places.",
      "Take the ridge road for a view over the countryside.",
      "Say Sat Sri Akal — a conversation can lead to a story.",
      "Try a flight, or take the long way round on four wheels.",
      "Explore a different world, then return whenever you like.",
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
    if (i) { const percent = Math.round(Math.max(0, Math.min(1, frac)) * 100); i.style.animation = "none"; i.style.marginLeft = "0"; i.style.width = `${percent}%`; i.parentElement?.setAttribute("aria-valuenow", String(percent)); }
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
      p.innerHTML = `<h2>Graphics</h2><div class="settings-note">Pick what suits your device. Choose Low if the game runs slowly; you can change this later in Settings.</div>`;
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
      t.innerHTML = `<div class="logo"><div class="en">${esc(GAME_NAME)}</div><div class="pa">${esc(GAME_NAME_PA)}</div><div class="tag">Your Punjab neighbourhood — play, ride, help people and make your own stories.</div></div>`;
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
      const touch = new AbortController();
      p.innerHTML = `<h2>${esc(title)}</h2>${note ? `<div style="margin-bottom:8px">${note}</div>` : ""}`;
      const col = el("div", "col");
      for (const it of items) {
        const b = el("button", "btn", esc(it.label));
        b.disabled = !!it.disabled;
        b.onclick = () => { touch.abort(); this.closeModal(); resolve(it.value); };
        secondaryTouchClick(b, touch.signal);
        col.append(b);
      }
      p.append(col);
      this.openModal(p);
      this.onModalKeys(["Escape"], () => { touch.abort(); this.closeModal(); resolve("__escape"); });
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
      const wallet = Number.isFinite(money) ? `₹${money.toLocaleString("en-IN")}` : "₹∞";
      p.innerHTML = `<h2>${esc(title)}</h2><div style="margin-bottom:8px">${intro}</div><div style="margin-bottom:6px">Your money: <b style="color:#ffe39a">${wallet}</b></div>`;
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
          note.textContent = `${preset(v.quality).note} Save and reload to apply the full world-detail change.`;
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
        p.append(el("div", "", `<span style="font-size:13px;opacity:.85">Select an action, then press the new key (Esc cancels). P stays reserved for Pause and F1 for Controls. Gamepads work automatically: left stick move/steer, right stick look, RT/LT throttle/brake, A jump, X interact, B horn, Y recover, Start pause.</span>`));
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
              if (e.code !== "Escape") {
                const reason = reservedBindingMessage(e.code);
                if (reason) this.toast(reason, "warn", 4000);
                else keys.rebind(action, e.code);
              }
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

  controls(keys?:KeyRemap): Promise<void> {
    return new Promise((resolve) => {
      const p = el("div", "panel menu-panel");
      const k = (s: string) => {
        const groups:Record<string,string[]>={"W A S D":["forward","left","back","right"],"A D":["left","right"],"J L I K":["camLeft","camRight","camUp","camDown"]};
        const actions:Record<string,string>={W:"forward",S:"back",Shift:"sprint",Space:"jump",E:"interact",F:"interact",Q:"attack",V:"weapon",G:"heavy",X:"heavy",U:"powers",H:"horn",R:"recover",N:"radio",C:"lookBack",M:"map",Tab:"map",Esc:"pause",P:"pause",F1:"help",T:"events",B:"bag"};
        const label=keys?(groups[s]?.map(a=>keys.get(a)).join(" · ")??(actions[s]?keys.get(actions[s]!):s)):s;
        return label.split(" ").map(x=>`<kbd>${x}</kbd>`).join(" ");
      };
      p.innerHTML = `<h2>Controls</h2><div class="controls-grid">
        <h3>On foot</h3>
        <div>${k("W A S D")}</div><div>Move (camera-relative)</div>
        <div>${k("Shift")}</div><div>Sprint</div>
        <div>${k("Space")}</div><div>Jump; hold in the air to glide while powers are on</div>
        <div>${k("E")}</div><div>Talk, pick up, deliver, ride — or pull a driver out of his car</div>
        <div>${k("Q")} / left click</div><div>Punch combo, or fire equipped pistol toward the camera</div>
        <div>${k("V")}</div><div>Equip / holster pistol after acquiring it</div>
        <div>${k("G")}</div><div>Power dash; with powers off, kick or swing a brick</div>
        <div>${k("U")}</div><div>Toggle free-roam superpowers (also ⚡ on touch)</div>
        <h3>Riding & driving</h3>
        <div>${k("W")} / ${k("S")}</div><div>Throttle / brake — keep holding brake when stopped to reverse</div>
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
        <div>${k("M")}</div><div>Map (＋ / － to zoom)</div>
        <div>${k("Esc")}</div><div>Pause, save, settings</div>
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
  quality: "high", shadows: "low", post: true, showFps: false, renderScale: 1, driveHints: false, renderer: "auto", subtitles: "bubbles", textSize: 1, gentleFlash: false, freePlay: true,
};

/** Fold a preset's rendering knobs into a settings object. */
export function withQuality(s: Settings, q: Quality): Settings {
  const p = preset(q);
  return { ...s, quality: q, shadows: p.shadows, post: p.post, renderScale: p.renderScale };
}
