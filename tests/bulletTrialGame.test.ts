import { describe, expect, it, vi } from "vitest";
import { Game } from "../src/app/Game";
import { newSave, validate } from "../src/save/schema";
import { BULLET_TRIAL_POINTS, advanceBulletTrial, freshTrialMotion } from "../src/missions/BulletTrial";
function host() {
  const g=Object.create(Game.prototype) as any;
  g.save=newSave("preet",{x:8.5,z:24,yaw:0},[{id:"bullet_ghar",type:"motorcycle",x:8.5,y:0,z:24,yaw:0,paint:"bullet"}]);
  g.save.introStage=999;
  g.vehicles=[{id:"bullet_ghar",spec:{type:"motorcycle"}}]; g.driving=null;
  g.missions={job:null}; g.tiffinRun={batch:null,objective:()=>null}; g.rides={ride:null};
  g.combat={inFight:false,playerDown:false}; g.cricket={active:false};g.kabaddi={active:false};
  g.tractorRace={active:false};g.canalSkipping={active:false};g.dogFetch={active:false};
  g.police={stars:0};g.busRide=null;
  g.dialogue=vi.fn(async()=>"leave");g.persist=vi.fn();g.reward=vi.fn();g.ui={toast:vi.fn()};
  return g;
}
function deferred(){let resolve!:(value:string)=>void;const promise=new Promise<string>(r=>{resolve=r;});return{promise,resolve};}
describe("Bullet trial Game host",()=>{
  it("offers on foot and binds the exact owned motorcycle in preparation",async()=>{
    const g=host();g.dialogue.mockResolvedValueOnce("trial").mockResolvedValueOnce("precision");
    await g.talkGurnam();
    expect(g.dialogue.mock.calls[0][2]).toContainEqual(expect.objectContaining({value:"trial"}));
    expect(g.save.bulletTrial).toMatchObject({stage:"preparation",vehicleId:"bullet_ghar",vehicleType:"motorcycle",mode:"precision"});
    expect(g.persist).toHaveBeenCalledWith("bullet_trial");expect(g.trialOccupied()).toBe(true);
    const m=freshTrialMotion(),s=g.save.bulletTrial;
    expect(advanceBulletTrial(s,m,{x:8.5,z:24,speed:null,vehicleId:null,vehicleType:null},0.1).state).toEqual(s);
    expect(advanceBulletTrial(s,m,{x:8.5,z:24,speed:0,vehicleId:"bullet_ghar",vehicleType:"motorcycle"},0.1).state.stage).toBe("active");
  });
  it.each(["delivery","tiffin","ride","gang","cricket","kabaddi","fight","down","tractor","skipping"])("blocks %s conflict before offer",async(kind)=>{
    const g=host();g.dialogue.mockResolvedValue("steady");
    if(kind==="delivery")g.missions.job={};if(kind==="tiffin")g.tiffinRun.batch={};if(kind==="ride")g.rides.ride={};
    if(kind==="gang")g.save.flags.crime_active=true;if(kind==="cricket")g.cricket.active=true;if(kind==="kabaddi")g.kabaddi.active=true;if(kind==="fight")g.combat.inFight=true;
    if(kind==="down")g.combat.playerDown=true;if(kind==="tractor")g.tractorRace.active=true;if(kind==="skipping")g.canalSkipping.active=true;
    await g.offerBulletTrial();expect(g.save.bulletTrial).toBeUndefined();expect(g.persist).not.toHaveBeenCalled();
  });
  it("rechecks a ride accepted or bike removed while dialogue is pending",async()=>{
    for(const race of ["ride","bike","down","tractor","skipping"]){const g=host(),d=deferred();g.dialogue.mockImplementationOnce(()=>d.promise);const pending=g.offerBulletTrial();
      if(race==="ride")g.rides.ride={};if(race==="bike")g.vehicles=[];if(race==="down")g.combat.playerDown=true;if(race==="tractor")g.tractorRace.active=true;if(race==="skipping")g.canalSkipping.active=true;
      d.resolve("steady");await pending;expect(g.save.bulletTrial).toBeUndefined();expect(g.persist).not.toHaveBeenCalled();}
  });
  it("rejects absent or wrong owned bike rather than binding another motorcycle",async()=>{
    for(const vehicles of [[],[{id:"other",spec:{type:"motorcycle"}}],[{id:"bullet_ghar",spec:{type:"auto"}}]]){
      const g=host();g.vehicles=vehicles;await g.offerBulletTrial();expect(g.dialogue).not.toHaveBeenCalled();expect(g.persist).not.toHaveBeenCalled();}
  });
  it("aborts through Gurnam without payment and permits another offer",async()=>{
    const g=host();g.dialogue.mockResolvedValueOnce("steady");await g.offerBulletTrial();
    g.dialogue.mockResolvedValueOnce("end_trial");await g.talkGurnam();
    expect(g.save.bulletTrial.stage).toBe("available");expect(g.trialOccupied()).toBe(false);expect(g.reward).not.toHaveBeenCalled();
    g.dialogue.mockResolvedValueOnce("precision");await g.offerBulletTrial();expect(g.save.bulletTrial.mode).toBe("precision");
  });
  it("preserves checkpoint through schema reload and commits turn-in receipt before awaiting dialogue",async()=>{
    const g=host();g.dialogue.mockResolvedValueOnce("precision");await g.offerBulletTrial();
    g.save.bulletTrial={...g.save.bulletTrial,stage:"active",checkpoint:3};
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],{minX:-700,maxX:700,minZ:-700,maxZ:700});
    expect(g.save.bulletTrial).toMatchObject({stage:"preparation",checkpoint:3});
    g.save.bulletTrial={...g.save.bulletTrial,stage:"return",checkpoint:BULLET_TRIAL_POINTS.length};
    const d=deferred();g.dialogue.mockImplementationOnce(()=>d.promise);g.persist.mockClear();
    const first=g.talkGurnam();expect(g.save.bulletTrial.receipt).toBe(true);expect(g.persist).toHaveBeenCalledWith("bullet_trial");
    expect(g.reward).toHaveBeenCalledWith(300,8,"other");
    await g.talkGurnam();d.resolve("ok");await first;
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],{minX:-700,maxX:700,minZ:-700,maxZ:700});
    await g.talkGurnam();expect(g.reward).toHaveBeenCalledTimes(1);expect(g.trialOccupied()).toBe(false);
  });
});
