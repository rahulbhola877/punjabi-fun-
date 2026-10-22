import * as THREE from 'three';
import { Character, HAIR_COLORS, SKIN_TONES } from './character';
import { outfitsFor } from './outfits';
import type { Archetype } from './rig';

export interface PopulationPreset {
  id: string;
  label: string;
  blurb: string;
  mix: { arch: Archetype; outfit: string; w: number }[];
}

/** Ready-made city populations. Each entry is { archetype, outfit-id, weight }. */
export const POPULATIONS: PopulationPreset[] = [
  {
    id: 'bazaar', label: 'Bazaar crowd', blurb: 'A normal busy day in the old city.',
    mix: [
      { arch: 'male', outfit: 'kurta_pajama', w: 3 }, { arch: 'uncle', outfit: 'kurta_pajama', w: 3 }, { arch: 'uncle', outfit: 'farmer', w: 2 },
      { arch: 'aunty', outfit: 'patiala_suit', w: 3 }, { arch: 'aunty', outfit: 'winter_aunty', w: 1 }, { arch: 'female', outfit: 'patiala_suit', w: 3 },
      { arch: 'male', outfit: 'business', w: 2 }, { arch: 'female', outfit: 'business_f', w: 1 }, { arch: 'male', outfit: 'police', w: 1 }, { arch: 'male', outfit: 'dhaba', w: 1 },
      { arch: 'boy', outfit: 'kurta_pajama', w: 1 }, { arch: 'girl', outfit: 'patiala_suit', w: 1 }, { arch: 'male', outfit: 'student', w: 2 }, { arch: 'female', outfit: 'college_f', w: 2 },
      // the other communities of the city
      { arch: 'male', outfit: 'diwali_kurta', w: 1 }, { arch: 'uncle', outfit: 'pandit', w: 1 }, { arch: 'male', outfit: 'eid_kurta', w: 1 }, { arch: 'uncle', outfit: 'imam', w: 1 },
      { arch: 'uncle', outfit: 'pagri_farmer', w: 1 }, { arch: 'uncle', outfit: 'netaji', w: 1 }, { arch: 'male', outfit: 'office_casual', w: 2 }, { arch: 'male', outfit: 'church_m', w: 1 },
      { arch: 'female', outfit: 'diwali_suit', w: 1 }, { arch: 'aunty', outfit: 'saree', w: 1 }, { arch: 'female', outfit: 'eid_suit', w: 1 }, { arch: 'aunty', outfit: 'eid_suit', w: 1 },
      { arch: 'female', outfit: 'casual_f', w: 2 }, { arch: 'female', outfit: 'church_f', w: 1 }, { arch: 'boy', outfit: 'street_casual', w: 1 }, { arch: 'girl', outfit: 'casual_f', w: 1 },
    ],
  },
  {
    id: 'mohalla', label: 'Mixed mohalla (all communities)', blurb: 'Sikh, Hindu, Muslim and Christian neighbours greeting each other in their own way.',
    mix: [
      { arch: 'male', outfit: 'kurta_pajama', w: 2 }, { arch: 'female', outfit: 'patiala_suit', w: 2 }, { arch: 'uncle', outfit: 'kurta_pajama', w: 1 },
      { arch: 'male', outfit: 'diwali_kurta', w: 2 }, { arch: 'uncle', outfit: 'pandit', w: 1 }, { arch: 'female', outfit: 'diwali_suit', w: 2 }, { arch: 'aunty', outfit: 'saree', w: 2 },
      { arch: 'male', outfit: 'eid_kurta', w: 2 }, { arch: 'uncle', outfit: 'imam', w: 1 }, { arch: 'female', outfit: 'eid_suit', w: 2 }, { arch: 'aunty', outfit: 'eid_suit', w: 1 },
      { arch: 'male', outfit: 'church_m', w: 1 }, { arch: 'female', outfit: 'church_f', w: 1 }, { arch: 'aunty', outfit: 'church_f', w: 1 },
      { arch: 'uncle', outfit: 'netaji', w: 1 }, { arch: 'uncle', outfit: 'pagri_farmer', w: 1 }, { arch: 'boy', outfit: 'eid_kurta', w: 1 }, { arch: 'girl', outfit: 'diwali_suit', w: 1 },
      { arch: 'boy', outfit: 'street_casual', w: 1 }, { arch: 'girl', outfit: 'casual_f', w: 1 },
    ],
  },
  {
    id: 'police', label: 'Police patrol', blurb: 'Punjab Police on duty among civilians.',
    mix: [
      { arch: 'male', outfit: 'police', w: 5 }, { arch: 'uncle', outfit: 'police', w: 2 }, { arch: 'female', outfit: 'police_f', w: 3 },
      { arch: 'uncle', outfit: 'kurta_pajama', w: 2 }, { arch: 'aunty', outfit: 'patiala_suit', w: 2 }, { arch: 'male', outfit: 'business', w: 1 },
    ],
  },
  {
    id: 'wedding', label: 'Wedding baraat', blurb: 'Festive wear, bhangra and giddha.',
    mix: [
      { arch: 'male', outfit: 'bhangra', w: 4 }, { arch: 'male', outfit: 'festive', w: 3 }, { arch: 'uncle', outfit: 'festive', w: 3 },
      { arch: 'female', outfit: 'giddha', w: 4 }, { arch: 'female', outfit: 'bridal', w: 1 }, { arch: 'aunty', outfit: 'patiala_suit', w: 2 },
      { arch: 'boy', outfit: 'festive', w: 2 }, { arch: 'girl', outfit: 'giddha', w: 2 },
    ],
  },
  {
    id: 'gurdwara', label: 'Gurdwara / sangat', blurb: 'Sewadars, Nihang Singhs and families.',
    mix: [
      { arch: 'male', outfit: 'sewadar', w: 3 }, { arch: 'uncle', outfit: 'sewadar', w: 2 }, { arch: 'male', outfit: 'nihang', w: 2 },
      { arch: 'female', outfit: 'sewadar_f', w: 3 }, { arch: 'aunty', outfit: 'sewadar_f', w: 3 }, { arch: 'boy', outfit: 'sewadar', w: 1 }, { arch: 'girl', outfit: 'sewadar_f', w: 1 },
    ],
  },
  {
    id: 'campus', label: 'College & school', blurb: 'Students and school kids.',
    mix: [
      { arch: 'male', outfit: 'student', w: 3 }, { arch: 'female', outfit: 'college_f', w: 3 }, { arch: 'boy', outfit: 'school', w: 3 }, { arch: 'girl', outfit: 'school_f', w: 3 },
      { arch: 'male', outfit: 'kabaddi', w: 2 },
    ],
  },
  {
    id: 'village', label: 'Village mela', blurb: 'Farmers, dhaba owners and village women.',
    mix: [
      { arch: 'uncle', outfit: 'farmer', w: 4 }, { arch: 'male', outfit: 'farmer', w: 2 }, { arch: 'male', outfit: 'dhaba', w: 2 },
      { arch: 'aunty', outfit: 'village_f', w: 4 }, { arch: 'female', outfit: 'village_f', w: 2 }, { arch: 'male', outfit: 'kabaddi', w: 2 },
      { arch: 'uncle', outfit: 'winter_uncle', w: 1 }, { arch: 'boy', outfit: 'kabaddi', w: 1 },
    ],
  },
];

