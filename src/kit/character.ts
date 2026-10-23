import * as THREE from 'three';
import { BODIES, buildRig, type Archetype, type BuildTweak, type Rig } from './rig';
import { buildBodyGeometry } from './body';
import { buildFace, FaceController } from './face';
import { OUTFITS, getOutfit, outfitsFor, type OutfitDef, type PropId, communityOf, GREETINGS, type Community } from './outfits';
import { bakeClips, CLIP_DEFS, type ClipDef } from './animations';
import { makeProp, PROP_ATTACH } from './props';

export interface ColorOverrides {
  skin?: string; hair?: string; eyes?: string;
  top?: string; bottom?: string; head?: string; dupatta?: string; outer?: string; shoes?: string;
}
export interface CharacterOptions {
  archetype: Archetype;
  outfit?: string;
  colors?: ColorOverrides;
  /** include morph-target face animation tracks inside baked clips (needed when exporting GLB) */
  bakeFaceTracks?: boolean;
  /** skip creating the animation mixer (static meshes / export only) */
  noAnimation?: boolean;
  /** body proportions on top of the archetype's (game addition) */
  build?: BuildTweak;
}
export interface PlayOptions { fade?: number; speed?: number; loop?: boolean; clamp?: boolean; restart?: boolean }

export const SKIN_TONES = ['#e3b48a', '#d29a6a', '#c68a5a', '#b57a4c', '#a06a40', '#8a5632'];
export const HAIR_COLORS = ['#120d0b', '#2a1a10', '#4a3020', '#8a8680', '#e9e6df'];

const clipCache = new Map<string, THREE.AnimationClip[]>();

function applyOverrides(o: OutfitDef, c: ColorOverrides = {}): OutfitDef {
  const r: OutfitDef = JSON.parse(JSON.stringify(o));
  if (c.top) r.top.color = c.top;
  if (c.bottom) r.bottom.color = c.bottom;
  if (c.head) r.head.color = c.head;
  if (c.dupatta && r.dupatta) r.dupatta.color = c.dupatta;
  if (c.outer && r.outer) r.outer.color = c.outer;
  if (c.shoes) r.shoes.color = c.shoes;
  return r;
}

export class Character {
  readonly root = new THREE.Group();
  readonly archetype: Archetype;
  rig: Rig;
  body!: THREE.SkinnedMesh;
  face!: THREE.SkinnedMesh;
  faceCtl!: FaceController;
  mixer?: THREE.AnimationMixer;
  actions = new Map<string, THREE.AnimationAction>();
  outfit!: OutfitDef;
  colors: ColorOverrides;
  currentClip = '';
  private clipDefs = new Map<string, ClipDef>();
  private props: THREE.Object3D[] = [];
  private tempProps: THREE.Object3D[] = [];
  private bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  private noAnim: boolean;
  private bakeFace: boolean;
  private buildKey: string;

  constructor(opts: CharacterOptions) {
    this.archetype = opts.archetype;
    this.colors = { ...(opts.colors ?? {}) };
    this.noAnim = !!opts.noAnimation;
    this.bakeFace = !!opts.bakeFaceTracks;
    const spec = { ...BODIES[opts.archetype], ...(opts.build ?? {}) };
    this.buildKey = opts.build ? JSON.stringify(opts.build) : '';
    this.rig = buildRig(spec);
    this.root.name = `Punjabi_${opts.archetype}`;
    this.root.add(this.rig.root);
    for (const d of CLIP_DEFS) this.clipDefs.set(d.name, d);
    const out = getOutfit(opts.outfit ?? '') ?? outfitsFor(opts.archetype)[0] ?? OUTFITS[0];
    this.setOutfit(out.id, this.colors);
    if (!this.noAnim) this.initAnimation();
  }

  get clipNames(): string[] { return CLIP_DEFS.map((c) => c.name); }
  get clipList(): ClipDef[] { return CLIP_DEFS; }
  get outfits(): OutfitDef[] { return outfitsFor(this.archetype); }
  /** Community the current outfit is associated with (drives the greeting). */
  get community(): Community { return communityOf(this.outfit); }
  /** Greeting clip and Punjabi/English line for the current outfit (Sat Sri Akal, Namaste, Salaam...). */
  get greeting(): { clip: string; text: string } { return GREETINGS[this.community]; }
  /** Play the community-appropriate greeting; returns the spoken line (for a speech bubble). */
  greet(o: PlayOptions = {}): string { this.play(this.greeting.clip, { restart: true, ...o }); return this.greeting.text; }

  private initAnimation() {
    this.mixer = new THREE.AnimationMixer(this.root);
    for (const c of this.clips) this.actions.set(c.name, this.mixer.clipAction(c));
  }

  /** The baked clips for this archetype (e.g. to pass to GLTFExporter). */
  get clips(): THREE.AnimationClip[] {
    const key = `${this.archetype}|${this.bakeFace}|${this.buildKey}`;
    let clips = clipCache.get(key);
    if (!clips) { clips = bakeClips(this.rig, { bakeFace: this.bakeFace }); clipCache.set(key, clips); }
    return clips;
  }

