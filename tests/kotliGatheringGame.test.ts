import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { newSave, validate } from "../src/save/schema";
import { freshKotliSelection } from "../src/missions/KotliSelection";
import { freshTractorSponsorship } from "../src/missions/TractorSponsorship";
import { KOTLI_NOTICE } from "../src/missions/KotliGathering";
const bounds={minX:-2000,maxX:2000,minZ:-2000,maxZ:2000};
function host(){
 const g=Object.create(Game.prototype) as any;
 g.save=newSave("preet",{x:-12,z:318,yaw:0},[]);g.save.introStage=999;g.save.home.punjabStory=3;g.save.home.kotliSuppliesStep=4;
 g.save.kotliSelection={...freshKotliSelection(),stage:"done",receipt:true};
 g.save.tractorSponsorship={...freshTractorSponsorship(),stage:"done",choice:"village",attemptId:1,outcome:{finished:true,rank:4,elapsed:180},receipt:true};
 let pos=new Vector3(-12,0,318);g.playerPos=()=>pos;g.move=(x:number,z:number)=>{pos=new Vector3(x,0,z)};
 g.crowd={get:(id:string)=>id==="sarpanch"?{pos:new Vector3(-12,0,318)}:undefined};g.jhagde={ustad:{pos:new Vector3(-31,0,350)},interactions:()=>[]};
 g.driving=null;g.busRide=null;Object.defineProperty(g,"carrying",{value:false,writable:true});g.rides={ride:null};g.missions={job:null,stage:999,objective:()=>({title:"Free roam",detail:"",target:null})};g.tiffinRun={batch:null,objective:()=>null};
 g.cricket={active:false};g.kabaddi={active:false};g.tractorRace={active:false,nextGate:null};g.dialogue=vi.fn(async()=>"no");g.persist=vi.fn();g.reward=vi.fn();g.warm=vi.fn();g.ui={toast:vi.fn()};g.player={anim:{play:vi.fn()}};g.kotliNotice={sync:vi.fn()};g.dayNight={hour:12};return g;
}
describe("Kotli notice Game flow",()=>{
 it.each(["team","care"])("completes the %s choice and persists before rewarding only once",async choice=>{
  const g=host();g.dialogue.mockResolvedValueOnce("yes");await g.talkKotliSarpanch();expect(g.currentObjective().title).toContain("Ustad");
  g.move(-31,350);g.dialogue.mockResolvedValueOnce("gathering").mockResolvedValueOnce("yes");await g.talkKotliCoach();expect(g.currentObjective().title).toContain("post");expect(g.currentObjective().target).toMatchObject({x:KOTLI_NOTICE.x,z:KOTLI_NOTICE.z});
  g.move(KOTLI_NOTICE.x,KOTLI_NOTICE.z);g.dialogue.mockResolvedValueOnce(choice);await g.postKotliNotice();expect(g.kotliNotice.sync).toHaveBeenCalledOnce();
  g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);expect(g.save.home.kotliGatherChoice).toBe(choice==="team"?1:2);expect(g.currentObjective().detail).toContain("Sarpanch");
  g.move(-12,318);g.dialogue.mockResolvedValue("ok");await g.talkKotliSarpanch();await g.talkKotliSarpanch();expect(g.reward).toHaveBeenCalledExactlyOnceWith(0,2,"other");expect(g.save.home.kotliGatherStep).toBe(4);
 });
 it("retains dangal while the notice consultation is pending",async()=>{
  const g=host(),dangal=vi.fn();g.save.home.kotliGatherStep=1;g.jhagde.interactions=()=>[{id:"ustad",run:dangal}];g.move(-31,350);g.dialogue.mockResolvedValue("dangal");await g.talkKotliCoach();expect(dangal).toHaveBeenCalledOnce();expect(g.save.home.kotliGatherStep).toBe(1);
 });
 it("rejects the notice if the player leaves during the choice",async()=>{
  const g=host();g.save.home.kotliGatherStep=2;g.move(KOTLI_NOTICE.x,KOTLI_NOTICE.z);let resolve!:(v:string)=>void;g.dialogue.mockImplementationOnce(()=>new Promise<string>(r=>{resolve=r}));const pending=g.postKotliNotice();g.move(0,0);resolve("team");await pending;expect(g.save.home.kotliGatherStep).toBe(2);expect(g.persist).not.toHaveBeenCalled();
 });
 it("routes to the next offer after selection and after the kit",()=>{
  const g=host();g.save.home.kotliSuppliesStep=0;g.save.tractorSponsorship=freshTractorSponsorship();expect(g.currentObjective().detail).toContain("help the team");
  g.save.home.kotliSuppliesStep=4;expect(g.currentObjective().detail).toContain("tractor race");
 });
 it("tracks the current story step without leaving a stale Sarpanch waypoint",async()=>{
  const g=host();g.save.home.kotliGatherStep=2;g.save.home.punjabStory=0;g.waypoint={x:500,z:500,label:"old route"};g.ui.menu=vi.fn(async()=>"kotli");g.setBusy=vi.fn();g.setRoute=vi.fn();
  await g.showPunjabStories();expect(g.save.home.punjabStory).toBe(3);expect(g.waypoint).toBeNull();expect(g.setRoute).not.toHaveBeenCalled();expect(g.currentObjective().target).toMatchObject({x:KOTLI_NOTICE.x,z:KOTLI_NOTICE.z});
 });
});
