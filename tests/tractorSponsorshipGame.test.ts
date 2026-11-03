import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { newSave, validate } from "../src/save/schema";
import { chooseTractorCommitment, freshTractorSponsorship } from "../src/missions/TractorSponsorship";
import { START_SPOT } from "../src/minigames/TractorRace";

function host() {
  const g = Object.create(Game.prototype) as any;
  g.save = newSave("preet", {x:START_SPOT.x,z:START_SPOT.z,yaw:0}, []);
  g.save.home.kotliSuppliesStep = 4;
  g.save.tractorSponsorship = chooseTractorCommitment(freshTractorSponsorship(), "village");
  let pos = new Vector3(START_SPOT.x,0,START_SPOT.z); g.playerPos=()=>pos; g.move=(x:number,z:number)=>{pos=new Vector3(x,0,z)};
  g.driving=null;g.busRide=null;Object.defineProperty(g,"carrying",{value:false,writable:true});
  g.rides={ride:null};g.missions={job:null};g.tiffinRun={batch:null};g.combat={inFight:false,playerDown:false};g.police={stars:0};
  g.cricket={active:false};g.kabaddi={active:false};g.tractorRace={active:false,start:vi.fn(()=>true)};g.dogFetch={active:false};g.canalSkipping={active:false};
  g.dayNight={hour:12};g.dialogue=vi.fn(async()=>"sponsor");g.persist=vi.fn();g.reward=vi.fn();g.warm=vi.fn();g.ui={toast:vi.fn()};return g;
}
const bounds={minX:-2000,maxX:2000,minZ:-2000,maxZ:2000};
describe("tractor sponsorship Game host",()=>{
  it("starts only after grid acceptance, records the owned result and pays once",async()=>{
    const g=host();g.tractorRace.start.mockReturnValueOnce(false);await g.startTractorAtTrack();expect(g.save.tractorSponsorship.stage).toBe("ready");expect(g.persist).not.toHaveBeenCalled();
    await g.startTractorAtTrack();expect(g.tractorRace.start).toHaveBeenLastCalledWith(1);expect(g.save.tractorSponsorship).toMatchObject({stage:"racing",attemptId:1});
    g.onTractorStoryEvent({kind:"complete",attemptId:2,finished:true,rank:4,elapsed:180});expect(g.save.tractorSponsorship.stage).toBe("racing");
    g.onTractorStoryEvent({kind:"complete",attemptId:1,finished:true,rank:4,elapsed:180});expect(g.save.tractorSponsorship.stage).toBe("report");
    g.save=validate(JSON.parse(JSON.stringify(g.save)),["preet"],bounds);expect(g.save.tractorSponsorship.stage).toBe("report");
    g.dialogue.mockResolvedValue("ok");await g.talkTractorSponsor(()=>true);await g.talkTractorSponsor(()=>true);expect(g.reward).toHaveBeenCalledOnce();expect(g.reward).toHaveBeenCalledWith(100,8,"other");expect(g.save.tractorSponsorship.stage).toBe("done");
  });
  it("rejects a sponsored race while another activity owns the player, and handles interruption",async()=>{
    const g=host();g.rides.ride={};await g.startTractorAtTrack();expect(g.tractorRace.start).not.toHaveBeenCalled();g.rides.ride=null;
    await g.startTractorAtTrack();g.onTractorStoryEvent({kind:"interrupted",attemptId:1});expect(g.save.tractorSponsorship.stage).toBe("ready");g.onTractorStoryEvent({kind:"complete",attemptId:1,finished:true,rank:1,elapsed:120});expect(g.save.tractorSponsorship.stage).toBe("ready");
  });
  it("retains an unrelated user waypoint and targets the active race gate",()=>{
    const g=host();g.tractorRace.nextGate={x:-300,z:-400};const objective=g.currentObjective();expect(objective.target.x).toBe(-300);expect(objective.target.z).toBe(-400);expect(objective.title).toContain("Tractor race");
  });
});
