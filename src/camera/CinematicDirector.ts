import { Vector3, type UniversalCamera } from "../babylon";

export interface CinematicShot {
  duration: number;
  eye: readonly [number,number,number];
  end: readonly [number,number,number];
  target: readonly [number,number,number];
  targetEnd?: readonly [number,number,number];
  caption: string;
  fov?: number;
}

/** Deterministic shot sampling, shared by opening and real mission moments. */
export function sampleCinematic(shots: readonly CinematicShot[], time: number): { index: number; t: number; done: boolean } {
  let remaining = Math.max(0,time);
  for(let index=0;index<shots.length;index++) {
    const duration=Math.max(0.01,shots[index]!.duration);
    if(remaining<duration) { const t=remaining/duration; return {index,t:t*t*(3-2*t),done:false}; }
    remaining-=duration;
  }
  return {index:Math.max(0,shots.length-1),t:1,done:true};
}

/** This owns only the camera/letterbox, never story progress or rewards.
 * The host freezes simulation while active and clears held inputs on release. */
export class CinematicDirector {
  private root: HTMLDivElement;
  private caption: HTMLDivElement;
  private abort=new AbortController();
  private shots: readonly CinematicShot[]=[];
  private time=0;
  private complete: (()=>void) | null=null;
  private saved: {eye:Vector3;target:Vector3;fov:number}|null=null;
  private padDown=false;
  get active(): boolean { return this.complete!==null; }

  constructor(parent: HTMLElement, private camera: UniversalCamera) {
    const root=this.root=document.createElement("div"); root.className="cinematic"; root.hidden=true; root.dataset.cinematic="";
    root.setAttribute("role","region"); root.setAttribute("aria-label","In-game cinematic");
    this.caption=document.createElement("div"); this.caption.className="cinematic-caption"; this.caption.setAttribute("aria-live","polite");
    const skip=document.createElement("button"); skip.textContent="Skip · Esc / A"; skip.dataset.cinematicSkip="";
    skip.addEventListener("click",()=>this.finish(),{signal:this.abort.signal}); root.append(this.caption,skip); parent.append(root);
    window.addEventListener("keydown",e=>{
      if(!this.active||!['Escape','Space','Enter'].includes(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation(); if(!e.repeat) this.finish();
    },{capture:true,signal:this.abort.signal});
  }

  play(shots: readonly CinematicShot[]): Promise<void> {
    this.finish();
    if(!shots.length) return Promise.resolve();
    this.saved={eye:this.camera.position.clone(),target:this.camera.getTarget().clone(),fov:this.camera.fov};
    this.shots=shots; this.time=0; this.padDown=true; this.root.hidden=false; this.root.dataset.cinematicShot="0";
    return new Promise(resolve=>{this.complete=resolve;this.update(0);});
  }

  update(dt: number): void {
    if(!this.active) return;
    const gp=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
    const down=!!(gp?.buttons[0]?.pressed||gp?.buttons[1]?.pressed||gp?.buttons[9]?.pressed);
    if(down&&!this.padDown) {this.finish();return;} this.padDown=down;
    if(!document.hidden) this.time+=Math.max(0,Math.min(dt,0.25));
    const state=sampleCinematic(this.shots,this.time);
    if(state.done) {this.finish();return;}
    const shot=this.shots[state.index]!;
    const eye=Vector3.Lerp(Vector3.FromArray(shot.eye),Vector3.FromArray(shot.end),state.t);
    const at=Vector3.Lerp(Vector3.FromArray(shot.target),Vector3.FromArray(shot.targetEnd??shot.target),state.t);
    this.camera.position.copyFrom(eye); this.camera.setTarget(at); this.camera.fov=shot.fov??0.78;
    this.caption.textContent=shot.caption; this.root.dataset.cinematicShot=String(state.index);
  }

  finish(): void {
    if(!this.complete) return;
    const complete=this.complete;this.complete=null;
    if(this.saved) {this.camera.position.copyFrom(this.saved.eye);this.camera.setTarget(this.saved.target);this.camera.fov=this.saved.fov;}
    this.saved=null;this.root.hidden=true;this.shots=[];complete();
  }
  dispose(): void {this.finish();this.abort.abort();this.root.remove();}
}

export function interactionShots(x:number,y:number,z:number,tx:number,ty:number,tz:number,caption:string): CinematicShot[] {
  const dx=tx-x,dz=tz-z,length=Math.hypot(dx,dz)||1,nx=dz/length,nz=-dx/length;
  return [{duration:2.4,eye:[x+nx*3-dx,y+2,z+nz*3-dz],end:[x+nx*2.5-dx*0.5,y+1.8,z+nz*2.5-dz*0.5],target:[(x+tx)/2,(y+ty)/2+1.3,(z+tz)/2],caption,fov:0.72}];
}
