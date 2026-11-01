import { Vector3 } from "../babylon";
import { rgb, type RGB } from "../render/GeoBuilder";
import type { Kit } from "./Kit";
import { building, facadeFrame } from "./layout";

/** A textile seller's phulkari display on the existing first-floor balcony.
 * It is attached to the balcony rail and stays above the walkable pavement. */
export function buildTextileDisplay(kit: Kit): void {
  const facade = facadeFrame(building("w_textile"));
  kit.frame(facade.ox, facade.oz, facade.rotY);
  // Short folded samples leave the shop sign below the balcony readable.
  const width = 0.60, bottom = 4.34, top = 4.90, face = 1.025;
  const cloth = kit.g("fabric"), thread = kit.g("paint");
  const palettes = [
    { base: "#a94e45", edge: "#edc77c", stitch: "#f4d79b" },
    { base: "#365f5a", edge: "#d8b572", stitch: "#eed594" },
    { base: "#8c546d", edge: "#dfb276", stitch: "#f1d4a3" },
  ];
  const plane = (x0: number, y0: number, x1: number, y1: number, z: number, c: RGB) =>
    thread.quad(new Vector3(x1, y0, z), new Vector3(x0, y0, z), new Vector3(x0, y1, z), new Vector3(x1, y1, z), c);
  for (let i = 0; i < palettes.length; i++) {
    const p = palettes[i]!, centre = facade.width / 2 + (i - 1) * 0.70;
    const left = centre - width / 2, right = centre + width / 2;
    cloth.quad(new Vector3(right, bottom, face), new Vector3(left, bottom, face), new Vector3(left, top, face), new Vector3(right, top, face), rgb(p.base));
    // Hem and small stitched diamonds are flat details, not disconnected
    // objects. They sit just proud of the cloth to avoid depth flicker.
    const z = face + 0.004, border = rgb(p.edge), stitch = rgb(p.stitch);
    plane(left + 0.035, bottom + 0.04, right - 0.035, bottom + 0.065, z, border);
    plane(left + 0.035, top - 0.065, right - 0.035, top - 0.04, z, border);
    plane(left + 0.035, bottom + 0.04, left + 0.06, top - 0.04, z, border);
    plane(right - 0.06, bottom + 0.04, right - 0.035, top - 0.04, z, border);
    for (let row = 0; row < 2; row++) for (let col = -1; col <= 1; col++) {
      const x = centre + col * 0.14, y = bottom + 0.18 + row * 0.20, r = 0.035;
      thread.quad(new Vector3(x, y - r, z), new Vector3(x - r, y, z), new Vector3(x, y + r, z), new Vector3(x + r, y, z), stitch);
    }
    // A folded edge wraps over the rail, visibly supporting each shawl.
    cloth.quad(new Vector3(left, top, face), new Vector3(right, top, face), new Vector3(right, top + 0.025, face - 0.14), new Vector3(left, top + 0.025, face - 0.14), rgb(p.base));
  }
  kit.world();
}