  setOutfit(id: string, colors?: ColorOverrides) {
    const base = getOutfit(id);
    if (!base) throw new Error(`Unknown outfit: ${id}`);
    if (!base.for.includes(this.archetype)) console.warn(`[Punjab] outfit "${id}" is not designed for ${this.archetype}; building anyway.`);
    if (colors) this.colors = { ...colors };
    const spec = this.rig.body;
    const o = applyOverrides(base, this.colors);
    this.outfit = o;
    const skin = this.colors.skin ?? spec.skin;
    const hair = this.colors.hair ?? spec.hair;
    for (const m of [this.body, this.face]) if (m) { this.root.remove(m); m.geometry.dispose(); }
    for (const p of this.props) p.parent?.remove(p);
    this.props = [];
    const geo = buildBodyGeometry(this.rig, o, { skin, hair });
    this.body = new THREE.SkinnedMesh(geo, this.bodyMat);
    this.body.name = 'Body';
    this.body.frustumCulled = false;
    this.root.add(this.body);
    this.body.bind(this.rig.skeleton, new THREE.Matrix4());
    const fem = spec.sex === 'f';
    const brow = spec.age === 'elder' ? (fem ? '#8a867f' : '#cfcac2') : hair;
    this.face = buildFace(this.rig, { eye: this.colors.eyes ?? '#3a2312', brow, lip: fem ? '#a8434d' : spec.age === 'kid' ? '#b5645a' : '#8a4a3e', kid: spec.age === 'kid', female: fem });
    this.face.frustumCulled = false;
    this.root.add(this.face);
    this.face.bind(this.rig.skeleton, new THREE.Matrix4());
    const prevExpr = this.faceCtl?.expression ?? 'neutral';
    this.faceCtl = new FaceController(this.face);
    this.faceCtl.set(prevExpr);
    if (o.props?.R) this.attachProp(o.props.R, 'R');
    if (o.props?.L) this.attachProp(o.props.L, 'L');
    if (this.currentClip) this.applyClipFace(this.currentClip);
    return this;
  }

  private attachProp(id: PropId, side: 'L' | 'R', temp = false) {
    const s = this.rig.dims.s;
    const obj = makeProp(id, s, side);
    const where = PROP_ATTACH[id] ?? 'hand';
    const bone = where === 'chest' ? this.rig.byName['Chest'] : this.rig.byName[`Hand_${side}`];
    bone.add(obj);
    (temp ? this.tempProps : this.props).push(obj);
    obj.userData.side = side;
    obj.userData.prop = id;
    return obj;
  }

  setExpression(name: string, intensity = 1) { this.faceCtl.set(name, intensity); }

  private applyClipFace(name: string) {
    const d = this.clipDefs.get(name);
    if (!d) return;
    this.faceCtl.set(d.expr);
    this.faceCtl.talk = d.talk ?? 0;
    this.faceCtl.chew = d.chew ?? 0;
  }

  play(name: string, o: PlayOptions = {}) {
    if (!this.mixer) return null;
    const next = this.actions.get(name);
    const d = this.clipDefs.get(name);
    if (!next || !d) { console.warn(`[Punjab] unknown clip "${name}"`); return null; }
    const fade = o.fade ?? 0.25;
    const loop = o.loop ?? d.loop;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = o.clamp ?? !loop;
    next.timeScale = o.speed ?? 1;
    const prev = this.actions.get(this.currentClip);
    if (prev === next && !o.restart) return next;
    next.reset().fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    this.currentClip = name;
    this.applyClipFace(name);
    for (const p of this.tempProps) p.parent?.remove(p);
    this.tempProps = [];
    const hidden = new Set<string>();
    if (d.props) for (const side of ['R', 'L'] as const) {
      const id = d.props[side];
      if (id) { if (id !== 'none') this.attachProp(id as PropId, side, true); hidden.add(side); }
    }
    for (const p of this.props) p.visible = !hidden.has(p.userData.side) || PROP_ATTACH[p.userData.prop as PropId] === 'chest';
    return next;
  }

  stop(fade = 0.2) { for (const a of this.actions.values()) a.fadeOut(fade); this.currentClip = ''; }

  /** True once a one-shot clip (greeting, punch, ...) has ended. */
  get finished(): boolean {
    const a = this.actions.get(this.currentClip);
    return !!a && a.loop === THREE.LoopOnce && a.time >= a.getClip().duration - 1e-3;
  }

  update(dt: number) {
    this.mixer?.update(dt);
    const d = this.clipDefs.get(this.currentClip);
    if (d && !d.props) {
      for (const p of this.props) {
        if (p.userData.prop === 'schoolbag' || !p.visible) continue;
        const side = p.userData.side as 'L' | 'R';
        const m = side === 'L' ? 1 : -1;
        const f = this.rig.byName[`Fingers_${side}`], t = this.rig.byName[`Thumb_${side}`];
        f.quaternion.setFromEuler(new THREE.Euler(0, 0, -m * 1.25));
        t.quaternion.setFromEuler(new THREE.Euler(0.1, 0, -m * 0.8));
      }
    }
    this.faceCtl.update(dt);
  }

  /** Approximate ground speed (m/s) the locomotion clips look right at. */
  speedFor(clip: 'walk' | 'jog' | 'run'): number {
    const s = this.rig.dims.s, b = this.rig.body;
    const L = 0.85 * b.legK * s;
    if (clip === 'walk') return ((4 * L * Math.sin(0.46 * b.stride)) / (1.1 / b.tempo)) * 0.78;
    // Jog and sprint carry the body through the air between steps; these are the speeds they look right at.
    if (clip === 'jog') return 3.6 * s * b.legK * b.tempo * Math.min(1.05, b.stride + 0.1);
    return 6.0 * s * b.legK * b.tempo * Math.min(1.05, b.stride + 0.1);
  }

  dispose() {
    this.body.geometry.dispose(); this.face.geometry.dispose(); this.bodyMat.dispose();
    this.mixer?.stopAllAction();
  }
}
