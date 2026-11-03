import { describe, expect, it } from "vitest";
import { BULLET_TRIAL_POINTS as points, abortBulletTrial, advanceBulletTrial, finishBulletTrial, freshBulletTrial, freshTrialMotion, impactBulletTrial, normalizeBulletTrial, startBulletTrial, type BulletTrialState, type TrialSample } from "../src/missions/BulletTrial";
import { newSave, validate } from "../src/save/schema";
import { ROADS } from "../src/world/region";
import { WORKSHOP_APRON } from "../src/world/layout";
import { buildRoadGraph } from "../src/world/nav";
const vehicle = { id: "bullet_ghar", type: "motorcycle" };
const started = (mode: "steady" | "precision" = "steady"): BulletTrialState => ({ ...startBulletTrial(freshBulletTrial(), mode, vehicle)!, stage: "active" });
const sample = (x: number, z: number, speed = 0): TrialSample => ({ x, z, speed, vehicleId: vehicle.id, vehicleType: vehicle.type });
describe("Gurnam's Bullet trial", () => {
  it("waits on foot for the agreed saved Bullet, supports abort, and validates saved identity", () => {
    const prepared = startBulletTrial(freshBulletTrial(), "precision", vehicle)!;
    expect(prepared.stage).toBe("preparation");
    expect(startBulletTrial(freshBulletTrial(),"steady",{id:"stolen",type:"motorcycle"})).toBeNull();
    const motion = freshTrialMotion();
    expect(advanceBulletTrial(prepared,motion,{...sample(8.5,24),vehicleId:null,vehicleType:null,speed:null},0.1).state).toEqual(prepared);
    expect(advanceBulletTrial(prepared,motion,sample(8.5,24),0.1).state.stage).toBe("active");
    expect(advanceBulletTrial(prepared,motion,{...sample(8.5,24),vehicleId:"other"},0.1).state.stage).toBe("failed");
    expect(abortBulletTrial(prepared)?.stage).toBe("available");
    expect(abortBulletTrial(started())?.checkpoint).toBe(0);
    expect(normalizeBulletTrial(prepared,[vehicle])).toEqual(prepared);
    expect(normalizeBulletTrial(prepared,[]).stage).toBe("failed");
    expect(normalizeBulletTrial(started(),[{...vehicle,type:"auto"}]).stage).toBe("failed");
  });
  it("round-trips actual save validation, remounts at the checkpoint, and preserves legacy progress", () => {
    const saved=newSave("preet",{x:8.5,z:24,yaw:0},[{...vehicle,type:"motorcycle",x:8.5,y:0,z:24,yaw:0,paint:"bullet"}]);
    saved.introStage=999; saved.flags.crime_complete=true; saved.home.fees_paid=4;
    saved.stats.deliveries=7; saved.bests.delivery_tailor=30; saved.money=1234;
    saved.bulletTrial={...started("precision"),checkpoint:3};
    const bounds={minX:-700,maxX:700,minZ:-700,maxZ:700};
    const restored=validate(JSON.parse(JSON.stringify(saved)),["preet"],bounds);
    expect(restored).toMatchObject({introStage:999,money:1234,flags:{crime_complete:true},home:{fees_paid:4},stats:{deliveries:7},bests:{delivery_tailor:30},bulletTrial:{stage:"preparation",checkpoint:3,vehicleId:vehicle.id,vehicleType:vehicle.type}});
    const motion=freshTrialMotion();
    const waiting=advanceBulletTrial(restored.bulletTrial!,motion,{...sample(8.5,24),vehicleId:null,vehicleType:null,speed:null},0.1);
    expect(waiting.changed).toBe(false);
    const mounted=advanceBulletTrial(waiting.state,motion,sample(8.5,24),0.1);
    expect(mounted.state).toMatchObject({stage:"active",checkpoint:3});
    const missing=validate({...saved,vehicles:[]},["preet"],bounds);
    expect(missing.bulletTrial?.stage).toBe("failed");
    const returned=validate({...saved,bulletTrial:{...saved.bulletTrial,stage:"return",checkpoint:points.length}},["preet"],bounds);
    expect(returned.bulletTrial?.stage).toBe("return");
    const finished=finishBulletTrial(returned.bulletTrial!)!;
    const paid=validate({...saved,bulletTrial:finished.state},["preet"],bounds);
    expect(finishBulletTrial(paid.bulletTrial!)).toBeNull();
    const legacy={...saved}; delete legacy.bulletTrial;
    expect(validate(legacy,["preet"],bounds).bulletTrial).toEqual(freshBulletTrial());
  });
  it("uses connected authored roads and the workshop apron", () => {
    const graph = buildRoadGraph();
    const apron = graph.nodes.find(n => n.tag === "apron")!;
    expect(apron).toMatchObject({ x: 8.5, z: 24 });
    expect(apron.x).toBeGreaterThan(WORKSHOP_APRON.x0);
    for (const p of points.slice(0, -1)) {
      expect(ROADS.some(r => ["kotli", "nehar"].includes(r.id) && p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1)).toBe(true);
      expect(graph.path(apron.id, graph.nearest(p.x, p.z)).length).toBeGreaterThan(1);
    }
  });
  it("requires checkpoints in order and different approach actions for each choice", () => {
    const m = freshTrialMotion();
    expect(advanceBulletTrial(started(), m, sample(100,150), 0.1).changed).toBe(false);
    for (const mode of ["steady", "precision"] as const) {
      const s = { ...started(mode), checkpoint: 1 };
      const motion = freshTrialMotion();
      const result = advanceBulletTrial(s, motion, sample(0,136,3),0.1);
      expect(result.changed).toBe(mode === "steady");
      if (mode === "precision") {
        let next = s;
        for (let i=0;i<10;i++) next = advanceBulletTrial(next,motion,sample(0,136),0.1).state;
        expect(next.checkpoint).toBe(2);
      }
    }
  });
  it("requires acceleration before the brake hold, and resets dwell when moving", () => {
    const s = { ...started(), checkpoint: 3 }, m = freshTrialMotion();
    for (let i=0;i<30;i++) expect(advanceBulletTrial(s,m,sample(100,150),0.1).changed).toBe(false);
    Object.assign(m, freshTrialMotion());
    advanceBulletTrial(s,m,sample(40,150,6),0.1);
    // Simulate a continuous ride along the road, rather than teleporting to the stop.
    for(let x=41;x<=100;x++) advanceBulletTrial(s,m,sample(x,150,6),0.1);
    for(let i=0;i<10;i++) advanceBulletTrial(s,m,sample(100,150),0.1);
    advanceBulletTrial(s,m,sample(100,150,1),0.1);
    for(let i=0;i<19;i++) expect(advanceBulletTrial(s,m,sample(100,150),0.1).changed).toBe(false);
    expect(advanceBulletTrial(s,m,sample(100,150),0.1).state.checkpoint).toBe(4);
  });
  it("fails on foot, swapped identity, teleport or hard impact and permits retry", () => {
    for (const change of [{vehicleId:null,speed:null},{vehicleId:"other"},{vehicleType:"auto"}]) {
      const failed = advanceBulletTrial(started(),freshTrialMotion(),{...sample(0,80),...change},0.1).state;
      expect(failed.stage).toBe("failed");
      expect(startBulletTrial(failed,"precision",vehicle)?.checkpoint).toBe(0);
    }
    const m=freshTrialMotion(), s=started();
    advanceBulletTrial(s,m,sample(0,10),0.1);
    expect(advanceBulletTrial(s,m,sample(0,80),0.1).state.stage).toBe("failed");
    expect(impactBulletTrial(s,null,10).changed).toBe(false);
    expect(impactBulletTrial(s,vehicle.id,4).changed).toBe(false);
    expect(impactBulletTrial(s,vehicle.id,5).state.stage).toBe("failed");
  });
  it("resumes exact completed checkpoints and identity without granting stale action evidence", () => {
    const s=normalizeBulletTrial(JSON.parse(JSON.stringify({...started("precision"),checkpoint:3})));
    expect(s).toMatchObject({stage:"preparation",checkpoint:3,vehicleId:vehicle.id,mode:"precision"});
    expect(advanceBulletTrial(s,freshTrialMotion(),{...sample(100,150),vehicleId:null,vehicleType:null,speed:null},0.1).state).toEqual(s);
    const mounted=advanceBulletTrial(s,freshTrialMotion(),sample(100,150),0.1).state;
    expect(mounted).toMatchObject({stage:"active",checkpoint:3});
    const m=freshTrialMotion();
    for(let i=0;i<30;i++) expect(advanceBulletTrial(mounted,m,sample(100,150),0.1).changed).toBe(false);
    expect(normalizeBulletTrial({...started(),stage:"return",checkpoint:points.length},[vehicle]).stage).toBe("return");
    expect(normalizeBulletTrial(undefined)).toEqual(freshBulletTrial());
    expect(normalizeBulletTrial({version:1,stage:"return",vehicleId:vehicle.id,vehicleType:vehicle.type,checkpoint:1}).stage).toBe("failed");
    expect(normalizeBulletTrial({...started(),stage:"preparation",checkpoint:points.length},[vehicle]).stage).toBe("failed");
  });
  it("completes the full ordered route, with one atomic reward receipt", () => {
    for(const mode of ["steady","precision"] as const) {
      let s:BulletTrialState=started(mode); const m=freshTrialMotion(); let x=8.5,z=24;
      for(const p of points) {
        const dx=p.x-x,dz=p.z-z,steps=Math.ceil(Math.hypot(dx,dz));
        for(let n=1;n<=steps;n++) s=advanceBulletTrial(s,m,sample(x+dx*n/steps,z+dz*n/steps,6),0.1).state;
        x=p.x;z=p.z;
        for(let n=0;n<21;n++) s=advanceBulletTrial(s,m,sample(x,z),0.1).state;
      }
      expect(s.stage).toBe("return");
      const finish=finishBulletTrial(s)!;
      expect(finish.reward.money).toBe(mode === "precision" ? 300 : 180);
      expect(finishBulletTrial(normalizeBulletTrial(JSON.parse(JSON.stringify(finish.state))))).toBeNull();
      expect(startBulletTrial(finish.state,mode,vehicle)).toBeNull();
    }
  });
});