export interface Obstacle { x: number; z: number; r: number }
export interface CrowdBounds { minX: number; maxX: number; minZ: number; maxZ: number }

type State = 'walk' | 'idle' | 'act' | 'greet';
interface Agent {
  char: Character; state: State; timer: number; target: THREE.Vector3; pace: number; yaw: number;
  fav: string[];                // signature actions for this outfit
  runner: boolean; running: boolean; greetCool: number; greetWith?: Agent;
}

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function favourites(arch: Archetype, outfit: string): string[] {
  const f: string[] = ['talk', 'laugh', 'wave'];
  if (outfit.startsWith('police')) f.push('salute', 'point', 'point');
  if (outfit === 'bhangra') f.push('bhangra', 'bhangra', 'bhangra');
  if (outfit === 'giddha' || outfit === 'bridal') f.push('giddha', 'giddha', 'clap');
  if (outfit === 'festive') f.push('bhangra', 'clap');
  if (outfit === 'dhaba' || outfit === 'farmer' || outfit === 'winter_uncle') f.push('drink_chai', 'drink_chai', 'eat');
  if (outfit.startsWith('sewadar')) f.push('pray', 'sat_sri_akal', 'sat_sri_akal');
  if (outfit === 'nihang' || outfit === 'kabaddi') f.push('fight_idle', 'punch', 'kick', 'victory');
  if (outfit === 'business' || outfit === 'business_f') f.push('point', 'shrug');
  if (arch === 'boy' || arch === 'girl') f.push('jump', 'jump', 'clap', 'victory');
  if (outfit === 'student' || outfit === 'college_f' || outfit === 'school' || outfit === 'school_f') f.push('wave', 'laugh', 'shrug');
  if (outfit === 'eid_kurta' || outfit === 'eid_suit' || outfit === 'imam') f.push('dua', 'talk', 'salaam');
  if (outfit === 'pandit') f.push('pray', 'namaste');
  if (outfit === 'diwali_kurta' || outfit === 'diwali_suit' || outfit === 'saree') f.push('clap', 'namaste', 'giddha');
  if (outfit === 'church_m' || outfit === 'church_f') f.push('pray', 'clap');
  if (outfit === 'netaji') f.push('point', 'wave', 'shrug', 'talk');
  if (outfit === 'pagri_farmer') f.push('drink_chai', 'drink_chai', 'bhangra');
  if (outfit === 'office_casual' || outfit === 'street_casual' || outfit === 'casual_f') f.push('shrug', 'laugh', 'wave');
  if (arch === 'aunty' || arch === 'uncle') f.push('shrug', 'point');
  return f;
}

