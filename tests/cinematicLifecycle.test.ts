import { afterEach, describe, expect, it, vi } from "vitest";
import { NullEngine, Scene, UniversalCamera, Vector3 } from "../src/babylon";
import { CinematicDirector, sampleCinematic, type CinematicShot } from "../src/camera/CinematicDirector";
import { clearWater } from "../src/render/ClearWater";

const shots: CinematicShot[] = [
  {duration:2,eye:[0,10,0],end:[2,5,2],target:[0,1,5],caption:"Arrival"},
  {duration:1,eye:[2,2,4],end:[1,2,3],target:[0,1,5],caption:"Meet"},
];
class Element extends EventTarget {
  hidden=false;dataset:Record<string,string>={};className="";textContent="";
  children:Element[]=[]; removed=false;
  append(...children:Element[]):void {this.children.push(...children);}
  setAttribute():void {}
  remove():void {this.removed=true;}
}
afterEach(()=>vi.unstubAllGlobals());

describe("cinematic interruption and replay",()=>{
  it("advances across shots and completes at the real sequence boundary",()=>{
    expect(sampleCinematic(shots,1)).toMatchObject({index:0,t:0.5,done:false});
    expect(sampleCinematic(shots,2)).toMatchObject({index:1,t:0,done:false});
    expect(sampleCinematic(shots,3).done).toBe(true);
  });
  it("skip, natural completion, replacement and disposal restore camera and resolve once",async()=>{
    const engine=new NullEngine(),scene=new Scene(engine),camera=new UniversalCamera("test",new Vector3(7,3,-9),scene);
    camera.setTarget(new Vector3(1,2,3));camera.fov=0.95;
    const eye=camera.position.clone(),target=camera.getTarget().clone(),parent=new Element();
    vi.stubGlobal("document",Object.assign(new EventTarget(),{createElement:()=>new Element(),hidden:false}));
    vi.stubGlobal("window",new EventTarget());vi.stubGlobal("navigator",{getGamepads:()=>[]});
    const director=new CinematicDirector(parent as unknown as HTMLElement,camera);
    try {
      let released=0;const first=director.play(shots).then(()=>released++);
      director.update(0.25);expect(camera.position.equals(eye)).toBe(false);
      director.finish();director.finish();await first;expect(released).toBe(1);
      expect(camera.position.equals(eye)).toBe(true);expect(camera.getTarget().equalsWithEpsilon(target)).toBe(true);expect(camera.fov).toBe(0.95);
      const replay=director.play(shots);for(let i=0;i<12;i++)director.update(0.25);await replay;expect(director.active).toBe(false);
      const replaced=director.play(shots);const replacement=director.play(shots);await replaced;
      director.dispose();await replacement;expect(director.active).toBe(false);expect(camera.position.equals(eye)).toBe(true);
    } finally {director.dispose();scene.dispose();engine.dispose();}
  });
});

describe("water scene lifetime",()=>{
  it("registers the authored shape after construction and releases its animation observer",()=>{
    const engine=new NullEngine(),scene=new Scene(engine),before=scene.onBeforeRenderObservable.observers.length;
    try {
      const water=clearWater(scene,"testWater",{x:10,z:27,rx:4,rz:3,ellipse:true});
      expect(scene.onBeforeRenderObservable.observers.length).toBe(before+1);
      const plugin=water.pluginManager!.getPlugin("ClearWater")!;
      expect(plugin.getCustomCode("fragment")!.CUSTOM_FRAGMENT_BEFORE_LIGHTS).toContain("10.0000");
      expect(water.alpha).toBeLessThan(1);expect(scene.meshes).toHaveLength(0);
      for(let i=0;i<240;i++)scene.onBeforeRenderObservable.notifyObservers(scene);
      expect(scene.meshes).toHaveLength(0);water.dispose();
      expect(scene.onBeforeRenderObservable.hasObservers()).toBe(before>0);
    } finally {scene.dispose();engine.dispose();}
  });
});
