import { Color4, Matrix, Mesh, Scene, Vector3, VertexData, type Material } from "../babylon";

/**
 * Accumulates procedural geometry (positions, normals, UVs, vertex colours)
 * and produces a single mesh. All district scenery for one material ends up
 * in one builder, which keeps draw calls low.
 *
 * UVs are metric: 1 UV unit = `uvScale` metres, so tiled textures keep a
 * consistent texel density across differently sized pieces.
 */
export type RGB = [number, number, number];

export class GeoBuilder {
  positions: number[] = [];
  normals: number[] = [];
  uvs: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  /** Optional per-vertex skin data for characters. */
  boneIdx: number[] = [];
  boneW: number[] = [];
  private matrix: Matrix = Matrix.Identity();
  private normalMatrix: Matrix = Matrix.Identity();
  private tmpV = new Vector3();
  private tmpN = new Vector3();
  /** Active skin binding: [bone, weight] pairs (max 2 used). */
  skin: { a: number; b: number; w: number } | null = null;
  /** Per-vertex skin binding from the local (pre-transform) position; overrides `skin`. */
  skinFn: ((x: number, y: number, z: number) => { a: number; b: number; w: number }) | null = null;
  /** Character texture regions: cloth weave (left half) or flat skin (right half). */
  uvMode: "normal" | "cloth" | "skin" = "normal";

  constructor(public uvScale = 1) {}

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  setTransform(m: Matrix | null): void {
    this.matrix = m ?? Matrix.Identity();
    const inv = this.matrix.clone();
    inv.invert();
    this.normalMatrix = inv.transpose();
  }

  getTransform(): Matrix {
    return this.matrix;
  }

