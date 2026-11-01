import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { Color3, PBRMaterial, type Scene } from "../babylon";

export interface WaterShape { x: number; z: number; rx: number; rz: number; ellipse?: boolean; night?: boolean; outside?: boolean }

/** Lit transparent water, with an authored bank-distance profile. Geometry
 * underneath is the real bed; this adds scattering, broken foam and moving
 * normals in one surface pass. No full-scene reflection or resolution change. */
export function clearWater(scene: Scene, name: string, shape: WaterShape): PBRMaterial {
  const material = new PBRMaterial(name,scene);
  material.albedoColor=Color3.FromHexString("#308f91"); material.metallic=0; material.roughness=0.2;
  material.alpha=0.74; material.transparencyMode=PBRMaterial.PBRMATERIAL_ALPHABLEND;
  material.environmentIntensity=0.5; material.environmentBRDFTexture=null;
  material.useRadianceOverAlpha=false; material.backFaceCulling=false; material.maxSimultaneousLights=2;
  new WaterSurface(material,shape); return material;
}

class WaterSurface extends MaterialPluginBase {
  private time=0;
  constructor(material: PBRMaterial, private shape: WaterShape) {
    // Babylon asks for injection points while registering. Defer registration
    // until the authored shape exists (super runs before parameter fields).
    super(material,"ClearWater",180,{},false,false);
    this._pluginManager._addPlugin(this); this._enable(true);
    const scene=material.getScene();
    const observer=scene.onBeforeRenderObservable.add(()=>{ this.time=(this.time+Math.min(scene.getEngine().getDeltaTime()/1000,0.1))%4096; });
    material.onDisposeObservable.addOnce(()=>scene.onBeforeRenderObservable.remove(observer));
  }
  override isCompatible(): boolean { return true; }
  override getUniforms(language?: ShaderLanguage) {
    return { ubo:[{name:"waterTime",size:1,type:"float"}],fragment:language===ShaderLanguage.WGSL?"":"#ifndef UNIFORMBUFFERS\nuniform float waterTime;\n#endif" };
  }
  override bindForSubMesh(buffer: UniformBuffer): void { buffer.updateFloat("waterTime",this.time); }
  override getCustomCode(type: string, language?: ShaderLanguage) {
    if(type!=="fragment") return null;
    const w=language===ShaderLanguage.WGSL, p=w?"fragmentInputs.vPositionW":"vPositionW", t=w?"uniforms.waterTime":"waterTime";
    const f=(n:string,v:string)=>w?`let ${n}: f32 = ${v};`:`float ${n} = ${v};`;
    const v=(s:string)=>`${w?"vec3f":"vec3"}(${s})`;
    const num=(n:number)=>n.toFixed(4), s=this.shape;
    const edge=s.outside?`max(abs(wx)-${num(s.rx)},abs(wz)-${num(s.rz)})`:s.ellipse?`(1.0-length(${w?"vec2f":"vec2"}(wx/${num(s.rx)},wz/${num(s.rz)})))*${num(Math.min(s.rx,s.rz))}`:`min(${num(s.rx)}-abs(wx),${num(s.rz)}-abs(wz))`;
    return { CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
      ${f("wx",`${p}.x-${num(s.x)}`)} ${f("wz",`${p}.z-${num(s.z)}`)}
      ${f("wEdge",edge)}
      ${f("wWave",`sin(wx*2.1+wz*1.6-${t}*1.2)+sin(wx*3.8-wz*2.7+${t}*0.7)*0.35`)}
      ${f("wCross",`cos(wx*1.7-wz*2.5+${t}*0.95)`)}
      ${f("wDepth","smoothstep(0.05,3.2,wEdge)")}
      ${f("wBreak",`sin(wz*6.7+sin(wx*2.2)*2.0+${t}*0.85)*0.5+0.5`)}
      ${f("wFoam","(1.0-smoothstep(0.035,0.10+wBreak*0.15,wEdge))*smoothstep(0.28,0.8,wBreak)*0.55")}
      surfaceAlbedo=mix(${v(s.night?"0.05,0.28,0.32":"0.16,0.62,0.55")},${v(s.night?"0.015,0.055,0.15":"0.025,0.22,0.29")},wDepth);
      surfaceAlbedo+=${v("0.012,0.035,0.025")}*wWave;
      surfaceAlbedo=mix(surfaceAlbedo,${v("0.75,0.86,0.79")},wFoam);
      normalW=normalize(normalW+${v("wWave*0.035,0.0,wCross*0.045")});
      alpha=mix(0.38,0.83,wDepth)+wFoam*0.15;
    ` };
  }
}
