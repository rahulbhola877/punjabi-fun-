import { Vector3, type UniversalCamera } from "../babylon";

export interface CinematicShot {
  duration: number;
  eye: readonly [number,number,number];
  end: readonly [number,number,number];
  target: readonly [number,number,number];
  targetEnd?: readonly [number,number,number];
  /** Additional faces/subjects that must remain visible in a conversation. */
  subjects?: ReadonlyArray<readonly[number,number,number]>;
  caption: string;
  fov?: number;
  /** Live focus for selectively staged actors; offsets follow their movement. */
  track?:()=>Vector3;
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
  private focused=true;
  get active(): boolean { return this.complete!==null; }
  get advancing():boolean {return this.active&&this.focused&&!document.hidden;}

  constructor(parent: HTMLElement, private camera: UniversalCamera, private resolveEye?: (target:Vector3,eye:Vector3)=>Vector3) {
    const root=this.root=document.createElement("div"); root.className="cinematic"; root.hidden=true; root.dataset.cinematic="";
    root.setAttribute("role","region"); root.setAttribute("aria-label","In-game cinematic");
    this.caption=document.createElement("div"); this.caption.className="cinematic-caption"; this.caption.setAttribute("aria-live","polite");
    const skip=document.createElement("button"); skip.textContent="Skip · Esc / A"; skip.dataset.cinematicSkip="";
    skip.addEventListener("click",()=>this.finish(),{signal:this.abort.signal}); root.append(this.caption,skip); parent.append(root);
    window.addEventListener("keydown",e=>{
      if(!this.active||!['Escape','Space','Enter'].includes(e.code)) return;
      e.preventDefault(); e.stopImmediatePropagation(); if(!e.repeat) this.finish();
    },{capture:true,signal:this.abort.signal});
    window.addEventListener("blur",()=>{this.focused=false;},{signal:this.abort.signal});
    window.addEventListener("focus",()=>{this.focused=true;},{signal:this.abort.signal});
  }

  play(shots: readonly CinematicShot[]): Promise<void> {
    this.finish();
    if(!shots.length) return Promise.resolve();
    this.saved={eye:this.camera.position.clone(),target:this.camera.getTarget().clone(),fov:this.camera.fov};
    this.shots=shots.map(shot=>this.fitShot(shot)); this.time=0; this.padDown=true; this.root.hidden=false; this.root.dataset.cinematicShot="0";
    return new Promise(resolve=>{this.complete=resolve;this.update(0);});
  }

  update(dt: number): void {
    if(!this.active) return;
    const gp=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected);
    const down=!!(gp?.buttons[0]?.pressed||gp?.buttons[1]?.pressed||gp?.buttons[9]?.pressed);
    if(down&&!this.padDown) {this.finish();return;} this.padDown=down;
    if(this.advancing) this.time+=Math.max(0,Math.min(dt,0.25));
    const state=sampleCinematic(this.shots,this.time);
    if(state.done) {this.finish();return;}
    const shot=this.shots[state.index]!;
    const eye=Vector3.Lerp(Vector3.FromArray(shot.eye),Vector3.FromArray(shot.end),state.t);
    const at=Vector3.Lerp(Vector3.FromArray(shot.target),Vector3.FromArray(shot.targetEnd??shot.target),state.t);
    if(shot.track){const offset=shot.track().subtract(Vector3.FromArray(shot.target));eye.addInPlace(offset);at.addInPlace(offset);}
    this.camera.position.copyFrom(this.resolveEye?.(at,eye)??eye); this.camera.setTarget(at); this.camera.fov=shot.fov??0.78;
    this.caption.textContent=shot.caption; this.root.dataset.cinematicShot=String(state.index);
  }

  private fitShot(shot:CinematicShot):CinematicShot {
    if(!this.resolveEye) return shot;
    const target=Vector3.FromArray(shot.target),targetEnd=Vector3.FromArray(shot.targetEnd??shot.target);
    const rotate=(tuple:readonly[number,number,number],at:Vector3,angle:number):Vector3=>{
      const x=tuple[0]-at.x,z=tuple[2]-at.z,c=Math.cos(angle),s=Math.sin(angle);
      return new Vector3(at.x+x*c-z*s,tuple[1],at.z+x*s+z*c);
    };
    let best=shot,score=-1,bestClear=0;
    for(const angle of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*0.75,-Math.PI*0.75,Math.PI]) {
      const eye=rotate(shot.eye,target,angle),end=rotate(shot.end,targetEnd,angle);
      const subjects=[target,...(shot.subjects??[]).map(p=>Vector3.FromArray(p))];
      const clear=Math.min(...[0,0.25,0.5,0.75,1].flatMap(t=>{
        const position=Vector3.Lerp(eye,end,t),forward=target.subtract(position),right=new Vector3(forward.z,0,-forward.x).normalize().scale(0.18);
        return subjects.flatMap(subject=>[subject,subject.add(right),subject.subtract(right)].map(at=>Vector3.Distance(at,this.resolveEye!(at,position))/Math.max(0.01,Vector3.Distance(at,position))));
      }));
      let separation=1;
      if((shot.subjects?.length??0)>1) {
        const a=shot.subjects![0]!,b=shot.subjects![1]!,dx=a[0]-b[0],dz=a[2]-b[2],vx=target.x-eye.x,vz=target.z-eye.z;
        separation=Math.abs(dx*vz-dz*vx)/Math.max(0.01,Math.hypot(dx,dz)*Math.hypot(vx,vz));
      }
      const composition=clear*(0.2+0.8*separation);
      if(composition>score+0.01) {score=composition;bestClear=clear;best={...shot,eye:[eye.x,eye.y,eye.z],end:[end.x,end.y,end.z]};}
      if(clear>=0.99&&separation>=0.95) break;
    }
    // A pillar between two actors may make every two-shot impossible. Cut to
    // a clear speaker close-up instead of accepting a partly hidden face.
    if((shot.subjects?.length??0)>1&&bestClear<0.98) {
      const face=Vector3.FromArray(shot.subjects!.at(-1)!),offset=Vector3.FromArray(best.eye).subtract(target);offset.y=0;offset.normalize();
      const eye=face.add(offset.scale(2.8));eye.y=face.y+0.22;const end=face.add(offset.scale(2.5));end.y=face.y+0.16;
      return this.fitShot({...shot,eye:[eye.x,eye.y,eye.z],end:[end.x,end.y,end.z],target:[face.x,face.y-0.08,face.z],targetEnd:undefined,subjects:undefined,fov:0.68});
    }
    return best;
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
  const mx=(x+tx)/2,my=(y+ty)/2,mz=(z+tz)/2;
  return [{duration:2.4,eye:[mx+nx*4,my+2.2,mz+nz*4],end:[mx+nx*3.5,my+2,mz+nz*3.5],target:[mx,my+1.3,mz],subjects:[[x,y+1.55,z],[tx,ty+1.55,tz]],caption,fov:0.72}];
}
