import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import type { PBRMaterial } from "../babylon";
import { CANAL } from "../world/region";

/** A single-pass stylised water treatment. It shares the existing canal mesh
 * and PBR lights/shadows; no scene copies, depth target or per-frame geometry.
 * Near-bank colour is optical scattering against the concrete lining, rather
 * than a fictitious beach/depth profile. Small puddles keep their own tint. */
export class CanalWater extends MaterialPluginBase {
  private time = 0;

  constructor(material: PBRMaterial) {
    super(material, "CanalWater", 170, {}, true, true);
    const scene = material.getScene();
    const observer = scene.onBeforeRenderObservable.add(() => {
      this.time = (this.time + Math.min(scene.getEngine().getDeltaTime() / 1000, 0.1)) % 4096;
    });
    material.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(observer));
  }

  override isCompatible(): boolean { return true; }

  override getUniforms(shaderLanguage?: ShaderLanguage) {
    return {
      ubo: [{ name: "canalTime", size: 1, type: "float" }],
      fragment: shaderLanguage === ShaderLanguage.WGSL ? "" : "#ifndef UNIFORMBUFFERS\nuniform float canalTime;\n#endif",
    };
  }

  override bindForSubMesh(buffer: UniformBuffer): void { buffer.updateFloat("canalTime", this.time); }

  override getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage) {
    if (shaderType !== "fragment") return null;
    const wgsl = shaderLanguage === ShaderLanguage.WGSL;
    const f = (name: string, expression: string) => wgsl ? `let ${name}: f32 = ${expression};` : `float ${name} = ${expression};`;
    const v3 = (x: string) => `${wgsl ? "vec3f" : "vec3"}(${x})`;
    const position = wgsl ? "fragmentInputs.vPositionW" : "vPositionW";
    const time = wgsl ? "uniforms.canalTime" : "canalTime";
    return {
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
        if (abs(${position}.y - ${CANAL.waterY.toFixed(2)}) < 0.08 && ${position}.z > ${CANAL.z0.toFixed(2)} && ${position}.z < ${CANAL.z1.toFixed(2)}) {
          ${f("cwX", `${position}.x - ${time} * 0.42`)}
          ${f("cwZ", position + ".z")}
          ${f("cwEdge", `min(cwZ - ${(CANAL.z0 + 0.3).toFixed(2)}, ${(CANAL.z1 - 0.3).toFixed(2)} - cwZ)`)}
          ${f("cwWave", `sin(cwX * 1.6 + sin(cwZ * 2.1) * 0.9) + sin(cwX * 2.7 - cwZ * 1.9 + ${time} * 0.35) * 0.45`)}
          ${f("cwCross", `sin(cwX * 1.1 - cwZ * 2.4 + ${time} * 0.42)`)}
          ${f("cwBank", "1.0 - smoothstep(0.05, 2.4, cwEdge)")}
          ${f("cwFoamBreak", `smoothstep(-0.1, 0.75, sin(cwX * 4.2 + sin(cwX * 1.1) * 2.0 + ${time} * 0.8))`)}
          ${f("cwFoam", "(1.0 - smoothstep(0.025, 0.13 + 0.025 * cwWave, cwEdge)) * (0.12 + 0.48 * cwFoamBreak)")}
          ${f("cwCaustic", "pow(max(0.0, 1.0 - abs(cwWave + cwCross * 0.3)), 10.0) * cwBank")}
          surfaceAlbedo = mix(${v3("0.035, 0.22, 0.205")}, ${v3("0.105, 0.34, 0.265")}, cwBank * 0.7);
          surfaceAlbedo += ${v3("0.008, 0.018, 0.016")} * (cwWave * 0.5 + cwCross * 0.35);
          surfaceAlbedo += ${v3("0.12, 0.16, 0.10")} * cwCaustic * 0.38;
          surfaceAlbedo = mix(surfaceAlbedo, ${v3("0.60, 0.76, 0.68")}, cwFoam);
          normalW = normalize(normalW + ${v3("cwWave * 0.055, 0.0, cwCross * 0.07")});
        }
      `,
      // A broad sun lobe across a rough, nearly horizontal plane can cover
      // half the view at dusk. Break it into the small rippling highlights
      // of the art direction, with a soft energy shoulder rather than a
      // clipped white carpet. Diffuse light and actual shadows are preserved.
      CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: `
        #ifndef UNLIT
        #ifdef SPECULARTERM
        if (abs(${position}.y - ${CANAL.waterY.toFixed(2)}) < 0.08 && ${position}.z > ${CANAL.z0.toFixed(2)} && ${position}.z < ${CANAL.z1.toFixed(2)}) {
          ${f("cwGlintX", `${position}.x - ${time} * 0.42`)}
          ${f("cwGlintSeed", `fract(sin(floor(cwGlintX * 1.9) * 127.1 + floor(${position}.z * 2.7) * 311.7) * 43758.5453)`)}
          ${f("cwShimmer", `pow(max(0.0, sin(cwGlintX * 7.3 + ${position}.z * 10.8 + sin(${position}.z * 1.7) * 1.8 - ${time} * 1.6)), 14.0) * pow(max(0.0, sin(cwGlintX * 3.7 - ${position}.z * 8.4 + ${time} * 0.7)), 4.0) * smoothstep(0.48, 0.85, cwGlintSeed)`)}
          finalSpecularScaled = finalSpecularScaled / (${v3("1.0")} + finalSpecularScaled * 3.0) * (0.18 + cwShimmer * 0.82);
        }
        #endif
        #endif
      `,
    };
  }
}
