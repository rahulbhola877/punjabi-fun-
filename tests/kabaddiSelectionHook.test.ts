import { afterEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { KabaddiMatch, court } from "../src/minigames/Kabaddi";
function setup() {
  let pos=Vector3.Zero();
  const residents:any[]=[];
  const host:any={crowd:{spawn:(def:any)=>{const r={...def,pos:new Vector3(def.x,0,def.z),vel:Vector3.Zero(),anim:{play:vi.fn()}};residents.push(r);return r;},remove:vi.fn()},playerPos:()=>pos,placePlayer:vi.fn((x:number,z:number)=>{pos=new Vector3(x,0,z);}),toast:vi.fn(),chant:vi.fn(),sting:vi.fn(),results:vi.fn(async()=>"ok"),reward:vi.fn(),hud:vi.fn(),setFlag:vi.fn(),persist:vi.fn(),selectionEvent:vi.fn()};
  const match=new KabaddiMatch(host);
  return {match,host,residents,move:(x:number,z:number)=>{pos=new Vector3(x,0,z);}};
}
afterEach(()=>vi.useRealTimers());
describe("kabaddi selection observer and lifecycle",()=>{
  it("emits actual touch-and-return raid once before waits without changing existing points",async()=>{
    vi.useFakeTimers();const {match,host,residents,move}=setup(),c=court();match.start(false,17);
    move(c.cx+6.5,c.cz-1.7);match.update(0.05);expect(match.touch()).toBe(true);
    move(c.cx-0.5,c.cz);match.update(0.05);match.update(0.05);
    expect(host.selectionEvent).toHaveBeenCalledExactlyOnceWith({kind:"raid",attemptId:17,cup:false,raid:1,reason:"home",touches:1});
    expect((match as any).you).toBe(1);expect(residents.length).toBe(8);
    for(let i=0;i<33;i++)match.update(0.1);expect((match as any).raid).toBe(2);expect(host.selectionEvent).toHaveBeenCalledTimes(1);
    match.stop();
  });
  it.each([0,1700,2200])("stop/new match invalidates delayed raid continuation at %d ms",async(delay)=>{
    vi.useFakeTimers();const {match,host,move}=setup(),c=court();match.start(false,1);
    move(c.cx+1,c.cz);match.update(0.05);move(c.cx-1,c.cz);match.update(0.05);
    for(let i=0;i<delay/100;i++)match.update(0.1);match.stop();match.start(false,2);
    const placements=host.placePlayer.mock.calls.length;await vi.advanceTimersByTimeAsync(4000);
    expect((match as any).raid).toBe(1);expect(host.placePlayer.mock.calls.length).toBe(placements);
    expect(host.selectionEvent.mock.calls.filter(([e]:any)=>e.kind==="interrupted")).toEqual([[{kind:"interrupted",attemptId:1,cup:false}]]);
    expect(host.reward).not.toHaveBeenCalled();match.stop();
  });
  it("keeps the 1.8-second opponent delay and 3.3-second next-raid delay in playing time",()=>{
    const {match,host,move}=setup(),c=court();match.start(false,7);
    move(c.cx+1,c.cz);match.update(0.05);move(c.cx-1,c.cz);match.update(0.05);
    host.hud.mockClear();const placements=host.placePlayer.mock.calls.length;
    for(let i=0;i<17;i++)match.update(0.1);
    expect(host.hud).not.toHaveBeenCalled();expect(host.placePlayer).toHaveBeenCalledTimes(placements);
    match.update(0.1);expect(host.hud).toHaveBeenCalledTimes(1);const score=(match as any).them;
    for(let i=0;i<14;i++)match.update(0.1);
    expect(host.hud).toHaveBeenCalledTimes(1);expect((match as any).them).toBe(score);expect((match as any).raid).toBe(1);
    match.update(0.1);expect((match as any).raid).toBe(2);expect(host.placePlayer).toHaveBeenCalledTimes(placements+1);match.stop();
  });
  it.each([1.7,2.2])("pause/focus wall time cannot finish a final raid at %s playing seconds",async(elapsed)=>{
    vi.useFakeTimers();const {match,host,move}=setup(),c=court();match.start(false,9);
    Object.assign(match,{raid:4,you:10});move(c.cx+1,c.cz);match.update(0.05);move(c.cx-1,c.cz);match.update(0.05);
    for(let i=0;i<Math.round(elapsed*10);i++)match.update(0.1);
    const before={score:(match as any).them,hud:host.hud.mock.calls.length,placements:host.placePlayer.mock.calls.length};
    // Game.pause and onFocusLost stop calling Kabaddi.update; timers still run.
    await vi.advanceTimersByTimeAsync(30000);
    expect((match as any).them).toBe(before.score);expect(host.hud).toHaveBeenCalledTimes(before.hud);expect(host.placePlayer).toHaveBeenCalledTimes(before.placements);
    expect(host.results).not.toHaveBeenCalled();expect(host.reward).not.toHaveBeenCalled();expect(host.selectionEvent.mock.calls.filter(([e]:any)=>e.kind==="complete")).toHaveLength(0);
    for(let i=Math.round(elapsed*10);i<33;i++)match.update(0.1);
    await Promise.resolve();expect(host.results).toHaveBeenCalledTimes(1);expect(host.reward).toHaveBeenCalledExactlyOnceWith(200,3);
    expect(host.selectionEvent.mock.calls.filter(([e]:any)=>e.kind==="complete")).toHaveLength(1);
    for(let i=0;i<50;i++)match.update(0.1);expect(host.reward).toHaveBeenCalledTimes(1);expect(host.results).toHaveBeenCalledTimes(1);
  });
  it("preserves ordinary and cup rewards, emits complete once, and ignores old results continuation",async()=>{
    for(const cup of [false,true]){
      const {match,host}=setup();match.start(cup,4);Object.assign(match,{you:10,them:0,raid:cup?5:4});
      let resolve!:(value:string)=>void;host.results.mockImplementationOnce(()=>new Promise<string>(r=>{resolve=r;}));
      const pending=(match as any).finish();
      expect(host.reward).toHaveBeenCalledExactlyOnceWith(cup?1000:200,cup?12:3);
      expect(host.selectionEvent).toHaveBeenCalledExactlyOnceWith({kind:"complete",attemptId:4,cup,raids:cup?5:4});
      if(cup)expect(host.setFlag).toHaveBeenCalledWith("c_kabaddi");else expect(host.setFlag).not.toHaveBeenCalled();
      match.start(false,5);resolve("ok");await pending;expect(host.persist).not.toHaveBeenCalled();match.stop();
    }
  });
  it("keeps old callers working without story callbacks",async()=>{
    const {match,host}=setup();delete host.selectionEvent;match.start(false);Object.assign(match,{you:0,them:1,raid:4});await (match as any).finish();
    expect(host.reward).not.toHaveBeenCalled();expect(host.persist).toHaveBeenCalledWith("kabaddi");
  });
});
