import { Vector3 } from "../babylon";
import { rgb } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { CANAL_LANDING } from "./canalLandingLayout";
import { tunyardBench } from "./tunyardBench";
import { tunyardBroadleaf } from "./tunyardTree";
import { lowpolyShrub } from "./lowpolyNature";

/** A modest landing at the existing steps, open to the road and the water.
 * Trees and low shrubs share the supplied opaque low-poly palette. */
export function buildCanalLanding(kit: Kit): void {
  const { x, z, halfWidth: rx, halfDepth: rz } = CANAL_LANDING;
  kit.frame(x, z, 0, 0);
  // An irregular oval of old paving follows the bank; a short continuation
  // reaches the south edge of Nehar Bank Road without entering its carriageway.
  const paving = kit.g("paver"), tint = rgb("#d0bda0"), n = 32;
  const centre = paving.vertex(0, 0.014, 0, 0, 1, 0, x / paving.uvScale, z / paving.uvScale, tint);
  const rim: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, r = 1 + 0.035 * Math.sin(a * 3 + 0.7);
    const px = Math.cos(a) * rx * r, pz = Math.sin(a) * rz * r;
    rim.push(paving.vertex(px, 0.014, pz, 0, 1, 0, (x + px) / paving.uvScale, (z + pz) / paving.uvScale, tint));
  }
  for (let i = 0; i < n; i++) paving.tri(centre, rim[i]!, rim[(i + 1) % n]!);
  kit.g("paver").box(0, 0.01, 3.5, 3.2, 0.02, 3, tint);
  // Two seats face the water, far from the central throw and stairs corridor.
  tunyardBench(kit, 38.5, 0, 182.5, Math.PI);
  tunyardBench(kit, 51.5, 0, 182.5, Math.PI);
  // A complete Tunyard tree on either end frames the landing without putting
  // a trunk in the walking lane. Both share their source trunk/branch/leaf mesh.
  tunyardBroadleaf(kit, 33, 0, 185, 0.8, 0.5);
  tunyardBroadleaf(kit, 57.5, 0, 185, 0.85, 2.1);
  // Plant the edge in a few irregular groups. Keep the steps, benches and
  // road approach clear, and leave the centre open to see the water.
  for (const [sx, sz, scale, yaw] of [[31.4, 184.4, 0.7, 0.2], [34, 186.2, 0.6, 2.1], [56.2, 186.2, 0.75, 1.5], [59, 184.8, 0.55, 0.8]] as const) lowpolyShrub(kit, sx, 0, sz, scale, yaw);
  southBankGrove(kit);
  kit.world();
}

/** A shaded neighborhood picnic clearing across the canal, reached from the
 * road without entering the house plots. All objects sit on the flat ground. */
function southBankGrove(kit: Kit): void {
  const earth = rgb("#b7a387"), timber = rgb("#8f765e");
  kit.frame(0, 0, 0, 0);
  const path = kit.g("dirt");
  const strip = (ax: number, az: number, bx: number, bz: number): void => {
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz), nx = -dz / length * 1.35, nz = dx / length * 1.35;
    path.quad(new Vector3(ax - nx, 0.012, az - nz), new Vector3(bx - nx, 0.012, bz - nz), new Vector3(bx + nx, 0.012, bz + nz), new Vector3(ax + nx, 0.012, az + nz), earth);
  };
  strip(34, 145.9, 34, 139); strip(34, 139, 30, 130);
  // Flat, gently irregular dirt clearing instead of paving a large rectangle.
  kit.frame(30, 127, 0, 0);
  const ground = kit.g("dirt"), centre = ground.vertex(0, 0.013, 0, 0, 1, 0, 30 / ground.uvScale, 127 / ground.uvScale, earth), rim: number[] = [];
  for (let i = 0; i < 28; i++) {
    const a = i * Math.PI * 2 / 28, r = 1 + 0.04 * Math.sin(a * 3 + 1), x = Math.cos(a) * 6 * r, z = Math.sin(a) * 5 * r;
    rim.push(ground.vertex(x, 0.013, z, 0, 1, 0, (30 + x) / ground.uvScale, (127 + z) / ground.uvScale, earth));
  }
  for (let i = 0; i < rim.length; i++) ground.tri(centre, rim[i]!, rim[(i + 1) % rim.length]!);
  // A real, collidable table and two original Tunyard benches.
  kit.g("wood").box(0, 0.75, 0, 1.8, 0.12, 0.9, timber);
  for (const x of [-0.72, 0.72]) for (const z of [-0.3, 0.3]) kit.g("wood").box(x, 0.36, z, 0.1, 0.72, 0.1, timber);
  kit.collide(0, 0.4, 0, 1.8, 0.8, 0.9);
  tunyardBench(kit, 28, 0, 125.5, 0);
  tunyardBench(kit, 32, 0, 125.5, 0);
  for (const [x, z, scale, yaw] of [[18,136,0.85,0.8], [41,136,0.8,2.1], [21,117,0.9,1.5]] as const) tunyardBroadleaf(kit, x, 0, z, scale, yaw);
  for (const [x, z, scale, yaw] of [[17,134,0.8,1.2], [19.4,137,0.6,0.4], [40,137,0.7,2.3], [22.5,117,0.7,1.4], [19.8,116,0.5,0.3]] as const) lowpolyShrub(kit, x, 0, z, scale, yaw);
}
