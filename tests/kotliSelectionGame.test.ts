import { afterEach, describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { KabaddiMatch, court } from "../src/minigames/Kabaddi";
import { Game } from "../src/app/Game";
import { newSave, validate } from "../src/save/schema";
import { beginKotliRound, chooseKotliRole, freshKotliSelection, inviteKotliSelection, recordKotliEvent, type KotliSelectionState } from "../src/missions/KotliSelection";
function host(){
  const g=Object.create(Game.prototype) as any;
  g.save=newSave("preet",{x:-12,z:318,yaw:0},[]);g.save.introStage=999;
  let pos=new Vector3(-12,0,318);g.playerPos=()=>pos;g.move=(x:number,z:number)=>{pos=new Vector3(x,0,z);};
  g.crowd={get:(id:string)=>id==="sarpanch"?{pos:new Vector3(-12,0,318)}:id==="ustad"?{pos:new Vector3(-31,0,350)}:undefined};
  g.jhagde={ustad:{pos:new Vector3(-31,0,350)}};
  g.pistol={equipped:false};g.holsterPistol=vi.fn();g.dayNight={hour:12};g.driving=null;g.busRide=null;Object.defineProperty(g,"carrying",{value:false,writable:true});
  g.missions={job:null};g.tiffinRun={batch:null};g.rides={ride:null};g.combat={inFight:false,playerDown:false};g.police={stars:0};
  g.cricket={active:false};g.kabaddi={active:false,start:vi.fn()};g.tractorRace={active:false};g.dogFetch={active:false};g.canalSkipping={active:false};
  g.dialogue=vi.fn(async()=>"no");g.persist=vi.fn();g.reward=vi.fn();g.warm=vi.fn();g.ui={toast:vi.fn()};return g;
}
function deferred(){let resolve!:(value:string)=>void;const promise=new Promise<string>(r=>{resolve=r;});return{promise,resolve};}
function practised():KotliSelectionState{
  let s=beginKotliRound(inviteKotliSelection(freshKotliSelection())!)!.state;
  for(let raid=1;raid<=4;raid++)s=recordKotliEvent(s,{kind:"raid",attemptId:s.attemptId,cup:false,raid,reason:raid===1?"home":"empty",touches:raid===1?1:0}).state;
  return recordKotliEvent(s,{kind:"complete",attemptId:s.attemptId,cup:false,raids:4}).state;
}
const bounds={minX:-700,maxX:700,minZ:-1000,maxZ:1000};
afterEach(()=>vi.useRealTimers());
describe("Kotli selection Game host",()=>{
  it("requires reaching actual Sarpanch and persists invitation only once",async()=>{
    const g=host();g.move(0,0);g.dialogue.mockResolvedValue("yes");await g.talkKotliSarpanch();expect(g.dialogue).not.toHaveBeenCalled();
    g.move(-12,318);await g.talkKotliSarpanch();await g.talkKotliSarpanch();expect(g.save.kotliSelection.stage).toBe("practice");expect(g.persist).toHaveBeenCalledTimes(1);expect(g.reward).not.toHaveBeenCalled();
  });
  it.each(["captain","raider"])("persists %s role choice after earned practice",async(role)=>{
    const g=host();g.save.kotliSelection=practised();g.dialogue.mockResolvedValue(role);await g.talkKotliSarpanch();
    expect(g.save.kotliSelection).toMatchObject({stage:"ready",role,practiceComplete:true});
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);expect(g.save.kotliSelection.role).toBe(role);
    expect(g.reward).not.toHaveBeenCalled();
  });
  it("coach retains original dangal and dispatches selection through admission",async()=>{
    const g=host(),dangal=vi.fn(async()=>{});g.jhagde.interactions=()=>[{id:"ustad",run:dangal}];g.move(-31,350);
    g.dialogue.mockResolvedValueOnce("dangal");await g.talkKotliCoach();expect(dangal).toHaveBeenCalledTimes(1);expect(g.kabaddi.start).not.toHaveBeenCalled();
    g.save.kotliSelection=inviteKotliSelection(freshKotliSelection());g.dialogue.mockResolvedValueOnce("selection").mockResolvedValueOnce("go");await g.talkKotliCoach();expect(g.kabaddi.start).toHaveBeenCalledExactlyOnceWith(false,1);
  });
  it("coach and Sarpanch reject a choice resumed after leaving their actual positions",async()=>{
    for(const who of ["coach","sarpanch"]){
      const g=host(),d=deferred(),dangal=vi.fn(async()=>{});g.jhagde.interactions=()=>[{id:"ustad",run:dangal}];g.dialogue.mockImplementationOnce(()=>d.promise);
      if(who==="coach")g.move(-31,350);
      const pending=who==="coach"?g.talkKotliCoach():g.talkKotliSarpanch();g.move(0,0);d.resolve(who==="coach"?"dangal":"yes");await pending;
      expect(dangal).not.toHaveBeenCalled();expect(g.persist).not.toHaveBeenCalled();expect(g.kabaddi.start).not.toHaveBeenCalled();
    }
  });
  it("starts practice with a persisted attempt before calling the existing match engine",async()=>{
    const g=host();g.save.kotliSelection=inviteKotliSelection(freshKotliSelection());g.move(-31,350);g.dialogue.mockResolvedValue("go");
    g.kabaddi.start.mockImplementation((cup:boolean,attemptId:number)=>{expect(cup).toBe(false);expect(g.save.kotliSelection).toMatchObject({stage:"playing",roundKind:"practice",attemptId});expect(g.persist).toHaveBeenCalledWith("kotli_selection");});
    await g.startKotliRound();expect(g.kabaddi.start).toHaveBeenCalledExactlyOnceWith(false,1);
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);expect(g.save.kotliSelection.stage).toBe("practice");
  });
  it.each(["delivery","tiffin","ride","trial","gang","cricket","kabaddi","tractor","fetch","skip","fight","down","police","night","orchard","cleanup","forest"])("blocks %s before admission",async(kind)=>{
    const g=host();g.save.kotliSelection=inviteKotliSelection(freshKotliSelection());g.move(-31,350);g.dialogue.mockResolvedValue("go");
    if(kind==="delivery")g.missions.job={};if(kind==="tiffin")g.tiffinRun.batch={};if(kind==="ride")g.rides.ride={};if(kind==="trial")g.save.bulletTrial={stage:"preparation"};if(kind==="gang")g.save.flags.crime_active=true;
    if(kind==="cricket")g.cricket.active=true;if(kind==="kabaddi")g.kabaddi.active=true;if(kind==="tractor")g.tractorRace.active=true;if(kind==="fetch")g.dogFetch.active=true;if(kind==="skip")g.canalSkipping.active=true;
    if(kind==="fight")g.combat.inFight=true;if(kind==="down")g.combat.playerDown=true;if(kind==="police")g.police.stars=1;if(kind==="night")g.dayNight.hour=1;
    if(kind==="orchard")g.save.home.orchardRoundStep=1;if(kind==="cleanup")g.save.home.waysideCleanupStep=1;if(kind==="forest")g.save.home.forestWaterStage=1;
    await g.startKotliRound();expect(g.kabaddi.start).not.toHaveBeenCalled();expect(g.persist).not.toHaveBeenCalled();
  });
  it.each(["ride","down","night","stale","moved","orchard"])("rechecks %s during pending Ustad offer",async(kind)=>{
    const g=host(),d=deferred();g.save.kotliSelection=inviteKotliSelection(freshKotliSelection());g.move(-31,350);g.dialogue.mockImplementationOnce(()=>d.promise);const talk=g.startKotliRound();
    if(kind==="ride")g.rides.ride={};if(kind==="down")g.combat.playerDown=true;if(kind==="night")g.dayNight.hour=1;if(kind==="stale")g.save.kotliSelection=freshKotliSelection();if(kind==="moved")g.move(0,0);if(kind==="orchard")g.save.home.orchardRoundStep=1;
    d.resolve("go");await talk;expect(g.kabaddi.start).not.toHaveBeenCalled();expect(g.persist).not.toHaveBeenCalled();
  });
  it("routes actual kabaddi touch/return events through Game persistence and validates earned practice",async()=>{
    vi.useFakeTimers();const g=host(),c=court();
    g.save.kotliSelection=beginKotliRound(inviteKotliSelection(freshKotliSelection())!)!.state;
    const engineHost:any={crowd:{spawn:(def:any)=>({...def,pos:new Vector3(def.x,0,def.z),vel:Vector3.Zero(),anim:{play:vi.fn()}}),remove:vi.fn()},playerPos:g.playerPos,placePlayer:(x:number,z:number)=>g.move(x,z),toast:vi.fn(),chant:vi.fn(),sting:vi.fn(),results:vi.fn(async()=>"ok"),reward:vi.fn(),hud:vi.fn(),setFlag:vi.fn(),persist:vi.fn(),selectionEvent:(event:any)=>g.onKotliEvent(event)};
    const engine=new KabaddiMatch(engineHost);engine.start(false,g.save.kotliSelection.attemptId);
    for(let raid=1;raid<=4;raid++){
      g.move(c.cx+6.5,c.cz-1.7);engine.update(0.05);expect(engine.touch()).toBe(true);g.move(c.cx-0.5,c.cz);engine.update(0.05);
      expect(g.save.kotliSelection.lastRaid).toBe(raid);expect(g.save.kotliSelection.practiceComplete).toBe(true);
      await vi.advanceTimersByTimeAsync(3300);
    }
    expect(g.save.kotliSelection.stage).toBe("choose");expect(g.persist).toHaveBeenCalledTimes(5);
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);expect(g.save.kotliSelection).toMatchObject({stage:"choose",practiceComplete:true});
    expect(g.reward).not.toHaveBeenCalled();
  });
  it("rejects duplicate and stale host events, and interrupts to a safe saved checkpoint",()=>{
    const g=host();g.save.kotliSelection=beginKotliRound(chooseKotliRole(practised(),"raider")!)!.state;const attemptId=g.save.kotliSelection.attemptId;
    const event={kind:"raid",attemptId,cup:false,raid:1,reason:"home",touches:2};g.onKotliEvent(event);g.onKotliEvent(event);g.onKotliEvent({...event,attemptId:attemptId-1});
    expect(g.persist).toHaveBeenCalledTimes(1);
    g.onKotliEvent({kind:"interrupted",attemptId,cup:false});expect(g.save.kotliSelection).toMatchObject({stage:"ready",bestTouches:0,scoringRaids:0,role:"raider"});
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);g.onKotliEvent(event);expect(g.persist).toHaveBeenCalledTimes(2);expect(g.reward).not.toHaveBeenCalled();
  });
  it("turns in earned selection once, saving role, relationship and receipt before dialogue",async()=>{
    const g=host();let s=beginKotliRound(chooseKotliRole(practised(),"captain")!)!.state;
    for(let raid=1;raid<=4;raid++)s=recordKotliEvent(s,{kind:"raid",attemptId:s.attemptId,cup:false,raid,reason:raid<=3?"home":"empty",touches:raid<=3?1:0}).state;
    g.save.kotliSelection=recordKotliEvent(s,{kind:"complete",attemptId:s.attemptId,cup:false,raids:4}).state;
    const d=deferred();g.dialogue.mockImplementationOnce(()=>d.promise);const talk=g.talkKotliSarpanch();
    expect(g.save.kotliSelection).toMatchObject({stage:"done",role:"captain",receipt:true});expect(g.reward).toHaveBeenCalledExactlyOnceWith(150,8,"other");expect(g.warm).toHaveBeenCalledExactlyOnceWith("sarpanch",3);expect(g.persist).toHaveBeenCalledWith("kotli_selection");
    await g.talkKotliSarpanch();d.resolve("ok");await talk;
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);await g.talkKotliSarpanch();expect(g.reward).toHaveBeenCalledTimes(1);expect(g.warm).toHaveBeenCalledTimes(1);
  });
});
