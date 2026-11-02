import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture";
import { Scene, Texture } from "../babylon";

/**
 * A small, offline sky reflection for water. This is an intentionally soft
 * approximation of the sky, not a scene reflection: it costs no render pass
 * and works on the low preset as well as in rain and at night.
 */
export function waterSky(scene: Scene): RawCubeTexture {
  const size = 32;
  const cube = new RawCubeTexture(scene, skyReflectionFaces(size), size, undefined, undefined, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  cube.name = "waterSky";
  return cube;
}

/** RawCubeTexture uses GL cube order: +X, -X, +Y, -Y, +Z, -Z. */
export function skyReflectionFaces(size=32):Uint8Array[] {
  const faces = Array.from({ length: 6 }, (_, face) => {
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (2 * (x + 0.5)) / size - 1, v = (2 * (y + 0.5)) / size - 1;
      // Side faces share the same horizon. Top and bottom use the angle from
      // their centres, keeping cube edges continuous and avoiding hard seams.
      const dirY = face === 2 ? 1 / Math.hypot(u, v, 1) : face === 3 ? -1 / Math.hypot(u, v, 1) : -v / Math.hypot(u, v, 1);
      const sky = Math.max(0, dirY), ground = Math.max(0, -dirY);
      const blend = Math.sqrt(sky);
      const horizon = [188, 207, 209], zenith = [110, 155, 190], earth = [92, 122, 112];
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const day = horizon[c]! * (1 - blend) + zenith[c]! * blend;
        pixels[i + c] = Math.round(day * (1 - ground * 0.7) + earth[c]! * ground * 0.7);
      }
      pixels[i + 3] = 255;
    }
    return pixels;
  });
  return faces;
}