  /** Push one vertex in local space; transforms with the current matrix. */
  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, c: RGB, a = 1): number {
    Vector3.TransformCoordinatesFromFloatsToRef(x, y, z, this.matrix, this.tmpV);
    Vector3.TransformNormalFromFloatsToRef(nx, ny, nz, this.normalMatrix, this.tmpN);
    this.tmpN.normalize();
    this.positions.push(this.tmpV.x, this.tmpV.y, this.tmpV.z);
    this.normals.push(this.tmpN.x, this.tmpN.y, this.tmpN.z);
    if (this.uvMode === "skin") this.uvs.push(0.75, 0.5);
    else if (this.uvMode === "cloth") this.uvs.push((u - Math.floor(u)) * 0.46 + 0.02, (v - Math.floor(v)) * 0.96 + 0.02);
    else this.uvs.push(u, v);
    this.colors.push(c[0], c[1], c[2], a);
    if (this.skinFn) {
      const sk = this.skinFn(x, y, z);
      this.boneIdx.push(sk.a, sk.b, 0, 0);
      this.boneW.push(1 - sk.w, sk.w, 0, 0);
    } else if (this.skin) {
      this.boneIdx.push(this.skin.a, this.skin.b, 0, 0);
      this.boneW.push(1 - this.skin.w, this.skin.w, 0, 0);
    }
    return this.vertexCount - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  /**
   * Quad from 4 corners (counter-clockwise when viewed from the front side
   * in Babylon's left-handed convention, i.e. p0..p3 go clockwise visually).
   */
  quad(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, c: RGB, uvW = 0, uvH = 0, uvOff: [number, number] = [0, 0]): void {
    const e1 = p1.subtract(p0);
    const e2 = p3.subtract(p0);
    // Babylon front face: normal = cross(e2, e1) for p0..p3 in visual CCW order.
    const n = Vector3.Cross(e2, e1).normalize();
    const w = uvW || e1.length() / this.uvScale;
    const h = uvH || e2.length() / this.uvScale;
    const [ou, ov] = uvOff;
    const i0 = this.vertex(p0.x, p0.y, p0.z, n.x, n.y, n.z, ou, ov, c);
    const i1 = this.vertex(p1.x, p1.y, p1.z, n.x, n.y, n.z, ou + w, ov, c);
    const i2 = this.vertex(p2.x, p2.y, p2.z, n.x, n.y, n.z, ou + w, ov + h, c);
    const i3 = this.vertex(p3.x, p3.y, p3.z, n.x, n.y, n.z, ou, ov + h, c);
    this.tri(i0, i1, i2);
    this.tri(i0, i2, i3);
  }

  /**
   * Axis-aligned box in local space centred at (cx,cy,cz). `faces` can omit
   * hidden faces: order is +x,-x,+y,-y,+z,-z.
   */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, c: RGB, faces = 0b111111, uvOffset: [number, number] = [0, 0]): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2;
    const y0 = cy - sy / 2, y1 = cy + sy / 2;
    const z0 = cz - sz / 2, z1 = cz + sz / 2;
    const s = this.uvScale;
    const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
    const [ou, ov] = uvOffset;
    // Metric UVs anchored to local coordinates so adjacent boxes tile seamlessly.
    if (faces & 0b100000) this.quad(V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0), c, sz / s, sy / s, [ou + z0 / s, ov + y0 / s]);
    if (faces & 0b010000) this.quad(V(x0, y0, z1), V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), c, sz / s, sy / s, [ou - z1 / s, ov + y0 / s]);
    if (faces & 0b001000) this.quad(V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1), c, sx / s, sz / s, [ou + x0 / s, ov + z0 / s]);
    if (faces & 0b000100) this.quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y0, z0), V(x0, y0, z0), c, sx / s, sz / s, [ou + x0 / s, ov + z0 / s]);
    if (faces & 0b000010) this.quad(V(x1, y0, z1), V(x0, y0, z1), V(x0, y1, z1), V(x1, y1, z1), c, sx / s, sy / s, [ou - x1 / s, ov + y0 / s]);
    if (faces & 0b000001) this.quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0), c, sx / s, sy / s, [ou + x0 / s, ov + y0 / s]);
  }

  /** Box given min/max corners. */
  boxMinMax(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB, faces = 0b111111): void {
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), c, faces);
  }

  /**
   * Cylinder/frustum along local Y from y0 to y1 with radii r0 (bottom) and r1 (top).
   * `scaleZ` squashes the cross-section into an ellipse.
   */
  cylinder(cx: number, y0: number, cz: number, r0: number, r1: number, h: number, seg: number, c: RGB, caps = true, scaleZ = 1, cTop?: RGB): void {
    const y1 = y0 + h;
    const base = this.vertexCount;
    const slope = (r0 - r1) / h;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const n = new Vector3(ca, slope, sa * (1 / scaleZ)).normalize();
      const u = (i / seg) * ((Math.PI * 2 * Math.max(r0, r1)) / this.uvScale);
      this.vertex(cx + ca * r0, y0, cz + sa * r0 * scaleZ, n.x, n.y, n.z, u, 0, c);
      this.vertex(cx + ca * r1, y1, cz + sa * r1 * scaleZ, n.x, n.y, n.z, u, h / this.uvScale, cTop ?? c);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.tri(a, a + 3, a + 1);
      this.tri(a, a + 2, a + 3);
    }
    if (caps) {
      for (const [y, r, up] of [[y1, r1, 1], [y0, r0, -1]] as const) {
        if (r <= 0) continue;
        const center = this.vertex(cx, y, cz, 0, up, 0, 0.5, 0.5, up > 0 ? cTop ?? c : c);
        const ring = this.vertexCount;
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * Math.PI * 2;
          this.vertex(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r * scaleZ, 0, up, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5, up > 0 ? cTop ?? c : c);
        }
        for (let i = 0; i < seg; i++) {
          if (up > 0) this.tri(center, ring + i, ring + i + 1);
          else this.tri(center, ring + i + 1, ring + i);
        }
      }
    }
  }

  /** Cylinder whose axis runs along local X (wheels, grips). */
  cylinderX(cx: number, cy: number, cz: number, r: number, len: number, seg: number, c: RGB): void {
    const saved = this.matrix.clone();
    this.setTransform(Matrix.RotationZ(Math.PI / 2).multiply(Matrix.Translation(cx, cy, cz)).multiply(saved));
    this.cylinder(0, -len / 2, 0, r, r, len, seg, c, true);
    this.setTransform(saved);
  }

  /** Cylinder whose axis runs along local Z (lamps, discs facing forward). */
  cylinderZ(cx: number, cy: number, cz: number, r: number, len: number, seg: number, c: RGB): void {
    const saved = this.matrix.clone();
    this.setTransform(Matrix.RotationX(Math.PI / 2).multiply(Matrix.Translation(cx, cy, cz)).multiply(saved));
    this.cylinder(0, -len / 2, 0, r, r, len, seg, c, true);
    this.setTransform(saved);
  }

  /** UV sphere / ellipsoid. */
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, seg: number, rings: number, c: RGB, yMin = -1, yMax = 1, grad = 0): void {
    const base = this.vertexCount;
    const t0 = Math.acos(Math.min(1, Math.max(-1, yMax)));
    const t1 = Math.acos(Math.min(1, Math.max(-1, yMin)));
    for (let r = 0; r <= rings; r++) {
      const theta = t0 + (r / rings) * (t1 - t0);
      const st = Math.sin(theta), ct = Math.cos(theta);
      for (let s = 0; s <= seg; s++) {
        const phi = (s / seg) * Math.PI * 2;
        const x = Math.cos(phi) * st, z = Math.sin(phi) * st, y = ct;
        const n = new Vector3(x / rx, y / ry, z / rz).normalize();
        // Optional vertical gradient: darker undersides (foliage self-shadowing).
        const k = grad ? 1 - grad * (1 - (y + 1) / 2) : 1;
        const cc: RGB = k === 1 ? c : [c[0] * k, c[1] * k, c[2] * k];
        this.vertex(cx + x * rx, cy + y * ry, cz + z * rz, n.x, n.y, n.z, s / seg, r / rings, cc);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < seg; s++) {
        const a = base + r * (seg + 1) + s;
        const b = a + seg + 1;
        this.tri(a, b, a + 1);
        this.tri(a + 1, b, b + 1);
      }
    }
  }

  /** Torus in the local XZ plane (ring axis = Y). */
  torus(cx: number, cy: number, cz: number, R: number, r: number, seg: number, tubeSeg: number, c: RGB, axis: "y" | "x" = "y"): void {
    const base = this.vertexCount;
    for (let i = 0; i <= seg; i++) {
      const u = (i / seg) * Math.PI * 2;
      for (let j = 0; j <= tubeSeg; j++) {
        const v = (j / tubeSeg) * Math.PI * 2;
        const nx = Math.cos(u) * Math.cos(v), ny = Math.sin(v), nz = Math.sin(u) * Math.cos(v);
        const px = (R + r * Math.cos(v)) * Math.cos(u), py = r * Math.sin(v), pz = (R + r * Math.cos(v)) * Math.sin(u);
        if (axis === "y") this.vertex(cx + px, cy + py, cz + pz, nx, ny, nz, i / seg, j / tubeSeg, c);
        else this.vertex(cx + py, cy + px, cz + pz, ny, nx, nz, i / seg, j / tubeSeg, c);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < tubeSeg; j++) {
        const a = base + i * (tubeSeg + 1) + j;
        const b = a + tubeSeg + 1;
        if (axis === "y") { this.tri(a, b, a + 1); this.tri(a + 1, b, b + 1); }
        else { this.tri(a, a + 1, b); this.tri(a + 1, b + 1, b); }
      }
    }
  }

  /**
   * Loft a tube through a polyline of rings. Each ring: centre, radius x/z.
   * Used for limbs, tunics and pipes. Rings are assumed roughly vertical-ish
   * or along `dir`; the cross-section lies perpendicular to the segment.
   */
  loft(rings: Array<{ p: Vector3; rx: number; rz: number; c?: RGB; skin?: { a: number; b: number; w: number } }>, seg: number, c: RGB, capStart = false, capEnd = false): void {
    const base = this.vertexCount;
    const n = rings.length;
    const ref = new Vector3(0, 0, 1);
    for (let i = 0; i < n; i++) {
      const ring = rings[i]!;
      const prev = rings[Math.max(0, i - 1)]!.p;
      const next = rings[Math.min(n - 1, i + 1)]!.p;
      const dir = next.subtract(prev).normalize();
      let side = Vector3.Cross(dir, ref);
      if (side.lengthSquared() < 1e-4) side = Vector3.Cross(dir, new Vector3(1, 0, 0));
      side.normalize();
      const fwd = Vector3.Cross(side, dir).normalize();
      if (ring.skin) this.skin = ring.skin;
      for (let s = 0; s <= seg; s++) {
        const a = (s / seg) * Math.PI * 2;
        const ox = Math.cos(a), oz = Math.sin(a);
        const off = side.scale(ox * ring.rx).add(fwd.scale(oz * ring.rz));
        const nn = side.scale(ox / ring.rx).add(fwd.scale(oz / ring.rz)).normalize();
        const p = ring.p.add(off);
        this.vertex(p.x, p.y, p.z, nn.x, nn.y, nn.z, s / seg, i / (n - 1), ring.c ?? c);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < seg; s++) {
        const a = base + i * (seg + 1) + s;
        const b = a + seg + 1;
        this.tri(a, a + 1, b);
        this.tri(a + 1, b + 1, b);
      }
    }
    const capRing = (ri: number, flip: boolean) => {
      const ring = rings[ri]!;
      const other = rings[flip ? ri - 1 : ri + 1]!;
      const dn = ring.p.subtract(other.p).normalize();
      if (ring.skin) this.skin = ring.skin;
      const center = this.vertex(ring.p.x, ring.p.y, ring.p.z, dn.x, dn.y, dn.z, 0.5, 0.5, ring.c ?? c);
      const start = base + ri * (seg + 1);
      for (let s = 0; s < seg; s++) {
        if (flip) this.tri(center, start + s, start + s + 1);
        else this.tri(center, start + s + 1, start + s);
      }
    };
    if (capStart && n > 1) capRing(0, false);
    if (capEnd && n > 1) capRing(n - 1, true);
  }

  /** Thin tube between two points (wires, pipes, rails). */
  tube(a: Vector3, b: Vector3, r: number, seg: number, c: RGB): void {
    this.loft([{ p: a, rx: r, rz: r }, { p: b, rx: r, rz: r }], seg, c, false, false);
  }

  /** Merge another builder's geometry. */
  append(o: GeoBuilder): void {
    const base = this.vertexCount;
    this.positions.push(...o.positions);
    this.normals.push(...o.normals);
    this.uvs.push(...o.uvs);
    this.colors.push(...o.colors);
    for (const i of o.indices) this.indices.push(i + base);
    this.boneIdx.push(...o.boneIdx);
    this.boneW.push(...o.boneW);
  }

  isEmpty(): boolean {
    return this.indices.length === 0;
  }

  toMesh(name: string, scene: Scene, material: Material | null, updatable = false): Mesh {
    const mesh = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = this.positions;
    vd.normals = this.normals;
    vd.uvs = this.uvs;
    vd.colors = this.colors;
    vd.indices = this.indices;
    if (this.boneIdx.length) {
      vd.matricesIndices = this.boneIdx;
      vd.matricesWeights = this.boneW;
    }
    vd.applyToMesh(mesh, updatable);
    mesh.material = material;
    mesh.useVertexColors = true;
    mesh.hasVertexAlpha = false;
    return mesh;
  }
}

export const rgb = (hex: string): RGB => {
  const n = parseInt(hex.replace("#", ""), 16);
  // Convert sRGB hex to linear, matching PBR albedo expectations.
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
};

export const shade = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const color4 = (c: RGB, a = 1): Color4 => new Color4(c[0], c[1], c[2], a);