/** Simple wandering crowd: walk to random points, chat, dance, eat and greet neighbours with Sat Sri Akal. */
export class Crowd {
  readonly group = new THREE.Group();
  agents: Agent[] = [];
  obstacles: Obstacle[] = [];
  private rng = mulberry(1234);
  private scan = 0;
  private static TOPS = ['#f2ead8', '#e8d9b5', '#d8e4ef', '#e9c6c0', '#cfe3cf', '#f3e2a8', '#c9b8de'];
  private static TURBANS = ['#ee8a1c', '#1d3f8a', '#f6f1e4', '#9c1f2e', '#2a2a2f', '#0f6d5d', '#f2c230', '#7a3fa0', '#d9467a'];

  constructor(public bounds: CrowdBounds) {}

  clear() {
    for (const a of this.agents) { this.group.remove(a.char.root); a.char.dispose(); }
    this.agents = [];
  }

  spawn(presetId: string, count: number, seed = Math.floor(Math.random() * 99999)) {
    const preset = POPULATIONS.find((p) => p.id === presetId) ?? POPULATIONS[0];
    this.rng = mulberry(seed);
    const total = preset.mix.reduce((s, m) => s + m.w, 0);
    for (let i = 0; i < count; i++) {
      let r = this.rng() * total, pick = preset.mix[0];
      for (const m of preset.mix) { if ((r -= m.w) <= 0) { pick = m; break; } }
      this.add(pick.arch, pick.outfit);
    }
  }

  add(arch: Archetype, outfit: string, at?: THREE.Vector3) {
    const rng = this.rng;
    const def = outfitsFor(arch).find((o) => o.id === outfit) ?? outfitsFor(arch)[0];
    const colors: Record<string, string> = { skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)] };
    if (arch !== 'aunty' && arch !== 'uncle') colors.hair = HAIR_COLORS[Math.floor(rng() * 3)];
    if (def.head.kind === 'dastar' || def.head.kind === 'patka') colors.head = Crowd.TURBANS[Math.floor(rng() * Crowd.TURBANS.length)];
    if (def.top.kind === 'kurta' && def.id !== 'nihang' && rng() < 0.7) colors.top = Crowd.TOPS[Math.floor(rng() * Crowd.TOPS.length)];
    const c = new Character({ archetype: arch, outfit: def.id, colors });
    c.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    c.root.position.copy(at ?? this.randomPoint());
    const yaw = rng() * Math.PI * 2;
    c.root.rotation.y = yaw;
    this.group.add(c.root);
    const kid = arch === 'boy' || arch === 'girl';
    const a: Agent = { char: c, state: 'idle', timer: rng() * 3, target: c.root.position.clone(), pace: 0.85 + rng() * 0.3, yaw, fav: favourites(arch, def.id), runner: kid, running: false, greetCool: 3 + rng() * 6 };
    c.play('idle', { fade: 0 });
    c.mixer!.update(rng() * 3);
    this.agents.push(a);
    return a;
  }

  randomPoint() {
    const b = this.bounds;
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Vector3(b.minX + this.rng() * (b.maxX - b.minX), 0, b.minZ + this.rng() * (b.maxZ - b.minZ));
      if (!this.obstacles.some((o) => (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < (o.r + 0.5) ** 2)) return p;
    }
    return new THREE.Vector3(0, 0, 0);
  }

  private decide(a: Agent) {
    const r = this.rng();
    if (r < 0.55) {
      a.target = this.randomPoint();
      a.state = 'walk';
      a.timer = 30;
      a.running = a.runner && this.rng() < 0.5;
      a.char.play(a.running ? 'run' : 'walk');
      a.pace = a.running ? 1.0 : 0.85 + this.rng() * 0.3;
    } else if (r < 0.7) {
      a.state = 'idle'; a.timer = 2 + this.rng() * 4; a.char.play('idle');
    } else {
      const clip = a.fav[Math.floor(this.rng() * a.fav.length)];
      a.state = 'act'; a.char.play(clip, { restart: true });
      const d = a.char.clipList.find((c) => c.name === clip)!;
      a.timer = d.loop ? 3 + this.rng() * 4 : d.duration / a.char.rig.body.tempo + 0.4;
    }
  }

  update(dt: number) {
    const b = this.bounds;
    this.scan -= dt;
    for (const a of this.agents) {
      a.char.update(dt);
      a.greetCool -= dt;
      a.timer -= dt;
      const root = a.char.root;
      if (a.state === 'walk') {
        const to = a.target.clone().sub(root.position); to.y = 0;
        const dist = to.length();
        if (dist < 0.4 || a.timer <= 0) { a.state = 'idle'; a.timer = 0.2; continue; }
        to.divideScalar(dist);
        for (const o of this.obstacles) {
          const dx = root.position.x - o.x, dz = root.position.z - o.z, d2 = dx * dx + dz * dz, rr = o.r + 0.6;
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.01; to.x += (dx / d) * (rr - d) * 2; to.z += (dz / d) * (rr - d) * 2; }
        }
        for (const o of this.agents) {
          if (o === a) continue;
          const dx = root.position.x - o.char.root.position.x, dz = root.position.z - o.char.root.position.z, d2 = dx * dx + dz * dz;
          if (d2 < 0.64 && d2 > 1e-4) { const d = Math.sqrt(d2); to.x += (dx / d) * (0.8 - d) * 1.5; to.z += (dz / d) * (0.8 - d) * 1.5; }
        }
        to.normalize();
        const want = Math.atan2(to.x, to.z);
        let dy = want - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        a.yaw += dy * Math.min(1, dt * 6);
        root.rotation.y = a.yaw;
        const sp = a.char.speedFor(a.running ? 'run' : 'walk') * a.pace * (Math.abs(dy) > 1.2 ? 0.3 : 1);
        root.position.x = Math.min(b.maxX, Math.max(b.minX, root.position.x + Math.sin(a.yaw) * sp * dt));
        root.position.z = Math.min(b.maxZ, Math.max(b.minZ, root.position.z + Math.cos(a.yaw) * sp * dt));
      } else if (a.state === 'greet') {
        const o = a.greetWith!;
        const dx = o.char.root.position.x - root.position.x, dz = o.char.root.position.z - root.position.z;
        let dy = Math.atan2(dx, dz) - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        a.yaw += dy * Math.min(1, dt * 5); root.rotation.y = a.yaw;
        if (a.timer <= 0) { a.state = 'idle'; a.timer = 0.5; a.greetWith = undefined; }
      } else if (a.timer <= 0) this.decide(a);
    }
    if (this.scan <= 0) {
      this.scan = 0.6;
      for (let i = 0; i < this.agents.length; i++) {
        const a = this.agents[i];
        if (a.state !== 'walk' || a.greetCool > 0) continue;
        for (let j = i + 1; j < this.agents.length; j++) {
          const o = this.agents[j];
          if (o.state !== 'walk' || o.greetCool > 0) continue;
          const dx = a.char.root.position.x - o.char.root.position.x, dz = a.char.root.position.z - o.char.root.position.z;
          if (dx * dx + dz * dz < 1.8 * 1.8) {
            for (const [p, q] of [[a, o], [o, a]] as [Agent, Agent][]) {
              p.state = 'greet'; p.greetWith = q; p.greetCool = 12 + this.rng() * 10;
              p.char.play(p.char.greeting.clip, { restart: true });
              p.timer = 3.1 / p.char.rig.body.tempo;
            }
            break;
          }
        }
      }
    }
  }
}
